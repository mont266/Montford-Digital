import React, { useState, useEffect } from 'react';
import { Estimate, fetchAllEstimates } from '../lib/estimates';
import { ConvertToInvoiceModal } from './ConvertToInvoiceModal';
import { ExactQuoteCalibrationModal } from './ExactQuoteCalibrationModal';
import { Link } from 'react-router-dom';

interface InvoiceFromQuoteModalProps {
  onClose: () => void;
  onInvoiceCreated: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const InvoiceFromQuoteModal: React.FC<InvoiceFromQuoteModalProps> = ({
  onClose,
  onInvoiceCreated,
}) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstimateForInvoice, setSelectedEstimateForInvoice] = useState<Estimate | null>(null);
  const [calibratingEstimate, setCalibratingEstimate] = useState<Estimate | null>(null);

  const loadData = () => {
    fetchAllEstimates().then((list) => {
      setEstimates(list);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (selectedEstimateForInvoice) {
    return (
      <ConvertToInvoiceModal
        estimate={selectedEstimateForInvoice}
        onClose={() => {
          setSelectedEstimateForInvoice(null);
          onClose();
        }}
        onSuccess={() => {
          onInvoiceCreated();
          onClose();
        }}
      />
    );
  }

  return (
    <>
      {calibratingEstimate && (
        <ExactQuoteCalibrationModal
          estimate={calibratingEstimate}
          onClose={() => setCalibratingEstimate(null)}
          onSaved={(updated) => {
            setEstimates((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
          onConvertToInvoice={(updated) => {
            setCalibratingEstimate(null);
            setSelectedEstimateForInvoice(updated);
          }}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-center items-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/90">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Quote Scoping &rarr; Invoice Generation
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Invoice from a Quote / Estimate</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pick any scope estimate to set an exact agreed quote amount and turn it into a customer invoice.
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
              &times;
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-4 flex-grow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Saved Client Quotes &amp; Scopes ({estimates.length})
              </span>
              <Link
                to="/dashboard/calculator"
                onClick={onClose}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                + New Scope in Calculator &rarr;
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading saved quotes...</div>
            ) : estimates.length === 0 ? (
              <div className="py-16 text-center bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                <p className="text-slate-400 text-sm">No saved estimates found yet.</p>
                <Link
                  to="/dashboard/calculator"
                  onClick={onClose}
                  className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-4 py-2 rounded-lg"
                >
                  Go to Quote Calculator
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {estimates.map((est) => {
                  const isAlreadyInvoiced = Boolean(est.invoice_number);
                  return (
                    <div
                      key={est.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                        isAlreadyInvoiced
                          ? 'bg-slate-900/40 border-slate-800 opacity-80'
                          : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{est.title}</span>
                          {isAlreadyInvoiced && (
                            <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full font-semibold">
                              ✓ Invoiced ({est.invoice_number})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Client: <strong className="text-slate-300">{est.client_name || 'Unassigned'}</strong>
                          </span>
                          <span>
                            Estimate: {formatCurrency(est.estimated_low)} &ndash; {formatCurrency(est.estimated_high)}
                          </span>
                          {est.quoted_amount ? (
                            <span className="text-emerald-400 font-bold">
                              Exact Quote: {formatCurrency(est.quoted_amount)}
                            </span>
                          ) : (
                            <span className="text-amber-400/80 italic text-[11px]">
                              Exact quote not set
                            </span>
                          )}
                          <span>Date: {formatDate(est.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        {isAlreadyInvoiced ? (
                          <a
                            href={`/#/invoice/${est.invoice_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700"
                          >
                            View Invoice
                          </a>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setCalibratingEstimate(est)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                            >
                              Set Exact Quote
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedEstimateForInvoice(est)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1"
                            >
                              <span>Turn into Invoice</span>
                              <span className="text-emerald-100">&rarr;</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
            <span>Choose any exact amount within the estimate range when billing.</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
