



// Fix: Corrected import statement for React hooks.
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

interface Expense {
  id: string;
  name?: string;
  description: string;
  amount: number; // Original amount
  currency?: string; // Original currency
  amount_gbp: number; // Standardized amount in GBP
  category: string;
  start_date: string;
  end_date?: string;
  type: 'manual' | 'subscription';
  billing_cycle?: 'monthly' | 'annually';
  status: ExpenseStatus;
  entity_id: string;
}

type OutgoingTimeSpan = '7d' | '30d' | '90d' | '1y' | 'all';

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

const formatCurrency = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// --- Tax Calculation Logic ---
const BASE_SALARY = 43000 + (43000 * 0.08); // 46440
// Tax Bands (England 2024/2025)
const PA_THRESHOLD = 12570;
const BASIC_RATE_THRESHOLD = 50270;
const HIGHER_RATE_THRESHOLD = 125140;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const ADDITIONAL_RATE = 0.45;
// NI Class 4 Bands (2024/2025)
const NI_LOWER_THRESHOLD = 12570;
const NI_UPPER_THRESHOLD = 50270;
const NI_LOWER_RATE = 0.06;
const NI_HIGHER_RATE = 0.02;

const calculateTaxForInvoice = (invoiceAmount: number, baseIncome: number, alreadyEarnedThisYear: number) => {
    let incomeTax = 0;
    let nationalInsurance = 0;
    const startingIncome = baseIncome + alreadyEarnedThisYear;
    // A simplified marginal tax calculation, iterating pound by pound
    for (let i = 1; i <= Math.floor(invoiceAmount); i++) {
        const currentTotalIncome = startingIncome + i;
        // Income Tax Calculation for this pound
        if (currentTotalIncome > HIGHER_RATE_THRESHOLD) {
            incomeTax += ADDITIONAL_RATE;
        } else if (currentTotalIncome > BASIC_RATE_THRESHOLD) {
            incomeTax += HIGHER_RATE;
        } else if (currentTotalIncome > PA_THRESHOLD) {
            incomeTax += BASIC_RATE;
        }
        // National Insurance Calculation for this pound
        if (currentTotalIncome > NI_UPPER_THRESHOLD) {
            nationalInsurance += NI_HIGHER_RATE;
        } else if (currentTotalIncome > NI_LOWER_THRESHOLD) {
            nationalInsurance += NI_LOWER_RATE;
        }
    }
    return {
        incomeTax,
        nationalInsurance,
        totalTax: incomeTax + nationalInsurance
    };
};

