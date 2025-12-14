

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Parses a date string from DD/MM/YYYY or YYYY-MM-DD into YYYY-MM-DD format.
 * @param dateString The date string from the CSV.
 * @returns A string in YYYY-MM-DD format, or null if the format is invalid.
 */
const parseDateToYYYYMMDD = (dateString: string): string | null => {
    if (!dateString || dateString.toLowerCase() === 'null') return null;

    // Try parsing DD/MM/YYYY or DD-MM-YYYY
    const dmyParts = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyParts) {
        const [, day, month, year] = dmyParts;
        const parsedDay = parseInt(day, 10);
        const parsedMonth = parseInt(month, 10);
        if (parsedDay > 31 || parsedMonth > 12 || parsedDay < 1 || parsedMonth < 1) return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Try parsing YYYY-MM-DD (already in the correct format)
    const ymdParts = dateString.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (ymdParts) {
        const [, year, month, day] = ymdParts;
        const parsedMonth = parseInt(month, 10);
        const parsedDay = parseInt(day, 10);
        if (parsedMonth > 12 || parsedDay > 31 || parsedMonth < 1 || parsedDay < 1) return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Fallback for JS Date parsing, though less reliable for ambiguous formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return null; // Return null if no format matches
};


const ImportPage: React.FC<{ selectedEntityId: string }> = ({ selectedEntityId }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setImportStatus(null);
        }
    };

    const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("CSV must have a header row and at least one data row.");
        }
        
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const parseRow = (rowString: string) => {
            const values = [];
            let currentVal = '';
            let inQuotes = false;
            for (let i = 0; i < rowString.length; i++) {
                const char = rowString[i];
                if (char === '"' && (i === 0 || rowString[i - 1] !== '\\')) {
                    if (inQuotes && i < rowString.length - 1 && rowString[i+1] === '"') {
                        currentVal += '"';
                        i++; 
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            return values.map(v => v.replace(/^"|"$/g, '')); // Remove surrounding quotes from values
        }

        const rows = lines.slice(1).map(line => {
            const values = parseRow(line);
            const rowData: { [key: string]: string } = {};
            header.forEach((key, index) => {
                rowData[key] = values[index];
            });
            return rowData;
        });
        
        return { header, rows };
    };
    
    const headerMapping: { [key: string]: string } = {
        'name': 'name',
        'title': 'name',
        'description': 'description',
        'amount': 'amount',
        'currency': 'currency',
        'category': 'category',
        'start date': 'start_date',
        'expense date': 'start_date',
        'end date': 'end_date',
        'expense type': 'expense_type',
        'type': 'expense_type',
        'billing cycle': 'billing_cycle',
        'cycle': 'billing_cycle',
    };

    const handleImport = async () => {
        if (!file) {
            setImportStatus({ message: 'Please select a file to import.', type: 'error' });
            return;
        }
        if (selectedEntityId === 'all') {
            setImportStatus({ message: 'Please select a specific Trading Identity from the sidebar before importing.', type: 'error' });
            return;
        }

        setIsImporting(true);
        setImportStatus(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvText = event.target?.result as string;
                const { header, rows } = parseCSV(csvText);

                const mappedHeader = header.map(h => headerMapping[h.toLowerCase()]);
                
                if (mappedHeader.some(h => h === undefined)) {
                    const unknownHeaders = header.filter(h => !headerMapping[h.toLowerCase()]);
                    throw new Error(`Unknown CSV headers: ${unknownHeaders.join(', ')}. Expected headers like Name, Description, Amount, etc.`);
                }
                
                const expensesToInsert = rows.map((row, index) => {
                    const expense: any = {
                        entity_id: selectedEntityId,
                        is_active: true,
                    };

                    header.forEach(h => {
                        const dbColumn = headerMapping[h.toLowerCase()];
                        if (dbColumn) {
                            let value: any = row[h];
                            if (dbColumn === 'amount') {
                                value = parseFloat(value);
                                if (isNaN(value)) throw new Error(`Invalid amount on row ${index + 2}.`);
                            }
                            if (dbColumn === 'start_date' || dbColumn === 'end_date') {
                                const formattedDate = parseDateToYYYYMMDD(value);
                                if (value && !formattedDate) { // only throw error if there was a value but it couldn't be parsed
                                     throw new Error(`Invalid or unsupported date format for "${h}" ('${value}') on row ${index + 2}. Please use DD/MM/YYYY or YYYY-MM-DD.`);
                                }
                                value = formattedDate;
                            }
                            if (dbColumn === 'expense_type' && value && !['one-time', 'subscription'].includes(value.toLowerCase())) {
                                throw new Error(`Invalid Expense Type on row ${index + 2}. Must be 'one-time' or 'subscription'.`);
                            }
                            if (dbColumn === 'billing_cycle' && value && !['monthly', 'annually', 'yearly'].includes(value.toLowerCase())) {
                                throw new Error(`Invalid Billing Cycle on row ${index + 2}. Must be 'monthly' or 'annually'.`);
                            }
                             if(dbColumn === 'billing_cycle' && value && value.toLowerCase() === 'yearly') {
                                value = 'annually';
                            }
                            
                            expense[dbColumn] = value === null ? null : (value || null);
                        }
                    });
                    
                    if (!expense.description && !expense.name) throw new Error(`Row ${index + 2} must have a Name or Description.`);
                    if (expense.amount === undefined || expense.amount === null) throw new Error(`Row ${index + 2} is missing an Amount.`);
                    if (!expense.start_date) throw new Error(`Row ${index + 2} is missing a Start Date.`);
                    
                    if (!expense.expense_type) expense.expense_type = 'one-time';
                    
                    if (expense.expense_type === 'subscription' && !expense.billing_cycle) {
                         throw new Error(`Row ${index + 2} is a subscription but is missing a Billing Cycle.`);
                    }

                    return expense;
                });
                
                const { error } = await supabase.from('expenses').insert(expensesToInsert);
                
                if (error) throw error;

                setImportStatus({ message: `Successfully imported ${rows.length} expenses.`, type: 'success' });
                setFile(null);
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: any) {
                setImportStatus({ message: err.message || 'An unknown error occurred during import.', type: 'error' });
            } finally {
                setIsImporting(false);
            }
        };

        reader.readAsText(file);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">Import Expenses</h2>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                <div className="mb-6 space-y-2 text-slate-300">
                    <p>Import expenses from a CSV file. This is useful for migrating data from other systems like Stoutly.</p>
                    <p>
                        Your CSV file must contain a header row with column names like:
                        <code className="text-cyan-400 bg-slate-900 p-1 rounded-md text-sm mx-1">Name</code>,
                        <code className="text-cyan-400 bg-slate-900 p-1 rounded-md text-sm mx-1">Description</code>,
                        <code className="text-cyan-400 bg-slate-900 p-1 rounded-md text-sm mx-1">Amount</code>,
                        <code className="text-cyan-400 bg-slate-900 p-1 rounded-md text-sm mx-1">Currency</code>,
                        <code className="text-cyan-400 bg-slate-900 p-1 rounded-md text-sm mx-1">Start Date</code>,
                        etc.
                    </p>
                     <p className="font-semibold text-yellow-400">Date columns must be in <code className="text-amber-300 bg-slate-900 p-1 rounded-md text-sm mx-1">DD/MM/YYYY</code> or <code className="text-amber-300 bg-slate-900 p-1 rounded-md text-sm mx-1">YYYY-MM-DD</code> format.</p>
                    <p className="font-semibold text-yellow-400">Important: Please select the correct Trading Identity in the sidebar before importing. All imported expenses will be assigned to it.</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="file-input" className="block text-sm font-medium text-slate-300 mb-2">CSV File</label>
                        <input 
                            id="file-input"
                            type="file" 
                            accept=".csv"
                            onChange={handleFileChange} 
                            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 cursor-pointer" 
                        />
                    </div>

                    <button 
                        onClick={handleImport} 
                        disabled={isImporting || !file}
                        className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImporting ? 'Importing...' : 'Import Expenses'}
                    </button>
                    
                    {importStatus && (
                         <div className={`mt-4 p-4 rounded-md text-sm ${importStatus.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {importStatus.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportPage;