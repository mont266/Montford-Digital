

import React, { useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- Type Imports from DashboardPage (assuming they are exported or defined here) ---
interface Invoice {
  id: string;
  issue_date: string;
  amount: number; 
  status: 'draft' | 'sent' | 'paid' | 'overdue';
}

// Fix: Add missing type definition for ExpenseStatus to align with DashboardPage.
type ExpenseStatus = 'upcoming' | 'completed' | 'active' | 'inactive';

// Fix: Add missing properties to the Expense interface to match the definition in DashboardPage.tsx.
// This resolves the TypeScript error related to the 'setAttachmentModalExpense' prop.
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
interface ExpenseAttachment {
    id: string;
    expense_id: string;
    file_path: string;
    file_name: string;
}


// --- Props ---
interface TaxCentrePageProps {
  invoices: Invoice[];
  expenses: Expense[];
  setAttachmentModalExpense: (expense: Expense | null) => void;
}

// --- Helper Functions ---
const formatCurrency = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-GB');

const getTaxYear = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const day = date.getDate();
  const startYear = (month > 3) || (month === 3 && day >= 6) ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
};

const getTaxYearBoundaries = (taxYear: string) => {
  const startYear = parseInt(taxYear.split('/')[0]);
  return {
    start: new Date(startYear, 3, 6), // April 6th
    end: new Date(startYear + 1, 3, 5, 23, 59, 59, 999), // April 5th
  };
};

