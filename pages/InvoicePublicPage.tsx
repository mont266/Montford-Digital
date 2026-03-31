

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '../src/components/CheckoutForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// --- Types ---
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
  created_at: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  projects: {
    name: string;
    client_name: string;
    clients?: {
      email: string;
    } | null;
  } | null;
  invoice_items: InvoiceItem[];
  split_group_id?: string | null;
  split_part?: number | null;
}


// --- Reusable Components ---
const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; title: string }> = ({ children, onClose, title }) => (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-800 pb-2 z-10">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {children}
        </div>
    </div>
);


const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');


const InvoicePublicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [siblingInvoice, setSiblingInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [isReceiptView, setIsReceiptView] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [isCollectingDetails, setIsCollectingDetails] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) {
        setError("Invalid invoice ID.");
        setLoading(false);
        return;
      }

      try {
        // Handle successful payment redirect
        if (searchParams.get('success') === 'true') {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', id);
          setSuccessMessage('Payment successful! Thank you.');
        } else if (searchParams.get('canceled') === 'true') {
          setError('Payment process was canceled.');
        }

        const { data, error: dbError } = await supabase
          .from('invoices')
          .select(`*, projects ( name, client_name, clients ( email ) ), invoice_items ( * )`)
          .eq('id', id)
          .single();

        if (dbError) throw dbError;
        if (data) {
            setInvoice(data as Invoice);
            setBillingName(data.projects?.client_name || '');
            setBillingEmail(data.projects?.clients?.email || '');
            if (data.split_group_id) {
                const { data: siblingData } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('split_group_id', data.split_group_id)
                    .neq('id', data.id)
                    .single();
                if (siblingData) {
                    setSiblingInvoice(siblingData as Invoice);
                }
            }
        } else {
            setError("Invoice not found.");
        }

      } catch (err: any) {
        if (err.message === 'NetworkError when attempting to fetch resource.' || err.message === 'Failed to fetch') {
            setError("Unable to connect to the database. Please check your internet connection, ensure your Supabase project is active (not paused), and disable any adblockers that might be blocking the connection.");
        } else {
            setError(err.message || 'An error occurred while fetching the invoice.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);
  
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const handlePaymentInitiate = () => {
    setIsCollectingDetails(true);
  };

  const handlePayment = async () => {
    if (!invoice) return;
    if (!billingName || !billingEmail) {
      alert('Please provide both name and email for billing.');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe', {
        method: 'POST',
        body: {
          action: 'create-payment-intent',
          invoiceId: invoice.id,
          amount: invoice.amount,
          invoiceNumber: invoice.invoice_number,
          clientName: billingName,
          clientEmail: billingEmail,
        },
      });

      if (error) {
        throw new Error(error.message || 'Server error');
      }

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsCollectingDetails(false);
      } else {
        throw new Error(data?.error || 'Failed to create payment intent: No client secret returned');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      alert(err.message || 'Failed to initiate payment. Please try again or use bank transfer.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (invoice) {
      await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);
      setInvoice({ ...invoice, status: 'paid' });
      setSuccessMessage('Payment successful! Thank you.');
      setClientSecret(null);
      setIsReceiptView(true);
    }
  };

  const handleSavePdf = () => {
      window.print();
  };

  const getStatusChip = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'paid';
    if (status === 'paid') return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (isOverdue) return 'bg-red-500/20 text-red-300 border-red-500/30';
    if (status === 'sent') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  }

  const stripeFee = invoice ? (invoice.amount * 0.025) + 0.20 : 0;

  return (
    <>
      <div className="min-h-screen bg-slate-900 text-slate-300 flex justify-center items-center p-4 sm:p-8 font-sans invoice-public-page-container">
        <div className="w-full max-w-4xl bg-slate-800 rounded-lg shadow-xl border border-slate-700 invoice-card">
          <header className="bg-slate-900 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-6 text-center sm:text-left border-b border-slate-700/50">
              <div className="w-full sm:w-auto flex flex-col items-center sm:items-start">
                  <Logo className="h-8 sm:h-9 w-auto" />
                  <p className="text-slate-500 text-xs sm:text-sm mt-2 uppercase tracking-widest font-bold">{isReceiptView ? 'Official Receipt' : 'Official Invoice'}</p>
              </div>
              {invoice && (
                  <div className="sm:text-right w-full sm:w-auto bg-slate-800/50 sm:bg-transparent p-4 sm:p-0 rounded-lg border border-slate-700 sm:border-0">
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">{isReceiptView ? 'Amount Paid' : 'Amount Due'}</p>
                      <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{isReceiptView ? 'Paid in Full' : formatCurrency(invoice.amount)}</h2>
                      <p className="text-slate-400 text-sm mt-1">{isReceiptView ? `Paid on ${formatDate(invoice.issue_date)}` : `Due on ${formatDate(invoice.due_date)}`}</p>
                  </div>
              )}
          </header>

          <main className="p-8">
              {loading && <p className="text-center">Loading invoice...</p>}
              {error && <p className="text-center text-red-400 mb-4">{error}</p>}
              {successMessage && (
                <div className="bg-green-500/20 border border-green-500/30 text-green-300 p-4 rounded-lg flex justify-between items-center mb-6">
                  <p>{successMessage}</p>
                  <button onClick={() => setSuccessMessage(null)} className="text-green-300 hover:text-white">&times;</button>
                </div>
              )}
              {invoice && (
                  <div>
                      {invoice.split_group_id && (
                        <div className="bg-slate-700/50 p-4 rounded-md mb-8 border border-slate-600 text-center">
                            <p className="font-semibold text-white">This is Part {invoice.split_part} of 2</p>
                            <p className="text-sm text-slate-300">
                                This invoice is for 50% of the total project cost of {formatCurrency(invoice.amount + (siblingInvoice?.amount || invoice.amount))}.
                            </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                          <div>
                              <p className="text-sm text-slate-400 mb-1">Billed To</p>
                              <p className="font-semibold text-white">{invoice.projects?.client_name || 'N/A'}</p>
                          </div>
                           <div>
                              <p className="text-sm text-slate-400 mb-1">Invoice Number</p>
                              <p className="font-semibold text-white">{invoice.invoice_number}</p>
                          </div>
                          <div>
                              <p className="text-sm text-slate-400 mb-1">Created Date</p>
                              <p className="font-semibold text-white">{formatDate(invoice.created_at)}</p>
                          </div>
                          <div>
                              <p className="text-sm text-slate-400 mb-1">Issue Date</p>
                              <p className="font-semibold text-white">{formatDate(invoice.issue_date)}</p>
                          </div>
                      </div>

                      <div className="border-t border-slate-700 pt-6">
                          <h3 className="text-lg font-semibold text-white mb-4">Itemised Breakdown</h3>
                          
                          {/* Desktop Table View */}
                          <div className="hidden sm:block overflow-x-auto">
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
                                  <tfoot className="text-slate-300">
                                      <tr className="text-white font-bold text-lg border-t-2 border-slate-600">
                                          <td colSpan={2}></td>
                                          <td className="p-2 text-right">Total Due</td>
                                          <td className="p-2 text-right">{formatCurrency(invoice.amount)}</td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="sm:hidden space-y-4">
                              {invoice.invoice_items.map(item => (
                                  <div key={item.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                      <p className="text-white font-medium mb-2">{item.description}</p>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div>
                                              <p className="text-slate-400">Quantity</p>
                                              <p className="text-white">{item.quantity}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-slate-400">Unit Price</p>
                                              <p className="text-white">{formatCurrency(item.unit_price)}</p>
                                          </div>
                                          <div className="col-span-2 pt-2 border-t border-slate-800 mt-2 flex justify-between items-center">
                                              <p className="text-slate-400">Subtotal</p>
                                              <p className="text-white font-bold">{formatCurrency(item.quantity * item.unit_price)}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                              <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex justify-between items-center">
                                  <p className="text-white font-bold">Total Due</p>
                                  <p className="text-cyan-400 font-bold text-xl">{formatCurrency(invoice.amount)}</p>
                              </div>
                          </div>
                      </div>
                      
                      {/* This block will only be visible when printing or saving as PDF */}
                      <div className="hidden print-show mt-8 pt-6 border-t border-slate-700">
                          <h3 className="text-lg font-semibold text-white mb-4">Bank Transfer Details</h3>
                           <div className="text-base space-y-2 bg-slate-900/50 p-4 rounded-md border border-slate-700">
                                <p><span className="text-slate-400">Account Name:</span> <span className="text-white font-mono">Scott Montford</span></p>
                                <p><span className="text-slate-400">Sort Code:</span> <span className="text-white font-mono">04-00-75</span></p>
                                <p><span className="text-slate-400">Account Number:</span> <span className="text-white font-mono">41017137</span></p>
                           </div>
                           <p className="text-xs text-slate-500 mt-2">Please use invoice number {invoice.invoice_number} as the payment reference.</p>
                      </div>

                      <div className="border-t border-slate-700 mt-6 pt-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="flex items-center mb-4 sm:mb-0 print-hide">
                             <span className="text-slate-400 mr-2">Status:</span>
                             <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusChip(invoice.status, invoice.due_date)}`}>
                                  {new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? 'Overdue' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                             </span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row flex-wrap items-start justify-end gap-4 w-full sm:w-auto print-hide">
                            {isReceiptView ? (
                                <>
                                    <button onClick={() => setIsReceiptView(false)} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                        Back to Invoice
                                    </button>
                                    <button onClick={() => window.print()} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                        Print Receipt
                                    </button>
                                    <button onClick={handleSavePdf} className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                        Save Receipt as PDF
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => window.print()} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                        Print Invoice
                                    </button>
                                    <button onClick={handleSavePdf} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                        Save as PDF
                                    </button>
                                    {invoice.status === 'paid' ? (
                                        <button onClick={() => setIsReceiptView(true)} className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20">
                                            View Receipt
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={() => setShowBankModal(true)} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                                Pay by Bank Transfer
                                            </button>
                                            {stripeFee <= 50 && (
                                                <button 
                                                  onClick={handlePaymentInitiate} 
                                                  disabled={isProcessingPayment}
                                                  className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isProcessingPayment ? 'Processing...' : 'Pay with Card'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                          </div>
                      </div>
                  </div>
              )}
          </main>
           <footer className="text-center p-4 bg-slate-900/50 border-t border-slate-700">
              <p className="text-xs text-slate-500">If you have any questions, please contact Montford Digital.</p>
          </footer>
        </div>
      </div>
      {showBankModal && invoice && (
          <Modal onClose={() => setShowBankModal(false)} title="Pay via Bank Transfer">
              <p className="text-sm text-slate-400 mb-4">
                  Please use your invoice number ({invoice.invoice_number}) as the payment reference.
              </p>
              <div className="text-base space-y-2 bg-slate-900/50 p-4 rounded-md border border-slate-700">
                  <p><span className="text-slate-400">Account Name:</span> <span className="text-white font-mono">Scott Montford</span></p>
                  <p><span className="text-slate-400">Sort Code:</span> <span className="text-white font-mono">04-00-75</span></p>
                  <p><span className="text-slate-400">Account Number:</span> <span className="text-white font-mono">41017137</span></p>
              </div>
          </Modal>
      )}
      {(clientSecret || isCollectingDetails) && invoice && (
          <Modal onClose={() => { setClientSecret(null); setIsCollectingDetails(false); }} title={isCollectingDetails ? "Billing Details" : "Pay with Card"}>
              {isCollectingDetails ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Billing Name</label>
                    <input
                      type="text"
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Billing Email</label>
                    <input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                      placeholder="Enter your email address"
                    />
                  </div>
                  <button
                    onClick={handlePayment}
                    disabled={isProcessingPayment || !billingName || !billingEmail}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-all disabled:opacity-50"
                  >
                    {isProcessingPayment ? 'Processing...' : 'Continue to Payment'}
                  </button>
                </div>
              ) : (
                <div className="w-full mt-2">
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                    <CheckoutForm 
                      returnUrl={`${window.location.origin}/#/invoice/${invoice.id}?success=true`} 
                      onSuccess={handlePaymentSuccess} 
                      billingDetails={{ name: billingName, email: billingEmail }}
                    />
                  </Elements>
                </div>
              )}
              <button
                onClick={() => { setClientSecret(null); setIsCollectingDetails(false); }}
                className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
              >
                Cancel
              </button>
          </Modal>
      )}
    </>
  );
};

export default InvoicePublicPage;