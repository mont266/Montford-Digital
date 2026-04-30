import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Client {
  id: string;
  name: string;
  email: string;
  portal_token: string;
  created_at: string;
}

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('clients').select('id, name, email, portal_token, created_at').order('name');
      if (error) throw error;
      setClients(data as Client[]);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message || 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

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
      fetchClients();
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
      fetchClients();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      alert(err.message || 'Failed to delete client.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Portal link copied to clipboard!');
  };

  if (loading) return <div className="text-slate-400">Loading clients...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Clients</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchClients()}
            title="Refresh Clients"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Add Client
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700 text-sm text-slate-400">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Portal Link</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">No clients found.</td>
              </tr>
            ) : (
              clients.map(client => {
                const portalLink = `${window.location.origin}/#/portal/${client.portal_token}`;
                return (
                  <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 text-white font-medium">{client.name}</td>
                    <td className="p-4 text-slate-400">{client.email || 'N/A'}</td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={portalLink} 
                          className="bg-slate-900 border border-slate-700 text-slate-400 text-xs rounded px-2 py-1 w-48 truncate"
                        />
                        <button 
                          onClick={() => copyToClipboard(portalLink)}
                          className="text-cyan-400 hover:text-cyan-300 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => handleOpenModal(client)} className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors">Edit</button>
                      <button onClick={() => handleDelete(client.id)} className="text-red-400 hover:text-red-300 text-sm transition-colors">Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
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
