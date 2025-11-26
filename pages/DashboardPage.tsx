import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// --- Types ---
interface Project {
  id: string;
  name: string;
  client_name: string;
}
interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: { name: string } | null;
}
interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
}

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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            {children}
        </div>
    </div>
);


// --- Page Components ---
const DashboardOverview: React.FC<{ invoices: Invoice[]; expenses: Expense[] }> = ({ invoices, expenses }) => {
    const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.amount, 0);
    const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 6.5h.01" /></svg>} />
                <StatCard title="Net Profit" value={formatCurrency(netProfit)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                <StatCard title="Overdue" value={formatCurrency(overdueAmount)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            </div>
        </div>
    );
};

const InvoicesPage: React.FC<{ invoices: Invoice[]; projects: Project[]; refreshData: () => void; }> = ({ invoices, projects, refreshData }) => {
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);

    const handleUpdateStatus = async (id: string, status: Invoice['status']) => {
        const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
        if (error) console.error("Error updating status:", error);
        else refreshData();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this invoice?")) {
            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) console.error("Error deleting invoice:", error);
            else refreshData();
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Invoices</h2>
                <button onClick={() => setShowInvoiceModal(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Create Invoice</button>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {invoices.map(invoice => (
                            <tr key={invoice.id} className="hover:bg-slate-800/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{invoice.invoice_number}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{invoice.projects?.name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${invoice.amount.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{invoice.due_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' : invoice.status === 'overdue' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{invoice.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    {invoice.status !== 'paid' && <button onClick={() => handleUpdateStatus(invoice.id, 'paid')} className="text-green-400 hover:text-green-300">Mark Paid</button>}
                                    <button onClick={() => handleDelete(invoice.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showInvoiceModal && <InvoiceForm projects={projects} onClose={() => setShowInvoiceModal(false)} refreshData={refreshData} onAddNewProject={() => { setShowInvoiceModal(false); setShowProjectModal(true); }} />}
            {showProjectModal && <ProjectForm onClose={() => setShowProjectModal(false)} refreshData={refreshData} />}
        </div>
    );
};

const ExpensesPage: React.FC<{ expenses: Expense[]; refreshData: () => void; }> = ({ expenses, refreshData }) => {
    const [showModal, setShowModal] = useState(false);
    
    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this expense?")) {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) console.error("Error deleting expense:", error);
            else refreshData();
        }
    };
    
    return (
         <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Expenses</h2>
                <button onClick={() => setShowModal(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Add Expense</button>
            </div>
             <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {expenses.map(exp => (
                            <tr key={exp.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{exp.expense_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{exp.description}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{exp.category}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${exp.amount.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button onClick={() => handleDelete(exp.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showModal && <ExpenseForm onClose={() => setShowModal(false)} refreshData={refreshData} />}
        </div>
    );
};


// --- FORMS ---
const InvoiceForm: React.FC<{ projects: Project[]; onClose: () => void; refreshData: () => void; onAddNewProject: () => void; }> = ({ projects, onClose, refreshData, onAddNewProject }) => {
    const [formData, setFormData] = useState({ project_id: '', invoice_number: '', issue_date: '', due_date: '', amount: 0, status: 'draft' });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('invoices').insert([formData]);
        if (error) console.error("Error creating invoice:", error);
        else {
            refreshData();
            onClose();
        }
    };
    return (
        <Modal onClose={onClose} title="Create New Invoice">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-end space-x-2">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-slate-300">Project</label>
                        <select name="project_id" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white">
                            <option value="">Select a project</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={onAddNewProject} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-md text-sm">New Project</button>
                </div>
                 <div><label className="block text-sm font-medium text-slate-300">Invoice Number</label><input type="text" name="invoice_number" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Amount</label><input type="number" step="0.01" name="amount" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Issue Date</label><input type="date" name="issue_date" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Due Date</label><input type="date" name="due_date" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md">Save Invoice</button>
            </form>
        </Modal>
    );
};

const ProjectForm: React.FC<{ onClose: () => void; refreshData: () => void; }> = ({ onClose, refreshData }) => {
    const [formData, setFormData] = useState({ name: '', client_name: '' });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('projects').insert([formData]);
        if (error) console.error("Error creating project:", error);
        else {
            refreshData();
            onClose();
        }
    };
     return (
        <Modal onClose={onClose} title="Create New Project">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-300">Project Name</label><input type="text" name="name" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Client Name</label><input type="text" name="client_name" onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md">Save Project</button>
            </form>
        </Modal>
    );
};

const ExpenseForm: React.FC<{ onClose: () => void; refreshData: () => void; }> = ({ onClose, refreshData }) => {
    const [formData, setFormData] = useState({ description: '', amount: 0, category: '', expense_date: '' });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('expenses').insert([formData]);
        if (error) console.error("Error creating expense:", error);
        else {
            refreshData();
            onClose();
        }
    };
    return (
        <Modal onClose={onClose} title="Add New Expense">
             <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-300">Description</label><input type="text" name="description" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Amount</label><input type="number" step="0.01" name="amount" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Category</label><input type="text" name="category" onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Expense Date</label><input type="date" name="expense_date" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md">Save Expense</button>
            </form>
        </Modal>
    );
};

// --- Main Dashboard Component ---
const DashboardPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const projectsPromise = supabase.from('projects').select('*');
            const invoicesPromise = supabase.from('invoices').select('*, projects(name)');
            const expensesPromise = supabase.from('expenses').select('*');
            
            const [{ data: projectsData, error: projectsError }, { data: invoicesData, error: invoicesError }, { data: expensesData, error: expensesError }] = await Promise.all([projectsPromise, invoicesPromise, expensesPromise]);

            if (projectsError) throw projectsError;
            if (invoicesError) throw invoicesError;
            if (expensesError) throw expensesError;

            setProjects(projectsData || []);
            setInvoices(invoicesData || []);
            setExpenses(expensesData || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            <aside className="w-64 bg-slate-800 p-6 border-r border-slate-700 flex-col hidden md:flex">
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
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 rounded-md hover:bg-slate-700 transition-colors">Logout</button>
                </div>
            </aside>

            <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
                 {loading && <div className="text-center">Loading dashboard data...</div>}
                 {error && <div className="text-center text-red-400">Error: {error}</div>}
                 {!loading && !error && (
                    <Routes>
                        <Route path="/" element={<DashboardOverview invoices={invoices} expenses={expenses} />} />
                        <Route path="/invoices" element={<InvoicesPage invoices={invoices} projects={projects} refreshData={fetchData} />} />
                        <Route path="/expenses" element={<ExpensesPage expenses={expenses} refreshData={fetchData} />} />
                    </Routes>
                 )}
            </main>
        </div>
    );
};

export default DashboardPage;
