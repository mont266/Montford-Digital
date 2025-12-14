
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- Type Definitions ---
type ExpenseStatus = 'upcoming' | 'completed' | 'active' | 'inactive';
type ExpenseType = 'manual' | 'subscription';

interface StagedExpense {
    name: string;
    description: string;
    amount: number | string;
    currency: string;
    category: string;
    start_date: string;
    end_date: string | null;
    type: ExpenseType;
    billing_cycle: 'monthly' | 'annually' | null;
    status: ExpenseStatus;
    [key: string]: any; // Allow other properties
}

interface ImportFlowProps {
  selectedEntityId: string;
  onClose: () => void;
  refreshData: () => void;
}

// --- Helper Functions ---
const parseDateToYYYYMMDD = (dateString: string): string | null => {
    if (!dateString || dateString.toLowerCase() === 'null') return null;
    const dmyParts = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyParts) {
        const [, day, month, year] = dmyParts;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const ymdParts = dateString.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (ymdParts) {
        const [, year, month, day] = ymdParts;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    return null;
};

// --- Main Component ---
const ImportFlow: React.FC<ImportFlowProps> = ({ selectedEntityId, onClose, refreshData }) => {
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [stagedExpenses, setStagedExpenses] = useState<StagedExpense[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const statusChipStyles: { [key in ExpenseStatus]: string } = {
        active: 'bg-green-500/20 text-green-300',
        inactive: 'bg-gray-600/20 text-gray-400',
        completed: 'bg-blue-500/20 text-blue-300',
        upcoming: 'bg-yellow-500/20 text-yellow-300',
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setStatus(null);
        }
    };

    const handleParseFile = () => {
        if (!file) {
            setStatus({ message: 'Please select a file to import.', type: 'error' });
            return;
        }
        if (selectedEntityId === 'all') {
            setStatus({ message: 'Please select a specific Trading Identity from the sidebar before importing.', type: 'error' });
            return;
        }

        setIsProcessing(true);
        setStatus(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvText = event.target?.result as string;
                const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");
                
                const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/"/g, '').replace(/\s+/g, ' ').toLowerCase());
                
                const headerMapping: { [key: string]: string } = {
                    'name': 'name', 'title': 'name',
                    'description': 'description',
                    'amount': 'amount',
                    'currency': 'currency',
                    'category': 'category',
                    'start_date': 'start_date', 'start date': 'start_date', 'expense date': 'start_date',
                    'end_date': 'end_date', 'end date': 'end_date',
                    'expense_type': 'type', 'type': 'type',
                    'billing_cycle': 'billing_cycle', 'billing cycle': 'billing_cycle', 'cycle': 'billing_cycle',
                };
                
                const rows = lines.slice(1);
                const expensesToStage: StagedExpense[] = rows.map((rowStr, index) => {
                    const values = rowStr.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const rowData: { [key: string]: any } = {};
                    header.forEach((h, i) => { rowData[h] = values[i] });

                    const expense: any = {};
                    Object.keys(rowData).forEach(key => {
                        const dbColumn = headerMapping[key];
                        if (dbColumn) {
                            let value: any = rowData[key];
                            if (dbColumn === 'amount') value = parseFloat(value) || '';
                            if (dbColumn === 'start_date' || dbColumn === 'end_date') {
                                const formatted = parseDateToYYYYMMDD(value);
                                if (value && !formatted) throw new Error(`Invalid date format for "${key}" on row ${index + 2}.`);
                                value = formatted;
                            }
                            if (dbColumn === 'billing_cycle' && value?.toLowerCase() === 'yearly') value = 'annually';
                            if (dbColumn === 'type') value = value.toLowerCase();
                            expense[dbColumn] = value;
                        }
                    });

                    expense.type = expense.type === 'subscription' ? 'subscription' : 'manual';

                    let calculatedStatus: ExpenseStatus;
                    if (expense.type === 'subscription') {
                        const hasEnded = expense.end_date && new Date(expense.end_date) < new Date();
                        calculatedStatus = hasEnded ? 'inactive' : 'active';
                    } else {
                        const isCompleted = expense.start_date && new Date(expense.start_date) <= new Date();
                        calculatedStatus = isCompleted ? 'completed' : 'upcoming';
                    }

                    if (!expense.description && !expense.name) throw new Error(`Row ${index + 2} needs a Name or Description.`);
                    if (expense.amount === undefined || expense.amount === '') throw new Error(`Row ${index + 2} needs an Amount.`);
                    if (!expense.start_date) throw new Error(`Row ${index + 2} needs a Start Date.`);
                    if (expense.type === 'subscription' && !expense.billing_cycle) throw new Error(`Row ${index + 2} is a subscription but is missing a Billing Cycle.`);
                    
                    return {
                        name: expense.name || '',
                        description: expense.description || '',
                        amount: expense.amount || '',
                        currency: expense.currency || 'GBP',
                        category: expense.category || '',
                        start_date: expense.start_date || '',
                        end_date: expense.end_date || null,
                        type: expense.type,
                        billing_cycle: expense.type === 'subscription' ? (expense.billing_cycle || null) : null,
                        status: calculatedStatus,
                    };
                });
                setStagedExpenses(expensesToStage);
                setStep('review');
            } catch (err: any) {
                setStatus({ message: err.message, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };

    const handleStagedChange = (index: number, field: keyof StagedExpense, value: any) => {
        const newStagedExpenses = [...stagedExpenses];
        const currentExpense = { ...newStagedExpenses[index], [field]: value };
        
        if (field === 'type' && value === 'manual') {
            currentExpense.billing_cycle = null;
        }

        // Fix: Cast `field` to string to satisfy Array.prototype.includes which expects a string.
        if (['type', 'start_date', 'end_date'].includes(field as string)) {
            if (currentExpense.type === 'subscription') {
                const hasEnded = currentExpense.end_date && new Date(currentExpense.end_date) < new Date();
                currentExpense.status = hasEnded ? 'inactive' : 'active';
            } else { // manual
                const isPast = currentExpense.start_date && new Date(currentExpense.start_date) <= new Date();
                currentExpense.status = isPast ? 'completed' : 'upcoming';
            }
        }

        newStagedExpenses[index] = currentExpense;
        setStagedExpenses(newStagedExpenses);
    };
    
    const removeStagedRow = (index: number) => {
        setStagedExpenses(stagedExpenses.filter((_, i) => i !== index));
    };

    const handleConfirmImport = async () => {
        setIsProcessing(true);
        setStatus(null);
        try {
            const expensesToInsert = stagedExpenses.map(exp => ({
                name: exp.name,
                description: exp.description,
                amount: exp.amount,
                currency: exp.currency.toUpperCase(),
                category: exp.category,
                start_date: exp.start_date,
                end_date: exp.end_date || null,
                type: exp.type,
                billing_cycle: exp.billing_cycle || null,
                status: exp.status,
                entity_id: selectedEntityId,
            }));

            const { error } = await supabase.from('expenses').insert(expensesToInsert);
            if (error) throw error;

            setStatus({ message: `Successfully imported ${stagedExpenses.length} expenses!`, type: 'success' });
            refreshData();
            setTimeout(onClose, 1500);
        } catch (err: any) {
            setStatus({ message: err.message, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const tableHeaders: { key: keyof StagedExpense, label: string, type: string, className?: string, options?: {value: any, label: string}[] }[] = [
        { key: 'name', label: 'Name', type: 'text', className: 'w-48' },
        { key: 'description', label: 'Description', type: 'text', className: 'w-64' },
        { key: 'amount', label: 'Amount', type: 'number', className: 'w-24' },
        { key: 'category', label: 'Category', type: 'text', className: 'w-32' },
        { key: 'start_date', label: 'Start Date', type: 'date', className: 'w-36' },
        { key: 'end_date', label: 'End Date', type: 'date', className: 'w-36' },
        { key: 'status', label: 'Status', type: 'text', className: 'w-32' },
        { key: 'type', label: 'Type', type: 'select', className: 'w-32', options: [{value: 'manual', label: 'Manual'}, {value: 'subscription', label: 'Subscription'}] },
        { key: 'billing_cycle', label: 'Billing Cycle', type: 'select', className: 'w-32', options: [{value: '', label: 'N/A'}, {value: 'monthly', label: 'Monthly'}, {value: 'annually', label: 'Annually'}] },
    ];

    return (
        <div>
            {step === 'upload' && (
                <div className="space-y-4">
                     <div className="space-y-2 text-slate-300 text-sm">
                        <p>Import expenses from a CSV file. The importer will match columns like 'Name', 'Amount', 'Type' etc., and ignore any unrecognised columns like 'Status'.</p>
                         <p className="font-semibold text-yellow-400">Date columns must be in DD/MM/YYYY or YYYY-MM-DD format.</p>
                        <p className="font-semibold text-yellow-400">All imported expenses will be assigned to the currently selected Trading Identity.</p>
                    </div>
                    <div>
                        <label htmlFor="file-input" className="block text-sm font-medium text-slate-300 mb-2">CSV File</label>
                        <input id="file-input" type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 cursor-pointer" />
                    </div>
                    <button onClick={handleParseFile} disabled={isProcessing || !file} className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isProcessing ? 'Parsing...' : 'Review Data'}
                    </button>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-4">
                     <p className="text-slate-300 text-sm">Review, edit, or remove expenses below before finalising the import.</p>
                    <div className="max-h-[50vh] overflow-auto border border-slate-700 rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-900/50 sticky top-0">
                                <tr>
                                    {tableHeaders.map(h => <th key={h.key as string} className={`p-2 text-left font-medium text-slate-400 ${h.className}`}>{h.label}</th>)}
                                    <th className="p-2 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {stagedExpenses.map((exp, index) => (
                                    <tr key={index} className="hover:bg-slate-700/50">
                                        {tableHeaders.map(h => (
                                            <td key={h.key as string} className="p-1 align-top">
                                                 {h.key === 'status' ? (
                                                    <span className={`px-2 py-1.5 w-full inline-block text-center text-xs leading-tight font-semibold rounded-md capitalize ${statusChipStyles[exp.status] || ''}`}>
                                                        {exp.status}
                                                    </span>
                                                 ) : h.type === 'select' ? (
                                                    <select 
                                                        value={exp[h.key] || ''} 
                                                        onChange={e => handleStagedChange(index, h.key, e.target.value)} 
                                                        className="w-full bg-slate-700 border-slate-600 rounded p-1.5 text-white text-xs capitalize disabled:opacity-50"
                                                        disabled={h.key === 'billing_cycle' && exp.type !== 'subscription'}
                                                    >
                                                        {h.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                ) : (
                                                    <input type={h.type} value={exp[h.key] || ''} onChange={e => handleStagedChange(index, h.key, h.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} className="w-full bg-slate-700 border-slate-600 rounded p-1.5 text-white text-xs" />
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-1 align-top text-center">
                                            <button onClick={() => removeStagedRow(index)} className="text-red-400 hover:text-red-300 p-1.5 leading-none text-2xl" title="Remove row">&times;</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-700">
                        <p className="text-slate-400 mb-2 sm:mb-0">Found {stagedExpenses.length} expenses to import.</p>
                        <div className="flex space-x-2">
                             <button onClick={() => setStep('upload')} disabled={isProcessing} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50">Back</button>
                            <button onClick={handleConfirmImport} disabled={isProcessing || stagedExpenses.length === 0} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50">
                                {isProcessing ? 'Importing...' : `Confirm & Import ${stagedExpenses.length} items`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {status && (
                <div className={`mt-4 p-3 rounded-md text-sm text-center ${status.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {status.message}
                </div>
            )}
        </div>
    );
};

export default ImportFlow;
