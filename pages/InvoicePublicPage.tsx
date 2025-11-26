
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';

// Define the structure of an invoice
interface InvoiceItem {
  id: string;
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
  projects: {
    name: string;
    client_name: string;
  } | null;
  invoice_items: InvoiceItem[];
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');


const InvoicePublicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) {
        setError("Invalid invoice ID.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            *,
            projects ( name, client_name ),
            invoice_items ( * )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setInvoice(data as Invoice);
        } else {
            setError("Invoice not found.");
        }

      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching the invoice.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handlePayment = () => {
      alert("Payment processing would be initiated here!");
  };

  const getStatusChip = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'paid';
    if (status === 'paid') return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (isOverdue) return 'bg-red-500/20 text-red-300 border-red-500/30';
    if (status === 'sent') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 flex justify-center items-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <header className="bg-slate-900 p-8 flex justify-between items-start">
            <div>
                <Logo className="h-9 w-auto" />
                <p className="text-slate-400 mt-2">Invoice</p>
            </div>
            {invoice && (
                <div className="text-right">
                    <h2 className="text-3xl font-bold text-white">{formatCurrency(invoice.amount)}</h2>
                    <p className="text-slate-400">Due on {formatDate(invoice.due_date)}</p>
                </div>
            )}
        </header>

        <main className="p-8">
            {loading && <p className="text-center">Loading invoice...</p>}
            {error && <p className="text-center text-red-400">{error}</p>}
            {invoice && (
                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                        <div>
                            <p className="text-sm text-slate-400 mb-1">Billed To</p>
                            <p className="font-semibold text-white">{invoice.projects?.client_name || 'N/A'}</p>
                        </div>
                         <div>
                            <p className="text-sm text-slate-400 mb-1">Invoice Number</p>
                            <p className="font-semibold text-white">{invoice.invoice_number}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-400 mb-1">Issue Date</p>
                            <p className="font-semibold text-white">{formatDate(invoice.issue_date)}</p>
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Itemised Breakdown</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-700 text-sm text-slate-400">
                                        <th className="p-2">Description</th>
                                        <th className="p-2 text-center">Qty</th>
                                        <th className="p-2 text-right">Unit Price</th>
                                        <th className="p-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.invoice_items.map(item => (
                                        <tr key={item.id} className="border-b border-slate-700/50">
                                            <td className="p-2 text-white font-medium">{item.description}</td>
                                            <td className="p-2 text-center">{item.quantity}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="text-white font-bold">
                                        <td colSpan={3} className="p-2 text-right">Grand Total</td>
                                        <td className="p-2 text-right">{formatCurrency(invoice.amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-700 mt-6 pt-6 flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center mb-4 sm:mb-0">
                           <span className="text-slate-400 mr-2">Status:</span>
                           <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusChip(invoice.status, invoice.due_date)}`}>
                                {new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? 'Overdue' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                           </span>
                        </div>

                        {invoice.status !== 'paid' && (
                             <button
                                onClick={handlePayment}
                                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20"
                            >
                                Pay Invoice with Stripe
                            </button>
                        )}
                    </div>
                </div>
            )}
        </main>
         <footer className="text-center p-4 bg-slate-900/50 border-t border-slate-700">
            <p className="text-xs text-slate-500">If you have any questions, please contact Montford Digital.</p>
        </footer>
      </div>
    </div>
  );
};

export default InvoicePublicPage;