import React, { useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- Types ---
interface Invoice {
  id: string;
  issue_date: string;
  amount: number; 
  status: 'draft' | 'sent' | 'paid' | 'overdue';
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

interface TaxCentrePageProps {
  invoices: Invoice[];
  expenses: Expense[];
  setAttachmentModalExpense: (expense: Expense | null) => void;
}

// --- Helpers ---
const formatCurrency = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-GB');

const getTaxYear = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth(); 
  const day = date.getDate();
  const startYear = (month > 3) || (month === 3 && day >= 6) ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
};

const getTaxYearBoundaries = (taxYear: string) => {
  const startYear = parseInt(taxYear.split('/')[0]);
  return {
    start: new Date(startYear, 3, 6),
    end: new Date(startYear + 1, 3, 5, 23, 59, 59, 999),
  };
};

const TaxCentrePage: React.FC<TaxCentrePageProps> = ({ invoices, expenses, setAttachmentModalExpense }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const availableTaxYears = useMemo(() => {
        const years = new Set<string>();
        invoices.forEach(inv => years.add(getTaxYear(new Date(inv.issue_date))));
        expenses.forEach(exp => years.add(getTaxYear(new Date(exp.start_date))));
        years.add(getTaxYear(new Date()));
        return Array.from(years).sort().reverse();
    }, [invoices, expenses]);

    const [selectedTaxYear, setSelectedTaxYear] = useState<string>(getTaxYear(new Date()));

    const taxYearData = useMemo(() => {
        const { start, end } = getTaxYearBoundaries(selectedTaxYear);
        
        const filteredInvoices = invoices.filter(inv => {
            const issueDate = new Date(inv.issue_date);
            return inv.status === 'paid' && issueDate >= start && issueDate <= end;
        });

        const filteredExpenses = expenses.filter(exp => {
             const startDate = new Date(exp.start_date);
             if (exp.type === 'manual') {
                 return startDate >= start && startDate <= end;
             }
             if (exp.type === 'subscription') {
                const subEndDate = exp.end_date ? new Date(exp.end_date) : end;
                if (startDate > end || subEndDate < start) return false;
                return true;
             }
             return false;
        });

        const totalTurnover = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount_gbp, 0);
        const taxableProfit = totalTurnover - totalExpenses;

        const searchableExpenses = filteredExpenses.filter(exp => 
           (exp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
           exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           exp.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            totalTurnover,
            totalExpenses,
            taxableProfit,
            filteredExpenses: searchableExpenses
        };
    }, [selectedTaxYear, invoices, expenses, searchTerm]);

    // Conditional styling for the profit card
    const profitColor = taxYearData.taxableProfit > 0 ? 'text-green-400' : taxYearData.taxableProfit < 0 ? 'text-red-400' : 'text-slate-400';
    const profitBorder = taxYearData.taxableProfit > 0 ? 'border-green-500/30' : taxYearData.taxableProfit < 0 ? 'border-red-500/30' : 'border-slate-700';

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Tax Centre</h2>
                <div className="flex items-center gap-4">
                    <label htmlFor="tax-year-select" className="text-slate-400 font-medium">Tax Year:</label>
                    <select 
                        id="tax-year-select"
                        value={selectedTaxYear} 
                        onChange={(e) => setSelectedTaxYear(e.target.value)}
                        className="bg-slate-800 border border-slate-600 text-white py-2 px-3 rounded-md focus:outline-none focus:border-cyan-500 transition-colors"
                    >
                        {availableTaxYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Total Turnover</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(taxYearData.totalTurnover)}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Total Expenses</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(taxYearData.totalExpenses)}</p>
                </div>
                <div className={`bg-slate-800 p-6 rounded-lg border ${profitBorder}`}>
                    <p className="text-sm text-slate-400">Taxable Profit (Estimate)</p>
                    <p className={`text-3xl font-bold ${profitColor}`}>{formatCurrency(taxYearData.taxableProfit)}</p>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                 <h3 className="text-xl font-bold text-white mb-4">Expenses Breakdown</h3>
                 <input 
                    type="text" 
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white mb-4 focus:border-cyan-500 outline-none"
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="border-b border-slate-700 text-slate-400">
                            <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Item/Service</th>
                                <th className="p-2">Category</th>
                                <th className="p-2 text-right">Amount (GBP)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {taxYearData.filteredExpenses.map(exp => (
                                <tr key={exp.id} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="p-2">{formatDate(exp.start_date)}</td>
                                    <td className="p-2 text-white font-semibold">{exp.name || exp.description}</td>
                                    <td className="p-2">{exp.category}</td>
                                    <td className="p-2 text-right text-white">{formatCurrency(exp.amount_gbp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {taxYearData.filteredExpenses.length === 0 && <p className="text-center text-slate-500 py-8">No expenses found for this period.</p>}
                </div>
            </div>
            <p className="text-xs text-slate-500 text-center italic">
                Disclaimer: These figures are estimates for planning purposes only and do not constitute professional financial advice.
            </p>
        </div>
    );
};

export default TaxCentrePage;