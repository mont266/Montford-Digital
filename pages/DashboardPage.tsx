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

interface Expense {
  id: string;
  name?: string;
  description: string;
  amount: number; 
  currency?: string; 
  amount_gbp: number; 
  category: string;
  start_date: string;
  end_date?: string | null;
  type: 'manual' | 'subscription';
  billing_cycle?: 'monthly' | 'annually' | null;
  status: ExpenseStatus;
  entity_id: string;
  expense_attachments: { count: number }[];
}

// --- Reusable Components ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; valueClassName?: string }> = ({ title, value, icon, valueClassName = "text-white" }) => (
  <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center space-x-4">
    <div className="bg-slate-900 text-cyan-400 p-3 rounded-full">{icon}</div>
    <div>
      <p className="text-slate-400 text-sm">{title}</p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  </div>
);

const formatCurrency = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);

// --- Tax Calculation Logic (Simplified for Estimates) ---
const BASE_SALARY = 46440;
const PA_THRESHOLD = 12570;
const BASIC_RATE_THRESHOLD = 50270;
const HIGHER_RATE_THRESHOLD = 125140;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const ADDITIONAL_RATE = 0.45;
const NI_LOWER_THRESHOLD = 12570;
const NI_UPPER_THRESHOLD = 50270;
const NI_LOWER_RATE = 0.06;
const NI_HIGHER_RATE = 0.02;

const calculateTaxForInvoice = (invoiceAmount: number, baseIncome: number, alreadyEarnedThisYear: number) => {
    let incomeTax = 0;
    let nationalInsurance = 0;
    const startingIncome = baseIncome + alreadyEarnedThisYear;
    for (let i = 1; i <= Math.floor(invoiceAmount); i++) {
        const currentTotalIncome = startingIncome + i;
        if (currentTotalIncome > HIGHER_RATE_THRESHOLD) incomeTax += ADDITIONAL_RATE;
        else if (currentTotalIncome > BASIC_RATE_THRESHOLD) incomeTax += HIGHER_RATE;
        else if (currentTotalIncome > PA_THRESHOLD) incomeTax += BASIC_RATE;
        if (currentTotalIncome > NI_UPPER_THRESHOLD) nationalInsurance += NI_HIGHER_RATE;
        else if (currentTotalIncome > NI_LOWER_THRESHOLD) nationalInsurance += NI_LOWER_RATE;
    }
    return incomeTax + nationalInsurance;
};

const DashboardOverview: React.FC<{ invoices: Invoice[]; expenses: Expense[] }> = ({ invoices, expenses }) => {
    type TimeSpan = 'all' | '7d' | 'mtd' | 'tfy' | 'lfy';
    const [timeSpan, setTimeSpan] = useState<TimeSpan>('all');

    const filteredData = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (timeSpan === '7d') {
            startDate = new Date(startOfToday);
            startDate.setDate(startOfToday.getDate() - 7);
        } else if (timeSpan === 'mtd') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (timeSpan === 'tfy') {
            const currentYear = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6) ? now.getFullYear() - 1 : now.getFullYear();
            startDate = new Date(currentYear, 3, 6);
        } else if (timeSpan === 'lfy') {
            const currentYear = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6) ? now.getFullYear() - 1 : now.getFullYear();
            startDate = new Date(currentYear - 1, 3, 6);
            endDate = new Date(currentYear, 3, 5);
        }

        const filter = (d: string) => {
            const date = new Date(d);
            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;
            return true;
        };

        const filteredInvoices = invoices.filter(inv => filter(inv.issue_date));
        const filteredExpenses = expenses.filter(exp => filter(exp.start_date));

        const revenue = filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
        const expenseTotal = filteredExpenses.reduce((sum, e) => sum + e.amount_gbp, 0);

        // Simple tax estimate mapping
        let runningTotal = 0;
        const taxTotal = filteredInvoices.filter(i => i.status === 'paid').sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()).reduce((sum, inv) => {
            const tax = calculateTaxForInvoice(inv.amount, BASE_SALARY, runningTotal);
            runningTotal += inv.amount;
            return sum + tax;
        }, 0);

        return { revenue, expenseTotal, taxTotal };
    }, [timeSpan, invoices, expenses]);

    const netProfit = filteredData.revenue - filteredData.expenseTotal - filteredData.taxTotal;
    
    // Determine color for profit
    const profitColor = netProfit > 0 ? 'text-green-400' : netProfit < 0 ? 'text-red-400' : 'text-slate-400';

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Financial Overview</h2>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    {(['all', '7d', 'mtd', 'tfy'] as const).map(span => (
                        <button 
                            key={span} 
                            onClick={() => setTimeSpan(span)}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${timeSpan === span ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            {span.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Revenue" 
                    value={formatCurrency(filteredData.revenue)} 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} 
                />
                <StatCard 
                    title="Expenses + Tax" 
                    value={formatCurrency(filteredData.expenseTotal + filteredData.taxTotal)} 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
                />
                <StatCard 
                    title="Net Profit" 
                    value={formatCurrency(netProfit)} 
                    valueClassName={profitColor}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} 
                />
            </div>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [invRes, expRes] = await Promise.all([
            supabase.from('invoices').select('*, projects(name)'),
            supabase.from('expenses').select('*, expense_attachments(count)')
        ]);
        if (invRes.data) setInvoices(invRes.data);
        if (expRes.data) setExpenses(expRes.data as Expense[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <div className="p-8 text-slate-400">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300">
            <nav className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-8">
                        <Link to="/dashboard" className="text-xl font-bold text-white flex items-center space-x-2">
                            <span className="text-cyan-400">Montford</span>
                            <span className="text-slate-400 font-normal">Dash</span>
                        </Link>
                        <div className="flex space-x-4">
                            <Link to="/dashboard" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/dashboard' ? 'bg-slate-900 text-white' : 'hover:text-white'}`}>Overview</Link>
                            <Link to="/dashboard/tax" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/dashboard/tax' ? 'bg-slate-900 text-white' : 'hover:text-white'}`}>Tax Centre</Link>
                            <Link to="/dashboard/import" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/dashboard/import' ? 'bg-slate-900 text-white' : 'hover:text-white'}`}>Import</Link>
                        </div>
                    </div>
                    <Link to="/" className="text-sm text-slate-400 hover:text-white">Back to Site</Link>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<DashboardOverview invoices={invoices} expenses={expenses} />} />
                    <Route path="/tax" element={<TaxCentrePage invoices={invoices} expenses={expenses} setAttachmentModalExpense={() => {}} />} />
                    <Route path="/import" element={<ImportFlow selectedEntityId="all" onClose={() => {}} refreshData={fetchData} />} />
                </Routes>
            </main>
        </div>
    );
};

export default DashboardPage;

// Minor change for commit.