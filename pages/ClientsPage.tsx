import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Estimate, fetchAllEstimates } from '../lib/estimates';
import { ExactQuoteCalibrationModal } from '../components/ExactQuoteCalibrationModal';
import { ConvertToInvoiceModal } from '../components/ConvertToInvoiceModal';
import { EmailTestingModal } from '../components/EmailTestingModal';
import { sendPortalInviteEmail } from '../lib/emailService';
import { getAppBaseUrl } from '../lib/urlHelper';

export interface Client {
  id: string;
  name: string;
  email: string;
  portal_token: string;
  created_at: string;
  password?: string | null;
  password_set_at?: string | null;
  stripe_customer_id?: string | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const hasClientLoggedIn = (client: Client): boolean => {
  return Boolean(
    (client.password_set_at && client.password_set_at.trim().length > 0) ||
    (client.password && client.password.trim().length > 0)
  );
};

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<'all' | 'logged_in' | 'not_logged_in'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Client modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [showEmailTestingModal, setShowEmailTestingModal] = useState(false);
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 5000);
  };

  // Client Quotes modal states
  const [quotesModalClient, setQuotesModalClient] = useState<Client | null>(null);
  const [calibratingEstimate, setCalibratingEstimate] = useState<Estimate | null>(null);
  const [invoicingEstimate, setInvoicingEstimate] = useState<Estimate | null>(null);

  const fetchClientsAndEstimates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      setClients(data as Client[]);

      // Fetch estimates
      const allEstimates = await fetchAllEstimates();
      setEstimates(allEstimates);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndEstimates();
  }, []);

  const getClientEstimates = (client: Client): Estimate[] => {
    return estimates.filter((e) => {
      if (e.client_id && e.client_id === client.id) return true;
      if (e.client_name && e.client_name.trim().toLowerCase() === client.name.trim().toLowerCase()) return true;
      return false;
    });
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({ name: client.name, email: client.email || '' });
    } else {
      setEditingClient(null);
      setFormData({ name: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ name: '', email: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', editingClient.id);
        if (error) throw error;
        showToast('Client profile updated successfully.', 'success');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([formData]);
        if (error) throw error;
        showToast('New client created successfully.', 'success');
      }
      handleCloseModal();
      fetchClientsAndEstimates();
    } catch (err: any) {
      console.error('Error saving client:', err);
      showToast(err.message || 'Failed to save client.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      showToast('Client deleted.', 'info');
      fetchClientsAndEstimates();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      showToast(err.message || 'Failed to delete client.', 'error');
    }
  };

  const handleResetPassword = async (client: Client) => {
    if (!window.confirm(`Are you sure you want to reset the portal password for ${client.name}? Next time they visit their portal, they will be prompted to create a new password.`)) {
      return;
    }
    setIsResettingPassword(true);
    try {
      const updatePayload: Record<string, any> = { password: null };
      if (client.password_set_at !== undefined) {
        updatePayload.password_set_at = null;
      }
      const { error } = await supabase
        .from('clients')
        .update(updatePayload)
        .eq('id', client.id);
      if (error) throw error;

      showToast(`Password reset for ${client.name}. On their next visit they will set a new password.`, 'success');
      await fetchClientsAndEstimates();
      if (editingClient && editingClient.id === client.id) {
        setEditingClient({ ...editingClient, password: null, password_set_at: null });
      }
    } catch (err: any) {
      console.error('Error resetting password:', err);
      showToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const copyToClipboard = (text: string, message = 'Portal link copied to clipboard!', feedbackKey?: string) => {
    navigator.clipboard.writeText(text);
    showToast(message, 'success');
    if (feedbackKey) {
      setCopiedKey(feedbackKey);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const copyPortalInvite = (client: Client, feedbackKey?: string) => {
    const portalLink = `${getAppBaseUrl()}/#/portal/${client.portal_token}`;
    const loggedIn = hasClientLoggedIn(client);
    const inviteMessage = `Hi ${client.name},\n\nYou can access your client portal here:\n${portalLink}\n\n${
      loggedIn
        ? 'Log in using your account password to review your projects, deliverables, and invoices.'
        : 'On your first visit, you will be prompted to set a secure password to activate your personal portal.'
    }`;
    copyToClipboard(inviteMessage, 'Client portal invitation copied to clipboard!', feedbackKey);
  };

  const handleSendPortalInviteEmail = async (client: Client) => {
    // STRICT REQUIREMENT: Only available for clients who have NOT yet signed up for portal
    if (hasClientLoggedIn(client)) {
      showToast(`${client.name} has already configured a password and signed up for their portal.`, 'info');
      return;
    }
    if (!client.email || !client.email.includes('@')) {
      showToast(`Cannot send email: Please set a valid email address for "${client.name}" first.`, 'error');
      return;
    }

    setSendingInviteId(client.id);
    try {
      const res = await sendPortalInviteEmail(client.id, client.email);
      if (res.success) {
        if (res.simulated) {
          showToast(`Portal invite simulated for ${client.email}. Add RESEND_API_KEY to .env to deliver live emails.`, 'info');
        } else {
          showToast(`✓ "Your Client Portal is Ready" email sent to ${client.email}!`, 'success');
        }
      } else {
        showToast(`Failed to send portal email: ${res.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error sending invite email: ${err.message}`, 'error');
    } finally {
      setSendingInviteId(null);
    }
  };

  // Metrics
  const totalCount = clients.length;
  const loggedInCount = clients.filter(hasClientLoggedIn).length;
  const notLoggedInCount = totalCount - loggedInCount;

  // Filtered clients list
  const filteredClients = clients.filter((client) => {
    const loggedIn = hasClientLoggedIn(client);
    if (statusFilter === 'logged_in' && !loggedIn) return false;
    if (statusFilter === 'not_logged_in' && loggedIn) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = client.name.toLowerCase().includes(q);
      const matchesEmail = client.email ? client.email.toLowerCase().includes(q) : false;
      if (!matchesName && !matchesEmail) return false;
    }

    return true;
  });

  if (loading) return <div className="text-slate-400">Loading clients and quotes...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  const modalClientEstimates = quotesModalClient ? getClientEstimates(quotesModalClient) : [];

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toastNotification && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-xs font-medium border shadow-lg transition-all animate-fade-in ${
            toastNotification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : toastNotification.type === 'error'
              ? 'bg-red-950/80 border-red-500/50 text-red-200'
              : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{toastNotification.type === 'success' ? '✓' : toastNotification.type === 'error' ? '⚠' : 'ℹ'}</span>
            <span>{toastNotification.message}</span>
          </div>
          <button onClick={() => setToastNotification(null)} className="ml-3 text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Clients</h2>
          <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">
            Manage client profiles, customer portal access, attached quotes, and 1-click invoice conversions.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowEmailTestingModal(true)}
            title="Preview & test transactional emails"
            className="bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700/80 font-medium py-2 sm:py-2 px-2.5 sm:px-3 rounded-lg transition-colors text-xs flex items-center gap-1.5 shadow-sm min-h-[38px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden xs:inline">Email Templates</span>
            <span className="xs:hidden">Emails</span>
          </button>
          <button
            onClick={() => fetchClientsAndEstimates()}
            title="Refresh Clients"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center border border-slate-700/60 min-h-[38px] min-w-[38px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-3.5 sm:px-4 rounded-lg transition-colors text-xs sm:text-sm shadow-sm flex items-center gap-1.5 min-h-[38px]"
          >
            <span>+ Add Client</span>
          </button>
        </div>
      </div>

      {/* Portal Login Status Metric Cards (Compact 3-column grid on mobile) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-2.5 sm:p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-slate-800/90 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg'
              : 'bg-slate-850/60 border-slate-750 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-semibold text-slate-400 truncate">Total</span>
            <span className="text-[10px] sm:text-xs text-slate-500 font-mono hidden xs:inline">100%</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-white mt-0.5 sm:mt-1.5">{totalCount}</div>
          <p className="text-[11px] text-slate-400 mt-1 hidden sm:block">All registered client records</p>
        </button>

        <button
          onClick={() => setStatusFilter('logged_in')}
          className={`p-2.5 sm:p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'logged_in'
              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-lg'
              : 'bg-slate-850/60 border-slate-750 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-semibold text-emerald-400 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Active</span>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 font-mono hidden xs:inline">
              {totalCount > 0 ? `${Math.round((loggedInCount / totalCount) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-emerald-300 mt-0.5 sm:mt-1.5">{loggedInCount}</div>
          <p className="text-[11px] text-emerald-400/80 mt-1 hidden sm:block">Has set password &amp; logged in</p>
        </button>

        <button
          onClick={() => setStatusFilter('not_logged_in')}
          className={`p-2.5 sm:p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'not_logged_in'
              ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40 shadow-lg'
              : 'bg-slate-850/60 border-slate-750 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-semibold text-amber-400 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shrink-0" />
              <span>Pending</span>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-amber-400 font-mono hidden xs:inline">
              {totalCount > 0 ? `${Math.round((notLoggedInCount / totalCount) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-amber-300 mt-0.5 sm:mt-1.5">{notLoggedInCount}</div>
          <p className="text-[11px] text-amber-400/80 mt-1 hidden sm:block">Awaiting password &amp; first login</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-750 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5 sm:gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-medium text-slate-400 mr-1 hidden sm:inline shrink-0">Portal:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              statusFilter === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700/60'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('logged_in')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              statusFilter === 'logged_in'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-emerald-300 hover:bg-slate-750 border border-emerald-800/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Logged In ({loggedInCount})
          </button>
          <button
            onClick={() => setStatusFilter('not_logged_in')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              statusFilter === 'not_logged_in'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800 text-amber-300 hover:bg-slate-750 border border-amber-800/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Not Logged In ({notLoggedInCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* --- CLIENTS LIST --- */}
      {filteredClients.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="font-medium text-slate-300">No clients match your filter</p>
            <p className="text-xs text-slate-500">
              {statusFilter !== 'all' || searchQuery
                ? 'Try clearing the search query or status filter.'
                : 'Click "+ Add Client" to create your first client.'}
            </p>
            {(statusFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE CARD VIEW (Block on mobile, hidden on md+) */}
          <div className="block md:hidden space-y-3.5">
            {filteredClients.map((client) => {
              const clientQuotes = getClientEstimates(client);
              const hasQuotes = clientQuotes.length > 0;
              const portalLink = `${getAppBaseUrl()}/#/portal/${client.portal_token}`;
              const loggedIn = hasClientLoggedIn(client);
              const linkKey = `link-${client.id}`;
              const textKey = `text-${client.id}`;

              return (
                <div
                  key={client.id}
                  className="bg-slate-850/95 border border-slate-750 rounded-xl p-4 space-y-3.5 shadow-sm"
                >
                  {/* Card Header: Client Name, Status Chip, Edit & Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate">{client.name}</h3>
                        {loggedIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Logged In</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                            <span>Not Logged In</span>
                          </span>
                        )}
                      </div>

                      {/* Email + Created date */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate max-w-[200px]"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{client.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">No email set</span>
                        )}
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-[11px] text-slate-500">Created {formatDate(client.created_at)}</span>
                      </div>
                    </div>

                    {/* Quick Edit button */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenModal(client)}
                        className="p-1.5 text-cyan-400 hover:text-cyan-300 bg-slate-800 border border-slate-700/80 rounded-lg text-xs"
                        title="Edit Client"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 bg-slate-800 border border-slate-700/80 rounded-lg text-xs"
                        title="Delete Client"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Attached Project Quotes & Invoicing */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Project Quotes &amp; Invoices</span>
                      {hasQuotes && (
                        <span className="text-emerald-400 lowercase font-normal">
                          {clientQuotes.length} {clientQuotes.length === 1 ? 'quote' : 'quotes'}
                        </span>
                      )}
                    </div>

                    {hasQuotes ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setQuotesModalClient(client)}
                          className="w-full bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 text-xs p-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>
                              {clientQuotes.length} {clientQuotes.length === 1 ? 'Quote Attached' : 'Quotes Attached'}
                            </span>
                          </div>
                          {clientQuotes[0].quoted_amount && (
                            <span className="text-white font-bold bg-emerald-900/80 px-2 py-0.5 rounded text-[11px]">
                              {formatCurrency(clientQuotes[0].quoted_amount)}
                            </span>
                          )}
                        </button>
                        <div className="flex justify-between items-center px-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setQuotesModalClient(client)}
                            className="text-cyan-400 hover:text-cyan-300 font-medium underline text-[11px]"
                          >
                            View &amp; Convert to Invoice &rarr;
                          </button>
                          <Link
                            to={`/dashboard/calculator?clientId=${client.id}`}
                            className="text-slate-400 hover:text-emerald-300 text-[11px]"
                          >
                            + New quote
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs text-slate-500 italic">No quotes attached yet</span>
                        <Link
                          to={`/dashboard/calculator?clientId=${client.id}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-700/50 bg-emerald-950/40 px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1"
                        >
                          + Create Quote
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Customer Portal Access & Link Sharing */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Customer Portal</span>
                      {loggedIn ? (
                        <span className="text-emerald-400 font-normal lowercase flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          active
                        </span>
                      ) : (
                        <span className="text-amber-400 font-normal lowercase">pending setup</span>
                      )}
                    </div>

                    {/* Copy Link Row */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={portalLink}
                        className="bg-slate-950 border border-slate-750 text-slate-400 text-xs rounded-lg px-2.5 py-1.5 flex-1 font-mono truncate"
                      />
                      <button
                        onClick={() => copyToClipboard(portalLink, 'Portal link copied to clipboard!', linkKey)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 rounded-lg text-xs font-semibold shrink-0 transition-colors min-h-[32px]"
                      >
                        {copiedKey === linkKey ? '✓ Copied' : 'Copy Link'}
                      </button>
                    </div>

                    {/* Portal Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                      {!loggedIn ? (
                        <button
                          type="button"
                          onClick={() => handleSendPortalInviteEmail(client)}
                          disabled={sendingInviteId === client.id}
                          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 min-h-[36px]"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {sendingInviteId === client.id ? 'Sending Invite...' : 'Send Invite Email'}
                          </span>
                        </button>
                      ) : (
                        <div className="w-full text-center text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 py-1.5 px-2 rounded-lg">
                          ✓ Client has set password &amp; logged in
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => copyPortalInvite(client, textKey)}
                        className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors min-h-[34px]"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{copiedKey === textKey ? '✓ Text Copied' : 'Copy Text Invite'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (Hidden on mobile, block on md+) */}
          <div className="hidden md:block bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-slate-700 text-left border-collapse">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Client &amp; Portal Status</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Attached Quotes &amp; Invoicing</th>
                  <th className="px-4 py-3 font-medium">Customer Portal Link</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredClients.map((client) => {
                  const clientQuotes = getClientEstimates(client);
                  const hasQuotes = clientQuotes.length > 0;
                  const portalLink = `${getAppBaseUrl()}/#/portal/${client.portal_token}`;
                  const loggedIn = hasClientLoggedIn(client);
                  const linkKey = `link-desk-${client.id}`;
                  const textKey = `text-desk-${client.id}`;

                  return (
                    <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                      {/* Name + Portal Login Indicator */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm">{client.name}</span>

                            {loggedIn ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-sm"
                                title="Logged In: This client has set a secure password and accessed their portal"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Logged In</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-sm"
                                title="Not Logged In: Client has never logged into their portal yet (no password set)"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                                <span>Not Logged In</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span>Created {formatDate(client.created_at)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-300 truncate max-w-[190px]">
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:text-cyan-300 transition-colors flex items-center gap-1"
                          >
                            <span>{client.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">No email set</span>
                        )}
                      </td>

                      {/* Attached Quotes & Invoicing */}
                      <td className="px-4 py-3">
                        {hasQuotes ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQuotesModalClient(client)}
                              className="bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>
                                {clientQuotes.length} {clientQuotes.length === 1 ? 'Quote' : 'Quotes'}
                              </span>
                              {clientQuotes[0].quoted_amount && (
                                <span className="text-white font-bold ml-0.5">
                                  ({formatCurrency(clientQuotes[0].quoted_amount)})
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setQuotesModalClient(client)}
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
                            >
                              Set Quote / Invoice &rarr;
                            </button>
                          </div>
                        ) : (
                          <Link
                            to={`/dashboard/calculator?clientId=${client.id}`}
                            className="text-xs text-slate-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 bg-slate-900/50 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <span>+ Create Quote</span>
                          </Link>
                        )}
                      </td>

                      {/* Customer Portal Link & Status */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              readOnly
                              value={portalLink}
                              className="bg-slate-900 border border-slate-700 text-slate-400 text-xs rounded px-2 py-1 w-32 truncate font-mono"
                            />
                            <button
                              onClick={() => copyToClipboard(portalLink, 'Portal link copied to clipboard!', linkKey)}
                              title="Copy direct portal URL"
                              className="text-cyan-400 hover:text-cyan-300 hover:bg-slate-750 text-xs shrink-0 bg-slate-800 border border-slate-750 px-2 py-1 rounded font-medium transition-colors"
                            >
                              {copiedKey === linkKey ? '✓' : 'Copy'}
                            </button>

                            {/* Email Invite Button: ONLY available for clients who haven't already signed up */}
                            {!loggedIn ? (
                              <button
                                type="button"
                                onClick={() => handleSendPortalInviteEmail(client)}
                                disabled={sendingInviteId === client.id}
                                title={client.email ? `Send "Your portal is ready" email to ${client.email}` : 'Add client email to send invite'}
                                className="text-white hover:text-cyan-100 bg-cyan-600 hover:bg-cyan-500 text-xs shrink-0 px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                              >
                                {sendingInviteId === client.id ? (
                                  <span>Sending...</span>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span>Send Invite Email</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className="text-slate-500 text-xs px-2 py-1 rounded bg-slate-900/60 border border-slate-800 flex items-center gap-1 cursor-default shrink-0"
                                title="Client already registered with a password and logged in"
                              >
                                <span className="text-emerald-400">✓</span> Portal Active
                              </span>
                            )}

                            <button
                              onClick={() => copyPortalInvite(client, textKey)}
                              title="Copy pre-written portal invitation text"
                              className="text-slate-300 hover:text-white hover:bg-slate-750 text-xs shrink-0 bg-slate-800 border border-slate-750 px-2 py-1 rounded font-medium transition-colors flex items-center gap-1"
                            >
                              <span>{copiedKey === textKey ? '✓' : 'Text'}</span>
                            </button>
                          </div>

                          {/* Status subtitle helper */}
                          <div className="flex items-center gap-1 text-[11px]">
                            {loggedIn ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Password set &bull; Active portal
                              </span>
                            ) : (
                              <span className="text-amber-400 font-medium flex items-center gap-1">
                                <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Awaiting first login / password
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right space-x-2">
                        <div className="flex justify-end space-x-2">
                          <Link
                            to={`/dashboard/calculator?clientId=${client.id}`}
                            className="text-emerald-400 hover:text-emerald-300 text-xs transition-colors border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-1 rounded font-semibold"
                            title="Open Quote Calculator for this client"
                          >
                            Quote
                          </Link>
                          <button
                            onClick={() => handleOpenModal(client)}
                            className="text-cyan-400 hover:text-cyan-300 text-xs transition-colors border border-cyan-700/50 bg-cyan-900/20 px-2.5 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-red-400 hover:text-red-300 text-xs transition-colors border border-red-700/50 bg-red-900/20 px-2.5 py-1 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- CLIENT DETAIL / QUOTES & INVOICING MODAL --- */}
      {quotesModalClient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setQuotesModalClient(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl my-auto sm:my-8 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    Quotes &amp; Invoicing
                  </span>

                  {/* Portal indicator in modal */}
                  {hasClientLoggedIn(quotesModalClient) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Portal Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Pending Setup
                    </span>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">{quotesModalClient.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {quotesModalClient.email || 'No email registered'} &bull;{' '}
                  <span className="text-slate-300 font-medium">
                    {modalClientEstimates.length} {modalClientEstimates.length === 1 ? 'quote' : 'quotes'} attached
                  </span>
                </p>
              </div>

              <button
                onClick={() => setQuotesModalClient(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-lg shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Attached Quotes */}
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              {modalClientEstimates.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 p-6">
                  <p className="text-slate-400 text-sm mb-3">No saved quotes attached to this client yet.</p>
                  <Link
                    to={`/dashboard/calculator?clientId=${quotesModalClient.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    <span>+ Build Quote in Calculator</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Attached Project Quotes
                    </span>
                    <Link
                      to={`/dashboard/calculator?clientId=${quotesModalClient.id}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                    >
                      + Create another quote
                    </Link>
                  </div>

                  {modalClientEstimates.map((est) => {
                    const isInvoiced = Boolean(est.invoice_number);
                    const low = est.estimated_low || 0;
                    const high = est.estimated_high || 0;
                    const mid = Math.round((low + high) / 2);
                    const rangeText = `£${low.toLocaleString()} - £${high.toLocaleString()}`;

                    return (
                      <div
                        key={est.id}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3 hover:border-slate-700 transition-colors"
                      >
                        {/* Scope & Date */}
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h4 className="font-semibold text-white text-sm">
                              {est.project_type || 'Custom Scope'}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Saved on {formatDate(est.created_at)}
                            </p>
                          </div>

                          {isInvoiced ? (
                            <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              ✓ Invoiced: {est.invoice_number}
                            </span>
                          ) : est.quoted_amount ? (
                            <span className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              Agreed Quote: {formatCurrency(est.quoted_amount)}
                            </span>
                          ) : (
                            <span className="bg-amber-950/60 border border-amber-600/40 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                              Estimate Range
                            </span>
                          )}
                        </div>

                        {/* Estimated Range vs Agreed Quote */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-slate-900/80 rounded-lg p-2.5 sm:p-3 text-xs border border-slate-800/60">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Estimate Scope Range:</span>
                            <span className="font-semibold text-slate-300">{rangeText}</span>
                            <span className="text-slate-500 ml-1.5 text-[10px]">
                              (Mid: £{mid.toLocaleString()})
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[11px]">Agreed Quoted Amount:</span>
                            {est.quoted_amount ? (
                              <span className="font-bold text-emerald-400 text-sm">
                                {formatCurrency(est.quoted_amount)}
                              </span>
                            ) : (
                              <span className="text-amber-400/80 italic text-xs">Not fixed yet</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setCalibratingEstimate(est)}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors text-center"
                          >
                            {est.quoted_amount ? 'Edit Exact Quote' : 'Set Exact Quote'}
                          </button>

                          <div className="flex items-center gap-2">
                            {isInvoiced ? (
                              <a
                                href={`/#/invoice/${est.invoice_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full sm:w-auto px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-800/40 text-center"
                              >
                                ✓ Invoiced ({est.invoice_number})
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInvoicingEstimate(est)}
                                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                <span>Turn into Invoice</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400 gap-2">
              <span className="truncate">Quotes can be converted directly into invoices.</span>
              <button
                type="button"
                onClick={() => setQuotesModalClient(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EXACT QUOTE CALIBRATION MODAL --- */}
      {calibratingEstimate && (
        <ExactQuoteCalibrationModal
          estimate={calibratingEstimate}
          onClose={() => setCalibratingEstimate(null)}
          onSaved={(updated) => {
            setEstimates((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
          onConvertToInvoice={(updated) => {
            setCalibratingEstimate(null);
            setInvoicingEstimate(updated);
          }}
        />
      )}

      {/* --- CONVERT TO INVOICE MODAL --- */}
      {invoicingEstimate && (
        <ConvertToInvoiceModal
          estimate={invoicingEstimate}
          onClose={() => setInvoicingEstimate(null)}
          onSuccess={() => {
            setInvoicingEstimate(null);
            fetchClientsAndEstimates();
          }}
        />
      )}

      {/* --- ADD / EDIT CLIENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-850 rounded-xl border border-slate-700 p-4 sm:p-6 w-full max-w-lg shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-750">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">{editingClient ? 'Edit Client' : 'Add Client'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingClient ? 'Update profile and manage customer portal access' : 'Create a new client profile'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">Company / Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Studio Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-2.5 sm:py-2 text-white focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-2.5 sm:py-2 text-white focus:outline-none focus:border-cyan-500 text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">Used for portal notifications, invites, and invoices.</p>
              </div>

              {/* Portal Info section if editing */}
              {editingClient && (
                <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3.5 sm:p-4 space-y-3 mt-4">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Client Portal Status
                    </span>
                    {hasClientLoggedIn(editingClient) ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Logged In (Password Set)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Not Logged In Yet
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Portal URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${getAppBaseUrl()}/#/portal/${editingClient.portal_token}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-300 font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            `${getAppBaseUrl()}/#/portal/${editingClient.portal_token}`,
                            'Portal URL copied!',
                            'edit-url'
                          )
                        }
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-cyan-300 rounded-lg font-medium whitespace-nowrap min-h-[36px]"
                      >
                        {copiedKey === 'edit-url' ? '✓ Copied' : 'Copy URL'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => copyPortalInvite(editingClient, 'edit-invite')}
                        className="text-xs text-slate-300 hover:text-white underline font-medium"
                      >
                        {copiedKey === 'edit-invite' ? '✓ Invite copied!' : 'Copy invite text message'}
                      </button>

                      {hasClientLoggedIn(editingClient) ? (
                        <button
                          type="button"
                          disabled={isResettingPassword}
                          onClick={() => handleResetPassword(editingClient)}
                          className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-700/50 rounded text-xs font-medium transition-colors"
                          title="Clear the client's password so they can set a fresh password on next login"
                        >
                          {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          Client will set password on first visit
                        </span>
                      )}
                    </div>

                    {/* Send "Your Client Portal is Ready" email button: ONLY for clients not yet signed up */}
                    {!hasClientLoggedIn(editingClient) ? (
                      <button
                        type="button"
                        disabled={sendingInviteId === editingClient.id}
                        onClick={() => handleSendPortalInviteEmail(editingClient)}
                        className="w-full mt-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 min-h-[40px]"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {sendingInviteId === editingClient.id
                            ? 'Sending Invitation...'
                            : `Send Invite Email to ${editingClient.email || editingClient.name}`}
                        </span>
                      </button>
                    ) : (
                      <div className="mt-2 bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-2 text-center text-xs text-emerald-300">
                        ✓ Client has already signed up and configured their portal password.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-3 border-t border-slate-750">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors text-sm shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Testing Modal */}
      {showEmailTestingModal && (
        <EmailTestingModal isOpen={showEmailTestingModal} onClose={() => setShowEmailTestingModal(false)} />
      )}
    </div>
  );
};

export default ClientsPage;