// --- Page Components ---
const DashboardOverview: React.FC<{ invoices: Invoice[]; expenses: Expense[] }> = ({ invoices, expenses }) => {
    type TimeSpan = '7d' | 'mtd' | 'tfy' | 'lfy' | 'all';
    const [timeSpan, setTimeSpan] = useState<TimeSpan>('all');

    const filteredData = useMemo(() => {
        const getUKFinancialYear = (date: Date) => {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0 = Jan, 3 = Apr
            const day = date.getDate();
            const startYear = (month > 3) || (month === 3 && day >= 6) ? year : year - 1;
            return {
                start: new Date(startYear, 3, 6),
                end: new Date(startYear + 1, 3, 5),
            };
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        switch (timeSpan) {
            case '7d':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = now;
                break;
            case 'mtd':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = now;
                break;
            case 'tfy': {
                const currentFY = getUKFinancialYear(today);
                startDate = currentFY.start;
                endDate = now;
                break;
            }
            case 'lfy': {
                const currentFY = getUKFinancialYear(today);
                startDate = new Date(currentFY.start.getFullYear() - 1, 3, 6);
                endDate = new Date(currentFY.end.getFullYear() - 1, 3, 5);
                break;
            }
            case 'all':
            default:
                break;
        }
        
        const filterByDate = (date: Date) => {
             if (startDate && date < startDate) return false;
             if (endDate && date > endDate) return false;
             return true;
        }

        const filteredInvoices = invoices.filter(inv => filterByDate(new Date(inv.issue_date)));
        const filteredExpenses = expenses.filter(exp => filterByDate(new Date(exp.start_date)));

        return { filteredInvoices, filteredExpenses };

    }, [timeSpan, invoices, expenses]);


    const { filteredInvoices, filteredExpenses } = filteredData;
    
    const totalRevenue = filteredInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.amount, 0);

    const invoiceTaxMap = useMemo(() => {
        const getFinancialYearStartYear = (date: Date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            return (month > 3 || (month === 3 && day >= 6)) ? year : year - 1;
        };

        const paidInvoicesByFY: { [key: number]: Invoice[] } = {};
        invoices.filter(i => i.status === 'paid').forEach(inv => {
            const fyStartYear = getFinancialYearStartYear(new Date(inv.issue_date));
            if (!paidInvoicesByFY[fyStartYear]) paidInvoicesByFY[fyStartYear] = [];
            paidInvoicesByFY[fyStartYear].push(inv);
        });

        const taxMap = new Map<string, number>();
        Object.values(paidInvoicesByFY).forEach(fyInvoices => {
            fyInvoices.sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime());
            let runningTotal = 0;
            fyInvoices.forEach(inv => {
                const taxInfo = calculateTaxForInvoice(inv.amount, BASE_SALARY, runningTotal);
                taxMap.set(inv.id, taxInfo.totalTax);
                runningTotal += inv.amount;
            });
        });
        return taxMap;
    }, [invoices]);
    
    const totalTaxPaid = filteredInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (invoiceTaxMap.get(inv.id) || 0), 0);
    
    const totalExpensesInPeriod = filteredExpenses.reduce((acc, exp) => acc + exp.amount_gbp, 0);
    const netProfit = totalRevenue - totalExpensesInPeriod - totalTaxPaid;
    
    const oneTimePayments = filteredExpenses.filter(e => e.type === 'manual').reduce((sum, e) => sum + e.amount_gbp, 0);
    const monthlySubscriptions = expenses
        .filter(e => e.type === 'subscription' && e.status === 'active')
        .reduce((sum, e) => {
            if (e.billing_cycle === 'annually') {
                return sum + (e.amount_gbp / 12);
            }
            return sum + e.amount_gbp;
        }, 0);
    
    const outstandingAmount = filteredInvoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0);
    const overdueAmount = filteredInvoices.filter(inv => inv.status === 'overdue' || (inv.status === 'sent' && new Date(inv.due_date) < new Date())).reduce((acc, inv) => acc + inv.amount, 0);
    
    const timeSpanLabels: Record<TimeSpan, string> = {
        '7d': '7 Days',
        'mtd': 'MTD',
        'tfy': 'This Fin. Year',
        'lfy': 'Last Fin. Year',
        'all': 'All Time'
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-white">Overview</h2>
                 <div className="flex space-x-2 bg-slate-800 border border-slate-700 rounded-md p-1">
                     {(['7d', 'mtd', 'tfy', 'lfy', 'all'] as const).map(span => (
                         <button key={span} onClick={() => setTimeSpan(span)} className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${timeSpan === span ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                            {timeSpanLabels[span]}
                         </button>
                     ))}
                 </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                <StatCard title="Est. Tax Paid" value={formatCurrency(totalTaxPaid)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 001.414 0l2.414-2.414a1 1 0 01.707-.293H15v5" /></svg>} />
                <StatCard title="Net Profit" value={formatCurrency(netProfit)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                <StatCard title="Outstanding" value={formatCurrency(outstandingAmount)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                <StatCard title="Overdue" value={formatCurrency(overdueAmount)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <StatCard title="Active Subscriptions" value={`${formatCurrency(monthlySubscriptions)}/mo`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
                <StatCard title="One-Time Payments" value={formatCurrency(oneTimePayments)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.93L5 10m7 0a2 2 0 012 2v5" /></svg>} />
            </div>
        </div>
    );
};

const ProjectsPage: React.FC<{ projects: Project[]; refreshData: () => void; selectedEntityId: string }> = ({ projects, refreshData, selectedEntityId }) => {
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
            {showModal && <ProjectForm projectToEdit={editingProject} onClose={handleCloseModal} refreshData={refreshData} selectedEntityId={selectedEntityId} />}
        </div>
    );
};


const InvoicesPage: React.FC<{ invoices: Invoice[]; projects: Project[]; refreshData: () => void; selectedEntityId: string }> = ({ invoices, projects, refreshData, selectedEntityId }) => {
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const TAX_YEAR_START = useMemo(() => new Date('2024-04-06'), []);

    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.actions-dropdown-container')) {
                setOpenDropdownId(null);
            }
        };
        if (openDropdownId) {
            document.addEventListener('click', handleDocumentClick);
        }
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [openDropdownId]);

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
    
    // We need to sort paid invoices by date to correctly calculate running total
    const sortedInvoices = useMemo(() => [...invoices].sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()), [invoices]);
    
    let runningPaidTotalThisYear = 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Invoices</h2>
                <button onClick={() => setShowInvoiceModal(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Create Invoice</button>
            </div>
            <div className={`bg-slate-800 border border-slate-700 rounded-lg ${openDropdownId ? 'overflow-visible' : 'overflow-x-auto'}`}>
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider relative group">
                                Financials
                                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-2 bg-slate-900 text-slate-300 text-xs rounded-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Client-side estimate for planning purposes only. Based on 2024/25 England tax bands with a £46,440 base salary. Not financial advice.
                                </span>
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {sortedInvoices.map(invoice => {
                            const isPaidThisYear = invoice.status === 'paid' && new Date(invoice.issue_date) >= TAX_YEAR_START;
                            
                            const taxCalculation = calculateTaxForInvoice(invoice.amount, BASE_SALARY, runningPaidTotalThisYear);

                            const calculatedStripeFee = (invoice.amount * 0.025) + 0.20;
                            const effectiveStripeFee = calculatedStripeFee > 50 ? 0 : calculatedStripeFee;
                            const totalTax = taxCalculation.totalTax;
                            const takeHome = invoice.amount - effectiveStripeFee - totalTax;
                            
                            if (isPaidThisYear) {
                                runningPaidTotalThisYear += invoice.amount;
                            }

                            return (
                                <tr key={invoice.id} className="hover:bg-slate-800/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{invoice.invoice_number}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{invoice.projects?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(invoice.amount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(invoice.created_at).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' : (invoice.status === 'sent' && new Date(invoice.due_date) < new Date()) ? 'bg-red-500/20 text-red-300' : invoice.status === 'draft' ? 'bg-gray-500/20 text-gray-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{invoice.status}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                                        <div className="flex flex-col">
                                            <span>Fee (Est.): <span className="font-medium text-slate-300">{formatCurrency(effectiveStripeFee)}</span></span>
                                            <span>Tax (Est.): <span className="font-medium text-slate-300">{formatCurrency(totalTax)}</span></span>
                                            <span className="font-semibold text-white mt-1 pt-1 border-t border-slate-700">Take-home: {formatCurrency(takeHome)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                        <div className="relative inline-block text-left actions-dropdown-container">
                                            <button
                                                onClick={() => setOpenDropdownId(openDropdownId === invoice.id ? null : invoice.id)}
                                                className="inline-flex justify-center w-full rounded-full p-2 text-sm font-medium text-slate-400 hover:bg-slate-700 focus:outline-none"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                </svg>
                                            </button>

                                            {openDropdownId === invoice.id && (
                                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-slate-900 ring-1 ring-black ring-opacity-5 z-20">
                                                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                                        <Link to={`/invoice/${invoice.id}`} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full text-left" role="menuitem">View</Link>
                                                        {invoice.status === 'draft' && <button onClick={() => { handleUpdateStatus(invoice.id, 'sent'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" role="menuitem">Mark Sent</button>}
                                                        {invoice.status !== 'paid' && <button onClick={() => { handleUpdateStatus(invoice.id, 'paid'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" role="menuitem">Mark Paid</button>}
                                                        <div className="border-t border-slate-700 my-1"></div>
                                                        <button onClick={() => { handleDelete(invoice.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300" role="menuitem">Delete</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {showInvoiceModal && <InvoiceForm projects={projects} onClose={() => setShowInvoiceModal(false)} refreshData={refreshData} onAddNewProject={() => { setShowInvoiceModal(false); setShowProjectModal(true); }} selectedEntityId={selectedEntityId} />}
            {showProjectModal && <ProjectForm onClose={() => setShowProjectModal(false)} refreshData={refreshData} selectedEntityId={selectedEntityId} />}
        </div>
    );
};

const calculateTotalSpend = (expense: Expense): number => {
    if (expense.type !== 'subscription' || !expense.billing_cycle || !expense.start_date) {
        return 0;
    }
    
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const startDateParts = expense.start_date.split('-').map(Number);
    const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
    
    if (startDate > todayDateOnly) {
        return 0;
    }

    const theoreticalEndDate = expense.end_date ? (() => {
        const endDateParts = expense.end_date.split('-').map(Number);
        return new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
    })() : todayDateOnly;

    const calcEndDate = theoreticalEndDate > todayDateOnly ? todayDateOnly : theoreticalEndDate;

    if (startDate > calcEndDate) return 0;

    let cycles = 0;
    
    if (expense.billing_cycle === 'monthly') {
        let months = (calcEndDate.getFullYear() - startDate.getFullYear()) * 12;
        months += calcEndDate.getMonth() - startDate.getMonth();
        
        if (calcEndDate.getDate() < startDate.getDate()) {
            months--;
        }
        cycles = Math.max(0, months + 1);

    } else if (expense.billing_cycle === 'annually') {
        let years = calcEndDate.getFullYear() - startDate.getFullYear();
        
        if (calcEndDate.getMonth() < startDate.getMonth() || 
           (calcEndDate.getMonth() === startDate.getMonth() && calcEndDate.getDate() < startDate.getDate())) {
            years--;
        }
        cycles = Math.max(0, years + 1);
    }

    return cycles * expense.amount_gbp;
};

const ExpensesPage: React.FC<{ expenses: Expense[]; refreshData: () => void; selectedEntityId: string }> = ({ expenses, refreshData, selectedEntityId }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [timeSpan, setTimeSpan] = useState<OutgoingTimeSpan>('all');

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingExpense(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingExpense(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this expense record permanently?")) {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) console.error("Error deleting expense:", error);
            else refreshData();
        }
    };

    const { totalSpend, recurringMonthlyCost, projectedAnnualCost } = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        let calculatedTotalSpend = 0;

        if (timeSpan === 'all') {
            calculatedTotalSpend = expenses.reduce((sum, exp) => {
                if (exp.type === 'manual') {
                    return sum + exp.amount_gbp;
                }
                if (exp.type === 'subscription') {
                    return sum + calculateTotalSpend(exp);
                }
                return sum;
            }, 0);
        } else {
            let periodStartDate: Date = new Date(today);
            switch (timeSpan) {
                case '7d': periodStartDate.setDate(today.getDate() - 7); break;
                case '30d': periodStartDate.setMonth(today.getMonth() - 1); break;
                case '90d': periodStartDate.setMonth(today.getMonth() - 3); break;
                case '1y': periodStartDate.setFullYear(today.getFullYear() - 1); break;
            }

            calculatedTotalSpend = expenses.reduce((sum, exp) => {
                let spendInPeriod = 0;
                if (exp.type === 'manual') {
                    const expenseDate = new Date(exp.start_date);
                    if (expenseDate >= periodStartDate && expenseDate <= today) {
                        spendInPeriod = exp.amount_gbp;
                    }
                } else if (exp.type === 'subscription' && exp.billing_cycle) {
                    const subStartDate = new Date(exp.start_date);
                    const subEndDate = exp.end_date ? new Date(exp.end_date) : today;
                    const effectiveEndDate = subEndDate > today ? today : subEndDate;

                    let paymentDate = new Date(subStartDate);
                    while (paymentDate <= effectiveEndDate) {
                        if (paymentDate >= periodStartDate) {
                            spendInPeriod += exp.amount_gbp;
                        }

                        if (exp.billing_cycle === 'monthly') {
                            paymentDate.setMonth(paymentDate.getMonth() + 1);
                        } else { // annually
                            paymentDate.setFullYear(paymentDate.getFullYear() + 1);
                        }
                    }
                }
                return sum + spendInPeriod;
            }, 0);
        }

        const recurringMonthlyCost = expenses
            .filter(e => e.type === 'subscription' && e.status === 'active')
            .reduce((sum, e) => {
                if (e.billing_cycle === 'annually') {
                    return sum + (e.amount_gbp / 12);
                }
                if (e.billing_cycle === 'monthly') {
                    return sum + e.amount_gbp;
                }
                return sum;
            }, 0);
            
        const projectedAnnualCost = recurringMonthlyCost * 12;

        return { totalSpend: calculatedTotalSpend, recurringMonthlyCost, projectedAnnualCost };
    }, [timeSpan, expenses]);
    
    const expectedPaymentsThisMonth = useMemo(() => {
        const today = new Date();
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

        type ExpectedPayment = Expense & { dueDate: Date };
        
        const dueThisMonth = expenses.reduce((acc, exp) => {
            if (!exp.start_date) return acc;
            const startDateParts = exp.start_date.split('-').map(Number);
            const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
            
            const endDate = exp.end_date ? (() => {
                const endDateParts = exp.end_date.split('-').map(Number);
                return new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
            })() : null;

            // Basic filtering to reduce computation
            if (exp.status === 'inactive') return acc;
            if (startDate > endOfMonth) return acc; // Subscription/manual hasn't started yet
            if (endDate && endDate < todayDateOnly) return acc; // Already ended

            if (exp.type === 'manual') {
                // Include if due date is within the remainder of this month.
                if (startDate >= todayDateOnly && startDate <= endOfMonth) {
                    acc.push({ ...exp, dueDate: startDate });
                }
            } else if (exp.type === 'subscription') {
                if (exp.billing_cycle === 'monthly') {
                    let paymentDate = new Date(startDate);
                    // Find the first potential payment date that is on or after the start of this month.
                    while (paymentDate.getFullYear() < currentYear || (paymentDate.getFullYear() === currentYear && paymentDate.getMonth() < currentMonth)) {
                        paymentDate.setMonth(paymentDate.getMonth() + 1);
                    }
                    
                    // If that payment date is this month and is upcoming, add it.
                    if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear && paymentDate >= todayDateOnly) {
                        acc.push({ ...exp, dueDate: paymentDate });
                    }

                } else if (exp.billing_cycle === 'annually') {
                    // Check if the anniversary month is the current month
                    if (startDate.getMonth() === currentMonth && startDate.getFullYear() <= currentYear) {
                        const dueDateInCurrentYear = new Date(currentYear, currentMonth, startDate.getDate());
                        // If the anniversary is upcoming this month, add it
                        if (dueDateInCurrentYear >= todayDateOnly && dueDateInCurrentYear <= endOfMonth) {
                            acc.push({ ...exp, dueDate: dueDateInCurrentYear });
                        }
                    }
                }
            }
            return acc;
        }, [] as ExpectedPayment[]);

        return dueThisMonth.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [expenses]);
    
    const subscriptionOutgoings = useMemo(() => expenses.filter(e => e.type === 'subscription'), [expenses]);
    const manualOutgoings = useMemo(() => expenses.filter(e => e.type === 'manual'), [expenses]);

    const statusChipStyles: { [key in ExpenseStatus]: string } = {
        active: 'bg-green-500/20 text-green-300',
        inactive: 'bg-slate-700 text-slate-400',
        completed: 'bg-blue-500/20 text-blue-300',
        upcoming: 'bg-yellow-500/20 text-yellow-300',
    };
    
    const handleExportCSV = () => {
        const headers = ['ID', 'Name', 'Description', 'Amount', 'Currency', 'Amount (GBP)', 'Category', 'Start Date', 'End Date', 'Type', 'Billing Cycle', 'Status'];
        const rows = expenses.map(exp => [
            exp.id,
            exp.name || '',
            exp.description,
            exp.amount,
            exp.currency,
            exp.amount_gbp,
            exp.category,
            exp.start_date,
            exp.end_date || '',
            exp.type,
            exp.billing_cycle || '',
            exp.status
        ].join(','));
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `montford-digital-expenses-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const CostDisplay: React.FC<{expense: Expense}> = ({expense}) => {
        const totalSpend = useMemo(() => calculateTotalSpend(expense), [expense]);

        return (
            <div className="flex flex-col text-right">
                <span className="font-semibold text-white">
                     {expense.currency !== 'GBP' ? formatCurrency(expense.amount, expense.currency) : formatCurrency(expense.amount_gbp)}
                     {expense.billing_cycle === 'monthly' ? ' / mo' : expense.billing_cycle === 'annually' ? ' / yr' : ''}
                </span>
                {expense.currency !== 'GBP' && <span className="text-xs text-slate-400">(≈ {formatCurrency(expense.amount_gbp)})</span>}
                {expense.type === 'subscription' && totalSpend > 0 && 
                    <span className="text-xs text-slate-400" title={`Estimated total spend since ${formatDate(expense.start_date)}`}>
                        Total: {formatCurrency(totalSpend)}
                    </span>
                }
            </div>
        );
    };
    
    return (
         <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold text-white">Outgoings</h2>
                    <button onClick={refreshData} className="text-slate-400 hover:text-white transition-colors" title="Refresh data">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5l-1 1M4 20h5l1-1M12 4V2M12 22v-2M20 12h2M2 12h2" /></svg>
                    </button>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                     <div className="flex space-x-1 bg-slate-800 border border-slate-700 rounded-md p-1 text-sm">
                         {(['7d', '30d', '90d', '1y', 'all'] as const).map(span => (
                             <button key={span} onClick={() => setTimeSpan(span)} className={`px-3 py-1 font-semibold rounded transition-colors ${timeSpan === span ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                                {span === '7d' ? '7 Days' : span === '30d' ? '30 Days' : span === '90d' ? '90 Days' : span === '1y' ? '1 Year' : 'All Time'}
                             </button>
                         ))}
                     </div>
                      {selectedEntityId !== 'all' && (
                        <button onClick={() => setShowImportModal(true)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 text-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Import CSV
                        </button>
                      )}
                     <button onClick={handleExportCSV} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export CSV
                    </button>
                    <button onClick={handleAddNew} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">+ Add Outgoing</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Spend ({timeSpan === 'all' ? 'All Time' : `Last ${timeSpan}`})</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(totalSpend)}</p>
                </div>
                 <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Recurring Monthly Cost (GBP)</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(recurringMonthlyCost)}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Projected Annual Cost (GBP)</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(projectedAnnualCost)}</p>
                </div>
            </div>

            {expectedPaymentsThisMonth.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Expected Payments This Month
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                           <tr className="border-b border-slate-700 text-slate-400">
                                <th className="p-2 text-left font-medium">ITEM</th>
                                <th className="p-2 text-left font-medium">TYPE</th>
                                <th className="p-2 text-left font-medium">DUE DATE</th>
                                <th className="p-2 text-right font-medium">AMOUNT</th>
                           </tr>
                        </thead>
                        <tbody>
                            {expectedPaymentsThisMonth.map(exp => (
                                <tr key={exp.id} className="hover:bg-slate-700/50">
                                    <td className="p-2 text-white font-semibold">{exp.name || exp.description}</td>
                                    <td className="p-2"><span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full text-xs capitalize">{exp.type}</span></td>
                                    <td className="p-2">{formatDate(exp.dueDate)}</td>
                                    <td className="p-2"><CostDisplay expense={exp} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
            
            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Subscriptions</h3>
                     <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700 text-sm">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Service</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Category</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Date Range</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 uppercase">Cost</th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {subscriptionOutgoings.map(exp => (
                                    <tr key={exp.id} className={exp.status === 'inactive' ? 'opacity-50' : ''}>
                                        <td className="px-4 py-3 text-white font-semibold">{exp.name || exp.description}</td>
                                        <td className="px-4 py-3">{exp.category}</td>
                                        <td className="px-4 py-3">{formatDate(exp.start_date)} - {exp.end_date ? formatDate(exp.end_date) : 'Present'}</td>
                                        <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${statusChipStyles[exp.status]}`}>{exp.status}</span></td>
                                        <td className="px-4 py-3"><CostDisplay expense={exp} /></td>
                                        <td className="px-4 py-3 text-center"><button onClick={() => handleEdit(exp)} className="p-2 rounded-full hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-white mb-4">Manual Outgoings</h3>
                     <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700 text-sm">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Item/Service</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Category</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Purchase Date</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 uppercase">Amount</th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {manualOutgoings.map(exp => (
                                    <tr key={exp.id} className={exp.status === 'completed' ? 'opacity-70' : ''}>
                                        <td className="px-4 py-3 text-white font-semibold">{exp.name || exp.description}</td>
                                        <td className="px-4 py-3">{exp.category}</td>
                                        <td className="px-4 py-3">{formatDate(exp.start_date)}</td>
                                        <td className="px-4 py-3"><CostDisplay expense={exp} /></td>
                                        <td className="px-4 py-3 text-center"><button onClick={() => handleEdit(exp)} className="p-2 rounded-full hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showImportModal && (
                <Modal onClose={() => setShowImportModal(false)} title="Import Expenses from CSV">
                    <ImportFlow 
                        selectedEntityId={selectedEntityId}
                        onClose={() => setShowImportModal(false)}
                        refreshData={refreshData}
                    />
                </Modal>
            )}
            {showModal && <ExpenseForm expenseToEdit={editingExpense} onClose={handleCloseModal} refreshData={refreshData} selectedEntityId={selectedEntityId} />}
        </div>
    );
};


// --- FORMS ---
const InvoiceForm: React.FC<{ projects: Project[]; onClose: () => void; refreshData: () => void; onAddNewProject: () => void; selectedEntityId: string }> = ({ projects, onClose, refreshData, onAddNewProject, selectedEntityId }) => {
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

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    }, [items]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };
    
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
        
        // Find entity from selected project if available, otherwise use global selected or error
        const selectedProject = projects.find(p => p.id === formData.project_id);
        const entityIdToUse = selectedProject ? selectedProject.entity_id : (selectedEntityId !== 'all' ? selectedEntityId : null);

        if (!entityIdToUse) {
            alert("Please select a valid project associated with a trading entity.");
            setIsSubmitting(false);
            return;
        }

        const invoiceData = { ...formData, amount: totalAmount, entity_id: entityIdToUse };

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-end space-x-2">
                        <div className="flex-grow">
                            <label className="block text-sm font-medium text-slate-300">Project</label>
                            <select name="project_id" value={formData.project_id} onChange={handleFormChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white">
                                <option value="">Select a project</option>
                                {(Object.entries(groupedProjects) as [string, Project[]][]).map(([clientName, clientProjects]) => (
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
                </div>
                
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
                
                <div className="text-right space-y-1 text-slate-300">
                    <p className="text-xl font-bold text-white border-t border-slate-600 pt-2 mt-2">Total: <span className="">{formatCurrency(totalAmount)}</span></p>
                </div>

                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md mt-6" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Invoice'}
                </button>
            </form>
        </Modal>
    );
};

const ProjectForm: React.FC<{ projectToEdit?: Project | null; onClose: () => void; refreshData: () => void; selectedEntityId: string }> = ({ projectToEdit, onClose, refreshData, selectedEntityId }) => {
    const [formData, setFormData] = useState({ 
        name: projectToEdit?.name || '', 
        client_name: projectToEdit?.client_name || '',
        client_email: projectToEdit?.client_email || ''
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // If creating new and no entity selected, show error
        if (!projectToEdit && selectedEntityId === 'all') {
            alert("Please select a specific Trading Identity (e.g., Montford Digital) from the sidebar before creating a project.");
            return;
        }

        let error;
        if (projectToEdit) {
            ({ error } = await supabase.from('projects').update(formData).eq('id', projectToEdit.id));
        } else {
            // Include entity_id for new records
            ({ error } = await supabase.from('projects').insert([{...formData, entity_id: selectedEntityId }]));
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

const ExpenseForm: React.FC<{ expenseToEdit?: Expense | null; onClose: () => void; refreshData: () => void; selectedEntityId: string }> = ({ expenseToEdit, onClose, refreshData, selectedEntityId }) => {
    const [formData, setFormData] = useState({
        name: expenseToEdit?.name || '',
        description: expenseToEdit?.description || '', 
        amount: expenseToEdit?.amount || '',
        currency: expenseToEdit?.currency || 'GBP',
        category: expenseToEdit?.category || '', 
        start_date: expenseToEdit?.start_date ? new Date(expenseToEdit.start_date).toISOString().split('T')[0] : '',
        end_date: expenseToEdit?.end_date ? new Date(expenseToEdit.end_date).toISOString().split('T')[0] : '',
        type: expenseToEdit?.type || 'manual',
        billing_cycle: expenseToEdit?.billing_cycle || null
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || '' : value,
            billing_cycle: name === 'type' && value === 'manual' ? null : prev.billing_cycle
        }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const expenseData = {
            name: formData.name,
            description: formData.description,
            amount: formData.amount,
            currency: formData.currency.toUpperCase(),
            category: formData.category,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            type: formData.type,
            billing_cycle: formData.type === 'subscription' ? formData.billing_cycle : null,
        };
        
        let error;
        if (expenseToEdit) {
            ({ error } = await supabase.from('expenses').update(expenseData).eq('id', expenseToEdit.id));
        } else {
             if (selectedEntityId === 'all') {
                alert("Please select a specific Trading Identity from the sidebar before adding expenses.");
                return;
            }
            ({ error } = await supabase.from('expenses').insert([{...expenseData, entity_id: selectedEntityId }]));
        }

        if (error) {
            console.error("Error saving expense:", error);
            alert(`Error: ${error.message}`);
        } else {
            refreshData();
            onClose();
        }
    };
    
    return (
        <Modal onClose={onClose} title={expenseToEdit ? "Edit Expense" : "Add New Expense"}>
             <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-300">Name / Title</label><input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-300">Description</label><textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-300">Amount</label><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                    <div><label className="block text-sm font-medium text-slate-300">Currency</label><input type="text" name="currency" value={formData.currency} onChange={handleChange} required maxLength={3} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white uppercase" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-300">Start Date</label><input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                    <div><label className="block text-sm font-medium text-slate-300">End Date (Optional)</label><input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Expense Type</label>
                    <select name="type" value={formData.type} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white">
                        <option value="manual">Manual</option>
                        <option value="subscription">Subscription</option>
                    </select>
                </div>
                {formData.type === 'subscription' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Billing Cycle</label>
                        <select name="billing_cycle" value={formData.billing_cycle || ''} onChange={handleChange} required className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white">
                             <option value="">Select cycle</option>
                            <option value="monthly">Monthly</option>
                            <option value="annually">Annually</option>
                        </select>
                    </div>
                )}
                <div><label className="block text-sm font-medium text-slate-300">Category</label><input type="text" name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md">{expenseToEdit ? 'Save Changes' : 'Save Expense'}</button>
            </form>
        </Modal>
    );
};

// --- Main Dashboard Component ---
const DashboardPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Identity State
    const [identities, setIdentities] = useState<TradingIdentity[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch initial identities
    useEffect(() => {
        const fetchIdentities = async () => {
            const { data } = await supabase.from('trading_identities').select('*');
            if (data) setIdentities(data);
        };
        fetchIdentities();
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Construct queries based on selection
            let projectsQuery = supabase.from('projects').select('*').order('name');
            let invoicesQuery = supabase.from('invoices').select('*, projects(name), invoice_items(*)').order('issue_date', { ascending: false });
            let expensesQuery = supabase.from('expenses').select('*').order('start_date', { ascending: false });

            // Apply filters if specific entity selected
            if (selectedEntityId !== 'all') {
                projectsQuery = projectsQuery.eq('entity_id', selectedEntityId);
                invoicesQuery = invoicesQuery.eq('entity_id', selectedEntityId);
                expensesQuery = expensesQuery.eq('entity_id', selectedEntityId);
            }
            
            const [{ data: projectsData, error: projectsError }, { data: invoicesData, error: invoicesError }, { data: expensesData, error: expensesError }] = await Promise.all([projectsQuery, invoicesQuery, expensesQuery]);

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
    }, [selectedEntityId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const processedExpenses = useMemo(() => {
        const today = new Date();
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        return expenses.map(exp => {
            if (!exp.start_date) return exp; // Guard against invalid data

            const startDateParts = exp.start_date.split('-').map(Number);
            const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
            
            const endDate = exp.end_date ? (() => {
                const endDateParts = exp.end_date.split('-').map(Number);
                return new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
            })() : null;

            let status: ExpenseStatus;

            if (exp.type === 'subscription') {
                if (endDate && endDate < todayDateOnly) {
                    status = 'inactive';
                } else if (startDate > todayDateOnly) {
                    status = 'upcoming';
                } else {
                    status = 'active';
                }
            } else { // manual
                status = startDate <= todayDateOnly ? 'completed' : 'upcoming';
            }
            
            if (exp.status !== status) {
                return { ...exp, status };
            }
            return exp;
        });
    }, [expenses]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { path: "/dashboard", label: "Overview" },
        { path: "/dashboard/projects", label: "Projects" },
        { path: "/dashboard/invoices", label: "Invoices" },
        { path: "/dashboard/expenses", label: "Outgoings" },
    ];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 flex">
            <aside className="w-64 bg-slate-800 p-6 border-r border-slate-700 flex-col hidden md:flex">
                <h1 className="text-xl font-bold text-white mb-8">Admin Dashboard</h1>
                
                {/* Identity Switcher */}
                <div className="mb-8">
                    <label className="block text-xs uppercase text-slate-500 font-semibold mb-2">View Data For</label>
                    <div className="relative">
                        <select 
                            value={selectedEntityId} 
                            onChange={(e) => setSelectedEntityId(e.target.value)}
                            className="w-full appearance-none bg-slate-900 border border-slate-600 hover:border-cyan-500 text-white py-2 px-3 rounded leading-tight focus:outline-none focus:shadow-outline transition-colors cursor-pointer"
                        >
                            <option value="all">All Group Data</option>
                            {(identities as TradingIdentity[]).map(id => (
                                <option key={id.id} value={id.id}>{id.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>

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
                        <Route index element={<DashboardOverview invoices={invoices} expenses={processedExpenses} />} />
                        <Route path="projects" element={<ProjectsPage projects={projects} refreshData={fetchData} selectedEntityId={selectedEntityId} />} />
                        <Route path="invoices" element={<InvoicesPage invoices={invoices} projects={projects} refreshData={fetchData} selectedEntityId={selectedEntityId} />} />
                        <Route path="expenses" element={<ExpensesPage expenses={processedExpenses} refreshData={fetchData} selectedEntityId={selectedEntityId} />} />
                    </Routes>
                 )}
            </main>
        </div>
    );
};

export default DashboardPage;