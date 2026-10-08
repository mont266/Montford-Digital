import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import {
  renderPortalInviteEmail,
  renderInvoiceReadyEmail,
  renderInvoicePaidEmail,
} from './emailTemplates';

const router = Router();

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  return createClient(supabaseUrl, supabaseKey);
};

const isDevelopmentHost = (host: string): boolean => {
  if (!host) return true;
  const h = host.toLowerCase();
  return (
    h.includes('localhost') ||
    h.includes('127.0.0.1') ||
    h.includes('.run.app') ||
    h.includes('ais-dev-') ||
    h.endsWith('.cloudworkstations.dev') ||
    h.endsWith('.googleusercontent.com') ||
    h.includes('webcontainer') ||
    h.includes('github.dev')
  );
};

const getAppOrigin = (req: Request): string => {
  // Check explicit environment variables, ignoring AI Studio dev URLs
  const candidateUrls = [
    process.env.PRODUCTION_APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VITE_APP_URL,
    process.env.APP_URL,
  ];

  for (const raw of candidateUrls) {
    const val = raw?.trim();
    if (val) {
      try {
        const parsed = new URL(val);
        if (!isDevelopmentHost(parsed.hostname)) {
          return val.replace(/\/+$/, '');
        }
      } catch {
        if (!isDevelopmentHost(val)) {
          return val.replace(/\/+$/, '');
        }
      }
    }
  }

  // Check if client passed an explicit origin that is a live production domain
  if (req.body?.origin && typeof req.body.origin === 'string') {
    const rawOrigin = req.body.origin.trim().replace(/\/+$/, '');
    try {
      const parsed = new URL(rawOrigin);
      if (!isDevelopmentHost(parsed.hostname)) {
        return rawOrigin;
      }
    } catch {
      // ignore invalid URL string
    }
  }

  // Check request host header if running on live production server
  const host = ((req.headers['x-forwarded-host'] as string) || req.get('host') || '').toLowerCase();
  if (!isDevelopmentHost(host)) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  // Canonical live webapp URL
  return 'https://montforddigital.com';
};

const getFromEmail = (): string => {
  const envFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (!envFrom) {
    return 'Montford Digital <onboarding@resend.dev>';
  }
  // If envFrom does not contain '@', it is not a valid email address (e.g. someone entered a domain name by mistake)
  if (!envFrom.includes('@')) {
    console.warn(`[Resend Warning] RESEND_FROM_EMAIL ("${envFrom}") is missing an '@' symbol. Falling back to "Montford Digital <onboarding@resend.dev>"`);
    return 'Montford Digital <onboarding@resend.dev>';
  }
  // If it's a bare email without a display name
  if (!envFrom.includes('<') && !envFrom.includes('>')) {
    return `Montford Digital <${envFrom}>`;
  }
  return envFrom;
};

/** GET /api/emails/status - Check whether Resend is configured */
router.get('/status', (req: Request, res: Response) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  res.json({
    isConfigured: Boolean(apiKey && apiKey.length > 5),
    fromEmail: getFromEmail(),
  });
});

/** GET /api/emails/preview - In-browser preview of HTML email templates */
router.get('/preview', (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'invoice-ready';
  const origin = getAppOrigin(req);

  if (type === 'portal-invite') {
    const { html } = renderPortalInviteEmail({
      clientName: 'Alex Morgan',
      portalUrl: `${origin}/#/portal/sample-demo-token`,
    });
    return res.setHeader('Content-Type', 'text/html').send(html);
  }

  if (type === 'invoice-paid') {
    const { html } = renderInvoicePaidEmail({
      clientName: 'Alex Morgan',
      invoiceNumber: 'MD-2026-0042',
      projectName: 'Full Website Redesign & Brand Identity',
      amount: 1850.00,
      paidDate: new Date().toISOString(),
      receiptUrl: `${origin}/#/invoice/demo-sample-id?receipt=true`,
      lineItems: [
        { description: 'Phase 1: Brand Strategy & UI/UX Design System', quantity: 1, unit_price: 950.00 },
        { description: 'Phase 2: Custom Web Application Development', quantity: 1, unit_price: 900.00 },
      ],
    });
    return res.setHeader('Content-Type', 'text/html').send(html);
  }

  // Default: invoice-ready
  const { html } = renderInvoiceReadyEmail({
    clientName: 'Alex Morgan',
    invoiceNumber: 'MD-2026-0042',
    projectName: 'Full Website Redesign & Brand Identity',
    amount: 1850.00,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    issueDate: new Date().toISOString(),
    invoiceUrl: `${origin}/#/invoice/demo-sample-id`,
    lineItems: [
      { description: 'Phase 1: Brand Strategy & UI/UX Design System', quantity: 1, unit_price: 950.00 },
      { description: 'Phase 2: Custom Web Application Development', quantity: 1, unit_price: 900.00 },
    ],
  });
  return res.setHeader('Content-Type', 'text/html').send(html);
});

