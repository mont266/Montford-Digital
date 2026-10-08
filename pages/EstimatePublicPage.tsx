import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabaseClient';
import {
  Estimate,
  decodeEstimateFromDataUrl,
  getLocalEstimates,
} from '../lib/estimates';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const FEATURE_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  auth: {
    label: 'User Authentication & Accounts',
    desc: 'Secure signup, login, password resets, and session management.',
  },
  roles: {
    label: 'Role-Based Access Control',
    desc: 'Tiered user permissions and access rights (e.g. Admin, Editor, Customer).',
  },
  profile: {
    label: 'User Profiles & Settings',
    desc: 'Customisable user profile data, avatars, preferences, and account controls.',
  },
  cms: {
    label: 'Content Management (CMS)',
    desc: 'Intuitive administrative dashboard to update copy, articles, assets, and media.',
  },
  ecommerce: {
    label: 'E-commerce & Payment Checkout',
    desc: 'Product catalogue, shopping cart, and secure Stripe payment gateway.',
  },
  api: {
    label: 'Third-Party API Integrations',
    desc: 'Connecting with external services, webhooks, CRMs, or mapping services.',
  },
  dashboard: {
    label: 'Analytics & Reporting Dashboard',
    desc: 'Interactive data visualisations, metrics charts, and operational reports.',
  },
  realtime: {
    label: 'Real-time Sync & Live Data',
    desc: 'Instant updates, notifications, live status indicators, or messaging.',
  },
  search: {
    label: 'Advanced Search & Multi-Filters',
    desc: 'Instant querying with faceted filtering, multi-criteria sorting, and fuzzy search.',
  },
  seo: {
    label: 'Technical SEO & Performance Optimisation',
    desc: 'OpenGraph metadata, schema markup, sitemaps, and search engine speed tuning.',
  },
  multilingual: {
    label: 'Multi-Language Support',
    desc: 'Localised interface strings, language toggle, and regional formatting.',
  },
  notifications: {
    label: 'Push & Automated Email Alerts',
    desc: 'System event notifications, transaction receipts, and mobile push alerts.',
  },
  offline: {
    label: 'Offline & Progressive Web App (PWA)',
    desc: 'Local data caching and installable home screen experience.',
  },
  animations: {
    label: 'Bespoke UI Animations & Micro-Interactions',
    desc: 'Fluid physics-based transitions, page reveals, and interactive motion design.',
  },
};

const PROJECT_TYPE_LABELS: Record<string, { title: string; subtitle: string }> = {
  website: {
    title: 'Static Website / Landing Page',
    subtitle: 'High-speed, SEO-optimised brochure or marketing website.',
  },
  webapp: {
    title: 'Cloud Web Application',
    subtitle: 'Custom database-driven application with full business logic.',
  },
  mobileapp: {
    title: 'Native Mobile Application',
    subtitle: 'Dedicated mobile software designed for app stores.',
  },
  combo: {
    title: 'Web Application & Mobile App Suite',
    subtitle: 'Unified multi-platform ecosystem with shared cloud backend.',
  },
};

const TIMELINE_LABELS: Record<string, string> = {
  flexible: 'Flexible (12+ Weeks)',
  standard: 'Standard (8-12 Weeks)',
  expedited: 'Expedited (4-7 Weeks)',
  urgent: 'Priority Rush (2-3 Weeks)',
};

const MAINTENANCE_LABELS: Record<string, { label: string; desc: string }> = {
  none: { label: 'Self-Managed', desc: 'Client manages hosting, updates, and maintenance.' },
  basic: { label: 'Managed Hosting & Security', desc: 'SSL, regular backups, and security patching.' },
  standard: { label: 'Standard Support & Maintenance', desc: 'Managed hosting plus up to 2 hours of monthly updates/fixes.' },
  premium: { label: 'Priority Support Retainer', desc: 'Priority support SLA plus up to 8 hours of monthly feature additions.' },
};

const EstimatePublicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEstimate = async () => {
      setLoading(true);
      setError(null);

      // Check query parameter ?data=
      const encodedData = searchParams.get('data');
      if (encodedData) {
        const decoded = decodeEstimateFromDataUrl(encodedData);
        if (decoded) {
          setEstimate(decoded);
          setLoading(false);
          return;
        }
      }

      // Check URL param :id or ?id=
      const targetId = id || searchParams.get('id');
      if (targetId) {
        // Try local storage first for instant response
        const localList = getLocalEstimates();
        const foundLocal = localList.find((e) => e.id === targetId);
        if (foundLocal) {
          setEstimate(foundLocal);
          setLoading(false);
        }

        // Try Supabase
        try {
          const { data, error: dbError } = await supabase
            .from('estimates')
            .select('*')
            .eq('id', targetId)
            .single();

          if (!dbError && data) {
            setEstimate(data as Estimate);
          } else if (!foundLocal) {
            setError('Estimate not found or link has expired.');
          }
        } catch {
          if (!foundLocal) {
            setError('Unable to load estimate.');
          }
        }
      } else {
        setError('No estimate specified in link.');
      }
      setLoading(false);
    };

    loadEstimate();
  }, [id, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading project estimate...</p>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full shadow-2xl">
          <Logo className="h-8 w-auto mx-auto mb-6" />
          <h2 className="text-xl font-bold text-white mb-2">Estimate Not Found</h2>
          <p className="text-slate-400 text-sm mb-6">{error || 'This estimate link is invalid or has expired.'}</p>
          <Link
            to="/"
            className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Visit Montford Digital
          </Link>
        </div>
      </div>
    );
  }

  const activeFeatures = Object.entries(estimate.features || {})
    .filter(([_, active]) => Boolean(active))
    .map(([key]) => ({
      key,
      ...(FEATURE_DESCRIPTIONS[key] || { label: key, desc: 'Custom project feature implementation.' }),
    }));

  const projectMeta = PROJECT_TYPE_LABELS[estimate.project_type] || {
    title: estimate.project_type,
    subtitle: 'Custom digital engineering project.',
  };

  const platformText = () => {
    if (estimate.project_type === 'mobileapp') {
      if (estimate.mobile_platform === 'both') return 'iOS & Android (Dual Native)';
      if (estimate.mobile_platform === 'android') return 'Android App';
      return 'iOS App';
    }
    if (estimate.project_type === 'combo') {
      if (estimate.combo_platform === 'web_both') return 'Web App + iOS & Android';
      if (estimate.combo_platform === 'web_android') return 'Web App + Android App';
      return 'Web App + iOS App';
    }
    if (estimate.project_type === 'website') return 'Responsive Web (Desktop, Tablet & Mobile)';
    return 'Cloud Web Application';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:text-black print:p-0">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Print Bar (hidden in print) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-auto" />
            <span className="text-slate-500">|</span>
            <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
              Project Estimate & Scope
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <a
              href="mailto:scott@montforddigital.com?subject=Project Estimate Discussion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              Contact Montford Digital &rarr;
            </a>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:rounded-none">
          {/* Header Banner */}
          <div className="p-8 sm:p-10 border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-850 print:bg-none print:border-b-2 print:border-black">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-1">
                  Budgetary Scope Estimate
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white print:text-black">
                  {estimate.title}
                </h1>
                <p className="text-slate-400 text-sm mt-1 print:text-slate-600">
                  {projectMeta.subtitle}
                </p>
              </div>

              <div className="text-left sm:text-right bg-slate-800/60 sm:bg-transparent p-4 sm:p-0 rounded-lg sm:rounded-none border border-slate-700 sm:border-none w-full sm:w-auto">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Prepared By
                </p>
                <p className="text-base font-bold text-white print:text-black">
                  Montford Digital
                </p>
                <p className="text-xs text-slate-400">scott@montforddigital.com</p>
                <p className="text-xs text-slate-500 mt-2">
                  Date: {formatDate(estimate.created_at)}
                </p>
              </div>
            </div>

            {estimate.client_name && (
              <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Prepared for: </span>
                  <span className="text-slate-200 font-semibold print:text-black">
                    {estimate.client_name}
                  </span>
                  {estimate.client_email && (
                    <span className="text-slate-400 ml-1">({estimate.client_email})</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Project Details Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-800 border-b border-slate-800 bg-slate-950/40 print:border-black">
            <div className="p-4 sm:p-5">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Project Classification
              </span>
              <span className="block text-sm font-bold text-white mt-1 print:text-black">
                {projectMeta.title}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Target Platform
              </span>
              <span className="block text-sm font-bold text-cyan-400 mt-1 print:text-black">
                {platformText()}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Delivery Timeline
              </span>
              <span className="block text-sm font-bold text-white mt-1 print:text-black">
                {TIMELINE_LABELS[estimate.timeline] || 'Standard'}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                {estimate.quoted_amount ? 'Agreed Quote' : 'Estimated Investment'}
              </span>
              <span className="block text-sm font-bold text-emerald-400 mt-1 print:text-black">
                {estimate.quoted_amount
                  ? formatCurrency(estimate.quoted_amount)
                  : `${formatCurrency(estimate.estimated_low)} - ${formatCurrency(estimate.estimated_high)}`}
              </span>
            </div>
          </div>

          {estimate.invoice_id && (
            <div className="mx-8 sm:mx-10 mt-6 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Official Invoice <strong>{estimate.invoice_number || 'Generated'}</strong> has been issued for this scope.
                </span>
              </div>
              <a
                href={`/#/invoice/${estimate.invoice_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded font-bold transition-colors"
              >
                View &amp; Pay Invoice &rarr;
              </a>
            </div>
          )}

          {/* Scope & Features Inclusions */}
          <div className="p-8 sm:p-10 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 print:text-black">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Included Scope & Architecture
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                The preliminary scope contains the following engineering components:
              </p>

              {activeFeatures.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeFeatures.map((feat) => (
                    <div
                      key={feat.key}
                      className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl print:bg-white print:border-slate-300"
                    >
                      <div className="flex items-start gap-2.5">
                        <svg
                          className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5 print:text-black"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-white print:text-black">
                            {feat.label}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed print:text-slate-600">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-4 bg-slate-800/40 border border-slate-800 rounded-xl text-xs text-slate-400">
                  Custom baseline scope without modular feature add-ons.
                </div>
              )}
            </div>

            {/* Custom Scope Notes if provided */}
            {estimate.custom_notes && (
              <div className="p-5 bg-slate-800/30 border border-slate-800 rounded-xl print:bg-white print:border-slate-300">
                <h3 className="text-xs uppercase tracking-wider text-cyan-400 font-bold mb-2">
                  Scope Notes & Project Context
                </h3>
                <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed print:text-slate-700">
                  {estimate.custom_notes}
                </p>
              </div>
            )}

            {/* Financial Summary */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 print:border-slate-400 print:bg-white">
              <h3 className="text-base font-bold text-white mb-4 print:text-black">
                Price Breakdown & Financial Summary
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-300 print:text-black">
                  <span>Development Subtotal</span>
                  <span className="font-semibold">{formatCurrency(estimate.subtotal)}</span>
                </div>

                {estimate.discount > 0 && (
                  <div className="flex justify-between text-emerald-400 print:text-emerald-800 font-medium">
                    <span>Discount</span>
                    <span>-{formatCurrency(estimate.discount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 print:border-black flex justify-between items-baseline">
                  <div>
                    <span className="text-base font-bold text-white print:text-black block">
                      Estimated Project Scope Envelope
                    </span>
                    <span className="text-xs text-slate-400">
                      Baseline contingency range (&plusmn;10%)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-slate-300 print:text-black">
                      {formatCurrency(estimate.estimated_low)} &ndash; {formatCurrency(estimate.estimated_high)}
                    </span>
                  </div>
                </div>

                {estimate.quoted_amount && (
                  <div className="pt-3 border-t border-slate-800 print:border-black flex justify-between items-baseline bg-emerald-950/20 -mx-6 px-6 py-3 rounded-lg border border-emerald-500/30">
                    <div>
                      <span className="text-base font-extrabold text-white print:text-black block">
                        Formal Agreed Fixed Quote
                      </span>
                      <span className="text-xs text-emerald-400">
                        Exact binding quote approved for this project
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 print:text-black">
                        {formatCurrency(estimate.quoted_amount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Maintenance if configured */}
                {estimate.maintenance_tier && estimate.maintenance_tier !== 'none' && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-slate-300 print:text-black block">
                        Ongoing Upkeep: {MAINTENANCE_LABELS[estimate.maintenance_tier]?.label}
                      </span>
                      <span className="text-slate-500">
                        {MAINTENANCE_LABELS[estimate.maintenance_tier]?.desc}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-bold print:text-black">
                        {formatCurrency(estimate.monthly_maintenance)} / mo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Terms & Call to Action */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 print:text-slate-600">
              <p>
                This document is a formal preliminary scope and budgetary estimate provided by Montford Digital.
                Valid for 30 days from issue.
              </p>
              <div className="flex-shrink-0 print:hidden">
                <a
                  href={`mailto:scott@montforddigital.com?subject=Accept Estimate: ${encodeURIComponent(
                    estimate.title
                  )}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-[1.02]"
                >
                  Confirm & Discuss Start Date &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatePublicPage;
