import React, { useState, useEffect } from 'react';
import { Estimate } from '../lib/estimates';
import { supabase } from '../lib/supabaseClient';
import {
  fetchNextInvoiceNumber,
  fetchClientProjects,
  convertEstimateToInvoice,
} from '../lib/invoiceConversion';
import { sendInvoiceReadyEmail } from '../lib/emailService';

interface ConvertToInvoiceModalProps {
  estimate: Estimate;
  onClose: () => void;
  onSuccess: (invoiceId: string, invoiceNumber: string) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const FEATURE_NAMES: Record<string, string> = {
  auth: 'User Authentication & Accounts',
  roles: 'Role-Based Access Control',
  profile: 'User Profiles & Settings',
  cms: 'Admin & Content Management Panel',
  ecommerce: 'E-commerce & Stripe Checkout',
  api: 'API Integrations & Webhooks',
  dashboard: 'Analytics & Reporting Dashboard',
  realtime: 'Real-time Live Sync & Data Stream',
  search: 'Advanced Faceted Search & Filters',
  seo: 'SEO Optimisation & Metadata Schema',
  multilingual: 'Multi-language (i18n) Support',
  notifications: 'Push & Transactional Email Alerts',
  offline: 'Offline Progressive Web App (PWA)',
  animations: 'Custom Interactive Motion Design',
};

export const ConvertToInvoiceModal: React.FC<ConvertToInvoiceModalProps> = ({
  estimate,
  onClose,
  onSuccess,
}) => {
  // Estimated bounds
  const low = estimate.estimated_low;
  const high = estimate.estimated_high;
  const mid = Math.round((low + high) / 2);

  // Exact amount state (defaults to previously set quoted_amount, or mid point)
  const [exactAmount, setExactAmount] = useState<number>(estimate.quoted_amount || mid);

  // Client state (loaded from estimate or selectable inside modal)
  const [availableClients, setAvailableClients] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [clientId, setClientId] = useState<string>(estimate.client_id || '');
  const [clientName, setClientName] = useState<string>(estimate.client_name || '');
  const [clientEmail, setClientEmail] = useState<string>(estimate.client_email || '');

  // Project state
  const [existingProjects, setExistingProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('new');
  const [newProjectName, setNewProjectName] = useState<string>(
    estimate.title || `${estimate.client_name || 'Client'} Project`
  );

  // Invoice parameters
  const [billingStructure, setBillingStructure] = useState<'full' | 'deposit_50' | 'split_50_50'>('full');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('MD-001');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [dueDatePart2, setDueDatePart2] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().split('T')[0];
  });
  const [invoiceStatus, setInvoiceStatus] = useState<'draft' | 'sent'>('sent');

  // Line items state
  const [itemMode, setItemMode] = useState<'itemized' | 'single'>('itemized');
  const [items, setItems] = useState<{ description: string; quantity: number; unit_price: number }[]>([]);

