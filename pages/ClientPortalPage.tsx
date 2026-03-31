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

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const ClientPortalPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
          .select('*')
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
            <p className="text-slate-400">
              {isFirstTime 
                ? 'Please set a password to access your client portal.' 
                : `Welcome back, ${client.name}. Please enter your password.`}
            </p>
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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Welcome, {client.name}</h1>
            <p className="text-slate-400">Client Portal</p>
          </div>
          <div className="mt-4 md:mt-0 text-right flex flex-col items-end gap-2">
            <button 
              onClick={() => {
                sessionStorage.removeItem(`portal_auth_${client.id}`);
                setIsAuthenticated(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
            >
              Logout
            </button>
            <div>
              <p className="text-sm text-slate-400">Total Outstanding</p>
              <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalOutstanding)}</p>
            </div>
            {projects.some(p => p.stripe_subscription_id) && (
              <button
                onClick={handleManageSubscription}
                disabled={isOpeningPortal}
                className="mt-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
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
                      <h3 className="font-semibold text-white">{project.name}</h3>
                      {project.recurring_fee && project.recurring_fee > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col gap-3 text-sm">
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
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-green-400 font-medium text-xs flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-400"></span> Active Subscription
                                </span>
                                {subscriptionDetails[project.id] && (
                                  <span className="text-slate-400 text-xs">
                                    Next payment: {new Date(subscriptionDetails[project.id].current_period_end * 1000).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleCancelSubscription(project)}
                                disabled={isCanceling === project.id}
                                className="w-full py-1.5 mt-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-xs font-medium rounded transition-colors disabled:opacity-50"
                              >
                                {isCanceling === project.id ? 'Canceling...' : 'Cancel Subscription'}
                              </button>
                            </div>
                          ) : project.stripe_subscription_status === 'canceled' ? (
                            <div className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                              <span className="text-slate-500 text-xs italic">Subscription canceled</span>
                              <button
                                onClick={() => handleSubscribeInitiate(project)}
                                disabled={isProcessingPayment}
                                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                              >
                                {isProcessingPayment ? '...' : 'Resubscribe'}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2">
                              {clientSecret && activeSubscriptionId === project.id ? (
                                <div className="bg-slate-800 p-4 rounded border border-slate-700 mt-4">
                                  <p className="text-sm text-slate-400 mb-2">Please complete the payment in the modal.</p>
                                </div>
                              ) : (
                                <div className="flex justify-end items-center gap-2">
                                  <select
                                    value={selectedIntervals[project.id] || 'month'}
                                    onChange={(e) => handleIntervalChange(project.id, e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                                  >
                                    <option value="month">Monthly</option>
                                    <option value="year">Yearly</option>
                                  </select>
                                  <button
                                    onClick={() => handleSubscribeInitiate(project)}
                                    disabled={isProcessingPayment}
                                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
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
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Invoices</h2>
              {invoices.length === 0 ? (
                <p className="text-slate-400 text-sm">No invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-sm text-slate-400">
                        <th className="pb-3 font-medium">Invoice</th>
                        <th className="pb-3 font-medium">Project</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(invoice => (
                        <tr key={invoice.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="py-4 text-white font-medium">{invoice.invoice_number}</td>
                          <td className="py-4 text-slate-400 text-sm">{invoice.projects?.name || 'N/A'}</td>
                          <td className="py-4 text-slate-400 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                          <td className="py-4 text-white font-medium">{formatCurrency(invoice.amount)}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              invoice.status === 'paid' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                              invoice.status === 'overdue' ? 'bg-red-900/50 text-red-400 border border-red-800' :
                              'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                            }`}>
                              {invoice.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <a 
                              href={`/#/invoice/${invoice.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded transition-colors"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Subscription Payment Modal */}
      {(clientSecret || isCollectingDetails) && activeSubscriptionId && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => { setClientSecret(null); setActiveSubscriptionId(null); setIsCollectingDetails(false); }}>
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md my-8 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
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
