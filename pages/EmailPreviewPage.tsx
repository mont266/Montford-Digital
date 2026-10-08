import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getSampleEmailTemplate, EmailTemplateType } from '../lib/emailTemplates';
import { getAppBaseUrl } from '../lib/urlHelper';

export const EmailPreviewPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type') as EmailTemplateType | null;

  const activeType: EmailTemplateType =
    rawType === 'portal-invite' || rawType === 'invoice-paid' || rawType === 'invoice-ready'
      ? rawType
      : 'invoice-ready';

  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile' | 'full'>('desktop');
  const [copiedHtml, setCopiedHtml] = useState(false);

  const template = useMemo(() => {
    return getSampleEmailTemplate(activeType, getAppBaseUrl());
  }, [activeType]);

  const handleSelectType = (type: EmailTemplateType) => {
    setSearchParams({ type });
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(template.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center p-1.5 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path fill="#ffffff" d="M0 32 L0 0 L12 0 L16 8 L20 0 L32 0 L32 32 L22 32 L16 20 L10 32 Z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-extrabold tracking-wider text-white">
                  MONTFORD<span className="text-cyan-400">.</span>DIGITAL
                </span>
                <span className="block text-[10px] text-slate-400 font-mono tracking-tight uppercase">
                  Email Template Preview
                </span>
              </div>
            </Link>

            {/* Back Links */}
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              >
                &larr; Dashboard
              </Link>
            </div>
          </div>

          {/* Template Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => handleSelectType('invoice-ready')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeType === 'invoice-ready'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>📄</span>
              <span>Invoice Ready</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectType('invoice-paid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeType === 'invoice-paid'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>✓</span>
              <span>Invoice Paid (Receipt)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectType('portal-invite')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeType === 'portal-invite'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>🔑</span>
              <span>Portal Setup Invite</span>
            </button>
          </div>

          {/* Viewport and Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Viewport Switcher */}
            <div className="flex items-center bg-slate-950/70 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                title="Desktop View (640px)"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                title="Mobile View (390px)"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewportMode === 'mobile'
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('full')}
                title="Full Width"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewportMode === 'full'
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>

            {/* Copy HTML Button */}
            <button
              type="button"
              onClick={handleCopyHtml}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedHtml ? (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy HTML</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 bg-slate-950">
        {/* Email Header Simulation Card */}
        <div
          className={`w-full mb-4 bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all duration-300 ${
            viewportMode === 'mobile'
              ? 'max-w-[420px]'
              : viewportMode === 'desktop'
              ? 'max-w-[680px]'
              : 'max-w-4xl'
          }`}
        >
          <div className="flex flex-col gap-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300 min-w-16">Subject:</span>
              <span className="text-slate-100 font-medium truncate">{template.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300 min-w-16">From:</span>
              <span className="text-slate-300">
                Montford Digital &lt;hello@montforddigital.com&gt;
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300 min-w-16">To:</span>
              <span className="text-slate-300">Alex Morgan &lt;alex.morgan@example.com&gt;</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[11px] text-cyan-400">
              <span className="font-semibold">Trigger:</span>
              <span>{template.trigger}</span>
            </div>
          </div>
        </div>

        {/* Viewport Frame */}
        <div
          className={`w-full flex justify-center transition-all duration-300 ${
            viewportMode === 'mobile'
              ? 'max-w-[420px]'
              : viewportMode === 'desktop'
              ? 'max-w-[680px]'
              : 'max-w-5xl'
          }`}
        >
          <div
            className={`w-full bg-[#0b0f17] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl transition-all duration-300 ${
              viewportMode === 'mobile'
                ? 'border-4 border-slate-700 rounded-3xl p-1 shadow-cyan-900/10'
                : ''
            }`}
          >
            {viewportMode === 'mobile' && (
              <div className="w-full flex justify-center py-2 bg-slate-850 rounded-t-2xl">
                <div className="w-24 h-4 bg-slate-800 rounded-full" />
              </div>
            )}

            <iframe
              title={template.name}
              srcDoc={template.html}
              className="w-full h-[850px] border-none bg-[#0b0f17] block"
              sandbox="allow-same-origin allow-popups"
            />
          </div>
        </div>

        {/* Description & Testing footer note */}
        <div className="mt-8 text-center text-xs text-slate-500 max-w-xl">
          <p className="leading-relaxed">
            All transactional emails are sent via Resend and match Montford Digital's verified
            dark branding. Button links dynamically route users to the live Montford Digital web application.
          </p>
        </div>
      </main>
    </div>
  );
};

export default EmailPreviewPage;
