import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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

// --- Page Components (can be split into own files later) ---
const DashboardOverview: React.FC = () => (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Overview</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Total Revenue" value="$42,320" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
      <StatCard title="Total Expenses" value="$8,150" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 6.5h.01" /></svg>} />
      <StatCard title="Overdue Invoices" value="$2,500" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      <StatCard title="Active Projects" value="3" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
    </div>
    <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Coming Soon</h3>
        <p className="text-slate-400">Full data tables for invoices and expenses, along with creation forms and Stripe integration, will be built out here.</p>
    </div>
  </div>
);

const InvoicesPage: React.FC = () => <div><h2 className="text-2xl font-bold text-white mb-6">Invoices</h2><p className="text-slate-400">Invoice management table will be here.</p></div>;
const ExpensesPage: React.FC = () => <div><h2 className="text-2xl font-bold text-white mb-6">Expenses</h2><p className="text-slate-400">Expense management table will be here.</p></div>;

const DashboardPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { path: "/dashboard", label: "Overview" },
        { path: "/dashboard/invoices", label: "Invoices" },
        { path: "/dashboard/expenses", label: "Expenses" },
    ];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 p-6 border-r border-slate-700 flex flex-col">
                <h1 className="text-xl font-bold text-white mb-8">Admin Dashboard</h1>
                <nav className="flex-grow">
                    <ul>
                        {navItems.map(item => (
                             <li key={item.path} className="mb-2">
                                <Link to={item.path} className={`block px-4 py-2 rounded-md transition-colors ${location.pathname === item.path ? 'bg-cyan-500 text-white' : 'hover:bg-slate-700'}`}>
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                 <div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 rounded-md hover:bg-slate-700 transition-colors">
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <Routes>
                    <Route path="/" element={<DashboardOverview />} />
                    <Route path="/invoices" element={<InvoicesPage />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                </Routes>
            </main>
        </div>
    );
};

export default DashboardPage;