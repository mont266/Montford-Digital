import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Estimate, fetchAllEstimates } from '../lib/estimates';
import { ExactQuoteCalibrationModal } from '../components/ExactQuoteCalibrationModal';
import { ConvertToInvoiceModal } from '../components/ConvertToInvoiceModal';

export interface Client {
  id: string;
  name: string;
  email: string;
  portal_token: string;
  created_at: string;
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

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });

  // Client Quotes modal states
  const [quotesModalClient, setQuotesModalClient] = useState<Client | null>(null);
  const [calibratingEstimate, setCalibratingEstimate] = useState<Estimate | null>(null);
  const [invoicingEstimate, setInvoicingEstimate] = useState<Estimate | null>(null);

  const fetchClientsAndEstimates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, portal_token, created_at')
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
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([formData]);
        if (error) throw error;
      }
      handleCloseModal();
      fetchClientsAndEstimates();
    } catch (err: any) {
      console.error('Error saving client:', err);
      alert(err.message || 'Failed to save client.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      fetchClientsAndEstimates();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      alert(err.message || 'Failed to delete client.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Portal link copied to clipboard!');
  };

  if (loading) return <div className="text-slate-400">Loading clients and quotes...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  const modalClientEstimates = quotesModalClient ? getClientEstimates(quotesModalClient) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Clients</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage your client profiles, customer portals, attached quotes, and 1-click invoice conversions.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchClientsAndEstimates()}
            title="Refresh Clients"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
          >
            + Add Client
          </button>
        </div>
      </div>

      <div className="bg-slate-800 md:border md:border-slate-700 md:rounded-lg overflow-x-auto">
        <table className="min-w-full md:divide-y md:divide-slate-700 responsive-table text-left border-collapse">
          <thead className="bg-slate-900/50">
            <tr className="bg-slate-900/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Attached Quotes &amp; Invoicing</th>
              <th className="px-4 py-3 font-medium">Portal Link</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="md:divide-y md:divide-slate-700">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-400">
                  No clients found.
                </td>
              </tr>
            ) : (
              clients.map((client) => {
                const clientQuotes = getClientEstimates(client);
                const hasQuotes = clientQuotes.length > 0;
                const portalLink = `${window.location.origin}/#/portal/${client.portal_token}`;

                return (
                  <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td data-label="Name" className="px-4 py-3 text-white font-medium">
                      {client.name}
                    </td>
                    <td data-label="Email" className="px-4 py-3 text-slate-400 truncate max-w-[180px]">
                      {client.email || 'N/A'}
                    </td>
                    <td data-label="Quotes & Invoicing" className="px-4 py-3">
                      {hasQuotes ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQuotesModalClient(client)}
                            className="bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
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
                    <td data-label="Portal Link" className="px-4 py-3">
                      <div className="flex items-center space-x-2 md:w-auto w-full justify-end md:justify-start">
                        <input
                          type="text"
                          readOnly
                          value={portalLink}
                          className="bg-slate-900 border border-slate-700 text-slate-400 text-xs rounded px-2 py-1 w-36 truncate flex-1 md:flex-none"
                        />
                        <button
                          onClick={() => copyToClipboard(portalLink)}
                          className="text-cyan-400 hover:text-cyan-300 text-xs shrink-0 bg-slate-800 border border-slate-700 p-1.5 rounded"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td data-label="Actions" className="px-4 py-3 text-right space-x-2">
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
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- CLIENT DETAIL / QUOTES & INVOICING MODAL --- */}
      {quotesModalClient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto"
          onClick={() => setQuotesModalClient(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex justify-between items-start">
              <div>
                <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Client Quotes &amp; Invoicing
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{quotesModalClient.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {quotesModalClient.email || 'No email registered'} &bull; {modalClientEstimates.length}{' '}
                  {modalClientEstimates.length === 1 ? 'quote' : 'quotes'} attached
                </p>
              </div>
              <button
                onClick={() => setQuotesModalClient(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Attached Quotes &amp; Scopes
                </h4>
                <Link
                  to={`/dashboard/calculator?clientId=${quotesModalClient.id}`}
                  onClick={() => setQuotesModalClient(null)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  + New Quote for {quotesModalClient.name} &rarr;
                </Link>
              </div>

              {modalClientEstimates.length === 0 ? (
                <div className="py-12 text-center bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                  <p className="text-slate-400 text-sm">No quotes attached to {quotesModalClient.name} yet.</p>
                  <Link
                    to={`/dashboard/calculator?clientId=${quotesModalClient.id}`}
                    onClick={() => setQuotesModalClient(null)}
                    className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-4 py-2 rounded-lg"
                  >
                    Open Quote Calculator
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalClientEstimates.map((est) => {
                    const isInvoiced = Boolean(est.invoice_number);

                    return (
                      <div
                        key={est.id}
                        className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 space-y-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                              {est.project_type.toUpperCase()} SCOPE
                            </span>
                            <h5 className="text-sm font-bold text-white mt-0.5">{est.title}</h5>
                          </div>
                          <span className="text-xs text-slate-400">{formatDate(est.created_at)}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Estimate Range:</span>
                            <span className="font-semibold text-slate-200">
                              {formatCurrency(est.estimated_low)} &ndash; {formatCurrency(est.estimated_high)}
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
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setCalibratingEstimate(est)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                          >
                            {est.quoted_amount ? 'Edit Exact Quote' : 'Set Exact Quote'}
                          </button>

                          <div className="flex items-center gap-2">
                            {isInvoiced ? (
                              <a
                                href={`/#/invoice/${est.invoice_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-800/40"
                              >
                                ✓ Invoiced ({est.invoice_number})
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInvoicingEstimate(est)}
                                className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
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
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
              <span>Quotes can be locked into an exact amount and converted into customer invoices.</span>
              <button
                type="button"
                onClick={() => setQuotesModalClient(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">{editingClient ? 'Edit Client' : 'Add Client'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
