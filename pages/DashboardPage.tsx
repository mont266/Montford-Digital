
// Fix: Corrected import statement for React hooks.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImportFlow from './ImportPage';
import TaxCentrePage from './TaxCentrePage';

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
  split_group_id?: string | null;
  split_part?: number | null;
}

type ExpenseStatus = 'upcoming' | 'completed' | 'active' | 'inactive';

interface ExpenseAttachment {
    id: string;
    expense_id: string;
    file_path: string;
    file_name: string;
    payment_date: string;
    uploaded_at: string;
}

interface Expense {
  id: string;
  name?: string;
  description: string;
  amount: number; // Original amount
  currency?: string; // Original currency
  amount_gbp: number; // Standardized amount in GBP
  category: string;
  start_date: string;
  // Fix: Allow null for end_date and billing_cycle to match form submission logic.
  end_date?: string | null;
  type: 'manual' | 'subscription';
  billing_cycle?: 'monthly' | 'annually' | null;
  status: ExpenseStatus;
  entity_id: string;
  expense_attachments: { count: number }[];
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

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; title: string, size?: 'md' | 'lg' | 'xl' }> = ({ children, onClose, title, size = 'lg' }) => {
    const sizeClasses = {
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
    };
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-start p-4 overflow-y-auto" onClick={onClose}>
            <div className={`bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full ${sizeClasses[size]} my-8 p-6`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

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

    const { 
        filteredInvoices, 
        filteredExpenses, 
        totalExpensesInPeriod,
        totalSubscriptionSpendInPeriod
    } = useMemo(() => {
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
        
        // This is used for the "One-Time Payments" card. Filtering by start_date is correct for this specific purpose.
        const filteredExpensesForCards = expenses.filter(exp => filterByDate(new Date(exp.start_date)));
        
        // Correctly calculate total spend in period, accounting for recurring subscriptions.
        const totalExpenses = expenses.reduce((sum, exp) => {
            if (exp.type === 'manual') {
                const expenseDate = new Date(exp.start_date);
                if ((!startDate || expenseDate >= startDate) && (!endDate || expenseDate <= endDate)) {
                    return sum + exp.amount_gbp;
                }
                return sum;
            }

            if (exp.type === 'subscription' && exp.billing_cycle) {
                let spendInPeriod = 0;
                const subStartDate = new Date(exp.start_date);
                const periodEndDate = endDate || today;
                
                const effectiveSubEndDate = exp.end_date ? new Date(exp.end_date) : periodEndDate;
                
                const finalEndDate = periodEndDate < effectiveSubEndDate ? periodEndDate : effectiveSubEndDate;

                if (subStartDate > finalEndDate) return sum;

                let paymentDate = new Date(subStartDate);
                while (paymentDate <= finalEndDate) {
                    if (!startDate || paymentDate >= startDate) {
                         spendInPeriod += exp.amount_gbp;
                    }
                    
                    if (exp.billing_cycle === 'monthly') {
                        paymentDate.setMonth(paymentDate.getMonth() + 1);
                    } else { // annually
                        paymentDate.setFullYear(paymentDate.getFullYear() + 1);
                    }
                }
                return sum + spendInPeriod;
            }
            return sum;
        }, 0);
        
        const subscriptionSpend = expenses.reduce((sum, exp) => {
            if (exp.type === 'subscription' && exp.billing_cycle) {
                let spendInPeriod = 0;
                const subStartDate = new Date(exp.start_date);
                const periodEndDate = endDate || today;
                
                const effectiveSubEndDate = exp.end_date ? new Date(exp.end_date) : periodEndDate;
                const finalEndDate = periodEndDate < effectiveSubEndDate ? periodEndDate : effectiveSubEndDate;

                if (subStartDate > finalEndDate) return sum;

                let paymentDate = new Date(subStartDate);
                while (paymentDate <= finalEndDate) {
                    if (!startDate || paymentDate >= startDate) {
                         spendInPeriod += exp.amount_gbp;
                    }
                    
                    if (exp.billing_cycle === 'monthly') {
                        paymentDate.setMonth(paymentDate.getMonth() + 1);
                    } else { // annually
                        paymentDate.setFullYear(paymentDate.getFullYear() + 1);
                    }
                }
                return sum + spendInPeriod;
            }
            return sum;
        }, 0);

        return { 
            filteredInvoices, 
            filteredExpenses: filteredExpensesForCards, 
            totalExpensesInPeriod: totalExpenses,
            totalSubscriptionSpendInPeriod: subscriptionSpend
        };

    }, [timeSpan, invoices, expenses]);


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
        <div className="space-y-10">
            <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                     <h2 className="text-2xl font-bold text-white">Overview</h2>
                     <div className="flex flex-wrap justify-end space-x-2 bg-slate-800 border border-slate-700 rounded-md p-1">
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
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold text-white mb-4">Expense Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Active Subscriptions" value={`${formatCurrency(monthlySubscriptions)}/mo`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
                    <StatCard title={`Subscriptions Spend (${timeSpanLabels[timeSpan]})`} value={formatCurrency(totalSubscriptionSpendInPeriod)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} />
                    <StatCard title="One-Time Payments" value={formatCurrency(oneTimePayments)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.93L5 10m7 0a2 2 0 012 2v5" /></svg>} />
                </div>
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
            <div className="bg-slate-800 md:border md:border-slate-700 md:rounded-lg overflow-x-auto">
                <table className="min-w-full md:divide-y md:divide-slate-700 responsive-table">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="md:divide-y md:divide-slate-700">
                        {projects.map(project => (
                            <tr key={project.id}>
                                <td data-label="Project Name" className="px-6 py-4 whitespace-nowrap text-sm text-white">{project.name}</td>
                                <td data-label="Client Name" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{project.client_name}</td>
                                <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="actions-cell">
                                        <button onClick={() => handleEdit(project)} className="text-cyan-400 hover:text-cyan-300">Edit</button>
                                        <button onClick={() => handleDelete(project.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                    </div>
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
    const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
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

    const handleDelete = async (id: string, groupId?: string | null) => {
        const confirmMessage = groupId
            ? "This is part of a split invoice. Are you sure you want to delete BOTH parts?"
            : "Are you sure you want to delete this invoice?";

        if (window.confirm(confirmMessage)) {
            let query = supabase.from('invoices').delete();
            if (groupId) {
                query = query.eq('split_group_id', groupId);
            } else {
                query = query.eq('id', id);
            }
            const { error } = await query;
            if (error) console.error("Error deleting invoice(s):", error);
            else refreshData();
        }
    };
    
    // We need to sort paid invoices by date to correctly calculate running total
    const sortedInvoices = useMemo(() => [...invoices].sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()), [invoices]);
    
    const processedInvoices = useMemo(() => {
        const splitInvoices = new Map<string, Invoice[]>();
        const regularInvoices: Invoice[] = [];

        sortedInvoices.forEach(inv => {
            if (inv.split_group_id) {
                if (!splitInvoices.has(inv.split_group_id)) {
                    splitInvoices.set(inv.split_group_id, []);
                }
                splitInvoices.get(inv.split_group_id)!.push(inv);
            } else {
                regularInvoices.push(inv);
            }
        });
        
        splitInvoices.forEach(parts => parts.sort((a, b) => (a.split_part || 0) - (b.split_part || 0)));
        
        return { regularInvoices, splitInvoices };
    }, [sortedInvoices]);

    const toggleSplitExpansion = (groupId: string) => {
        setExpandedSplits(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) newSet.delete(groupId);
            else newSet.add(groupId);
            return newSet;
        });
    };

    let runningPaidTotalThisYear = 0;
    
    const InvoiceRow: React.FC<{ invoice: Invoice; isSubRow?: boolean }> = ({ invoice, isSubRow = false }) => {
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
            <tr className={isSubRow ? "bg-slate-800/50" : "hover:bg-slate-800/50"}>
                <td data-label="Number" className={`px-6 py-4 whitespace-nowrap text-sm text-white ${isSubRow ? 'md:pl-10' : ''}`}>
                    <div className="flex items-center justify-end md:justify-start">
                        {isSubRow && <span className="mr-2 text-slate-500 hidden md:inline">↳</span>}
                        {invoice.invoice_number}
                    </div>
                </td>
                <td data-label="Project" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{invoice.projects?.name || 'N/A'}</td>
                <td data-label="Amount" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(invoice.amount)}</td>
                <td data-label="Created" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(invoice.created_at).toLocaleDateString('en-GB')}</td>
                <td data-label="Due Date" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                <td data-label="Status" className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="status-cell">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' : (invoice.status === 'sent' && new Date(invoice.due_date) < new Date()) ? 'bg-red-500/20 text-red-300' : invoice.status === 'draft' ? 'bg-gray-500/20 text-gray-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{invoice.status}</span>
                    </div>
                </td>
                <td data-label="Financials" className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                    <div className="financials-cell">
                        <span>Fee (Est.): <span className="font-medium text-slate-300">{formatCurrency(effectiveStripeFee)}</span></span>
                        <span>Tax (Est.): <span className="font-medium text-slate-300">{formatCurrency(totalTax)}</span></span>
                        <span className="font-semibold text-white mt-1 pt-1 border-t border-slate-700">Take-home: {formatCurrency(takeHome)}</span>
                    </div>
                </td>
                <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                     <div className="actions-cell">
                        <div className="relative inline-block text-left actions-dropdown-container">
                            <button onClick={() => setOpenDropdownId(openDropdownId === invoice.id ? null : invoice.id)} className="inline-flex justify-center w-full rounded-full p-2 text-sm font-medium text-slate-400 hover:bg-slate-700 focus:outline-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>
                            {openDropdownId === invoice.id && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-slate-900 ring-1 ring-black ring-opacity-5 z-20">
                                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                        <Link to={`/invoice/${invoice.id}`} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full text-left" role="menuitem">View</Link>
                                        {invoice.status === 'draft' && <button onClick={() => { handleUpdateStatus(invoice.id, 'sent'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" role="menuitem">Mark Sent</button>}
                                        {invoice.status !== 'paid' && <button onClick={() => { handleUpdateStatus(invoice.id, 'paid'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" role="menuitem">Mark Paid</button>}
                                        <div className="border-t border-slate-700 my-1"></div>
                                        <button onClick={() => { handleDelete(invoice.id, invoice.split_group_id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300" role="menuitem">Delete</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Invoices</h2>
                <button onClick={() => setShowInvoiceModal(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Create Invoice</button>
            </div>
            <div className={`bg-slate-800 md:border md:border-slate-700 md:rounded-lg ${openDropdownId ? 'overflow-visible' : 'overflow-x-auto'}`}>
                <table className="min-w-full md:divide-y md:divide-slate-700 responsive-table">
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
                    <tbody className="md:divide-y md:divide-slate-700">
                        {processedInvoices.regularInvoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} />)}
                        {Array.from(processedInvoices.splitInvoices.entries()).map(([groupId, parts]) => {
                            const totalAmount = parts.reduce((sum, p) => sum + p.amount, 0);
                            const mainPart = parts[0];
                            const isExpanded = expandedSplits.has(groupId);
                            const overallStatus = parts.every(p => p.status === 'paid') ? 'Paid' : parts.some(p => p.status === 'sent' && new Date(p.due_date) < new Date()) ? 'Overdue' : 'In Progress';
                             const baseInvoiceNumber = mainPart.invoice_number.split('-').slice(0, 2).join('-');

                            return (
                                <React.Fragment key={groupId}>
                                    <tr className="hover:bg-slate-800/50 cursor-pointer" onClick={() => toggleSplitExpansion(groupId)}>
                                        <td data-label="Number" className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                            <div className="actions-cell">
                                                {baseInvoiceNumber}
                                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">SPLIT</span>
                                            </div>
                                        </td>
                                        <td data-label="Project" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{mainPart.projects?.name || 'N/A'}</td>
                                        <td data-label="Amount" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold">{formatCurrency(totalAmount)}</td>
                                        <td data-label="Created" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(mainPart.created_at).toLocaleDateString('en-GB')}</td>
                                        <td data-label="Due Date" className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">-</td>
                                        <td data-label="Status" className="px-6 py-4 whitespace-nowrap text-sm">{overallStatus}</td>
                                        <td data-label="Financials" className="px-6 py-4"></td>
                                        <td data-label="Actions" className="px-6 py-4 text-right">
                                            <button className={`transition-transform transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && parts.map(part => <InvoiceRow key={part.id} invoice={part} isSubRow />)}
                                </React.Fragment>
                            );
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
        const endDateParts = (expense.end_date as string).split('-').map(Number);
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

const ExpensesPage: React.FC<{ expenses: Expense[]; refreshData: () => void; selectedEntityId: string; setAttachmentModalExpense: (expense: Expense | null) => void; }> = ({ expenses, refreshData, selectedEntityId, setAttachmentModalExpense }) => {
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
    
    const handleOpenAttachments = (expense: Expense) => {
        setAttachmentModalExpense(expense);
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
                const endDateParts = (exp.end_date as string).split('-').map(Number);
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
                 <div className="flex items-center gap-2 flex-wrap justify-end">
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
                     <div className="bg-slate-800 md:border md:border-slate-700 md:rounded-lg overflow-x-auto">
                        <table className="min-w-full md:divide-y md:divide-slate-700 text-sm responsive-table">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Service</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Category</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Date Range</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 uppercase">Cost</th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Attachments</th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="md:divide-y md:divide-slate-700">
                                {subscriptionOutgoings.map(exp => (
                                    <tr key={exp.id} className={exp.status === 'inactive' ? 'opacity-50' : ''}>
                                        <td data-label="Service" className="px-4 py-3 text-white font-semibold">{exp.name || exp.description}</td>
                                        <td data-label="Category" className="px-4 py-3">{exp.category}</td>
                                        <td data-label="Date Range" className="px-4 py-3">{formatDate(exp.start_date)} - {exp.end_date ? formatDate(exp.end_date) : 'Present'}</td>
                                        <td data-label="Status" className="px-4 py-3"><div className="status-cell"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${statusChipStyles[exp.status]}`}>{exp.status}</span></div></td>
                                        <td data-label="Cost" className="px-4 py-3"><CostDisplay expense={exp} /></td>
                                        <td data-label="Attachments" className="px-4 py-3 text-center">
                                            <div className="actions-cell justify-center md:justify-end">
                                                <button onClick={() => handleOpenAttachments(exp)} className="flex items-center justify-center gap-2 mx-auto px-3 py-1 text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                    <span>{exp.expense_attachments[0]?.count || 0}</span>
                                                </button>
                                            </div>
                                        </td>
                                        <td data-label="Actions" className="px-4 py-3 text-center">
                                            <div className="actions-cell justify-center md:justify-end">
                                                <button onClick={() => handleEdit(exp)} className="p-2 rounded-full hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-white mb-4">Manual Outgoings</h3>
                     <div className="bg-slate-800 md:border md:border-slate-700 md:rounded-lg overflow-x-auto">
                        <table className="min-w-full md:divide-y md:divide-slate-700 text-sm responsive-table">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Item/Service</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Category</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase">Purchase Date</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 uppercase">Amount</th>
                                     <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Attachments</th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="md:divide-y md:divide-slate-700">
                                {manualOutgoings.map(exp => (
                                    <tr key={exp.id} className={exp.status === 'completed' ? 'opacity-70' : ''}>
                                        <td data-label="Item/Service" className="px-4 py-3 text-white font-semibold">{exp.name || exp.description}</td>
                                        <td data-label="Category" className="px-4 py-3">{exp.category}</td>
                                        <td data-label="Purchase Date" className="px-4 py-3">{formatDate(exp.start_date)}</td>
                                        <td data-label="Amount" className="px-4 py-3"><CostDisplay expense={exp} /></td>
                                        <td data-label="Attachments" className="px-4 py-3 text-center">
                                            <div className="actions-cell justify-center md:justify-end">
                                                <button onClick={() => handleOpenAttachments(exp)} className="flex items-center justify-center gap-2 mx-auto px-3 py-1 text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                    <span>{exp.expense_attachments[0]?.count || 0}</span>
                                                </button>
                                            </div>
                                        </td>
                                        <td data-label="Actions" className="px-4 py-3 text-center">
                                            <div className="actions-cell justify-center md:justify-end">
                                                <button onClick={() => handleEdit(exp)} className="p-2 rounded-full hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                                                <button onClick={() => handleDelete(exp.id)} className="p-2 rounded-full hover:bg-slate-700 text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </td>
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
    const [formData, setFormData] = useState({ 
        project_id: '', 
        invoice_number: '', 
        issue_date: '', 
        due_date: '', 
        due_date_part1: '',
        due_date_part2: '',
        status: 'draft' 
    });
    const [isSplitInvoice, setIsSplitInvoice] = useState(false);
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
        
        const selectedProject = projects.find(p => p.id === formData.project_id);
        const entityIdToUse = selectedProject ? selectedProject.entity_id : (selectedEntityId !== 'all' ? selectedEntityId : null);

        if (!entityIdToUse) {
            alert("Please select a valid project associated with a trading entity.");
            setIsSubmitting(false);
            return;
        }

        if (isSplitInvoice) {
            const splitGroupId = crypto.randomUUID();
            const splitAmount = totalAmount / 2;

            // Explicitly build the objects to avoid sending formData's extra fields
            const invoiceData1 = {
                project_id: formData.project_id,
                invoice_number: `${formData.invoice_number}-A`,
                issue_date: formData.issue_date,
                due_date: formData.due_date_part1,
                status: formData.status,
                amount: splitAmount,
                entity_id: entityIdToUse,
                split_group_id: splitGroupId,
                split_part: 1,
            };
            const invoiceData2 = {
                project_id: formData.project_id,
                invoice_number: `${formData.invoice_number}-B`,
                issue_date: formData.issue_date,
                due_date: formData.due_date_part2,
                status: formData.status,
                amount: splitAmount,
                entity_id: entityIdToUse,
                split_group_id: splitGroupId,
                split_part: 2,
            };
            
            const { data: newInvoice1, error: invoiceError1 } = await supabase.from('invoices').insert(invoiceData1).select().single();
            if (invoiceError1) { console.error("Error creating invoice part 1:", invoiceError1); setIsSubmitting(false); return; }

            const { data: newInvoice2, error: invoiceError2 } = await supabase.from('invoices').insert(invoiceData2).select().single();
            if (invoiceError2) { console.error("Error creating invoice part 2:", invoiceError2); await supabase.from('invoices').delete().eq('id', newInvoice1.id); setIsSubmitting(false); return; }

            // Explicitly build item objects to avoid sending transient state fields like 'id'
            const itemsPart1 = items.map(item => ({ description: item.description, quantity: item.quantity, unit_price: item.unit_price / 2, invoice_id: newInvoice1.id }));
            const itemsPart2 = items.map(item => ({ description: item.description, quantity: item.quantity, unit_price: item.unit_price / 2, invoice_id: newInvoice2.id }));

            const { error: itemsError1 } = await supabase.from('invoice_items').insert(itemsPart1);
            if (itemsError1) { console.error("Error creating items for part 1:", itemsError1); await supabase.from('invoices').delete().eq('split_group_id', splitGroupId); setIsSubmitting(false); return; }

            const { error: itemsError2 } = await supabase.from('invoice_items').insert(itemsPart2);
            if (itemsError2) { console.error("Error creating items for part 2:", itemsError2); await supabase.from('invoices').delete().eq('split_group_id', splitGroupId); await supabase.from('invoice_items').delete().eq('invoice_id', newInvoice1.id); setIsSubmitting(false); return; }
        } else {
            // Explicitly build the object to avoid sending formData's extra fields
            const invoiceData = {
                project_id: formData.project_id,
                invoice_number: formData.invoice_number,
                issue_date: formData.issue_date,
                due_date: formData.due_date,
                status: formData.status,
                amount: totalAmount,
                entity_id: entityIdToUse,
            };
            const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert(invoiceData).select().single();
            if (invoiceError || !newInvoice) { console.error("Error creating invoice:", invoiceError); setIsSubmitting(false); return; }

            // Explicitly build item objects
            const itemsToInsert = items.map(item => ({ description: item.description, quantity: item.quantity, unit_price: item.unit_price, invoice_id: newInvoice.id }));
            const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
            if (itemsError) { console.error("Error creating invoice items:", itemsError); await supabase.from('invoices').delete().eq('id', newInvoice.id); }
        }

        refreshData();
        onClose();
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
                     <div className="flex items-center space-x-2 pt-6">
                        <input id="split-invoice-checkbox" type="checkbox" checked={isSplitInvoice} onChange={(e) => setIsSplitInvoice(e.target.checked)} className="h-4 w-4 rounded border-slate-500 text-cyan-600 focus:ring-cyan-500" />
                        <label htmlFor="split-invoice-checkbox" className="text-sm font-medium text-slate-300">Create 50/50 Split Invoice</label>
                    </div>
                </div>

                {isSplitInvoice && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-md border border-slate-700">
                        <div><label className="block text-sm font-medium text-slate-300">Upfront 50% Due Date</label><input type="date" name="due_date_part1" value={formData.due_date_part1} onChange={handleFormChange} required={isSplitInvoice} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                        <div><label className="block text-sm font-medium text-slate-300">Completion 50% Due Date</label><input type="date" name="due_date_part2" value={formData.due_date_part2} onChange={handleFormChange} required={isSplitInvoice} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                    </div>
                )}
                {!isSplitInvoice && (
                     <div><label className="block text-sm font-medium text-slate-300">Due Date</label><input type="date" name="due_date" value={formData.due_date} onChange={handleFormChange} required={!isSplitInvoice} className="mt-1 w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white" /></div>
                )}
                
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
                    <p className="text-sm">Total Project Value:</p>
                    <p className="text-xl font-bold text-white border-t border-slate-600 pt-2 mt-2">{formatCurrency(totalAmount)}</p>
                    {isSplitInvoice && <p className="text-sm text-cyan-400">2 x Invoices of {formatCurrency(totalAmount / 2)}</p>}
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
    const [attachmentModalExpense, setAttachmentModalExpense] = useState<Expense | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);


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
            let expensesQuery = supabase.from('expenses').select('*, expense_attachments(count)').order('start_date', { ascending: false });

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
            setExpenses(expensesData as Expense[] || []);
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
                const endDateParts = (exp.end_date as string).split('-').map(Number);
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
        { path: "/dashboard/tax", label: "Tax Centre" },
    ];
    
    const pageTitles: { [key:string]: string } = {
        "/dashboard": "Overview",
        "/dashboard/projects": "Projects",
        "/dashboard/invoices": "Invoices",
        "/dashboard/expenses": "Outgoings",
        "/dashboard/tax": "Tax Centre"
    };
    
    const currentPageTitle = pageTitles[location.pathname] || "Dashboard";

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col md:flex-row">
            <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-800 p-6 border-r border-slate-700 flex flex-col z-40 transform transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
                                <Link to={item.path} onClick={() => setIsSidebarOpen(false)} className={`block px-4 py-2 rounded-md transition-colors ${location.pathname === item.path ? 'bg-cyan-500 text-white' : 'hover:bg-slate-700'}`}>
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
            
            <div className="flex-1 flex flex-col">
                 <div className="md:hidden bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-30">
                    <h1 className="text-lg font-bold text-white">{currentPageTitle}</h1>
                    <button onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>

                <main className="flex-1 p-4 sm:p-8 overflow-y-auto relative">
                    {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

                    {loading && <div className="text-center">Loading dashboard data...</div>}
                    {error && <div className="text-center text-red-400">Error: {error}</div>}
                    {!loading && !error && (
                        <>
                            <Routes>
                                <Route index element={<DashboardOverview invoices={invoices} expenses={processedExpenses} />} />
                                <Route path="projects" element={<ProjectsPage projects={projects} refreshData={fetchData} selectedEntityId={selectedEntityId} />} />
                                <Route path="invoices" element={<InvoicesPage invoices={invoices} projects={projects} refreshData={fetchData} selectedEntityId={selectedEntityId} />} />
                                <Route path="expenses" element={<ExpensesPage expenses={processedExpenses} refreshData={fetchData} selectedEntityId={selectedEntityId} setAttachmentModalExpense={setAttachmentModalExpense} />} />
                                <Route path="tax" element={<TaxCentrePage invoices={invoices} expenses={processedExpenses} setAttachmentModalExpense={setAttachmentModalExpense} />} />
                            </Routes>
                            {attachmentModalExpense && <AttachmentModal expense={attachmentModalExpense} onClose={() => setAttachmentModalExpense(null)} refreshData={fetchData} />}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DashboardPage;
const AttachmentModal: React.FC<{ expense: Expense; onClose: () => void; refreshData: () => void }> = ({ expense, onClose, refreshData }) => {
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null); // Holds the date string of the period being uploaded to

    const fetchAttachments = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('expense_attachments')
            .select('*')
            .eq('expense_id', expense.id)
            .order('payment_date', { ascending: false });
        
        if (error) {
            setError(error.message);
        } else {
            setAttachments(data);
        }
        setLoading(false);
    }, [expense.id]);

    useEffect(() => {
        fetchAttachments();
    }, [fetchAttachments]);

    const handleUpload = async (file: File, paymentDate: Date) => {
        if (!file) return;

        const paymentDateString = paymentDate.toISOString().split('T')[0];
        setUploading(paymentDateString);
        setError(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${paymentDateString}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const filePath = `${expense.entity_id}/${expense.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('expense-invoices')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from('expense_attachments').insert({
                expense_id: expense.id,
                file_path: filePath,
                file_name: fileName,
                payment_date: paymentDateString,
            });

            if (dbError) throw dbError;

            await fetchAttachments(); // Refresh list
            refreshData(); // Refresh main dashboard data to update counts

        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(null);
        }
    };
    
    const handleDelete = async (attachment: ExpenseAttachment) => {
        if (!window.confirm(`Are you sure you want to delete "${attachment.file_name}"?`)) return;

        try {
            const { error: storageError } = await supabase.storage
                .from('expense-invoices')
                .remove([attachment.file_path]);

            if (storageError) throw storageError;

            const { error: dbError } = await supabase
                .from('expense_attachments')
                .delete()
                .eq('id', attachment.id);

            if (dbError) throw dbError;

            await fetchAttachments();
            refreshData();
        } catch (err: any) {
            setError(err.message);
        }
    }

    const getPublicUrl = (filePath: string) => {
        const { data } = supabase.storage.from('expense-invoices').getPublicUrl(filePath);
        return data.publicUrl;
    };

    const paymentPeriods = useMemo(() => {
        if (expense.type === 'manual') {
            return [{ date: new Date(expense.start_date), label: 'Invoice(s)' }];
        }
        
        const periods: { date: Date, label: string }[] = [];
        const today = new Date();
        let currentDate = new Date(expense.start_date);
        const endDate = expense.end_date ? new Date(expense.end_date) : today;

        while (currentDate <= endDate) {
            periods.push({
                date: new Date(currentDate),
                label: currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
            });
            if (expense.billing_cycle === 'monthly') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (expense.billing_cycle === 'annually') {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
            } else {
                break; // Should not happen for subscriptions
            }
        }
        return periods.reverse(); // Show most recent first
    }, [expense]);

    const FileInput: React.FC<{ paymentDate: Date }> = ({ paymentDate }) => {
        const id = `file-upload-${paymentDate.toISOString()}`;
        return (
            <>
                <input
                    type="file"
                    id={id}
                    className="hidden"
                    onChange={(e) => e.target.files && handleUpload(e.target.files[0], paymentDate)}
                    disabled={uploading !== null}
                />
                <label htmlFor={id} className="cursor-pointer bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors">
                    Upload
                </label>
            </>
        )
    };
    
    return (
        <Modal onClose={onClose} title={`Attachments for: ${expense.name || expense.description}`} size="xl">
            {error && <p className="mb-4 text-center text-red-400 bg-red-500/10 p-2 rounded-md">{error}</p>}
            <div className="max-h-[60vh] overflow-y-auto">
                {loading ? <p>Loading attachments...</p> : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900/50 sticky top-0">
                            <tr>
                                <th className="p-3">Period / Invoice Date</th>
                                <th className="p-3">Attached File</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {paymentPeriods.map(period => {
                                const periodAttachments = attachments.filter(a => a.payment_date === period.date.toISOString().split('T')[0]);
                                if (periodAttachments.length > 0) {
                                    return periodAttachments.map((att, index) => (
                                         <tr key={att.id}>
                                            <td className="p-3">{index === 0 ? period.label : ''}</td>
                                            <td className="p-3">
                                                <a href={getPublicUrl(att.file_path)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{att.file_name}</a>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => handleDelete(att)} className="text-red-400 hover:text-red-300">Delete</button>
                                            </td>
                                        </tr>
                                    ));
                                }
                                // Render a row for periods with no attachments yet
                                return (
                                    <tr key={period.date.toISOString()}>
                                        <td className="p-3">{period.label}</td>
                                        <td className="p-3 text-slate-500 italic">No invoice uploaded</td>
                                        <td className="p-3 text-right">
                                            {uploading === period.date.toISOString().split('T')[0] ? 'Uploading...' : <FileInput paymentDate={period.date} />}
                                        </td>
                                    </tr>
                                )
                            })}
                             {expense.type === 'manual' && attachments.length === 0 && (
                                <tr>
                                    <td className="p-3">{formatDate(expense.start_date)}</td>
                                    <td className="p-3 text-slate-500 italic">No invoice uploaded</td>
                                    <td className="p-3 text-right">
                                         {uploading ? 'Uploading...' : <FileInput paymentDate={new Date(expense.start_date)} />}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </Modal>
    );
};
