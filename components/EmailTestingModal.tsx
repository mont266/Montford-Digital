import React, { useState } from 'react';

interface EmailTestingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailTestingModal: React.FC<EmailTestingModalProps> = ({ isOpen, onClose }) => {
  const [recipientEmail, setRecipientEmail] = useState('scott@montforddigital.com');
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async (type: 'portal-invite' | 'invoice-ready' | 'invoice-paid') => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setResultMessage({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }

    setSendingType(type);
    setResultMessage(null);

    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, recipientEmail }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.simulated) {
          setResultMessage({
            type: 'info',
            text: `Simulated test send for "${type}". To send real emails, ensure RESEND_API_KEY is configured.`,
          });
        } else {
          setResultMessage({
            type: 'success',
            text: `✓ Test "${type}" email sent successfully to ${recipientEmail}! (Resend ID: ${data.messageId})`,
          });
        }
      } else {
        setResultMessage({
          type: 'error',
          text: `Resend error: ${data.error || 'Failed to send test email.'}`,
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Network error: ${err.message || 'Could not connect to server.'}`,
      });
    } finally {
      setSendingType(null);
    }
  };

  const templates = [
    {
      id: 'invoice-ready' as const,
      name: 'Invoice Ready to Pay',
      trigger: 'Auto-sends when invoice is marked "Sent"',
      description: 'Clean branded email with invoice number, amount, due date, line items breakdown, bank transfer details, and a direct "View & Pay Invoice Online" button.',
      previewUrl: '/api/emails/preview?type=invoice-ready',
    },
    {
      id: 'invoice-paid' as const,
      name: 'Invoice Paid (Receipt)',
      trigger: 'Auto-sends when invoice is paid via Stripe or marked "Paid"',
      description: 'Official confirmation receipt with "PAID IN FULL" status badge, amount paid, payment date, itemised items, and a direct link to the live digital receipt.',
      previewUrl: '/api/emails/preview?type=invoice-paid',
    },
    {
      id: 'portal-invite' as const,
      name: 'Client Portal Setup Invitation',
      trigger: 'Manual 1-click button on Clients dashboard (only for clients who haven\'t yet set a password)',
      description: 'Features the Montford "M" branding and highlights key portal capabilities: manage invoices, upload project files, check project progress, review proposals & more, with an "Activate Portal & Set Password" button.',
      previewUrl: '/api/emails/preview?type=portal-invite',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <h3 className="text-xl font-bold text-white">Transactional Email Templates & Testing</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Preview email templates in your browser or send live test emails via your connected Resend account.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Test Recipient Input */}
        <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-300">
              Test Email Recipient
            </label>
            <span className="text-[11px] text-amber-400/90 font-medium">
              Note: Unverified Resend domains can only send to your account email (scott@montforddigital.com)
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="scott@montforddigital.com"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {resultMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium border ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                  : resultMessage.type === 'error'
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                  : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
              }`}
            >
              {resultMessage.text}
            </div>
          )}
        </div>

        {/* Templates List */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Available Email Templates ({templates.length})
          </h4>

          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    {tpl.name}
                  </h5>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    ⚡ {tpl.trigger}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={tpl.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>👁 Preview HTML</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleSendTest(tpl.id)}
                    disabled={sendingType === tpl.id}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {sendingType === tpl.id ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <span>✉ Send Test Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {tpl.description}
              </p>
            </div>
          ))}
        </div>

        {/* Resend Domain Verification Guide */}
        <div className="mt-5 p-4 bg-slate-950/30 border border-slate-800/80 rounded-xl space-y-1.5 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">
            How to send to real customers (Domain Verification):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Log in to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">resend.com/domains</a> and click <span className="text-white">"Add Domain"</span> (e.g. <span className="font-mono text-cyan-300">montforddigital.com</span>).</li>
            <li>Add the 3 DNS records (DKIM, SPF) provided by Resend to your domain registrar (e.g. GoDaddy, Cloudflare, Namecheap).</li>
            <li>Once verified in Resend, set <span className="font-mono text-cyan-300">RESEND_FROM_EMAIL=Montford Digital &lt;hello@montforddigital.com&gt;</span>. Live emails will now deliver automatically to any client!</li>
          </ol>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