// --- Main Component ---
const TaxCentrePage: React.FC<TaxCentrePageProps> = ({ invoices, expenses, setAttachmentModalExpense }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const availableTaxYears = useMemo(() => {
        const years = new Set<string>();
        invoices.forEach(inv => years.add(getTaxYear(new Date(inv.issue_date))));
        expenses.forEach(exp => years.add(getTaxYear(new Date(exp.start_date))));
        
        // Add current tax year if not present
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
             // Simple case: manual expense within the period
             if (exp.type === 'manual') {
                 return startDate >= start && startDate <= end;
             }
             // Complex case: subscription might have started before but has payments within the period
             if (exp.type === 'subscription') {
                const subEndDate = exp.end_date ? new Date(exp.end_date) : end;
                // If sub started after tax year end OR ended before tax year start, exclude
                if (startDate > end || subEndDate < start) return false;
                return true; // If there's any overlap, include it. We calculate exact spend next.
             }
             return false;
        });

        const totalTurnover = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        const totalExpenses = filteredExpenses.reduce((sum, exp) => {
            if (exp.type === 'manual') {
                return sum + exp.amount_gbp;
            }
            if (exp.type === 'subscription' && exp.billing_cycle) {
                let paymentDate = new Date(exp.start_date);
                const subEndDate = exp.end_date ? new Date(exp.end_date) : end;
                let spendInPeriod = 0;
                while (paymentDate <= subEndDate) {
                    if (paymentDate >= start && paymentDate <= end) {
                        spendInPeriod += exp.amount_gbp;
                    }
                     if (paymentDate > end) break; // Stop if we've passed the tax year
                    
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

        const expensesByCategory = filteredExpenses.reduce((acc, exp) => {
            const category = exp.category || 'Uncategorised';
            if (!acc[category]) acc[category] = 0;
            // Note: This is a simplified calculation for the summary card.
            // The `totalExpenses` calculation above is more accurate for subscriptions.
            acc[category] += exp.amount_gbp;
            return acc;
        }, {} as Record<string, number>);

        const searchableExpenses = filteredExpenses.filter(exp => 
           (exp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
           exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           exp.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            totalTurnover,
            totalExpenses,
            expensesByCategory,
            taxableProfit: totalTurnover - totalExpenses,
            filteredExpenses: searchableExpenses
        };
    }, [selectedTaxYear, invoices, expenses, searchTerm]);

    const handleExportCSV = useCallback(() => {
        const headers = ['Date', 'Item/Service', 'Category', 'Amount (GBP)'];
        const rows = taxYearData.filteredExpenses.map(exp => [
            formatDate(exp.start_date),
            `"${(exp.name || exp.description).replace(/"/g, '""')}"`, // Escape quotes
            exp.category,
            exp.amount_gbp.toFixed(2)
        ].join(','));

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `expenses-${selectedTaxYear.replace('/', '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [taxYearData.filteredExpenses, selectedTaxYear]);

    const handleDownloadAllReceipts = useCallback(async () => {
        const expensesWithAttachments = taxYearData.filteredExpenses.filter(exp => exp.expense_attachments[0]?.count > 0);
        
        if (expensesWithAttachments.length === 0) {
            alert("No receipts found for the selected tax year.");
            return;
        }

        if (!window.confirm(`This will trigger ${expensesWithAttachments.length} file downloads. Your browser may ask for permission to download multiple files. Continue?`)) {
            return;
        }

        for (const expense of expensesWithAttachments) {
            const { data, error } = await supabase
                .from('expense_attachments')
                .select('file_path, file_name')
                .eq('expense_id', expense.id);
            
            if (error) {
                console.error(`Failed to fetch attachments for ${expense.name}:`, error);
                continue;
            }

            for (const attachment of data) {
                const { data: urlData } = supabase.storage.from('expense-invoices').getPublicUrl(attachment.file_path);
                if (urlData.publicUrl) {
                    const link = document.createElement('a');
                    link.href = urlData.publicUrl;
                    link.download = attachment.file_name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    // Add a small delay to help browsers manage multiple downloads
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }
    }, [taxYearData.filteredExpenses]);

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
                        className="w-48 appearance-none bg-slate-800 border border-slate-600 hover:border-cyan-500 text-white py-2 px-3 rounded-md leading-tight focus:outline-none focus:shadow-outline transition-colors cursor-pointer"
                    >
                        {availableTaxYears.map(year => (
                            <option key={year} value={year}>{year}{year === getTaxYear(new Date()) ? ' (Current)' : ''}</option>
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
                    <p className="text-sm text-slate-400">Total Allowable Expenses</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(taxYearData.totalExpenses)}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg border border-green-500/30">
                    <p className="text-sm text-slate-400">Taxable Profit (Estimate)</p>
                    <p className="text-3xl font-bold text-green-300">{formatCurrency(taxYearData.taxableProfit)}</p>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                     <h3 className="text-xl font-bold text-white">Expenses for {selectedTaxYear}</h3>
                     <div className="flex items-center gap-2">
                        <button onClick={handleExportCSV} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 text-sm">Export CSV</button>
                        <button onClick={handleDownloadAllReceipts} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 text-sm">Download Receipts</button>
                     </div>
                </div>
                 <input 
                    type="text" 
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-md p-2 text-white mb-4 placeholder:text-slate-500"
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-700 text-slate-400">
                            <tr>
                                <th className="p-2 text-left font-medium">Date</th>
                                <th className="p-2 text-left font-medium">Item/Service</th>
                                <th className="p-2 text-left font-medium">Category</th>
                                <th className="p-2 text-center font-medium">Receipts</th>
                                <th className="p-2 text-right font-medium">Amount (GBP)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {taxYearData.filteredExpenses.map(exp => (
                                <tr key={exp.id} className="hover:bg-slate-700/50">
                                    <td className="p-2">{formatDate(exp.start_date)}</td>
                                    <td className="p-2 text-white font-semibold">{exp.name || exp.description}</td>
                                    <td className="p-2">{exp.category}</td>
                                    <td className="p-2 text-center">
                                        <button 
                                            onClick={() => setAttachmentModalExpense(exp)} 
                                            disabled={!exp.expense_attachments[0]?.count}
                                            className="flex items-center justify-center gap-2 mx-auto px-3 py-1 text-xs rounded-full bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            <span>{exp.expense_attachments[0]?.count || 0}</span>
                                        </button>
                                    </td>
                                    <td className="p-2 text-right font-semibold text-white">{formatCurrency(exp.amount_gbp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {taxYearData.filteredExpenses.length === 0 && <p className="text-center text-slate-500 py-8">No expenses found for this period.</p>}
                </div>
            </div>
            <div className="text-xs text-slate-500 text-center italic mt-4">
                Disclaimer: These figures are estimates for planning purposes only and do not constitute financial advice. Please consult with a qualified accountant.
            </div>
        </div>
    );
};

export default TaxCentrePage;