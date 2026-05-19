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
  category?: 'bug' | 'feature' | 'question' | 'billing' | 'other';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by: 'client' | 'admin';
  created_at: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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
  const [files, setFiles] = useState<Record<string, ProjectFile[]>>({});
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

  const [newTicketSubjects, setNewTicketSubjects] = useState<Record<string, string>>({});
  const [newTicketMessages, setNewTicketMessages] = useState<Record<string, string>>({});
  const [newTicketCategories, setNewTicketCategories] = useState<Record<string, string>>({});
  const [newTicketPriorities, setNewTicketPriorities] = useState<Record<string, string>>({});
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'invoices' | 'files'>('dashboard');
  const [forceLoginView, setForceLoginView] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

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

        // Check auth with Supabase session instead of sessionStorage
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Verify user metadata matches this client or is admin
          const isAdmin = session.user.user_metadata?.role !== 'client' && session.user.email === 'scottmontford@gmail.com';
          const isThisClient = session.user.user_metadata?.client_id === clientData.id;
          
          if (isAdmin || isThisClient) {
            setIsAuthenticated(true);
          }
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

          // 5. Fetch Milestones, Activities, Tickets, Files
          const [
            { data: milestonesData, error: milestonesError },
            { data: activitiesData, error: activitiesError },
            { data: ticketsData, error: ticketsError },
            { data: filesData, error: filesError }
          ] = await Promise.all([
            supabase.from('project_milestones').select('*').in('project_id', projectIds).order('created_at', { ascending: true }),
            supabase.from('project_activities').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
            supabase.from('support_tickets').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
            supabase.from('project_files').select('*').in('project_id', projectIds).order('created_at', { ascending: false })
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
          if (filesData) {
            const map: Record<string, ProjectFile[]> = {};
            filesData.forEach(f => { if(!map[f.project_id]) map[f.project_id]=[]; map[f.project_id].push(f); });
            setFiles(map);
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: portalPassword
      });

      if (authError) {
        throw new Error(authError.message || 'Invalid login');
      }

      const isAdmin = authData.user.user_metadata?.role !== 'client' && authData.user.email === 'scottmontford@gmail.com';
      const isThisClient = authData.user.user_metadata?.client_id === client.id || authData.user.email === loginEmail;

      if (!isAdmin && !isThisClient) {
        await supabase.auth.signOut();
        throw new Error('Not authorized for this portal');
      }

      setIsAuthenticated(true);
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

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.error || 'Failed to set password');
      }

      // Create the Supabase auth user so they have a proper session that persists
      const { error: signUpError } = await supabase.auth.signUp({
        email: client.email || '',
        password: portalPassword,
        options: {
          data: {
            role: 'client',
            client_id: client.id
          }
        }
      });

      if (signUpError && signUpError.message !== 'User already registered') {
        throw new Error('Failed to create secure session: ' + signUpError.message);
      }

      // Sign them in explicitly just in case signUp didn't auto-login
      await supabase.auth.signInWithPassword({
        email: client.email || '',
        password: portalPassword
      });

      setIsAuthenticated(true);
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
    const isFirstTime = !client.password && !forceLoginView;
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white p-4">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 max-w-md w-full">
          <div className="text-center mb-8">
            <h2 
              className="text-3xl font-bold text-white mb-2 select-none"
              onDoubleClick={() => setForceLoginView(prev => !prev)}
              title="Double click to toggle admin login"
            >
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

  const handleCreateTicket = async (projectId: string) => {
    const subject = newTicketSubjects[projectId];
    const message = newTicketMessages[projectId];
    const category = newTicketCategories[projectId] || 'other';
    const priority = newTicketPriorities[projectId] || 'normal';
    if (!subject?.trim() || !message?.trim()) return;

    setIsSubmittingTicket(projectId);
    try {
      const { error } = await supabase.from('support_tickets').insert([{
        project_id: projectId,
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority
      }]);
      if (error) throw error;
      
      setSuccessMessage('Support ticket submitted successfully.');
      setNewTicketSubjects(prev => ({ ...prev, [projectId]: '' }));
      setNewTicketMessages(prev => ({ ...prev, [projectId]: '' }));
      setNewTicketCategories(prev => ({ ...prev, [projectId]: '' }));
      setNewTicketPriorities(prev => ({ ...prev, [projectId]: '' }));
      
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingFile(projectId);
    try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${projectId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('project_files')
            .upload(filePath, file);
            
        if (uploadError) throw uploadError;
        
        await supabase.from('project_files').insert([{
            project_id: projectId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: 'client'
        }]);
        
        // Refresh files
        const { data } = await supabase.from('project_files').select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
        if (data) {
          const map: Record<string, ProjectFile[]> = {};
          data.forEach(f => { if(!map[f.project_id]) map[f.project_id]=[]; map[f.project_id].push(f); });
          setFiles(map);
        }
    } catch (err: any) {
        console.error("Error uploading:", err);
        alert("Upload failed: " + err.message);
    } finally {
        setUploadingFile(null);
        e.target.value = '';
    }
  };

  const handleFileDelete = async (id: string, filePath: string) => {
      if(!confirm("Delete this file?")) return;
      try {
          await supabase.storage.from('project_files').remove([filePath]);
          await supabase.from('project_files').delete().eq('id', id);
          
          // Refresh files
          const { data } = await supabase.from('project_files').select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
          if (data) {
            const map: Record<string, ProjectFile[]> = {};
            data.forEach(f => { if(!map[f.project_id]) map[f.project_id]=[]; map[f.project_id].push(f); });
            setFiles(map);
          }
      } catch(e) {
          console.error(e);
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
                onClick={async () => {
                  await supabase.auth.signOut();
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

        
        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-slate-700 w-full mb-6 relative overflow-x-auto custom-scrollbar">
          <button 
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 px-2 whitespace-nowrap ${activeView === 'dashboard' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveView('dashboard')}
          >
            Project Dashboard
          </button>
          <button 
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 px-2 whitespace-nowrap ${activeView === 'invoices' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveView('invoices')}
          >
            Invoices
            {outstandingInvoices.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{outstandingInvoices.length}</span>}
          </button>
          <button 
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 px-2 whitespace-nowrap ${activeView === 'files' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveView('files')}
          >
            File Hub
          </button>
        </div>

        {activeView === 'invoices' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 md:p-6 shadow-lg animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-6">All Invoices</h2>
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
        )}

        {activeView === 'files' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 md:p-6 shadow-lg animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-6">File Hub</h2>
            {projects.length === 0 ? (
               <p className="text-slate-400 text-sm italic">No active projects found.</p>
            ) : (
                <div className="space-y-8">
                   {projects.map(project => {
                     const projectFiles = files[project.id] || [];
                     return (
                         <div key={project.id} className="space-y-4">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                 <div>
                                     <h3 className="text-lg font-bold text-cyan-400">{project.name}</h3>
                                     <p className="text-sm text-slate-400 mt-1">Upload files related to this project (Max 50MB).</p>
                                 </div>
                                 <label className={`cursor-pointer justify-center sm:w-auto w-full px-5 py-2 inline-flex items-center gap-2 rounded-md font-bold transition-all border ${uploadingFile === project.id ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-cyan-600/20 border-cyan-500 text-cyan-400 hover:bg-cyan-600/30'}`}>
                                      {uploadingFile === project.id ? (
                                          <><span className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-300 rounded-full animate-spin"></span> Uploading...</>
                                      ) : (
                                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Choose File</>
                                      )}
                                      <input type="file" className="hidden" disabled={uploadingFile === project.id} onChange={(e) => handleFileUpload(e, project.id)} />
                                 </label>
                             </div>
                             
                             {projectFiles.length === 0 ? (
                                 <p className="text-slate-500 italic p-6 text-center border border-dashed border-slate-700 rounded-lg">No files uploaded for {project.name}.</p>
                             ) : (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                     {projectFiles.map(file => (
                                         <div key={file.id} className="bg-slate-900/40 rounded-lg p-4 flex items-center justify-between group hover:bg-slate-700/40 transition-colors border border-slate-700/50">
                                            <div className="flex items-center space-x-3 overflow-hidden">
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${file.uploaded_by === 'client' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-cyan-900/30 text-cyan-400'}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <a
                                                        href={`${supabase.storage.from('project_files').getPublicUrl(file.file_path).data.publicUrl}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-white font-medium hover:text-cyan-400 truncate block"
                                                    >
                                                        {file.file_name}
                                                    </a>
                                                    <div className="flex items-center text-[10px] text-slate-500 space-x-2 mt-1">
                                                        <span>{formatBytes(file.file_size)}</span>
                                                        <span>&bull;</span>
                                                        <span className="capitalize">{file.uploaded_by}</span>
                                                        <span>&bull;</span>
                                                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {file.uploaded_by === 'client' && (
                                                <button onClick={() => handleFileDelete(file.id, file.file_path)} className="text-slate-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shrink-0 ml-2" title="Delete File">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     );
                   })}
                </div>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-300">
            {projects.length === 0 ? (
               <div className="w-full bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                 <p className="text-slate-400 font-medium">No active projects found.</p>
               </div>
            ) : (
              <>
                 {projects.length > 1 && (
                   <div className="w-full lg:w-64 shrink-0">
                     <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 sticky top-6">
                       <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Your Projects</h3>
                       <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible custom-scrollbar pb-2 lg:pb-0">
                         {projects.map(p => {
                           const pTodos = todos[p.id] || [];
                           const completed = pTodos.filter(t => t.is_completed).length;
                           const progress = pTodos.length > 0 ? Math.round((completed / pTodos.length) * 100) : 0;
                           
                           return (
                             <button
                               key={p.id}
                               onClick={() => setActiveProjectId(p.id)}
                               className={`flex flex-col items-start p-3 rounded-lg text-left whitespace-nowrap lg:whitespace-normal transition-all min-w-[200px] lg:min-w-0 border ${activeProjectId === p.id ? 'bg-cyan-900/20 border-cyan-500/50 shadow-lg shadow-cyan-900/10' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/30'}`}
                             >
                               <span className={`text-sm font-bold truncate w-full mb-2 ${activeProjectId === p.id ? 'text-cyan-400' : 'text-slate-300'}`}>{p.name}</span>
                               <div className="w-full flex items-center gap-2">
                                 <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                   <div className={`h-full ${activeProjectId === p.id ? 'bg-cyan-400' : 'bg-slate-500'}`} style={{ width: `${progress}%` }}></div>
                                 </div>
                                 <span className={`text-[10px] font-bold ${activeProjectId === p.id ? 'text-cyan-400' : 'text-slate-500'}`}>{progress}%</span>
                               </div>
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 )}

                <div className="flex-1 overflow-hidden">
                  {(() => {
                    const project = projects.find(p => p.id === activeProjectId) || projects[0];
                    if (!project) return null;

                    const projectMilestonesRaw = milestones[project.id] || [];
                    const deadlineMilestone = projectMilestonesRaw.find(m => m.title === '[DEADLINE]');
                    const projectMilestones = projectMilestonesRaw.filter(m => m.title !== '[DEADLINE]');
                    const projectTodos = todos[project.id] || [];
                    const completedTodos = projectTodos.filter(t => t.is_completed).length;
                    const progressPercent = projectTodos.length > 0 ? Math.round((completedTodos / projectTodos.length) * 100) : 0;

                    return (
                      <div className="flex flex-col gap-6">
                      
                      {/* Project Header & Progress */}
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
                          <div 
                            className="h-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all duration-1000 ease-out" 
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mt-2 relative z-10">
                          <div>
                            <span className={`inline-block mb-3 text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${
                              project.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              project.status === 'Ready for review' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                              project.status === 'Cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {project.status || 'Active'}
                            </span>
                            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight break-words">{project.name}</h2>
                          </div>

                          <div className="w-full md:w-auto flex flex-col sm:flex-row flex-wrap md:items-end gap-3 sm:gap-4">
                             {deadlineMilestone && deadlineMilestone.due_date && (
                               <div className="flex items-center gap-4 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                                 <div className="flex flex-col">
                                   <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Deadline</span>
                                   <span className="text-xl font-bold text-white max-w-[120px] truncate" title={new Date(deadlineMilestone.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}>
                                     {new Date(deadlineMilestone.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                   </span>
                                 </div>
                                 <div className="w-8 h-8 rounded-full bg-slate-800/40 border border-slate-600/30 flex items-center justify-center">
                                   <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                 </div>
                               </div>
                             )}
                             <div className="flex items-center gap-4 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Progress</span>
                                 <span className="text-xl font-bold text-white">{progressPercent}%</span>
                               </div>
                               <div className="w-8 h-8 rounded-full bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center">
                                 <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                               </div>
                             </div>

                             {project.preview_url && (
                              <a 
                                href={project.preview_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-all px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                              >
                                View Live Project
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                             )}
                          </div>
                        </div>
                      </div>

                      {/* Bento Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Column 1: Task Board & Recurring Fee */}
                        <div className="space-y-6">
                           
                           {/* Recurring Fee block (moved up if exists for priority) */}
                           {project.recurring_fee && project.recurring_fee > 0 && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden flex flex-col gap-4">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                                <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {project.recurring_fee_description || 'Recurring Subscription'}
                              </div>

                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white">
                                  {project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] 
                                    ? `${formatCurrency(subscriptionDetails[project.id].amount)}`
                                    : `${formatCurrency((selectedIntervals[project.id] === 'year' ? 12 : 1) * project.recurring_fee)}`
                                  }
                                </span>
                                <span className="text-sm text-slate-500 font-medium">/{project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] ? (subscriptionDetails[project.id].interval === 'year' ? 'yr' : 'mo') : (selectedIntervals[project.id] === 'year' ? 'yr' : 'mo')}</span>
                              </div>

                              {project.stripe_subscription_status === 'active' ? (
                                <div className="mt-2 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                  <div className="flex flex-col gap-3">
                                    <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded w-fit">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                    </span>
                                    {subscriptionDetails[project.id] && (
                                      <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Next billing: <span className="text-slate-200">{new Date(subscriptionDetails[project.id].current_period_end * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleCancelSubscription(project)}
                                      disabled={isCanceling === project.id}
                                      className="mt-2 w-full py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-900/50 text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
                                    >
                                      {isCanceling === project.id ? 'Canceling...' : 'Cancel'}
                                    </button>
                                  </div>
                                </div>
                              ) : project.stripe_subscription_status === 'canceled' ? (
                                <div className="mt-2 flex flex-col gap-3">
                                  <span className="text-amber-500 text-[10px] uppercase tracking-wider font-bold">Canceled</span>
                                  <button
                                    onClick={() => handleSubscribeInitiate(project)}
                                    disabled={isProcessingPayment}
                                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    Resubscribe
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-col gap-3">
                                  {clientSecret && activeSubscriptionId === project.id ? (
                                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-center">
                                      <p className="text-xs text-cyan-400 font-medium animate-pulse">Payment modal active...</p>
                                    </div>
                                  ) : (
                                    <>
                                      <select
                                        value={selectedIntervals[project.id] || 'month'}
                                        onChange={(e) => handleIntervalChange(project.id, e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500"
                                      >
                                        <option value="month">Monthly Billing</option>
                                        <option value="year">Yearly (Save 20%)</option>
                                      </select>
                                      <button
                                        onClick={() => handleSubscribeInitiate(project)}
                                        disabled={isProcessingPayment}
                                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-cyan-900/20"
                                      >
                                        Subscribe
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                           )}

                           {/* Task Board */}
                           <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 shadow-lg flex flex-col min-h-[300px] md:h-[400px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                              Task Board
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                               {todos[project.id] && todos[project.id].length > 0 ? (
                                  [...todos[project.id]].sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1)).map(todo => (
                                    <div key={todo.id} className="flex items-start gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                                      <div className="mt-0.5 shrink-0">
                                        {todo.is_completed ? (
                                          <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center">
                                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                          </div>
                                        ) : (
                                          <div className="w-5 h-5 rounded-md border-2 border-slate-600 bg-slate-800"></div>
                                        )}
                                      </div>
                                      <span className={`text-sm ${todo.is_completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                        {todo.description}
                                      </span>
                                    </div>
                                  ))
                               ) : (
                                 <p className="text-slate-500 text-sm italic text-center mt-10">No tasks mapped yet.</p>
                               )}
                            </div>
                           </div>

                        </div>

                        {/* Column 2: Milestones & Activity */}
                        <div className="space-y-6">
                          
                          {/* Milestones */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 shadow-lg flex flex-col max-h-[350px] md:max-h-[500px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Project Milestones
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                              {projectMilestones.length > 0 ? (
                                <div className="space-y-5 pl-2 py-2">
                                  {projectMilestones.map((m, idx) => (
                                    <div key={m.id} className="relative pl-6">
                                      {idx !== projectMilestones.length - 1 && (
                                        <div className="absolute left-[7px] top-6 bottom-[-24px] w-[2px] bg-slate-700"></div>
                                      )}
                                      <div className={`absolute left-[-2px] top-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-800 ${
                                        m.status === 'completed' ? 'bg-cyan-500' : m.status === 'in_progress' ? 'bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.3)]' : 'bg-slate-600'
                                      }`}>
                                        {m.status === 'completed' && <svg className="w-3 h-3 text-cyan-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                      </div>
                                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 ml-2">
                                        <div className="flex justify-between items-center mb-1 gap-2">
                                          <span className="font-bold text-slate-200 text-sm">{m.title}</span>
                                          <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap ${m.status === 'completed' ? 'text-cyan-400 bg-cyan-500/10' : m.status === 'in_progress' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 bg-slate-800'}`}>{m.status.replace('_', ' ')}</span>
                                        </div>
                                        {m.description && <p className="text-slate-400 text-xs mt-1">{m.description}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 text-sm italic text-center mt-10">No milestones set.</p>
                              )}
                            </div>
                          </div>

                          {/* Activity Log */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 shadow-lg flex flex-col max-h-[300px] md:max-h-[350px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Activity Log
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                               {activities[project.id] && activities[project.id].filter(a => !a.description.startsWith('[NOTE] ')).length > 0 ? (
                                  activities[project.id].filter(a => !a.description.startsWith('[NOTE] ')).map(a => (
                                    <div key={a.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-1.5">
                                      <span className="text-sm text-slate-200">{a.description}</span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  ))
                               ) : (
                                 <p className="text-slate-500 text-sm italic text-center mt-6">No recent activity.</p>
                               )}
                            </div>
                          </div>

                          {/* Meeting Notes */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 shadow-lg flex flex-col max-h-[300px] md:max-h-[400px] mt-6">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Meeting Notes
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                               {activities[project.id] && activities[project.id].filter(a => a.description.startsWith('[NOTE] ')).length > 0 ? (
                                  activities[project.id].filter(a => a.description.startsWith('[NOTE] ')).map(act => (
                                    <div key={act.id} className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50 flex flex-col gap-2">
                                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{act.description.substring(7)}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {new Date(act.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  ))
                               ) : (
                                 <p className="text-slate-500 text-sm italic text-center mt-6">No meeting notes yet.</p>
                               )}
                            </div>
                          </div>


                        </div>

                        {/* Column 3: Tickets */}
                        <div className="space-y-6">
                           
                           {/* Support Tickets */}
                           <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 shadow-lg flex flex-col min-h-[500px] md:h-[775px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                              Support & Requests
                            </div>
                            
                            <form onSubmit={(e) => { e.preventDefault(); handleCreateTicket(project.id); }} className="space-y-3 bg-slate-900/60 p-4 flex flex-col rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden mb-6 flex-shrink-0">
                              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
                              <p className="text-xs font-bold text-white mb-1">New Request</p>
                              <div className="grid grid-cols-2 gap-2">
                                <select value={newTicketCategories[project.id] || ''} onChange={e => setNewTicketCategories(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer">
                                  <option value="" disabled>Category</option>
                                  <option value="bug">🐛 Bug/Issue</option>
                                  <option value="feature">✨ Feature Request</option>
                                  <option value="question">❓ Question</option>
                                  <option value="billing">💳 Billing</option>
                                  <option value="other">📝 Other</option>
                                </select>
                                <select value={newTicketPriorities[project.id] || ''} onChange={e => setNewTicketPriorities(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer">
                                  <option value="" disabled>Priority</option>
                                  <option value="low">🧊 Low</option>
                                  <option value="normal">🔵 Normal</option>
                                  <option value="high">🔶 High</option>
                                  <option value="urgent">🚨 Urgent</option>
                                </select>
                              </div>
                              <input type="text" placeholder="Subject line" value={newTicketSubjects[project.id] || ''} onChange={e => setNewTicketSubjects(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" required />
                              <textarea placeholder="How can we help?" value={newTicketMessages[project.id] || ''} onChange={e => setNewTicketMessages(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[90px] resize-y transition-all" required />
                              <button type="submit" disabled={isSubmittingTicket === project.id} className="w-full justify-center px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-md disabled:opacity-50 transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2 mt-1">
                                {isSubmittingTicket === project.id ? (
                                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Submitting...</>
                                ) : (
                                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Send Request</>
                                )}
                              </button>
                            </form>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                              {tickets[project.id] && tickets[project.id].length > 0 ? (
                                tickets[project.id].map(t => (
                                  <div key={t.id} className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/80 shadow-inner flex flex-col gap-3 relative overflow-hidden group">
                                    {t.priority === 'urgent' && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/80"></div>}
                                    {t.priority === 'high' && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/80"></div>}
                                    
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-sm text-white break-words">{t.subject}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {t.category && (
                                            <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                                              {t.category === 'bug' && '🐛 '}
                                              {t.category === 'feature' && '✨ '}
                                              {t.category === 'question' && '❓ '}
                                              {t.category === 'billing' && '💳 '}
                                              {t.category}
                                            </span>
                                          )}
                                          {t.priority && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-widest whitespace-nowrap ${
                                              t.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
                                              t.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                              t.priority === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                                              'bg-slate-600/30 text-slate-400'
                                            }`}>{t.priority}</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className={`text-[9px] px-2 py-1 rounded-sm uppercase font-bold tracking-widest whitespace-nowrap ${
                                        t.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                                        t.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                        'bg-slate-700/50 text-slate-300 border border-slate-600'
                                      }`}>{t.status.replace('_', ' ')}</span>
                                    </div>
                                    <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 leading-relaxed max-w-none shadow-inner">
                                      {t.message}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-500 text-sm italic text-center mt-6">No previous requests.</p>
                              )}
                            </div>

                           </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}
                </div>
              </>
            )}
          </div>
        )}
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
