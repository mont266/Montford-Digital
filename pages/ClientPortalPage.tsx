import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '../src/components/CheckoutForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface Client {
  id: string;
  name: string;
  email: string;
  portal_token: string;
  password?: string;
}

interface Project {
  id: string;
  name: string;
  recurring_fee?: number;
  recurring_fee_description?: string;
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;
  status?: string;
  preview_url?: string;
}

interface SubscriptionDetails {
  id: string;
  status: string;
  current_period_end: number;
  amount: number;
  interval: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: { name: string } | null;
}

export interface ProjectTodo {
  id: string;
  project_id: string;
  description: string;
  is_completed: boolean;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  description: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  project_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const ClientPortalPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [todos, setTodos] = useState<Record<string, ProjectTodo[]>>({});
  const [milestones, setMilestones] = useState<Record<string, ProjectMilestone[]>>({});
  const [activities, setActivities] = useState<Record<string, ProjectActivity[]>>({});
  const [tickets, setTickets] = useState<Record<string, SupportTicket[]>>({});
  const [subscriptionDetails, setSubscriptionDetails] = useState<Record<string, SubscriptionDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState<string | null>(null);
  const [selectedIntervals, setSelectedIntervals] = useState<Record<string, string>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [isCollectingDetails, setIsCollectingDetails] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleIntervalChange = (projectId: string, interval: string) => {
    setSelectedIntervals(prev => ({ ...prev, [projectId]: interval }));
  };

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Subscription successful! Thank you.');
    } else if (searchParams.get('canceled') === 'true') {
      setError('Subscription process was canceled.');
    }

    const fetchPortalData = async () => {
      if (!token) {
        setError("Invalid portal link.");
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch Client by Token
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, email, portal_token')
          .eq('portal_token', token)
          .single();

        if (clientError || !clientData) {
          throw new Error("Portal not found or invalid token.");
        }
        setClient(clientData as Client);
        setLoginEmail(clientData.email || '');

        // Check if already authenticated in this session
        const sessionAuth = sessionStorage.getItem(`portal_auth_${clientData.id}`);
        if (sessionAuth === 'true') {
          setIsAuthenticated(true);
        }

        // 1.5 Sync all client subscriptions from Stripe (Discovery)
        try {
          await supabase.functions.invoke('stripe', {
            method: 'POST',
            body: {
              action: 'sync-all-client-subscriptions',
              clientId: clientData.id
            }
          });
        } catch (e) {
          console.error('Error discovering subscriptions:', e);
        }

        // 2. Fetch Projects for this Client
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('client_id', clientData.id);

        if (projectsError) throw projectsError;
        const currentProjects = projectsData as Project[];
        setProjects(currentProjects);

        // Fetch subscription details for projects with subscription IDs
        const projectsWithSubs = currentProjects.filter(p => p.stripe_subscription_id);
        const subDetails: Record<string, SubscriptionDetails> = {};
        
        for (const project of projectsWithSubs) {
          try {
            const { data, error } = await supabase.functions.invoke('stripe', {
              method: 'POST',
              body: {
                action: 'sync-subscription',
                subscriptionId: project.stripe_subscription_id,
                projectId: project.id
              }
            });
            if (!error && data) {
              // Fetch full details for UI
              const { data: details } = await supabase.functions.invoke(`stripe?action=subscription&id=${project.stripe_subscription_id || ''}`, {
                method: 'GET'
              });
              if (details) {
                subDetails[project.id] = details;
              }
              
              // If status changed to active, we might need to refresh invoices
              if (data.status === 'active' && project.stripe_subscription_status !== 'active') {
                console.log(`Syncing status for project ${project.id} to active`);
                // Update local state
                setProjects(prev => prev.map(p => p.id === project.id ? { ...p, stripe_subscription_status: 'active' } : p));
                
                // Refresh invoices list
                const { data: newInvoices } = await supabase
                  .from('invoices')
                  .select('*, projects(name)')
                  .eq('project_id', project.id)
                  .neq('status', 'draft')
                  .order('issue_date', { ascending: false });
                
                if (newInvoices) {
                  setInvoices(prev => {
                    const filtered = prev.filter(i => i.project_id !== project.id);
                    return [...filtered, ...newInvoices].sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error fetching subscription details:', e);
          }
        }
        setSubscriptionDetails(subDetails);

        // 3. Fetch Invoices for these Projects
        if (projectsData && projectsData.length > 0) {
          const projectIds = projectsData.map(p => p.id);
          const { data: invoicesData, error: invoicesError } = await supabase
            .from('invoices')
            .select('*, projects(name)')
            .in('project_id', projectIds)
            .neq('status', 'draft') // Hide drafts from clients
            .order('issue_date', { ascending: false });

          if (invoicesError) throw invoicesError;
          setInvoices(invoicesData as Invoice[]);

          // 4. Fetch Todos
          const { data: todosData, error: todosError } = await supabase
            .from('project_todos')
            .select('*')
            .in('project_id', projectIds)
            .order('created_at', { ascending: true });

          if (todosError) {
             console.log("Todos table might not exist yet ->", todosError);
          } else if (todosData) {
            const todosMap: Record<string, ProjectTodo[]> = {};
            todosData.forEach(t => {
               if (!todosMap[t.project_id]) todosMap[t.project_id] = [];
               todosMap[t.project_id].push(t as ProjectTodo);
            });
            setTodos(todosMap);
          }

          // 5. Fetch Milestones, Activities, Tickets
          const [
            { data: milestonesData, error: milestonesError },
            { data: activitiesData, error: activitiesError },
            { data: ticketsData, error: ticketsError }
          ] = await Promise.all([
            supabase.from('project_milestones').select('*').in('project_id', projectIds).order('created_at', { ascending: true }),
            supabase.from('project_activities').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
            supabase.from('support_tickets').select('*').in('project_id', projectIds).order('created_at', { ascending: false })
          ]);

          if (milestonesData) {
            const map: Record<string, ProjectMilestone[]> = {};
            milestonesData.forEach(m => { if(!map[m.project_id]) map[m.project_id]=[]; map[m.project_id].push(m); });
            setMilestones(map);
          }
          if (activitiesData) {
            const map: Record<string, ProjectActivity[]> = {};
            activitiesData.forEach(a => { if(!map[a.project_id]) map[a.project_id]=[]; map[a.project_id].push(a); });
            setActivities(map);
          }
          if (ticketsData) {
            const map: Record<string, SupportTicket[]> = {};
            ticketsData.forEach(t => { if(!map[t.project_id]) map[t.project_id]=[]; map[t.project_id].push(t); });
            setTickets(map);
          }
        }

      } catch (err: any) {
        console.error("Error fetching portal data:", err);
        setError(err.message || "An error occurred while loading your portal.");
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'verify-client-password',
          clientId: client.id,
          password: portalPassword,
          email: loginEmail
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Invalid password');
      }

      setIsAuthenticated(true);
      sessionStorage.setItem(`portal_auth_${client.id}`, 'true');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (portalPassword !== confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    if (portalPassword.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'set-client-password',
          clientId: client.id,
          password: portalPassword
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to set password');
      }

      setIsAuthenticated(true);
      sessionStorage.setItem(`portal_auth_${client.id}`, 'true');
      // Update local client state to reflect password is set
      setClient({ ...client, password: 'set' });
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white p-4">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const isFirstTime = !client.password;
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white p-4">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isFirstTime ? 'Secure Your Portal' : 'Client Login'}
            </h2>
            <div className="text-slate-400 space-y-2">
              {isFirstTime ? (
                <>
                  <p className="text-lg text-slate-300">Welcome, <strong>{client.email}</strong></p>
                  <p>Please set a secure password to create your account. This will give you access to your personal client portal where you can view your ongoing projects, access deliverables, and manage your invoices.</p>
                </>
              ) : (
                <p>Welcome back, {client.name}. Please enter your password.</p>
              )}
            </div>
          </div>

          <form onSubmit={isFirstTime ? handleSetPassword : handleLogin} className="space-y-4">
            {!isFirstTime && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {isFirstTime ? 'Create Password' : 'Password'}
              </label>
              <input
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                required
                minLength={6}
              />
            </div>
            {isFirstTime && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                  minLength={6}
                />
              </div>
            )}

            {authError && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-3 rounded text-sm">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-all disabled:opacity-50"
            >
              {isAuthLoading ? 'Processing...' : (isFirstTime ? 'Set Password & Enter' : 'Login')}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-xs text-slate-500">
              This portal is private and secure. If you've forgotten your password, please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubscribeInitiate = (project: Project) => {
    setActiveSubscriptionId(project.id);
    // If it's a resubscription (canceled status), don't pre-fill to force re-entry of details
    if (project.stripe_subscription_status === 'canceled') {
      setBillingName('');
      setBillingEmail('');
    } else {
      setBillingName(client?.name || '');
      setBillingEmail(client?.email || '');
    }
    setIsCollectingDetails(true);
    setClientSecret(null);
  };

  const handleSubscribe = async (project: Project) => {
    if (!billingName || !billingEmail) {
      alert('Please provide both name and email for billing.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'create-subscription',
          projectId: project.id,
          amount: project.recurring_fee,
          projectName: project.name,
          clientName: billingName,
          clientEmail: billingEmail,
          interval: selectedIntervals[project.id] || 'month',
        },
      });

      if (error) {
        throw new Error(error.message || 'Server error');
      }

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsCollectingDetails(false);
        
        // Update database with subscription ID immediately
        if (data.subscriptionId) {
          await supabase
            .from('projects')
            .update({ 
              stripe_subscription_id: data.subscriptionId,
              stripe_subscription_status: 'incomplete'
            })
            .eq('id', project.id);
          
          // Update local state too
          setProjects(prev => prev.map(p => p.id === project.id ? { 
            ...p, 
            stripe_subscription_id: data.subscriptionId,
            stripe_subscription_status: 'incomplete'
          } : p));
        }
      } else {
        throw new Error(data?.error || 'Failed to create subscription: No client secret returned');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      alert(err.message || 'Failed to initiate subscription.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    setSuccessMessage('Subscription successful! Thank you.');
    setClientSecret(null);
    setActiveSubscriptionId(null);
    // Refresh data
    window.location.reload();
  };

  const handleCancelSubscription = async (project: Project) => {
    if (!project.stripe_subscription_id) return;
    
    if (!window.confirm('Are you sure you want to cancel this subscription? This action cannot be undone.')) {
      return;
    }

    setIsCanceling(project.id);
    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'cancel-subscription',
          subscriptionId: project.stripe_subscription_id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Server error');
      }

      if (data?.success) {
        // Update local state
        setProjects(projects.map(p => p.id === project.id ? { ...p, stripe_subscription_status: 'canceled' } : p));
        setSuccessMessage('Subscription canceled successfully.');
        
        // Update database
        await supabase
          .from('projects')
          .update({ stripe_subscription_status: 'canceled' })
          .eq('id', project.id);
      } else {
        throw new Error(data?.error || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      console.error('Cancellation error:', err);
      alert(err.message || 'Failed to cancel subscription.');
    } finally {
      setIsCanceling(null);
    }
  };

  const [newTicketSubjects, setNewTicketSubjects] = useState<Record<string, string>>({});
  const [newTicketMessages, setNewTicketMessages] = useState<Record<string, string>>({});
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<string | null>(null);

  const handleCreateTicket = async (projectId: string) => {
    const subject = newTicketSubjects[projectId];
    const message = newTicketMessages[projectId];
    if (!subject?.trim() || !message?.trim()) return;

    setIsSubmittingTicket(projectId);
    try {
      const { error } = await supabase.from('support_tickets').insert([{
        project_id: projectId,
        subject: subject.trim(),
        message: message.trim()
      }]);
      if (error) throw error;
      
      setSuccessMessage('Support ticket submitted successfully.');
      setNewTicketSubjects(prev => ({ ...prev, [projectId]: '' }));
      setNewTicketMessages(prev => ({ ...prev, [projectId]: '' }));
      
      // Refresh tickets
      const { data } = await supabase.from('support_tickets').select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
      if (data) {
        const map: Record<string, SupportTicket[]> = {};
        data.forEach((t: any) => { if(!map[t.project_id]) map[t.project_id]=[]; map[t.project_id].push(t); });
        setTickets(map);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to submit ticket.');
    } finally {
      setIsSubmittingTicket(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!client?.email) return;
    
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'create-portal-session',
          clientEmail: client.email,
          returnUrl: window.location.href,
        },
      });

      if (error) throw new Error(error.message || 'Server error');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'Failed to create portal session');
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      alert(err.message || 'Failed to open billing portal.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800 p-5 md:p-6 rounded-xl border border-slate-700 shadow-lg gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">Welcome, {client.name}</h1>
            <p className="text-slate-400 text-sm md:text-base">Client Portal</p>
          </div>
          <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-3">
            <div className="flex justify-between sm:justify-end items-center w-full sm:w-auto gap-4">
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Total Outstanding</p>
                <p className="text-xl md:text-2xl font-bold text-cyan-400 leading-none">{formatCurrency(totalOutstanding)}</p>
              </div>
              <button 
                onClick={() => {
                  sessionStorage.removeItem(`portal_auth_${client.id}`);
                  setIsAuthenticated(false);
                }}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white rounded-md border border-slate-600 transition-colors"
              >
                Logout
              </button>
            </div>
            {projects.some(p => p.stripe_subscription_id) && (
              <button
                onClick={handleManageSubscription}
                disabled={isOpeningPortal}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 border border-slate-600 shadow-sm"
              >
                {isOpeningPortal ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
                Manage Billing
              </button>
            )}
          </div>
        </header>

        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/30 text-green-300 p-4 rounded-lg flex justify-between items-center">
            <p>{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="text-green-300 hover:text-white">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Projects & Recurring */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Your Projects</h2>
              {projects.length === 0 ? (
                <p className="text-slate-400 text-sm">No active projects found.</p>
              ) : (
                <div className="space-y-4">
                  {projects.map(project => (
                    <div key={project.id} className="p-4 bg-slate-900/50 rounded-md border border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white">{project.name}</h3>
                        {project.status && (
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            project.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            project.status === 'Ready for review' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            project.status === 'Cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {project.status}
                          </span>
                        )}
                      </div>

                      {project.preview_url && (
                        <div className="mb-3">
                          <a 
                            href={project.preview_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-400/10 px-3 py-1.5 rounded-md border border-cyan-400/20 group"
                          >
                            <span>View your project</span>
                            <svg className="w-3 h-3 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        </div>
                      )}

                      {todos[project.id] && todos[project.id].length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Project To-Do List</h4>
                          <ul className="space-y-1.5 pl-1">
                            {todos[project.id].map(todo => (
                              <li key={todo.id} className="flex items-start space-x-2 text-sm">
                                <div className="mt-0.5">
                                  {todo.is_completed ? (
                                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <div className="w-4 h-4 rounded border border-slate-600 bg-slate-800/50"></div>
                                  )}
                                </div>
                                <span className={todo.is_completed ? 'line-through text-slate-500' : 'text-slate-300'}>
                                  {todo.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {milestones[project.id] && milestones[project.id].length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Milestones</h4>
                          <div className="space-y-3 pl-1">
                            {milestones[project.id].map(m => (
                               <div key={m.id} className="text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-200">{m.title}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${m.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900' : m.status === 'in_progress' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-900' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{m.status.replace('_', ' ')}</span>
                                  </div>
                                  {m.description && <p className="text-slate-400 text-xs mt-1">{m.description}</p>}
                               </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activities[project.id] && activities[project.id].length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Activity Log</h4>
                          <div className="space-y-2 pl-1 max-h-40 overflow-y-auto pr-2">
                            {activities[project.id].map(a => (
                               <div key={a.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex justify-between items-start gap-4">
                                  <span className="text-sm text-slate-300">{a.description}</span>
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap mt-0.5">{new Date(a.created_at).toLocaleDateString()}</span>
                               </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-700/50">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">Support & Requests</h4>
                        
                        {tickets[project.id] && tickets[project.id].length > 0 && (
                          <div className="space-y-3 mb-4">
                            {tickets[project.id].map(t => (
                              <div key={t.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-bold text-sm text-slate-200">{t.subject}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${t.status === 'resolved' ? 'bg-emerald-900/40 text-emerald-400' : t.status === 'in_progress' ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-600'}`}>{t.status.replace('_', ' ')}</span>
                                </div>
                                <p className="text-xs text-slate-400">{t.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleCreateTicket(project.id); }} className="space-y-2 bg-slate-900/30 p-3 flex flex-col rounded-lg border border-slate-800">
                          <p className="text-xs text-slate-400 mb-1">Need help or want to request a change?</p>
                          <input type="text" placeholder="Subject" value={newTicketSubjects[project.id] || ''} onChange={e => setNewTicketSubjects(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500" required />
                          <textarea placeholder="Message..." value={newTicketMessages[project.id] || ''} onChange={e => setNewTicketMessages(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 min-h-[80px]" required />
                          <button type="submit" disabled={isSubmittingTicket === project.id} className="self-end px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded disabled:opacity-50 transition-colors">
                            {isSubmittingTicket === project.id ? 'Submitting...' : 'Submit Request'}
                          </button>
                        </form>
                      </div>

                      {project.recurring_fee && project.recurring_fee > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-col gap-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">{project.recurring_fee_description || 'Recurring Fee'}</span>
                            <span className="font-medium text-cyan-400">
                              {project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] 
                                ? `${formatCurrency(subscriptionDetails[project.id].amount)}/${subscriptionDetails[project.id].interval === 'year' ? 'yr' : 'mo'}`
                                : `${formatCurrency((selectedIntervals[project.id] === 'year' ? 12 : 1) * project.recurring_fee)}/${selectedIntervals[project.id] === 'year' ? 'yr' : 'mo'}`
                              }
                            </span>
                          </div>
                          
                          {project.stripe_subscription_status === 'active' ? (
                            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                                <span className="text-green-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 bg-green-400/10 px-2 py-1 rounded border border-green-400/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Active
                                </span>
                                {subscriptionDetails[project.id] && (
                                  <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                                    Next: {new Date(subscriptionDetails[project.id].current_period_end * 1000).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleCancelSubscription(project)}
                                disabled={isCanceling === project.id}
                                className="w-full py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isCanceling === project.id ? 'Canceling...' : 'Cancel Subscription'}
                              </button>
                            </div>
                          ) : project.stripe_subscription_status === 'canceled' ? (
                            <div className="flex flex-col gap-3 bg-slate-800 p-3 rounded-lg border border-slate-700">
                              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold italic text-center">Subscription canceled</span>
                              <button
                                onClick={() => handleSubscribeInitiate(project)}
                                disabled={isProcessingPayment}
                                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-cyan-900/20"
                              >
                                {isProcessingPayment ? '...' : 'Resubscribe'}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2">
                              {clientSecret && activeSubscriptionId === project.id ? (
                                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mt-4">
                                  <p className="text-sm text-slate-400 mb-2 text-center">Please complete the payment in the modal.</p>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Billing Cycle:</label>
                                    <select
                                      value={selectedIntervals[project.id] || 'month'}
                                      onChange={(e) => handleIntervalChange(project.id, e.target.value)}
                                      className="flex-grow bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-2 focus:outline-none focus:border-cyan-500"
                                    >
                                      <option value="month">Monthly</option>
                                      <option value="year">Yearly</option>
                                    </select>
                                  </div>
                                  <button
                                    onClick={() => handleSubscribeInitiate(project)}
                                    disabled={isProcessingPayment}
                                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-cyan-900/20"
                                  >
                                    {isProcessingPayment ? 'Processing...' : 'Set up Subscription'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Invoices */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 md:p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6">Invoices</h2>
              {invoices.length === 0 ? (
                <p className="text-slate-400 text-sm italic">No invoices found.</p>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {invoices.map(invoice => (
                      <div key={invoice.id} className="bg-slate-900/50 rounded-lg border border-slate-700 p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Invoice</p>
                            <p className="text-white font-bold">{invoice.invoice_number}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            invoice.status === 'paid' ? 'bg-green-900/30 text-green-400 border-green-800/50' :
                            invoice.status === 'overdue' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                            'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                          }`}>
                            {invoice.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Project</p>
                            <p className="text-slate-300 text-sm truncate">{invoice.projects?.name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Date</p>
                            <p className="text-slate-300 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-700/50">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Amount</p>
                            <p className="text-cyan-400 font-bold">{formatCurrency(invoice.amount)}</p>
                          </div>
                          <a 
                            href={`/#/invoice/${invoice.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                          <th className="pb-4 font-bold">Invoice</th>
                          <th className="pb-4 font-bold">Project</th>
                          <th className="pb-4 font-bold">Date</th>
                          <th className="pb-4 font-bold">Amount</th>
                          <th className="pb-4 font-bold">Status</th>
                          <th className="pb-4 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map(invoice => (
                          <tr key={invoice.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors group">
                            <td className="py-4 text-white font-bold">{invoice.invoice_number}</td>
                            <td className="py-4 text-slate-400 text-sm">{invoice.projects?.name || 'N/A'}</td>
                            <td className="py-4 text-slate-400 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                            <td className="py-4 text-white font-bold">{formatCurrency(invoice.amount)}</td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                invoice.status === 'paid' ? 'bg-green-900/30 text-green-400 border-green-800/50' :
                                invoice.status === 'overdue' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                                'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <a 
                                href={`/#/invoice/${invoice.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block px-4 py-1.5 bg-slate-700 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-all border border-slate-600 hover:border-cyan-500"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Subscription Payment Modal */}
      {(clientSecret || isCollectingDetails) && activeSubscriptionId && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => { setClientSecret(null); setActiveSubscriptionId(null); setIsCollectingDetails(false); }}>
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-800 pb-2 z-10">
              <h3 className="text-xl font-bold text-white">{isCollectingDetails ? 'Billing Details' : 'Set up Subscription'}</h3>
              <button onClick={() => { setClientSecret(null); setActiveSubscriptionId(null); setIsCollectingDetails(false); }} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {(() => {
              const activeProject = projects.find(p => p.id === activeSubscriptionId);
              if (!activeProject || !activeProject.recurring_fee) return null;
              const interval = selectedIntervals[activeProject.id] || 'month';
              const amount = (interval === 'year' ? 12 : 1) * activeProject.recurring_fee;
              return (
                <div className="mb-6 p-4 bg-slate-900/50 rounded-md border border-slate-700">
                  <p className="text-sm text-slate-400 mb-1">You will be billed:</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {formatCurrency(amount)} <span className="text-sm font-normal text-slate-400">/{interval === 'year' ? 'yr' : 'mo'}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    For {activeProject.name} - {activeProject.recurring_fee_description || 'Recurring Fee'}
                  </p>
                </div>
              );
            })()}

            {isCollectingDetails ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Billing Name</label>
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Billing Email</label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Enter your email address"
                  />
                </div>
                <button
                  onClick={() => {
                    const project = projects.find(p => p.id === activeSubscriptionId);
                    if (project) handleSubscribe(project);
                  }}
                  disabled={isProcessingPayment || !billingName || !billingEmail}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-all disabled:opacity-50"
                >
                  {isProcessingPayment ? 'Processing...' : 'Continue to Payment'}
                </button>
              </div>
            ) : clientSecret && (
              <div className="w-full mt-2">
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                  <CheckoutForm 
                    returnUrl={`${window.location.origin}/#/portal/${token}?success=true`} 
                    onSuccess={handlePaymentSuccess} 
                    billingDetails={{ name: billingName, email: billingEmail }}
                  />
                </Elements>
              </div>
            )}

            <button
              onClick={() => { setClientSecret(null); setActiveSubscriptionId(null); setIsCollectingDetails(false); }}
              className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortalPage;
