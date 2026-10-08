// HTML & Text Email Templates for Montford Digital Transactional Emails
import { getAppBaseUrl } from './urlHelper';

export interface PortalInviteParams {
  clientName: string;
  portalUrl: string;
}

export interface InvoiceReadyParams {
  clientName: string;
  invoiceNumber: string;
  projectName: string;
  amount: number;
  dueDate: string;
  issueDate: string;
  invoiceUrl: string;
  lineItems?: Array<{ description: string; quantity: number; unit_price: number }>;
}

export interface InvoicePaidParams {
  clientName: string;
  invoiceNumber: string;
  projectName: string;
  amount: number;
  paidDate: string;
  receiptUrl: string;
  lineItems?: Array<{ description: string; quantity: number; unit_price: number }>;
}

export type EmailTemplateType = 'portal-invite' | 'invoice-ready' | 'invoice-paid';

const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val);

const formatDate = (dateStr: string): string => {
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

/** Base HTML wrapper matching Montford Digital branding */
function wrapHtmlTemplate({
  title,
  preheader,
  contentHtml,
}: {
  title: string;
  preheader: string;
  contentHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f17;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0b0f17;
      padding-top: 40px;
      padding-bottom: 50px;
    }
    .main-table {
      margin: 0 auto;
      max-width: 600px;
      width: 100%;
      background-color: #131d2e;
      border: 1px solid #1e2e48;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header-bar {
      background: linear-gradient(135deg, #0e1e38 0%, #172a4c 100%);
      padding: 30px 36px 26px;
      border-bottom: 1px solid #23395c;
    }
    .logo-text {
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-decoration: none;
      display: inline-block;
    }
    .logo-accent {
      color: #06b6d4;
    }
    .subhead {
      color: #94a3b8;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .content-body {
      padding: 36px;
      line-height: 1.6;
      font-size: 15px;
      color: #cbd5e1;
    }
    .footer-bar {
      background-color: #0d1523;
      padding: 24px 36px;
      border-top: 1px solid #1a2a44;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .btn-primary {
      display: inline-block;
      background-color: #06b6d4;
      background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
      text-align: center;
    }
    .btn-emerald {
      display: inline-block;
      background-color: #10b981;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      text-align: center;
    }
    .card-box {
      background-color: #172439;
      border: 1px solid #253957;
      border-radius: 10px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .badge-amber {
      display: inline-block;
      background-color: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .badge-emerald {
      display: inline-block;
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .badge-cyan {
      display: inline-block;
      background-color: rgba(6, 182, 212, 0.15);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    .items-table th {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #2d4368;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e2e48;
      color: #e2e8f0;
    }
  </style>
</head>
<body>
  <!-- Preheader text for inbox preview -->
  <span style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    ${preheader}
  </span>

  <div class="wrapper">
    <table class="main-table" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header-bar">
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            <tr>
              <td valign="middle" style="padding-right: 14px; width: 44px;">
                <!-- Montford "Prism M" Brand Icon -->
                <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; display: inline-table;">
                  <tr>
                    <td align="center" valign="middle" style="width: 44px; height: 44px; min-width: 44px; background: linear-gradient(135deg, #0e2238 0%, #152d4a 100%); border: 1px solid #1f3d63; border-radius: 12px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.25); text-align: center;">
                      <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                        <defs>
                          <linearGradient id="headerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#22d3ee" />
                            <stop offset="100%" stop-color="#14b8a6" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#headerLogoGradient)" d="M0 32 L0 0 L12 0 L16 8 L20 0 L32 0 L32 32 L22 32 L16 20 L10 32 Z" />
                      </svg>
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="middle">
                <span class="logo-text">MONTFORD<span class="logo-accent">.</span>DIGITAL</span>
                <div class="subhead">Web Engineering &amp; Client Solutions</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="content-body">
          ${contentHtml}
        </td>
      </tr>
      <tr>
        <td class="footer-bar">
          <div style="margin-bottom: 10px;">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; opacity: 0.6;">
              <defs>
                <linearGradient id="footerMGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#06b6d4" />
                  <stop offset="100%" stop-color="#14b8a6" />
                </linearGradient>
              </defs>
              <path fill="url(#footerMGradient)" d="M0 32 L0 0 L12 0 L16 8 L20 0 L32 0 L32 32 L22 32 L16 20 L10 32 Z" />
            </svg>
          </div>
          <p style="margin: 0 0 6px;">Montford Digital &bull; Scott Montford</p>
          <p style="margin: 0 0 6px;">
            Need help? Reply directly to this email or reach out at <a href="mailto:scott@montforddigital.com" style="color: #06b6d4; text-decoration: none;">scott@montforddigital.com</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #475569;">
            &copy; ${new Date().getFullYear()} Montford Digital. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/** 1. Portal Invitation Email Template */
export function renderPortalInviteEmail(params: PortalInviteParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { clientName, portalUrl } = params;
  const displayName = clientName?.trim() || 'Valued Client';
  const subject = `Your Montford Digital Client Portal is Ready`;
  const preheader = `Hi ${displayName}, manage your invoices, upload project files, check project progress & more in your dedicated Montford Digital portal.`;

  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <span class="badge-cyan">CLIENT PORTAL INVITATION</span>
    </div>
    
    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">
      Welcome to your Montford Digital Client Portal
    </h1>

    <p style="margin: 0 0 16px; font-size: 15px;">
      Hi ${displayName},
    </p>

    <p style="margin: 0 0 18px; font-size: 15px; color: #cbd5e1;">
      Your dedicated client workspace is set up and ready to go. Through this secure portal, you have direct, 24/7 access to manage everything regarding your projects in one unified place:
    </p>

    <!-- Portal Features Grid/Table -->
    <div style="background-color: #172439; border: 1px solid #253957; border-radius: 12px; padding: 22px 24px; margin: 24px 0;">
      <div style="font-size: 12px; font-weight: 700; color: #06b6d4; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;">
        Everything You Need in One Unified Workspace
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border-spacing: 0 14px;">
        <!-- 1. Manage Invoices -->
        <tr>
          <td valign="top" style="width: 38px; padding-right: 14px;">
            <div style="width: 32px; height: 32px; background-color: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
              📄
            </div>
          </td>
          <td valign="top">
            <div style="color: #ffffff; font-size: 14.5px; font-weight: 600; margin-bottom: 3px;">
              Manage Invoices &amp; Online Payments
            </div>
            <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              View itemised invoices, track real-time payment status, download PDF receipts, and settle balances instantly via secure card payments.
            </div>
          </td>
        </tr>

        <!-- 2. Upload Project-Related Files -->
        <tr>
          <td valign="top" style="width: 38px; padding-right: 14px;">
            <div style="width: 32px; height: 32px; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
              📁
            </div>
          </td>
          <td valign="top">
            <div style="color: #ffffff; font-size: 14.5px; font-weight: 600; margin-bottom: 3px;">
              Upload Project-Related Files
            </div>
            <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              Easily upload project briefs, design assets, brand guidelines, and documents directly to your active project workspace.
            </div>
          </td>
        </tr>

        <!-- 3. Check Project Progress -->
        <tr>
          <td valign="top" style="width: 38px; padding-right: 14px;">
            <div style="width: 32px; height: 32px; background-color: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
              ⚡
            </div>
          </td>
          <td valign="top">
            <div style="color: #ffffff; font-size: 14.5px; font-weight: 600; margin-bottom: 3px;">
              Check Project Progress
            </div>
            <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              Track active sprint milestones, roadmap timelines, review progress updates, and see live deliverables as they are completed.
            </div>
          </td>
        </tr>

        <!-- 4. Review Quotes & Estimates -->
        <tr>
          <td valign="top" style="width: 38px; padding-right: 14px;">
            <div style="width: 32px; height: 32px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
              🎯
            </div>
          </td>
          <td valign="top">
            <div style="color: #ffffff; font-size: 14.5px; font-weight: 600; margin-bottom: 3px;">
              Review Quotes &amp; Proposals
            </div>
            <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              Access calibrated estimates, inspect transparent scope breakdowns, and approve new project deliverables with complete clarity.
            </div>
          </td>
        </tr>

        <!-- 5. And More -->
        <tr>
          <td valign="top" style="width: 38px; padding-right: 14px;">
            <div style="width: 32px; height: 32px; background-color: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
              ✨
            </div>
          </td>
          <td valign="top">
            <div style="color: #ffffff; font-size: 14.5px; font-weight: 600; margin-bottom: 3px;">
              And More...
            </div>
            <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              Centralised project communication, archived project history, and dedicated support, all secured behind your private login.
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- First-time setup note -->
    <div style="background-color: rgba(6, 182, 212, 0.08); border-left: 3px solid #06b6d4; padding: 14px 18px; margin: 22px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 13.5px; color: #94a3b8; line-height: 1.5;">
        <strong style="color: #e2e8f0;">First-time setup:</strong> When you open the portal for the first time, you will be invited to set your own secure password so you can log back in anytime from any device.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 34px 0 24px;">
      <a href="${portalUrl}" class="btn-primary" target="_blank" style="padding: 15px 32px; font-size: 16px;">
        Activate Portal &amp; Set Password &rarr;
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0 0 24px; word-break: break-all;">
      Or paste this URL into your browser:<br>
      <a href="${portalUrl}" style="color: #06b6d4; text-decoration: underline;">${portalUrl}</a>
    </p>

    <p style="margin: 0; color: #94a3b8; font-size: 14px;">
      Best regards,<br>
      <strong style="color: #ffffff;">Scott Montford</strong><br>
      Montford Digital
    </p>
  `;

  const text = `Hi ${displayName},

Your dedicated Montford Digital client portal is ready!

Through your portal, you can:
• Manage Invoices & Online Payments: View itemised invoices, download PDF receipts, and pay securely online
• Upload Project-Related Files: Easily upload briefs, design assets, brand guidelines, and documents directly
• Check Project Progress: Monitor real-time milestones, deliverable progress, and roadmap timelines
• Review Quotes & Proposals: Inspect calibrated estimates, transparent scope breakdowns, and approvals
• And more: Centralised messaging, archived project history, and dedicated support in one secure place

To activate your portal and set your password on your first visit, use the link below:
${portalUrl}

If you have any questions, feel free to reply directly to this email.

Best regards,
Scott Montford
Montford Digital
`;

  return {
    subject,
    html: wrapHtmlTemplate({ title: subject, preheader, contentHtml }),
    text,
  };
}

/** 2. Invoice Ready to be Paid Email Template */
export function renderInvoiceReadyEmail(params: InvoiceReadyParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    clientName,
    invoiceNumber,
    projectName,
    amount,
    dueDate,
    issueDate,
    invoiceUrl,
    lineItems = [],
  } = params;

  const displayName = clientName?.trim() || 'Valued Client';
  const formattedAmount = formatCurrency(amount);
  const formattedDueDate = formatDate(dueDate);
  const formattedIssueDate = formatDate(issueDate);

  const subject = `Invoice #${invoiceNumber} is Ready for Payment (${formattedAmount}) - Montford Digital`;
  const preheader = `Invoice #${invoiceNumber} for ${projectName || 'your project'} (${formattedAmount}) is now ready for payment.`;

  const itemsHtml = lineItems.length > 0
    ? `
      <div style="margin-top: 20px;">
        <h4 style="color: #e2e8f0; font-size: 13px; text-transform: uppercase; margin: 0 0 10px; letter-spacing: 0.05em;">Invoice Breakdown</h4>
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td style="text-align: center;">${item.quantity || 1}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency((item.unit_price || 0) * (item.quantity || 1))}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  const itemsText = lineItems.length > 0
    ? lineItems.map((item) => `- ${item.description}: ${formatCurrency(item.unit_price * item.quantity)}`).join('\n')
    : '';

  const contentHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <span class="badge-amber">INVOICE READY</span>
      <span style="font-size: 13px; color: #94a3b8; font-mono: monospace;">#${invoiceNumber}</span>
    </div>

    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 12px; line-height: 1.3;">
      Invoice #${invoiceNumber} is Ready for Payment
    </h1>

    <p style="margin: 0 0 16px;">
      Hi ${displayName},
    </p>

    <p style="margin: 0 0 20px;">
      Your invoice for <strong style="color: #ffffff;">${projectName || 'your project'}</strong> has been issued and is now ready for payment.
    </p>

    <!-- Key Metrics Card -->
    <div class="card-box">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 14px;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Total Amount Due</span>
            <div style="font-size: 28px; font-weight: 800; color: #38bdf8; margin-top: 4px;">
              ${formattedAmount}
            </div>
          </td>
          <td style="padding-bottom: 14px; text-align: right;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Due Date</span>
            <div style="font-size: 15px; font-weight: 600; color: #f1f5f9; margin-top: 4px;">
              ${formattedDueDate}
            </div>
          </td>
        </tr>
        <tr style="border-top: 1px solid #223554;">
          <td style="padding-top: 12px; font-size: 13px; color: #94a3b8;">
            Issue Date: <span style="color: #cbd5e1;">${formattedIssueDate}</span>
          </td>
          <td style="padding-top: 12px; text-align: right; font-size: 13px; color: #94a3b8;">
            Project: <span style="color: #cbd5e1;">${projectName || 'Digital Services'}</span>
          </td>
        </tr>
      </table>

      ${itemsHtml}
    </div>

    <!-- Payment CTA -->
    <div style="text-align: center; margin: 32px 0 20px;">
      <a href="${invoiceUrl}" class="btn-primary" target="_blank">
        View &amp; Pay Invoice Online &rarr;
      </a>
    </div>

    <!-- Payment Methods Information -->
    <div style="background-color: #121c2e; border: 1px solid #1e2e4a; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <h4 style="margin: 0 0 8px; font-size: 13px; color: #e2e8f0; font-weight: 600;">Payment Options</h4>
      <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
        &bull; <strong style="color: #cbd5e1;">Credit / Debit Card:</strong> Pay directly and securely online through Stripe using the button above.
      </p>
      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
        &bull; <strong style="color: #cbd5e1;">Bank Transfer:</strong> Banking details (Sort Code: 04-00-75, Account: 41017137) are provided on your invoice page. Please quote <strong style="color: #cbd5e1;">#${invoiceNumber}</strong> as reference.
      </p>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0 0 24px; word-break: break-all;">
      Invoice link: <a href="${invoiceUrl}" style="color: #06b6d4; text-decoration: underline;">${invoiceUrl}</a>
    </p>

    <p style="margin: 0; color: #94a3b8; font-size: 14px;">
      Thank you for your business!<br>
      <strong style="color: #ffffff;">Scott Montford</strong><br>
      Montford Digital
    </p>
  `;

  const text = `Hi ${displayName},

Your invoice #${invoiceNumber} for ${projectName || 'your project'} is ready for payment.

Amount Due: ${formattedAmount}
Due Date: ${formattedDueDate}
Issue Date: ${formattedIssueDate}

${itemsText ? `Breakdown:\n${itemsText}\n\n` : ''}You can view and pay your invoice securely online at:
${invoiceUrl}

Payment Options:
- Credit / Debit Card: Pay securely online via Stripe using the invoice link above.
- Bank Transfer: Account Name: Scott Montford, Sort Code: 04-00-75, Account: 41017137 (Quote #${invoiceNumber} as payment reference).

Thank you for your business!

Best regards,
Scott Montford
Montford Digital
`;

  return {
    subject,
    html: wrapHtmlTemplate({ title: subject, preheader, contentHtml }),
    text,
  };
}

/** 3. Invoice Paid / Receipt Email Template */
export function renderInvoicePaidEmail(params: InvoicePaidParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    clientName,
    invoiceNumber,
    projectName,
    amount,
    paidDate,
    receiptUrl,
    lineItems = [],
  } = params;

  const displayName = clientName?.trim() || 'Valued Client';
  const formattedAmount = formatCurrency(amount);
  const formattedPaidDate = formatDate(paidDate || new Date().toISOString());

  const subject = `Payment Received: Invoice #${invoiceNumber} Receipt (${formattedAmount}) - Montford Digital`;
  const preheader = `Thank you! Your payment of ${formattedAmount} for Invoice #${invoiceNumber} has been received. View your receipt.`;

  const itemsHtml = lineItems.length > 0
    ? `
      <div style="margin-top: 18px; border-top: 1px solid #1f3554; padding-top: 14px;">
        <h4 style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin: 0 0 10px;">Services Summary</h4>
        <table class="items-table">
          <tbody>
            ${lineItems
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency((item.unit_price || 0) * (item.quantity || 1))}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  const contentHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <span class="badge-emerald">&#10003; PAID IN FULL</span>
      <span style="font-size: 13px; color: #94a3b8; font-mono: monospace;">#${invoiceNumber}</span>
    </div>

    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 12px; line-height: 1.3;">
      Payment Received &bull; Thank You!
    </h1>

    <p style="margin: 0 0 16px;">
      Hi ${displayName},
    </p>

    <p style="margin: 0 0 20px;">
      Thank you for your prompt payment! We have successfully received payment in full for invoice <strong style="color: #ffffff;">#${invoiceNumber}</strong> (${projectName || 'your project'}).
    </p>

    <!-- Receipt Details Card -->
    <div class="card-box" style="border-color: rgba(16, 185, 129, 0.4); background-color: #132334;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 14px;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Amount Paid</span>
            <div style="font-size: 28px; font-weight: 800; color: #10b981; margin-top: 4px;">
              ${formattedAmount}
            </div>
          </td>
          <td style="padding-bottom: 14px; text-align: right;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Payment Date</span>
            <div style="font-size: 15px; font-weight: 600; color: #f1f5f9; margin-top: 4px;">
              ${formattedPaidDate}
            </div>
          </td>
        </tr>
        <tr style="border-top: 1px solid #1f3750;">
          <td style="padding-top: 12px; font-size: 13px; color: #94a3b8;">
            Payment Status: <strong style="color: #10b981;">Paid in Full</strong>
          </td>
          <td style="padding-top: 12px; text-align: right; font-size: 13px; color: #94a3b8;">
            Project: <span style="color: #cbd5e1;">${projectName || 'Digital Services'}</span>
          </td>
        </tr>
      </table>

      ${itemsHtml}
    </div>

    <!-- Receipt CTA -->
    <div style="text-align: center; margin: 32px 0 20px;">
      <a href="${receiptUrl}" class="btn-emerald" target="_blank">
        View Paid Invoice &amp; Receipt &rarr;
      </a>
    </div>

    <div style="background-color: #121c2e; border: 1px solid #1e2e4a; border-radius: 8px; padding: 14px 18px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">
        📄 You can print or download your official PDF receipt anytime via the link above.
      </p>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0 0 24px; word-break: break-all;">
      Receipt URL: <a href="${receiptUrl}" style="color: #06b6d4; text-decoration: underline;">${receiptUrl}</a>
    </p>

    <p style="margin: 0; color: #94a3b8; font-size: 14px;">
      Thank you for choosing Montford Digital.<br>
      <strong style="color: #ffffff;">Scott Montford</strong><br>
      Montford Digital
    </p>
  `;

  const text = `Hi ${displayName},

Thank you! We've received your payment in full for invoice #${invoiceNumber} (${projectName || 'your project'}).

Amount Paid: ${formattedAmount}
Payment Date: ${formattedPaidDate}
Status: Paid in Full

You can view, download, or print your official payment receipt anytime at:
${receiptUrl}

Thank you for choosing Montford Digital!

Best regards,
Scott Montford
Montford Digital
`;

  return {
    subject,
    html: wrapHtmlTemplate({ title: subject, preheader, contentHtml }),
    text,
  };
}

/** Helper to generate realistic sample email templates for testing and previews */
export function getSampleEmailTemplate(
  type: EmailTemplateType = 'invoice-ready',
  origin?: string
): {
  id: EmailTemplateType;
  name: string;
  trigger: string;
  subject: string;
  html: string;
  text: string;
  description: string;
} {
  const baseOrigin = origin || getAppBaseUrl();

  if (type === 'portal-invite') {
    const rendered = renderPortalInviteEmail({
      clientName: 'Alex Morgan',
      portalUrl: `${baseOrigin}/#/portal/sample-demo-token`,
    });
    return {
      id: 'portal-invite',
      name: 'Client Portal Setup Invitation',
      trigger: 'Manual 1-click trigger from Clients dashboard (for clients who have not yet set a password)',
      description: 'Features the Montford "M" branding and highlights key portal capabilities: manage invoices, upload project files, check project progress, review quotes & proposals, with an "Activate Portal & Set Password" button.',
      ...rendered,
    };
  }

  if (type === 'invoice-paid') {
    const rendered = renderInvoicePaidEmail({
      clientName: 'Alex Morgan',
      invoiceNumber: 'MD-2026-0042',
      projectName: 'Full Website Redesign & Brand Identity',
      amount: 1850.0,
      paidDate: new Date().toISOString(),
      receiptUrl: `${baseOrigin}/#/invoice/demo-sample-id?receipt=true`,
      lineItems: [
        { description: 'Phase 1: Brand Strategy & UI/UX Design System', quantity: 1, unit_price: 950.0 },
        { description: 'Phase 2: Custom Web Application Development', quantity: 1, unit_price: 900.0 },
      ],
    });
    return {
      id: 'invoice-paid',
      name: 'Invoice Paid (Receipt)',
      trigger: 'Auto-sends when invoice is paid via Stripe or marked "Paid"',
      description: 'Official confirmation receipt with "PAID IN FULL" status badge, amount paid, payment date, itemised items, and a direct link to the live digital receipt.',
      ...rendered,
    };
  }

  // Default: invoice-ready
  const rendered = renderInvoiceReadyEmail({
    clientName: 'Alex Morgan',
    invoiceNumber: 'MD-2026-0042',
    projectName: 'Full Website Redesign & Brand Identity',
    amount: 1850.0,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    issueDate: new Date().toISOString(),
    invoiceUrl: `${baseOrigin}/#/invoice/demo-sample-id`,
    lineItems: [
      { description: 'Phase 1: Brand Strategy & UI/UX Design System', quantity: 1, unit_price: 950.0 },
      { description: 'Phase 2: Custom Web Application Development', quantity: 1, unit_price: 900.0 },
    ],
  });
  return {
    id: 'invoice-ready',
    name: 'Invoice Ready to Pay',
    trigger: 'Auto-sends when invoice is marked "Sent"',
    description: 'Clean branded email with invoice number, amount, due date, line items breakdown, bank transfer details, and a direct "View & Pay Invoice Online" button.',
    ...rendered,
  };
}
