
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// --- Types ---
interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email?: string;
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
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: { name: string } | null;
  invoice_items: InvoiceItem[];
}
interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
}

type TimeSpan = '7d' | 'mtd' | 'ytd' | 'all';

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
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-2xl my-8 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {children}
        </div>
    </div>
);

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');


// --- Page Components ---
const DashboardOverview: React.FC<{ invoices: Invoice[]; expenses: Expense[] }> = ({ invoices, expenses }) => {
    const [timeSpan, setTimeSpan] = useState<TimeSpan>('all');

    const filteredData = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date | null = null;

        switch (timeSpan) {
            case '7d':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                break;
            case 'mtd':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'ytd':
                startDate = new Date(today.getFullYear(), 0, 1);
                break;
            case 'all':
            default:
                break;
        }

        const filteredInvoices = startDate
            ? invoices.filter(inv => new Date(inv.issue_date) >= startDate!)
            : invoices;
        
        const filteredExpenses = startDate
            ? expenses.filter(exp => new Date(exp.expense_date) >= startDate!)
            : expenses;

        return { filteredInvoices, filteredExpenses };

    }, [timeSpan, invoices, expenses]);


    const { filteredInvoices, filteredExpenses } = filteredData;
    
    const totalRevenue = filteredInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.amount, 0);
    const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const outstandingAmount = filteredInvoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0);
    const overdueAmount = filteredInvoices.filter(inv => inv.status === 'overdue' || (inv.status === 'sent' && new Date(inv.due_date) < new Date())).reduce((acc, inv) => acc + inv.amount, 0);
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-white">Overview</h2>
                 <div className="flex space-x-2 bg-slate-800 border border-slate-700 rounded-md p-1">
                     {(['7d', 'mtd', 'ytd', 'all'] as const).map(span => (
                         <button key={span} onClick={() => setTimeSpan(span)} className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${timeSpan === span ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                            {span === '7d' ? 'Last 7 Days' : span === 'mtd' ? 'MTD' : span === 'ytd' ? 'YTD' : 'All Time'}
                         </button>
                     ))}
                 </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 6.5h.01" /></svg>} />
                <StatCard title="Net Profit" value={formatCurrency(netProfit)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                <StatCard title="Outstanding" value={formatCurrency(outstandingAmount)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                <StatCard title="Overdue" value={formatCurrency(overdueAmount)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            </div>
        </div>
    );
};

const ProjectsPage: React.FC<{ projects: Project[]; refreshData: () => void; }> = ({ projects, refreshData }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingProject(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProject(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this project? This will also delete all associated invoices.")) {
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) console.error("Error deleting project:", error);
            else refreshData();
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Projects</h2>
                <button onClick={handleAddNew} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Create Project</button>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {projects.map(project => (
                            <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{project.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{project.client_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                    <button onClick={() => handleEdit(project)} className="text-cyan-400 hover:text-cyan-300">Edit</button>
                                    <button onClick={() => handleDelete(project.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showModal && <ProjectForm projectToEdit={editingProject} onClose={handleCloseModal} refreshData={refreshData} />}
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(invoice.amount)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatDate(invoice.due_date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' : (invoice.status === 'sent' && new Date(invoice.due_date) < new Date()) ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{invoice.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <Link to={`/invoice/${invoice.id}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">View</Link>
                                    {invoice.status === 'draft' && <button onClick={() => handleUpdateStatus(invoice.id, 'sent')} className="text-blue-400 hover:text-blue-300">Mark Sent</button>}
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatDate(exp.expense_date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{exp.description}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{exp.category}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(exp.amount)}</td>
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
    const [formData, setFormData] = useState({ project_id: '', invoice_number: '', issue_date: '', due_date: '', status: 'draft' });
    const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const groupedProjects = useMemo(() => {
        return projects.reduce((acc, project) => {
            const clientName = project.client_name || 'No Client';
            if (!acc[clientName]) {
                acc[clientName] = [];
            }
            acc[clientName].push(project);
            return acc;
        }, {} as Record<string, Project[]>);
    }, [projects]);


    useEffect(() => {
        const generateNextInvoiceNumber = async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('invoice_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            let nextNumber = 'MD-001';
            if (data && data.invoice_number) {
                const parts = data.invoice_number.split('-');
                const lastNum = parseInt(parts[1], 10);
                if (!isNaN(lastNum)) {
                    const newNum = (lastNum + 1).toString().padStart(3, '0');
                    nextNumber = `MD-${newNum}`;
                }
            }
            setFormData(prev => ({ ...prev, invoice_number: nextNumber }));
        };
        generateNextInvoiceNumber();
    }, []);

    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0), [items]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const invoiceData = { ...formData, amount: totalAmount };

        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoiceData)
            .select()
            .single();

        if (invoiceError || !newInvoice) {
            console.error("Error creating invoice:", invoiceError);
            setIsSubmitting(false);
            return;
        }

        const itemsToInsert = items.map(item => ({
            ...item,
            invoice_id: newInvoice.id,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);

        if (itemsError) {
            console.error("Error creating invoice items:", itemsError);
            await supabase.from('invoices').delete().eq('id', newInvoice.id);
        } else {
            refreshData();
            onClose();
        }
        setIsSubmitting(false);
    };

    return (
        <Modal onClose={onClose} title="Create New Invoice">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-end space-x-2">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-slate-300">Project</label>
                        <select name="project_id" value={formData.project_id} onChange={handleFormChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white">
                            <option value="">Select a project</option>
                             {Object.entries(groupedProjects).map(([clientName, clientProjects]) => (
                                <optgroup label={clientName} key={clientName}>
                                    {clientProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <button type="button" onClick={onAddNewProject} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-md text-sm">New Project</button>
                </div>
                 <div><label className="block text-sm font-medium text-slate-300">Invoice Number</label><input type="text" name="invoice_number" value={formData.invoice_number} readOnly className="mt-1 w-full bg-slate-900 border-slate-700 rounded-md p-2 text-slate-400 cursor-not-allowed" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Issue Date</label><input type="date" name="issue_date" value={formData.issue_date} onChange={handleFormChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Due Date</label><input type="date" name="due_date" value={formData.due_date} onChange={handleFormChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                
                <div className="border-t border-b border-slate-700 py-4 space-y-3">
                    <h4 className="text-lg font-semibold text-white">Invoice Items</h4>
                     <div className="grid grid-cols-12 gap-2 items-center text-xs text-slate-400 font-medium px-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-3">Unit Price</div>
                    </div>
                    {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                            <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} required className="col-span-6 bg-slate-700 border-slate-600 rounded-md p-2 text-white" />
                            <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} required className="col-span-2 bg-slate-700 border-slate-600 rounded-md p-2 text-white" />
                            <input type="number" step="0.01" placeholder="Price" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)} required className="col-span-3 bg-slate-700 border-slate-600 rounded-md p-2 text-white" />
                            <button type="button" onClick={() => removeItem(index)} className="col-span-1 text-red-400 hover:text-red-300 text-2xl">&times;</button>
                        </div>
                    ))}
                    <button type="button" onClick={addItem} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold">+ Add Item</button>
                </div>
                
                <div className="text-right text-xl font-bold text-white">
                    Total: {formatCurrency(totalAmount)}
                </div>

                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Invoice'}
                </button>
            </form>
        </Modal>
    );
};

const ProjectForm: React.FC<{ projectToEdit?: Project | null; onClose: () => void; refreshData: () => void; }> = ({ projectToEdit, onClose, refreshData }) => {
    const [formData, setFormData] = useState({ 
        name: projectToEdit?.name || '', 
        client_name: projectToEdit?.client_name || '',
        client_email: projectToEdit?.client_email || ''
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let error;
        if (projectToEdit) {
            ({ error } = await supabase.from('projects').update(formData).eq('id', projectToEdit.id));
        } else {
            ({ error } = await supabase.from('projects').insert([formData]));
        }

        if (error) console.error("Error saving project:", error);
        else {
            refreshData();
            onClose();
        }
    };
     return (
        <Modal onClose={onClose} title={projectToEdit ? "Edit Project" : "Create New Project"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-300">Project Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Client Name</label><input type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                 <div><label className="block text-sm font-medium text-slate-300">Client Email</label><input type="email" name="client_email" value={formData.client_email} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
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
                <div><label className="block text-sm font-medium text-slate-300">Amount (£)</label><input type="number" step="0.01" name="amount" onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
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
            const projectsPromise = supabase.from('projects').select('*').order('name');
            const invoicesPromise = supabase.from('invoices').select('*, projects(name), invoice_items(*)').order('issue_date', { ascending: false });
            const expensesPromise = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
            
            const [{ data: projectsData, error: projectsError }, { data: invoicesData, error: invoicesError }, { data: expensesData, error: expensesError }] = await Promise.all([projectsPromise, invoicesPromise, expensesPromise]);

            if (projectsError) throw projectsError;
            if (invoicesError) throw invoicesError;
            if (expensesError) throw expensesError;

            setProjects(projectsData || []);
            setInvoices(invoicesData as Invoice[] || []);
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
        { path: "/dashboard/projects", label: "Projects" },
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
                        <Route path="/projects" element={<ProjectsPage projects={projects} refreshData={fetchData} />} />
                        <Route path="/invoices" element={<InvoicesPage invoices={invoices} projects={projects} refreshData={fetchData} />} />
                        <Route path="/expenses" element={<ExpensesPage expenses={expenses} refreshData={fetchData} />} />
                    </Routes>
                 )}
            </main>
        </div>
    );
};

export default DashboardPage;
