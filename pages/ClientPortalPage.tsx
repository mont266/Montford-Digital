import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface Client {
  id: string;
  name: string;
  email: string;
  portal_token: string;
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

        // 2. Fetch Projects for this Client
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('client_id', clientData.id);

        if (projectsError) throw projectsError;
        setProjects(projectsData as Project[]);

        // Fetch subscription details for active subscriptions
        const activeSubs = (projectsData as Project[]).filter(p => p.stripe_subscription_id && p.stripe_subscription_status === 'active');
        const subDetails: Record<string, SubscriptionDetails> = {};
        
        for (const project of activeSubs) {
          try {
            const res = await fetch(`/api/subscription/${project.stripe_subscription_id}`);
            if (res.ok) {
              const data = await res.json();
              subDetails[project.id] = data;
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

  const handleSubscribe = async (project: Project) => {
    try {
      const response = await fetch('/api/create-subscription-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          amount: project.recurring_fee,
          projectName: project.name,
          clientName: client?.name || 'Client',
          clientEmail: client?.email || '',
          origin: window.location.origin,
          token: token,
          interval: selectedIntervals[project.id] || 'month',
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create subscription session: No URL returned');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      alert(err.message || 'Failed to initiate subscription.');
    }
  };

  const handleCancelSubscription = async (project: Project) => {
    if (!project.stripe_subscription_id) return;
    
    if (!window.confirm('Are you sure you want to cancel this subscription? This action cannot be undone.')) {
      return;
    }

    setIsCanceling(project.id);
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: project.stripe_subscription_id,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
      }

      if (data.success) {
        // Update local state
        setProjects(projects.map(p => p.id === project.id ? { ...p, stripe_subscription_status: 'canceled' } : p));
        setSuccessMessage('Subscription canceled successfully.');
        
        // Update database
        await supabase
          .from('projects')
          .update({ stripe_subscription_status: 'canceled' })
          .eq('id', project.id);
      } else {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      console.error('Cancellation error:', err);
      alert(err.message || 'Failed to cancel subscription.');
    } finally {
      setIsCanceling(null);
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
          <div className="mt-4 md:mt-0 text-right">
            <p className="text-sm text-slate-400">Total Outstanding</p>
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalOutstanding)}</p>
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
                              {formatCurrency(project.recurring_fee)}
                              {project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] 
                                ? `/${subscriptionDetails[project.id].interval === 'year' ? 'yr' : 'mo'}`
                                : ''}
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
                                onClick={() => handleSubscribe(project)}
                                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors"
                              >
                                Resubscribe
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-2 mt-2">
                              <select
                                value={selectedIntervals[project.id] || 'month'}
                                onChange={(e) => handleIntervalChange(project.id, e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                              >
                                <option value="month">Monthly</option>
                                <option value="year">Yearly</option>
                              </select>
                              <button
                                onClick={() => handleSubscribe(project)}
                                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors"
                              >
                                Set up Subscription
                              </button>
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
    </div>
  );
};

export default ClientPortalPage;