  // Submission & Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdInvoiceResult, setCreatedInvoiceResult] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    secondInvoiceNumber?: string;
  } | null>(null);
  const [copiedInvoiceLink, setCopiedInvoiceLink] = useState(false);

  // Load clients and next invoice number on mount
  useEffect(() => {
    fetchNextInvoiceNumber().then(setInvoiceNumber);

    supabase
      .from('clients')
      .select('id, name, email')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setAvailableClients(data);
          // If we have clientId, preselect
          if (estimate.client_id) {
            const found = data.find((c) => c.id === estimate.client_id);
            if (found) {
              setClientName(found.name);
              setClientEmail(found.email || '');
            }
          }
        }
      });
  }, [estimate.client_id]);

  // Load projects whenever clientId changes
  useEffect(() => {
    if (clientId) {
      fetchClientProjects(clientId).then((projs) => {
        setExistingProjects(projs);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        } else {
          setSelectedProjectId('new');
        }
      });
    } else {
      setExistingProjects([]);
      setSelectedProjectId('new');
    }
  }, [clientId]);

  // Re-build line items whenever exactAmount, itemMode or estimate changes
  useEffect(() => {
    if (itemMode === 'single') {
      setItems([
        {
          description: `${estimate.title || 'Project Development'} - Engineering Scope as Quoted`,
          quantity: 1,
          unit_price: exactAmount,
        },
      ]);
    } else {
      const rawItems: { description: string; quantity: number; weight: number }[] = [];

      // Base setup
      rawItems.push({
        description: `Base Architecture & Engineering Setup (${estimate.project_type.toUpperCase()})`,
        quantity: 1,
        weight: 15,
      });

      // Active features
      Object.entries(estimate.features || {}).forEach(([key, active]) => {
        if (active) {
          rawItems.push({
            description: FEATURE_NAMES[key] || key,
            quantity: 1,
            weight: 10,
          });
        }
      });

      const totalWeight = rawItems.reduce((acc, curr) => acc + curr.weight, 0);

      // Distribute exactAmount proportionally
      let runningSum = 0;
      const calculated = rawItems.map((item, idx) => {
        if (idx === rawItems.length - 1) {
          return {
            description: item.description,
            quantity: item.quantity,
            unit_price: Math.max(0, exactAmount - runningSum),
          };
        }
        const price = Math.round((exactAmount * (item.weight / totalWeight)) * 100) / 100;
        runningSum += price;
        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: price,
        };
      });

      setItems(calculated);
    }
  }, [exactAmount, itemMode, estimate]);

  const handleQuickAmountPick = (amount: number) => {
    setExactAmount(amount);
  };

  const handleClientSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setClientId(val);
    if (val && val !== 'custom') {
      const c = availableClients.find((item) => item.id === val);
      if (c) {
        setClientName(c.name);
        setClientEmail(c.email || '');
        setNewProjectName(estimate.title || `${c.name} Project`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalClientId = clientId;
    let finalClientName = clientName.trim();
    let finalClientEmail = clientEmail.trim();

    if (!finalClientName) {
      setErrorMsg('Please select or specify a customer/client name to invoice.');
      return;
    }
    if (exactAmount <= 0) {
      setErrorMsg('Please specify a valid invoice amount greater than £0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    // If client does not exist in database, create client first
    if (!finalClientId || finalClientId === 'custom') {
      try {
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            name: finalClientName,
            email: finalClientEmail || null,
          })
          .select()
          .single();

        if (!clientErr && newClient) {
          finalClientId = newClient.id;
        }
      } catch (e) {
        console.warn('Could not auto-create client in database, proceeding with name:', e);
      }
    }

    const result = await convertEstimateToInvoice({
      estimate,
      clientId: finalClientId,
      clientName: finalClientName,
      clientEmail: finalClientEmail,
      projectId: selectedProjectId,
      newProjectName,
      exactAmount,
      billingStructure,
      invoiceNumber,
      issueDate,
      dueDate,
      dueDatePart2,
      status: invoiceStatus,
      lineItems: items,
    });

    setIsSubmitting(false);

    if (result.success && result.invoiceId && result.invoiceNumber) {
      if (invoiceStatus === 'sent') {
        sendInvoiceReadyEmail(result.invoiceId).catch(console.error);
        if (result.secondInvoiceId) {
          sendInvoiceReadyEmail(result.secondInvoiceId).catch(console.error);
        }
      }
      setCreatedInvoiceResult({
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        secondInvoiceNumber: result.secondInvoiceNumber,
      });
      onSuccess(result.invoiceId, result.invoiceNumber);
    } else {
      setErrorMsg(result.error || 'Failed to create invoice.');
    }
  };

  const copyInvoiceUrl = (id: string) => {
    const url = `${window.location.origin}/#/invoice/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedInvoiceLink(true);
    setTimeout(() => setCopiedInvoiceLink(false), 2000);
  };

  // SUCCESS SCREEN
  if (createdInvoiceResult) {
    const invoiceUrl = `${window.location.origin}/#/invoice/${createdInvoiceResult.invoiceId}`;
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl w-full max-w-lg p-7 text-center space-y-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white">Invoice Generated!</h3>
            <p className="text-slate-400 text-sm mt-1">
              Invoice <span className="text-cyan-400 font-semibold">{createdInvoiceResult.invoiceNumber}</span>{' '}
              {createdInvoiceResult.secondInvoiceNumber && (
                <span>&amp; {createdInvoiceResult.secondInvoiceNumber}</span>
              )}{' '}
              was successfully generated for <strong className="text-white">{clientName || estimate.client_name}</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-left text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Client:</span>
              <span className="text-white font-medium">{clientName || estimate.client_name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Billed Amount:</span>
              <span className="text-emerald-400 font-bold text-sm">{formatCurrency(exactAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Billing Structure:</span>
              <span className="text-slate-300 capitalize">
                {billingStructure === 'split_50_50'
                  ? 'Two-part (50% upfront + 50% completion)'
                  : billingStructure === 'deposit_50'
                  ? '50% Upfront Deposit'
                  : 'Full 100% Invoice'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Public Invoice
              </a>

              <button
                type="button"
                onClick={() => copyInvoiceUrl(createdInvoiceResult.invoiceId)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copiedInvoiceLink ? 'Copied Link!' : 'Copy Client Link'}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Done &amp; Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex justify-between items-start">
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Quote &rarr; Invoice Conversion
            </span>
            <h3 className="text-xl font-bold text-white mt-1">Convert Quote to Customer Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Scope: <strong className="text-slate-200">{estimate.title}</strong> &bull; Range: {formatCurrency(low)} &ndash; {formatCurrency(high)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Client Selection */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
              1. Customer / Client to Invoice
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Select Existing Client</label>
                <select
                  value={clientId}
                  onChange={handleClientSelectChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Client or Enter New Below --</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                  <option value="custom">+ New / Custom Client</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp / Jane Smith"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {(!clientId || clientId === 'custom') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Client Contact Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* STEP 2: Exact Quoted Amount Selection */}
          <div className="p-5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-4">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                2. Set Exact Quoted Amount to Bill
              </label>
              <span className="text-xs text-slate-400">
                Envelope: {formatCurrency(low)} &ndash; {formatCurrency(high)}
              </span>
            </div>

            {/* Quick-pick chips */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmountPick(low)}
                className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === low
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Lower Bound</span>
                <span className="text-sm font-bold text-white">{formatCurrency(low)}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAmountPick(mid)}
                className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === mid
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Mid Target</span>
                <span className="text-sm font-bold text-white">{formatCurrency(mid)}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAmountPick(high)}
                className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === high
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Upper Bound</span>
                <span className="text-sm font-bold text-white">{formatCurrency(high)}</span>
              </button>
            </div>

            {/* Custom Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Exact Invoice Amount (£)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-400 text-lg font-bold">£</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={exactAmount}
                  onChange={(e) => setExactAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-emerald-400 text-xl font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Choose any exact amount within (or based on) the estimated scope envelope.
              </p>
            </div>
          </div>

          {/* STEP 3: Project Assignment */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
              3. Dashboard Project Assignment
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="new">+ Create New Project for this Scope</option>
                  {existingProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProjectId === 'new' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Project Name</label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* STEP 4: Invoicing Structure */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
              4. Invoicing Milestone Structure
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  billingStructure === 'full'
                    ? 'bg-cyan-950/40 border-cyan-500'
                    : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="billingStructure"
                  value="full"
                  checked={billingStructure === 'full'}
                  onChange={() => setBillingStructure('full')}
                  className="sr-only"
                />
                <span className="text-xs font-bold text-white block">Full Invoice (100%)</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Bill {formatCurrency(exactAmount)} on a single invoice.
                </span>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  billingStructure === 'deposit_50'
                    ? 'bg-cyan-950/40 border-cyan-500'
                    : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="billingStructure"
                  value="deposit_50"
                  checked={billingStructure === 'deposit_50'}
                  onChange={() => setBillingStructure('deposit_50')}
                  className="sr-only"
                />
                <span className="text-xs font-bold text-white block">50% Upfront Deposit</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Bill {formatCurrency(Math.round(exactAmount / 2))} as upfront milestone.
                </span>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  billingStructure === 'split_50_50'
                    ? 'bg-cyan-950/40 border-cyan-500'
                    : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="billingStructure"
                  value="split_50_50"
                  checked={billingStructure === 'split_50_50'}
                  onChange={() => setBillingStructure('split_50_50')}
                  className="sr-only"
                />
                <span className="text-xs font-bold text-white block">Two-Part 50/50 Split</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Create Part A &amp; Part B ({formatCurrency(Math.round(exactAmount / 2))} each).
                </span>
              </label>
            </div>
          </div>

          {/* STEP 5: Invoice Dates & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Issue Date</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {billingStructure === 'split_50_50' ? 'Due Date (Part 1)' : 'Due Date'}
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {billingStructure === 'split_50_50' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Due Date (Part 2 - Completion)</label>
              <input
                type="date"
                required
                value={dueDatePart2}
                onChange={(e) => setDueDatePart2(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* STEP 6: Line Items */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                5. Scope Line Items
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemMode('itemized')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    itemMode === 'itemized'
                      ? 'bg-cyan-500 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Itemised Scope
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('single')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    itemMode === 'single'
                      ? 'bg-cyan-500 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Single Summary Item
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 max-h-40 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs text-slate-300 border-b border-slate-850 pb-1.5 last:border-none last:pb-0">
                  <span className="truncate pr-4">{item.description}</span>
                  <span className="font-semibold text-white whitespace-nowrap">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Initial Status */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs">
            <span className="text-slate-300 font-medium">Initial Invoice Status</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInvoiceStatus('sent')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  invoiceStatus === 'sent' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Mark as Sent
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatus('draft')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  invoiceStatus === 'draft' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Save as Draft
              </button>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Generating Invoice...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>
                    Create Invoice for {formatCurrency(billingStructure === 'deposit_50' ? exactAmount / 2 : exactAmount)}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
