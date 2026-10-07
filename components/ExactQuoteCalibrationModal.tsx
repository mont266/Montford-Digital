import React, { useState, useEffect } from 'react';
import { Estimate, saveEstimate } from '../lib/estimates';

interface ExactQuoteCalibrationModalProps {
  estimate: Estimate;
  onClose: () => void;
  onSaved: (updated: Estimate) => void;
  onConvertToInvoice: (updated: Estimate) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

export const ExactQuoteCalibrationModal: React.FC<ExactQuoteCalibrationModalProps> = ({
  estimate,
  onClose,
  onSaved,
  onConvertToInvoice,
}) => {
  const low = estimate.estimated_low;
  const high = estimate.estimated_high;
  const mid = Math.round((low + high) / 2);

  const [exactAmount, setExactAmount] = useState<number>(estimate.quoted_amount || mid);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setExactAmount(estimate.quoted_amount || mid);
  }, [estimate, mid]);

  const handleSave = async (andInvoice = false) => {
    setIsSaving(true);
    const updated: Estimate = {
      ...estimate,
      quoted_amount: exactAmount,
      status: estimate.status === 'invoiced' ? 'invoiced' : 'quoted',
    };

    await saveEstimate(updated);
    setIsSaving(false);
    onSaved(updated);

    if (andInvoice) {
      onConvertToInvoice(updated);
    } else {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    }
  };

  // Determine relative position in range
  const percentInRange = Math.max(
    0,
    Math.min(100, high > low ? Math.round(((exactAmount - low) / (high - low)) * 100) : 50)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex justify-between items-start">
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Quote Calibration
            </span>
            <h3 className="text-xl font-bold text-white mt-1">Set Agreed Exact Quote Amount</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Scope: <strong className="text-slate-200">{estimate.title}</strong>
              {estimate.client_name ? ` • For ${estimate.client_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {saveSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold text-center">
              ✓ Exact quote of {formatCurrency(exactAmount)} saved successfully!
            </div>
          )}

          {/* Range banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Calculated Scope Envelope:</span>
              <span className="font-extrabold text-cyan-400 text-sm">
                {formatCurrency(low)} &ndash; {formatCurrency(high)}
              </span>
            </div>

            {/* Quick Bounds Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExactAmount(low)}
                className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === low
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Lower Bound</span>
                <span className="font-bold">{formatCurrency(low)}</span>
              </button>

              <button
                type="button"
                onClick={() => setExactAmount(mid)}
                className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === mid
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Mid Target</span>
                <span className="font-bold">{formatCurrency(mid)}</span>
              </button>

              <button
                type="button"
                onClick={() => setExactAmount(high)}
                className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                  exactAmount === high
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-300 uppercase">Upper Bound</span>
                <span className="font-bold">{formatCurrency(high)}</span>
              </button>
            </div>
          </div>

          {/* Exact amount input */}
          <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Agreed Exact Quote to Bill Customer
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {percentInRange}% within scope range
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-2 text-slate-400 text-2xl font-bold">£</span>
              <input
                type="number"
                step="1"
                min="1"
                value={exactAmount}
                onChange={(e) => setExactAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-emerald-500/60 rounded-xl pl-10 pr-4 py-2.5 text-emerald-400 font-extrabold text-2xl text-right focus:outline-none focus:border-emerald-400 shadow-inner"
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Quotes are estimates, but you can select or type an exact fixed figure to lock in with the client. When ready, convert this exact amount directly into a customer invoice.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Quoted Amount'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Turn into Invoice ({formatCurrency(exactAmount)})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
