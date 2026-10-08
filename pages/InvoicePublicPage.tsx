

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '../src/components/CheckoutForm';
import { sendInvoicePaidEmail } from '../lib/emailService';

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
    client_name?: string | null;
    client_id?: string | null;
    clients?: {
      id?: string;
      name?: string;
      email?: string;
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
  const [isNotFound, setIsNotFound] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [isReceiptView, setIsReceiptView] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [isCollectingDetails, setIsCollectingDetails] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!id) {
      setIsNotFound(true);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      // Handle successful payment redirect
      if (searchParams.get('success') === 'true') {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', id);
        sendInvoicePaidEmail(id).catch(console.error);
        setSuccessMessage('Payment successful! A confirmation receipt has been sent to your email.');
        setIsReceiptView(true);
      } else if (searchParams.get('canceled') === 'true' || searchParams.get('cancelled') === 'true') {
        setError('Payment process was cancelled.');
      }

      const { data, error: dbError } = await supabase
        .from('invoices')
        .select(`*, projects ( name, client_name, client_id, clients ( id, name, email ) ), invoice_items ( * )`)
        .eq('id', id)
        .single();

      if (dbError) {
        if (
          dbError.code === 'PGRST116' ||
          dbError.message?.toLowerCase().includes('json object requested') ||
          dbError.message?.toLowerCase().includes('0 rows') ||
          dbError.details?.toLowerCase().includes('0 rows')
        ) {
          setIsNotFound(true);
          setInvoice(null);
          return;
        }
        throw dbError;
      }

      if (data) {
          let candidateNames = [
            data.projects?.client_name?.trim(),
            data.projects?.clients?.name?.trim(),
          ].filter((n): n is string => Boolean(n && n.length > 0));

          let candidateEmails = [
            data.projects?.clients?.email?.trim(),
            (data.projects as any)?.client_email?.trim(),
          ].filter((e): e is string => Boolean(e && e.length > 0));

          // If neither client_name nor clients was loaded via join, try direct lookup by client_id
          if (candidateNames.length === 0 && data.projects?.client_id) {
            try {
              const { data: directClient } = await supabase
                .from('clients')
                .select('id, name, email')
                .eq('id', data.projects.client_id)
                .single();
              if (directClient?.name) {
                candidateNames.push(directClient.name.trim());
                if (directClient.email) candidateEmails.push(directClient.email.trim());
              }
            } catch (e) {
              console.warn('Direct client lookup notice:', e);
            }
          }

          // Pick the most complete full name (e.g. "Blue Whippet Heating" over "Blue")
          const resolvedClientName = candidateNames.sort((a, b) => b.length - a.length)[0] || '';
          const resolvedClientEmail = candidateEmails[0] || '';

          setInvoice(data as Invoice);
          setBillingName(resolvedClientName);
          setBillingEmail(resolvedClientEmail);
          setIsNotFound(false);
          if (searchParams.get('receipt') === 'true' || searchParams.get('success') === 'true') {
              setIsReceiptView(true);
          }
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
          setIsNotFound(true);
          setInvoice(null);
      }

    } catch (err: any) {
      if (
        err?.code === 'PGRST116' ||
        err?.message?.toLowerCase().includes('json object requested') ||
        err?.message?.toLowerCase().includes('0 rows') ||
        err?.message?.toLowerCase().includes('not found')
      ) {
        setIsNotFound(true);
        setInvoice(null);
      } else if (err.message === 'NetworkError when attempting to fetch resource.' || err.message === 'Failed to fetch') {
        setError("Unable to connect to the database. Please check your internet connection, ensure your Supabase project is active (not paused), and disable any adblockers that might be blocking the connection.");
      } else {
        setError(err.message || 'An error occurred while fetching the invoice.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, searchParams]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);
  
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
    if (status === 'sent') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col justify-center items-center p-4">
        <Logo className="h-9 w-auto mb-8 animate-pulse" />
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Loading invoice details...</p>
      </div>
    );
  }

  if (isNotFound || (!invoice && !error)) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col justify-center items-center p-4 sm:p-8 font-sans">
        <div className="w-full max-w-lg bg-slate-800/95 backdrop-blur rounded-2xl shadow-2xl border border-slate-700 p-6 sm:p-10 text-center">
          <div className="mb-6 flex justify-center">
            <Logo className="h-8 sm:h-9 w-auto" />
          </div>

          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v.01" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Invoice Not Found</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            This invoice is no longer available. It may have been updated, settled, or removed by our accounts team.
          </p>

          {id && (
            <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/60 mb-6 flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Reference:</span>
              <span className="text-slate-300 font-mono select-all truncate max-w-[280px]">{id}</span>
            </div>
          )}

          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800 text-left text-xs text-slate-400 space-y-2.5 mb-8">
            <p className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] mb-1">What you can do:</p>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span>Check your email inbox for a more recently issued invoice link.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span>If you are a registered client, log into your Client Portal to view all current and past invoices.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span>If you believe this is an error, contact our accounts team and we'll gladly look into it.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`mailto:hello@montforddigital.com?subject=Invoice%20Query%20(Ref:%20${encodeURIComponent(id || 'N/A')})`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-lg transition-colors shadow-lg shadow-cyan-950/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </a>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm rounded-lg transition-colors border border-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col justify-center items-center p-4 sm:p-8 font-sans">
        <div className="w-full max-w-lg bg-slate-800/95 backdrop-blur rounded-2xl shadow-2xl border border-slate-700 p-6 sm:p-10 text-center">
          <div className="mb-6 flex justify-center">
            <Logo className="h-8 sm:h-9 w-auto" />
          </div>

          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Unable to Load Invoice</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            {error}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => fetchInvoice()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-lg transition-colors shadow-lg shadow-cyan-950/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm rounded-lg transition-colors border border-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
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
                              <p className="font-semibold text-white">
                                {billingName || invoice.projects?.client_name?.trim() || invoice.projects?.clients?.name?.trim() || 'Valued Client'}
                              </p>
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
                                  {new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? 'Overdue' : (invoice.status === 'sent' ? 'Outstanding' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1))}
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