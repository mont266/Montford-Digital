import express from 'express';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());

// Webhook endpoint needs raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(400).send('Webhook Error: Missing secret');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // If this invoice is from a subscription, we might want to record it in our database
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const projectId = subscription.metadata.projectId;
          
          if (projectId) {
            // Create an invoice record in Supabase
            const { data: project } = await supabase
              .from('projects')
              .select('client_id')
              .eq('id', projectId)
              .single();

            if (project) {
              const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
              await supabase.from('invoices').insert({
                project_id: projectId,
                client_id: project.client_id,
                invoice_number: invoiceNumber,
                issue_date: new Date(invoice.created * 1000).toISOString(),
                due_date: new Date(invoice.created * 1000).toISOString(),
                amount: invoice.amount_paid / 100,
                status: 'paid',
              });
            }
          }
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'payment' && session.metadata?.invoiceId) {
          // Update invoice status to paid
          await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', session.metadata.invoiceId);
        } else if (session.mode === 'subscription' && session.metadata?.projectId) {
          // Save subscription ID to project
          await supabase
            .from('projects')
            .update({ 
              stripe_subscription_id: session.subscription as string,
              stripe_subscription_status: 'active'
            })
            .eq('id', session.metadata.projectId);
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const projectId = subscription.metadata.projectId;
        if (projectId) {
          await supabase
            .from('projects')
            .update({ stripe_subscription_status: subscription.status })
            .eq('id', projectId);
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.use(express.json());

// Lazy initialize Stripe
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    // @ts-ignore
    stripeClient = new Stripe(key, { apiVersion: '2023-10-16' });
  }
  return stripeClient;
}

// API Routes
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { invoiceId, amount, invoiceNumber, clientName, origin } = req.body;
    const stripe = getStripe();

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Invoice ${invoiceNumber || 'Payment'}`,
              description: `Payment for ${clientName || 'Client'}`,
            },
            unit_amount: Math.round(parsedAmount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/#/invoice/${invoiceId}?success=true`,
      cancel_url: `${origin}/#/invoice/${invoiceId}?canceled=true`,
      metadata: {
        invoiceId: String(invoiceId || ''),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/create-subscription-session', async (req, res) => {
  try {
    const { projectId, projectName, amount, interval, origin, token, clientEmail } = req.body;
    const stripe = getStripe();

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid subscription amount' });
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Subscription: ${projectName || 'Project'}`,
            },
            unit_amount: Math.round(parsedAmount * 100),
            recurring: {
              interval: (interval as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval) || 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/#/portal/${token}?success=true`,
      cancel_url: `${origin}/#/portal/${token}?canceled=true`,
      subscription_data: {
        metadata: {
          projectId: String(projectId || ''),
        },
      },
      metadata: {
        projectId: String(projectId || ''),
      },
    };

    if (clientEmail) {
      sessionConfig.customer_email = clientEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating subscription session:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/subscription/:id', async (req, res) => {
  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(req.params.id);
    
    res.json({
      id: subscription.id,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      amount: subscription.items.data[0]?.price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
      interval: subscription.items.data[0]?.price.recurring?.interval,
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const stripe = getStripe();

    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    
    res.json({ success: true, status: subscription.status });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
