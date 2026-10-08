// Client-side transactional email service helper for Resend

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  recipient?: string;
  messageId?: string;
  message?: string;
  error?: string;
}

export interface EmailStatusResult {
  isConfigured: boolean;
  fromEmail: string;
}

/** Check if Resend is configured on the backend */
export async function checkEmailStatus(): Promise<EmailStatusResult> {
  try {
    const res = await fetch('/api/emails/status');
    if (!res.ok) throw new Error('Status endpoint returned error');
    return await res.json();
  } catch (e) {
    return { isConfigured: false, fromEmail: 'Montford Digital <onboarding@resend.dev>' };
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
    const res = await fetch('/api/emails/portal-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        email,
        origin: window.location.origin,
      }),
    });

    const data = await res.json();
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
    const res = await fetch('/api/emails/invoice-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        origin: window.location.origin,
      }),
    });

    const data = await res.json();
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
    const res = await fetch('/api/emails/invoice-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        origin: window.location.origin,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Failed to trigger invoice-paid email:', err);
    return {
      success: false,
      error: err.message || 'Network error triggering invoice paid email',
    };
  }
}
