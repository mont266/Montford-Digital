// Client-side transactional email service helper for Resend
import { getAppBaseUrl } from './urlHelper';

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  recipient?: string;
  messageId?: string;
  message?: string;
  error?: string;
  isHtmlResponse?: boolean;
}

export interface EmailStatusResult {
  isConfigured: boolean;
  fromEmail: string;
}

/**
 * Robust API caller that tries the standard /api route and falls back to
 * /.netlify/functions/api in case of static hosting rewrites.
 * Safely handles non-JSON / HTML responses (such as 404 pages) without crashing with "Unexpected token <".
 */
async function callEmailApi(subPath: string, options: RequestInit = {}): Promise<any> {
  const normalizedSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
  const endpoints = [
    `/api/emails${normalizedSubPath}`,
    `/.netlify/functions/api/emails${normalizedSubPath}`,
    `/.netlify/functions/api${normalizedSubPath}`,
  ];

  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, options);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('application/json')) {
        const data = await res.json();
        return data;
      }

      // If response is HTML (such as Netlify 404 or index.html SPA fallback)
      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html') || res.status === 404) {
        lastError = new Error(
          `The server returned an HTML page (${res.status} ${res.statusText}) instead of a JSON response. The serverless function endpoint (${url}) is not currently responding.`
        );
        continue;
      }

      // Attempt parsing raw text in case content-type header was omitted
      try {
        return JSON.parse(text);
      } catch {
        lastError = new Error(`Received unexpected non-JSON response from ${url} (${res.status})`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Unable to connect to email API endpoints.');
}

/** Check if Resend is configured on the backend */
export async function checkEmailStatus(): Promise<EmailStatusResult> {
  try {
    const data = await callEmailApi('/status');
    return data;
  } catch (e) {
    return { isConfigured: false, fromEmail: 'Montford Digital <scott@hello.montforddigital.com>' };
  }
}

/**
 * Send a sample test email to verify Resend setup
 */
export async function sendTestEmail(
  type: 'portal-invite' | 'invoice-ready' | 'invoice-paid',
  recipientEmail: string
): Promise<EmailSendResult> {
  try {
    const data = await callEmailApi('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, recipientEmail }),
    });
    return data;
  } catch (err: any) {
    console.error('Failed to trigger test email:', err);
    return {
      success: false,
      error: err.message || 'Network error triggering test email',
    };
  }
}

/**
 * Trigger "Your client portal is ready" invitation email
 * ONLY available for clients who have NOT yet set a password / registered.
 */
export async function sendPortalInviteEmail(
  clientId: string,
  email?: string
): Promise<EmailSendResult> {
  try {
    const data = await callEmailApi('/portal-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        email,
        origin: getAppBaseUrl(),
      }),
    });
    return data;
  } catch (err: any) {
    console.error('Failed to trigger portal invite email:', err);
    return {
      success: false,
      error: err.message || 'Network error triggering invite email',
    };
  }
}

/**
 * Trigger "Invoice is ready to be paid" transactional email
 * Auto-sent when invoice is marked as "Sent" on the dashboard
 */
export async function sendInvoiceReadyEmail(invoiceId: string): Promise<EmailSendResult> {
  try {
    const data = await callEmailApi('/invoice-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        origin: getAppBaseUrl(),
      }),
    });
    return data;
  } catch (err: any) {
    console.error('Failed to trigger invoice-ready email:', err);
    return {
      success: false,
      error: err.message || 'Network error triggering invoice ready email',
    };
  }
}

/**
 * Trigger "Invoice paid" receipt transactional email
 * Auto-sent when invoice is marked or confirmed as paid
 */
export async function sendInvoicePaidEmail(invoiceId: string): Promise<EmailSendResult> {
  try {
    const data = await callEmailApi('/invoice-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        origin: getAppBaseUrl(),
      }),
    });
    return data;
  } catch (err: any) {
    console.error('Failed to trigger invoice-paid email:', err);
    return {
      success: false,
      error: err.message || 'Network error triggering invoice paid email',
    };
  }
}
