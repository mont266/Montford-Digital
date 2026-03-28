import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-center text-sm">
                          <span className="text-slate-400">{project.recurring_fee_description || 'Recurring Fee'}</span>
                          <span className="font-medium text-cyan-400">{formatCurrency(project.recurring_fee)}/mo</span>
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