/** POST /api/emails/test - Send a sample test email to verify Resend setup */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { type = 'invoice-ready', recipientEmail = 'scottmontford@gmail.com' } = req.body;
    const origin = getAppOrigin(req);

    let rendered: { subject: string; html: string; text: string };
    if (type === 'portal-invite') {
      rendered = renderPortalInviteEmail({
        clientName: 'Scott Montford (Test)',
        portalUrl: `${origin}/#/portal/sample-demo-token`,
      });
    } else if (type === 'invoice-paid') {
      rendered = renderInvoicePaidEmail({
        clientName: 'Scott Montford (Test)',
        invoiceNumber: 'MD-TEST-001',
        projectName: 'Test Web App Project',
        amount: 500.00,
        paidDate: new Date().toISOString(),
        receiptUrl: `${origin}/#/invoice/test-demo?receipt=true`,
        lineItems: [
          { description: 'Test Line Item: Initial Milestone', quantity: 1, unit_price: 500.00 },
        ],
      });
    } else {
      rendered = renderInvoiceReadyEmail({
        clientName: 'Scott Montford (Test)',
        invoiceNumber: 'MD-TEST-001',
        projectName: 'Test Web App Project',
        amount: 500.00,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        issueDate: new Date().toISOString(),
        invoiceUrl: `${origin}/#/invoice/test-demo`,
        lineItems: [
          { description: 'Test Line Item: Initial Milestone', quantity: 1, unit_price: 500.00 },
        ],
      });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return res.json({
        success: true,
        simulated: true,
        recipient: recipientEmail,
        type,
        message: 'Resend API key is not yet set in environment variables. Simulated test email successfully generated.',
      });
    }

    const resend = new Resend(apiKey);
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: [recipientEmail],
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    if (sendError) {
      return res.status(500).json({ success: false, error: sendError.message });
    }

    return res.json({
      success: true,
      simulated: false,
      recipient: recipientEmail,
      type,
      messageId: sendResult?.id,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/** POST /api/emails/portal-invite - Send client portal setup invitation */
router.post('/portal-invite', async (req: Request, res: Response) => {
  try {
    const { clientId, email: overrideEmail } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId is required' });
    }

    const supabase = getSupabaseAdmin();
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, email, portal_token, password')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return res.status(404).json({ success: false, error: 'Client not found in database.' });
    }

    // STRICT CHECK: Portal invite may ONLY be triggered for clients who have not yet set a password / signed up
    const hasPassword = Boolean(client.password && client.password.trim() !== '');
    if (hasPassword) {
      return res.status(400).json({
        success: false,
        error: `${client.name} has already configured a password and registered for their client portal.`,
      });
    }

    const recipientEmail = overrideEmail || client.email;
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: `Client ${client.name} does not have a valid email address. Please update their profile first.`,
      });
    }

    const origin = getAppOrigin(req);
    const portalUrl = `${origin}/#/portal/${client.portal_token}`;

    const { subject, html, text } = renderPortalInviteEmail({
      clientName: client.name,
      portalUrl,
    });

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.log(`[Resend Notice] RESEND_API_KEY not configured. Simulated invite email to ${recipientEmail}`);
      console.log(`[Resend Notice] Portal URL: ${portalUrl}`);
      return res.json({
        success: true,
        simulated: true,
        recipient: recipientEmail,
        message: 'Resend API key is not configured in environment variables yet. The email invitation has been simulated.',
        portalUrl,
      });
    }

    const resend = new Resend(apiKey);
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: [recipientEmail],
      subject,
      html,
      text,
    });

    if (sendError) {
      console.error('[Resend Error] Failed to send portal invite:', sendError);
      return res.status(500).json({ success: false, error: sendError.message });
    }

    console.log(`[Resend Success] Portal invite sent to ${recipientEmail}:`, sendResult);
    return res.json({
      success: true,
      simulated: false,
      recipient: recipientEmail,
      messageId: sendResult?.id,
    });
  } catch (err: any) {
    console.error('[Resend Exception] portal-invite:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/** POST /api/emails/invoice-ready - Trigger "Invoice is ready to be paid" */
router.post('/invoice-ready', async (req: Request, res: Response) => {
  try {
    const { invoiceId, email: overrideEmail } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'invoiceId is required' });
    }

    const supabase = getSupabaseAdmin();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, projects (*, clients (*)), invoice_items (*)')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const clientName =
      invoice.projects?.clients?.name ||
      invoice.projects?.client_name ||
      'Valued Client';

    const recipientEmail =
      overrideEmail ||
      invoice.projects?.clients?.email ||
      invoice.projects?.client_email;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: `Could not find an email address for client "${clientName}". Please set a client email in their record.`,
      });
    }

    const origin = getAppOrigin(req);
    const invoiceUrl = `${origin}/#/invoice/${invoice.id}`;

    const { subject, html, text } = renderInvoiceReadyEmail({
      clientName,
      invoiceNumber: invoice.invoice_number,
      projectName: invoice.projects?.name || '',
      amount: Number(invoice.amount) || 0,
      dueDate: invoice.due_date,
      issueDate: invoice.issue_date,
      invoiceUrl,
      lineItems: invoice.invoice_items || [],
    });

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.log(`[Resend Notice] RESEND_API_KEY not configured. Simulated invoice-ready email for #${invoice.invoice_number} to ${recipientEmail}`);
      return res.json({
        success: true,
        simulated: true,
        recipient: recipientEmail,
        message: 'Resend API key is not configured in environment variables yet. The invoice ready email has been simulated.',
        invoiceUrl,
      });
    }

    const resend = new Resend(apiKey);
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: [recipientEmail],
      subject,
      html,
      text,
    });

    if (sendError) {
      console.error('[Resend Error] Failed to send invoice-ready email:', sendError);
      return res.status(500).json({ success: false, error: sendError.message });
    }

    console.log(`[Resend Success] Invoice ready email #${invoice.invoice_number} sent to ${recipientEmail}:`, sendResult);
    return res.json({
      success: true,
      simulated: false,
      recipient: recipientEmail,
      messageId: sendResult?.id,
    });
  } catch (err: any) {
    console.error('[Resend Exception] invoice-ready:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/** POST /api/emails/invoice-paid - Trigger "Invoice paid" payment receipt */
router.post('/invoice-paid', async (req: Request, res: Response) => {
  try {
    const { invoiceId, email: overrideEmail } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'invoiceId is required' });
    }

    const supabase = getSupabaseAdmin();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, projects (*, clients (*)), invoice_items (*)')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const clientName =
      invoice.projects?.clients?.name ||
      invoice.projects?.client_name ||
      'Valued Client';

    const recipientEmail =
      overrideEmail ||
      invoice.projects?.clients?.email ||
      invoice.projects?.client_email;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: `Could not find an email address for client "${clientName}".`,
      });
    }

    const origin = getAppOrigin(req);
    const receiptUrl = `${origin}/#/invoice/${invoice.id}?receipt=true`;

    const { subject, html, text } = renderInvoicePaidEmail({
      clientName,
      invoiceNumber: invoice.invoice_number,
      projectName: invoice.projects?.name || '',
      amount: Number(invoice.amount) || 0,
      paidDate: new Date().toISOString(),
      receiptUrl,
      lineItems: invoice.invoice_items || [],
    });

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.log(`[Resend Notice] RESEND_API_KEY not configured. Simulated invoice-paid receipt email for #${invoice.invoice_number} to ${recipientEmail}`);
      return res.json({
        success: true,
        simulated: true,
        recipient: recipientEmail,
        message: 'Resend API key is not configured in environment variables yet. The paid invoice receipt has been simulated.',
        receiptUrl,
      });
    }

    const resend = new Resend(apiKey);
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: [recipientEmail],
      subject,
      html,
      text,
    });

    if (sendError) {
      console.error('[Resend Error] Failed to send invoice-paid receipt:', sendError);
      return res.status(500).json({ success: false, error: sendError.message });
    }

    console.log(`[Resend Success] Invoice paid receipt #${invoice.invoice_number} sent to ${recipientEmail}:`, sendResult);
    return res.json({
      success: true,
      simulated: false,
      recipient: recipientEmail,
      messageId: sendResult?.id,
    });
  } catch (err: any) {
    console.error('[Resend Exception] invoice-paid:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
