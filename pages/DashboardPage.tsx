

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImportFlow from './ImportPage';

// --- Types ---
interface TradingIdentity {
  id: string;
  name: string;
  slug: string;
  color_theme: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email?: string;
  entity_id: string;
}

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  created_at: string;
  amount: number; 
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: { name: string } | null;
  invoice_items: InvoiceItem[];
  entity_id: string;
}

type ExpenseStatus = 'upcoming' | 'completed' | 'active' | 'inactive';
type ExpenseType = 'manual' | 'subscription';

// Updated Expense interface to match the new schema
interface Expense {
  id: string;
  name?: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  start_date: string;
  end_date?: string;
  type: ExpenseType;
  billing_cycle?: 'monthly' | 'annually';
  entity_id: string;
}

type TimeSpan = '7d' | 'mtd' | 'ytd' | 'all';

// --- Helper Functions ---
const getExpenseStatus = (expense: Expense): ExpenseStatus => {
    const now = new Date();
    if (expense.type === 'subscription') {
        const hasEnded = expense.end_date && new Date(expense.end_date) < now;
        return hasEnded ? 'inactive' : 'active';
    }
    // manual type
    const isPast = new Date(expense.start_date) <= now;
    return isPast ? 'completed' : 'upcoming';
};


// --- Reusable Components ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center space-x-4">
    <div className="bg-slate-900 text-cyan-400 p-3 rounded-full">{icon}</div>
    <div>
      <p className="text-slate-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; title: string }> = ({ children, onClose, title }) => (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-start p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-4xl my-8 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {children}
        </div>
    </div>
);

// --- Main Page Component ---

const DashboardContent: React.FC<{ selectedEntityId: string }> = ({ selectedEntityId }) => {
    // Placeholder for content based on selected entity
    return <div><h3 className="text-white">Content for entity: {selectedEntityId}</h3><p>Data and components for this section would be built out here.</p></div>;
};


const DashboardPage: React.FC = () => {
    const [tradingIdentities, setTradingIdentities] = useState<TradingIdentity[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const fetchTradingIdentities = useCallback(async () => {
        const { data, error } = await supabase.from('trading_identities').select('*');
        if (error) {
            console.error('Error fetching trading identities:', error);
        } else {
            setTradingIdentities(data || []);
        }
    }, []);

    useEffect(() => {
        fetchTradingIdentities();
    }, [fetchTradingIdentities]);
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const refreshData = () => {
        // In a real app, this would re-fetch data for the current view
        console.log("Refreshing data...");
        fetchTradingIdentities();
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 flex">
            <aside className="w-64 bg-slate-800 p-4 border-r border-slate-700 flex flex-col">
                <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>
                <h2 className="text-xs uppercase text-slate-400 font-bold mb-2">Trading Identities</h2>
                <ul className="space-y-1">
                    <li key="all">
                        <button 
                            onClick={() => setSelectedEntityId('all')}
                            className={`w-full text-left px-3 py-2 rounded text-sm ${selectedEntityId === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-slate-700'}`}
                        >
                            All Identities
                        </button>
                    </li>
                    {tradingIdentities.map(entity => (
                        <li key={entity.id}>
                            <button
                                onClick={() => setSelectedEntityId(entity.id)}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${selectedEntityId === entity.id ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-slate-700'}`}
                            >
                                {entity.name}
                            </button>
                        </li>
                    ))}
                </ul>

                <nav className="mt-8">
                    <Link to="/dashboard" className={`block px-3 py-2 rounded text-sm ${location.pathname === '/dashboard' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>Overview</Link>
                    <Link to="/dashboard/expenses" className={`block px-3 py-2 rounded text-sm ${location.pathname.startsWith('/dashboard/expenses') ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>Expenses</Link>
                    <Link to="/dashboard/invoices" className={`block px-3 py-2 rounded text-sm ${location.pathname.startsWith('/dashboard/invoices') ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>Invoices</Link>
                </nav>

                <div className="mt-auto">
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700">
                        Logout
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-8 overflow-y-auto">
                 <header className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-white">Overview</h2>
                    <button onClick={() => setImportModalOpen(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Import Expenses
                    </button>
                </header>
                <Routes>
                    <Route path="/" element={<DashboardContent selectedEntityId={selectedEntityId} />} />
                    <Route path="/expenses" element={<DashboardContent selectedEntityId={selectedEntityId} />} />
                    <Route path="/invoices" element={<DashboardContent selectedEntityId={selectedEntityId} />} />
                </Routes>
            </main>
            
            {isImportModalOpen && (
                <Modal title="Import Expenses" onClose={() => setImportModalOpen(false)}>
                    <ImportFlow 
                        selectedEntityId={selectedEntityId}
                        onClose={() => setImportModalOpen(false)}
                        refreshData={refreshData}
                    />
                </Modal>
            )}
        </div>
    );
};

export default DashboardPage;
