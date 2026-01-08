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

// --- Reusable Components ---
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative inline-block ml-2 group align-middle">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-900 text-slate-300 text-xs rounded-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
      {text}
    </div>
  </div>
);


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

        const totalTurnover = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        const totalExpenses = expenses.reduce((sum, exp) => {
            if (exp.type === 'manual') {
                const expenseDate = new Date(exp.start_date);
                if (expenseDate >= start && expenseDate <= end) {
                    return sum + exp.amount_gbp;
                }
                return sum;
            }

            if (exp.type === 'subscription' && exp.billing_cycle) {
                let spendInPeriod = 0;
                const subStartDate = new Date(exp.start_date);
                const subEndDate = exp.end_date ? new Date(exp.end_date) : end;

                let paymentDate = new Date(subStartDate);
                while (paymentDate <= subEndDate && paymentDate <= end) {
                    if (paymentDate >= start) {
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

        const taxableProfit = totalTurnover - totalExpenses;

        const displayExpenses = expenses.filter(exp => {
             const startDate = new Date(exp.start_date);
             const subEndDate = exp.end_date ? new Date(exp.end_date) : end;
             return startDate <= end && subEndDate >= start;
        }).filter(exp => 
           (exp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
           exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           exp.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            totalTurnover,
            totalExpenses,
            taxableProfit,
            filteredExpenses: displayExpenses,
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
                    <p className="text-sm text-slate-400">Allowable Expenses</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(taxYearData.totalExpenses)}</p>
                </div>
                <div className={`bg-slate-800 p-6 rounded-lg border ${profitBorder}`}>
                    <div className="flex items-center">
                        <p className="text-sm text-slate-400">Taxable Profit (Estimate)</p>
                        <InfoTooltip text="Calculated as: Total Turnover - Allowable Expenses. This is the figure your tax liability is based on." />
                    </div>
                    <p className={`text-3xl font-bold ${profitColor}`}>{formatCurrency(taxYearData.taxableProfit)}</p>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                 <h3 className="text-xl font-bold text-white mb-4">Expenses Breakdown for Tax Year</h3>
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
