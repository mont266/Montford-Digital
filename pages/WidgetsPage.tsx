import React, { useState } from 'react';

// --- Watermark Snippet Component (Moved from QuoteCalculatorPage) ---
const WatermarkSnippet: React.FC = () => {
    const [copyButtonText, setCopyButtonText] = useState('Copy Code');

    const snippet = `<a href="https://montforddigital.com" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; text-decoration: none; font-family: sans-serif; font-size: 12px; color: #94a3b8; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" style="margin-right: 6px;">
    <defs><linearGradient id="md-grad-footer" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#14b8a6"/></linearGradient></defs>
    <path fill="url(#md-grad-footer)" d="M0 32 L0 0 L12 0 L16 8 L20 0 L32 0 L32 32 L22 32 L16 20 L10 32 Z"/>
  </svg>
  <span style="color: #94a3b8;">Developed by <strong style="font-weight: bold; color: #e2e8f0;">Montford Digital</strong></span>
</a>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet.trim()).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Code'), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            setCopyButtonText('Failed to copy');
        });
    };

    return (
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-4xl">
            <h3 className="text-xl font-bold text-white mb-4">Website Footer Snippet</h3>
            <p className="text-slate-400 mb-4 text-sm">Add this self-contained HTML snippet to the footer of sites you build to provide attribution.</p>
            
            <div className="bg-slate-900 rounded-lg p-4 relative">
                <pre className="text-cyan-300 text-xs overflow-x-auto">
                    <code>{snippet.trim()}</code>
                </pre>
                <button 
                    onClick={handleCopy}
                    className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs py-1 px-3 rounded-md transition-colors"
                >
                    {copyButtonText}
                </button>
            </div>
            
            <div className="mt-4 border-t border-slate-700 pt-4">
                 <h4 className="text-sm font-semibold text-white mb-2">Live Preview:</h4>
                 <div className="bg-slate-900/50 p-4 rounded-lg flex justify-center items-center">
                    <div dangerouslySetInnerHTML={{ __html: snippet }} />
                 </div>
            </div>
        </div>
    );
};

const WidgetsPage: React.FC = () => {
    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Widgets & Snippets</h2>
            <p className="text-slate-400">Reusable components and code snippets for your projects.</p>
            <WatermarkSnippet />
        </div>
    );
};

export default WidgetsPage;