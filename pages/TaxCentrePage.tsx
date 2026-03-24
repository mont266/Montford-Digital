import React, { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';

// --- Types ---
interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number; 
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: { name: string; client_name: string; } | null;
  invoice_items: InvoiceItem[];
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

// --- Tax Calculation Logic (from DashboardPage) ---
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

const calculateFullYearTax = (taxableProfit: number, payeSalary: number) => {
    let incomeTax = 0;
    let nationalInsurance = 0;
    const startingIncome = payeSalary;
    
    for (let i = 1; i <= Math.floor(taxableProfit); i++) {
        const currentTotalIncome = startingIncome + i;
        if (currentTotalIncome > HIGHER_RATE_THRESHOLD) {
            incomeTax += ADDITIONAL_RATE;
        } else if (currentTotalIncome > BASIC_RATE_THRESHOLD) {
            incomeTax += HIGHER_RATE;
        } else if (currentTotalIncome > PA_THRESHOLD) {
            incomeTax += BASIC_RATE;
        }
    }
    
    if (taxableProfit > NI_LOWER_THRESHOLD) {
        const niableInLowerBand = Math.min(taxableProfit, NI_UPPER_THRESHOLD) - NI_LOWER_THRESHOLD;
        nationalInsurance += Math.max(0, niableInLowerBand) * NI_LOWER_RATE;
    }
    if (taxableProfit > NI_UPPER_THRESHOLD) {
        const niableInHigherBand = taxableProfit - NI_UPPER_THRESHOLD;
        nationalInsurance += niableInHigherBand * NI_HIGHER_RATE;
    }
    
    return {
        incomeTax,
        nationalInsurance,
        totalTax: incomeTax + nationalInsurance
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


const TaxCentrePage: React.FC<TaxCentrePageProps> = ({ invoices, expenses }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [payeSalary, setPayeSalary] = useState<number>(() => {
        const savedSalary = localStorage.getItem('payeSalary');
        return savedSalary ? JSON.parse(savedSalary) : 0;
    });

    useEffect(() => {
        localStorage.setItem('payeSalary', JSON.stringify(payeSalary));
    }, [payeSalary]);
    
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

        const expensesInPeriod = expenses.filter(exp => {
             const startDate = new Date(exp.start_date);
             const subEndDate = exp.end_date ? new Date(exp.end_date) : end;
             return startDate <= end && subEndDate >= start;
        });

        const totalExpenses = expensesInPeriod.reduce((sum, exp) => {
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
        const taxCalculation = calculateFullYearTax(taxableProfit, payeSalary);
        
        const displayExpenses = expensesInPeriod.filter(exp => 
           (exp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
           exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           exp.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            totalTurnover,
            totalExpenses,
            taxableProfit,
            filteredPaidInvoices: filteredInvoices,
            expensesForYear: expensesInPeriod,
            filteredExpensesForDisplay: displayExpenses,
            ...taxCalculation
        };
    }, [selectedTaxYear, invoices, expenses, searchTerm, payeSalary]);

    const submissionDeadline = useMemo(() => {
        if (!selectedTaxYear) return '';
        const endYear = parseInt(selectedTaxYear.split('/')[0]) + 1;
        const deadlineYear = endYear + 1;
        return `31 January ${deadlineYear}`;
    }, [selectedTaxYear]);
    
    const handleDownloadTaxPack = async () => {
        setIsDownloading(true);
        try {
            const escapeCsvCell = (cellData: any) => {
                const stringData = String(cellData === null || cellData === undefined ? '' : cellData);
                if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
                    return `"${stringData.replace(/"/g, '""')}"`;
                }
                return stringData;
            };

            const revenueHeaders = ['Invoice Number', 'Issue Date', 'Client Name', 'Project Name', 'Amount (GBP)'];
            const revenueRows = taxYearData.filteredPaidInvoices.map(inv => [
                escapeCsvCell(inv.invoice_number),
                escapeCsvCell(formatDate(inv.issue_date)),
                escapeCsvCell(inv.projects?.client_name),
                escapeCsvCell(inv.projects?.name),
                inv.amount
            ].join(','));
            const revenueCsv = [revenueHeaders.join(','), ...revenueRows].join('\n');

            const expenseHeaders = ['Date', 'Name', 'Description', 'Category', 'Amount (GBP)'];
            const expenseRows = taxYearData.expensesForYear.map(exp => [
                escapeCsvCell(formatDate(exp.start_date)),
                escapeCsvCell(exp.name),
                escapeCsvCell(exp.description),
                escapeCsvCell(exp.category),
                exp.amount_gbp
            ].join(','));
            const expenseCsv = [expenseHeaders.join(','), ...expenseRows].join('\n');

            const zip = new JSZip();
            zip.file('revenue.csv', revenueCsv);
            zip.file('expenses.csv', expenseCsv);
            const invoiceFolder = zip.folder('invoices');

            if (invoiceFolder) {
                 for (const inv of taxYearData.filteredPaidInvoices) {
                    const itemsHtml = inv.invoice_items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td style="text-align: center;">${item.quantity}</td>
                            <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
                            <td style="text-align: right;">${formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>`).join('');

                    const invoiceHtml = `<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_number}</title><style>body{font-family:sans-serif;margin:40px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem}.total{margin-top:1rem;text-align:right;font-size:1.2rem;font-weight:bold}</style></head><body><div class="header"><div><h1>Invoice ${inv.invoice_number}</h1><p><strong>Billed To:</strong> ${inv.projects?.client_name || 'N/A'}</p></div><div><p><strong>Issue Date:</strong> ${formatDate(inv.issue_date)}</p><p><strong>Due Date:</strong> ${formatDate(inv.due_date)}</p></div></div><table><thead><tr><th>Description</th><th style="text-align:center">Quantity</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="total">Total: ${formatCurrency(inv.amount)}</div></body></html>`;
                    invoiceFolder.file(`${inv.invoice_number}.html`, invoiceHtml);
                }
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `tax-pack-${selectedTaxYear.replace('/', '-')}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error("Failed to generate tax pack:", error);
            alert("An error occurred while generating the tax pack.");
        } finally {
            setIsDownloading(false);
        }
    };

    const profitColor = taxYearData.taxableProfit > 0 ? 'text-green-400' : taxYearData.taxableProfit < 0 ? 'text-red-400' : 'text-slate-400';

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold text-white">Tax Centre</h2>
                    <button onClick={handleDownloadTaxPack} disabled={isDownloading} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        {isDownloading ? 'Generating...' : 'Download Tax Pack'}
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <label htmlFor="tax-year-select" className="text-slate-400 font-medium">Tax Year:</label>
                    <select id="tax-year-select" value={selectedTaxYear} onChange={(e) => setSelectedTaxYear(e.target.value)} className="bg-slate-800 border border-slate-600 text-white py-2 px-3 rounded-md focus:outline-none focus:border-cyan-500 transition-colors">
                        {availableTaxYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">Tax Settings</h3>
                <div>
                    <label htmlFor="paye-salary" className="block text-sm font-medium text-slate-300">Annual PAYE Salary (£)</label>
                    <input type="number" id="paye-salary" value={payeSalary || ''} onChange={e => setPayeSalary(Number(e.target.value))} className="mt-1 w-full max-w-xs bg-slate-900 border border-slate-600 rounded-md p-2 text-white" placeholder="e.g., 45000" />
                    <p className="text-xs text-slate-500 mt-2">Enter your gross salary from other employment to improve tax estimations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1"><p className="text-sm text-slate-400">Total Turnover</p><p className="text-2xl font-bold text-white">{formatCurrency(taxYearData.totalTurnover)}</p></div>
                    <div className="lg:col-span-1"><p className="text-sm text-slate-400">Allowable Expenses</p><p className="text-2xl font-bold text-white">{formatCurrency(taxYearData.totalExpenses)}</p></div>
                    <div className="lg:col-span-1"><p className="text-sm text-slate-400">Taxable Profit</p><p className={`text-2xl font-bold ${profitColor}`}>{formatCurrency(taxYearData.taxableProfit)}</p></div>
                    <div className="lg:col-span-1"><p className="text-sm text-slate-400">Est. Income Tax</p><p className="text-2xl font-bold text-orange-400">{formatCurrency(taxYearData.incomeTax)}</p></div>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg border-2 border-cyan-500/50 flex flex-col justify-center text-center">
                     <div className="flex items-center justify-center">
                        <p className="text-lg text-slate-400">Total Tax Due</p>
                        <InfoTooltip text="Sum of estimated Income Tax and Class 4 National Insurance on your taxable profit." />
                    </div>
                    <p className="text-4xl font-bold text-cyan-400 my-2">{formatCurrency(taxYearData.totalTax)}</p>
                </div>
                 <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex flex-col justify-center text-center items-center md:col-span-3">
                     <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p className="text-lg font-semibold text-white">Online Submission Deadline</p>
                    </div>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">{submissionDeadline}</p>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                 <h3 className="text-xl font-bold text-white mb-4">Expenses Breakdown for Tax Year {selectedTaxYear}</h3>
                 <input type="text" placeholder="Search expenses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white mb-4 focus:border-cyan-500 outline-none"/>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left">
                        <thead className="border-b border-slate-700 text-slate-400 bg-slate-800 sticky top-0">
                            <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Item/Service</th>
                                <th className="p-2">Category</th>
                                <th className="p-2 text-right">Amount (GBP)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {taxYearData.filteredExpensesForDisplay.map(exp => (
                                <tr key={exp.id} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="p-2">{formatDate(exp.start_date)}</td>
                                    <td className="p-2 text-white font-semibold">{exp.name || exp.description}</td>
                                    <td className="p-2">{exp.category}</td>
                                    <td className="p-2 text-right text-white">{formatCurrency(exp.amount_gbp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {taxYearData.filteredExpensesForDisplay.length === 0 && <p className="text-center text-slate-500 py-8">No expenses found for this period.</p>}
                </div>
            </div>
            <p className="text-xs text-slate-500 text-center italic">
                Disclaimer: These figures are estimates for planning purposes only and do not constitute professional financial advice. Based on 2024/25 England tax bands.
            </p>
        </div>
    );
};

export default TaxCentrePage;