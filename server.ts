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
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.metadata?.invoiceId) {
          await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', paymentIntent.metadata.invoiceId);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const projectId = subscription.metadata.projectId;
          
          if (projectId) {
            // Update project subscription status
            await supabase
              .from('projects')
              .update({ 
                stripe_subscription_id: subscription.id,
                stripe_subscription_status: 'active'
              })
              .eq('id', projectId);

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
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { invoiceId, amount, invoiceNumber, clientName } = req.body;
    const stripe = getStripe();

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parsedAmount * 100),
      currency: 'gbp',
      description: `Payment for Invoice ${invoiceNumber || ''} - ${clientName || 'Client'}`,
      metadata: {
        invoiceId: String(invoiceId || ''),
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/create-subscription', async (req, res) => {
  try {
    const { projectId, projectName, amount, interval, clientEmail, clientName } = req.body;
    const stripe = getStripe();

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid subscription amount' });
    }

    let customer;
    if (clientEmail) {
      const customers = await stripe.customers.list({ email: clientEmail, limit: 1 });
      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({ email: clientEmail, name: clientName });
      }
    } else {
      customer = await stripe.customers.create({ name: clientName || 'Client' });
    }

    const product = await stripe.products.create({
      name: `Subscription: ${projectName || 'Project'}`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(parsedAmount * 100),
      currency: 'gbp',
      recurring: { interval: interval || 'month' },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        projectId: String(projectId || ''),
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    res.json({ 
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret 
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
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
