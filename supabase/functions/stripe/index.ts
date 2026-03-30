import Stripe from 'npm:stripe@^14.14.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function serve(req: Request) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const method = req.method;
    
    // For GET requests, read action from query param. For POST, read from body or query param.
    let action = url.searchParams.get('action');
    let body: any = {};
    let rawBody = '';
    
    if (method === 'POST') {
      rawBody = await req.text();
      try {
        body = JSON.parse(rawBody);
        if (!action && body.action) {
          action = body.action;
        }
      } catch (e) {
        // Might be webhook raw body
        body = rawBody;
      }
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Webhook handler
    if (action === 'webhook' && req.method === 'POST') {
      const signature = req.headers.get('stripe-signature');
      const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
      
      if (!signature || !webhookSecret) {
        return new Response('Missing signature or secret', { status: 400, headers: corsHeaders });
      }

      let event;

      try {
        // Use the raw text body we read earlier
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
      }

      // Handle the event
      console.log(`Processing event: ${event.type}`);
      try {
        switch (event.type) {
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log(`Payment intent succeeded: ${paymentIntent.id}`);
            
            if (paymentIntent.metadata?.invoiceId) {
              const { error } = await supabase
                .from('invoices')
                .update({ status: 'paid' })
                .eq('id', paymentIntent.metadata.invoiceId);
              if (error) console.error('Error updating invoice status:', error);
            }
            
            // If it's a subscription payment intent, it might have projectId
            if (paymentIntent.metadata?.projectId) {
              const { error } = await supabase
                .from('projects')
                .update({ stripe_subscription_status: 'active' })
                .eq('id', paymentIntent.metadata.projectId);
              if (error) console.error('Error updating project status from payment intent:', error);
            }
            break;
          }
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log(`Invoice payment succeeded: ${invoice.id}, subscription: ${invoice.subscription}`);
            
            if (invoice.subscription) {
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
              const projectId = subscription.metadata.projectId;
              console.log(`Subscription retrieved: ${subscription.id}, projectId: ${projectId}`);
              
              if (projectId) {
                const { error: projError } = await supabase
                  .from('projects')
                  .update({ 
                    stripe_subscription_id: subscription.id,
                    stripe_subscription_status: 'active'
                  })
                  .eq('id', projectId);
                
                if (projError) console.error('Error updating project status:', projError);

                const { data: project, error: fetchError } = await supabase
                  .from('projects')
                  .select('client_id, entity_id, name')
                  .eq('id', projectId)
                  .single();

                if (fetchError) console.error('Error fetching project:', fetchError);

                if (project) {
                  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
                  console.log(`Creating invoice ${invoiceNumber} for project ${projectId}`);
                  
                  const { data: newInvoice, error: invError } = await supabase.from('invoices').insert({
                    project_id: projectId,
                    entity_id: project.entity_id,
                    invoice_number: invoiceNumber,
                    issue_date: new Date(invoice.created * 1000).toISOString(),
                    due_date: new Date(invoice.created * 1000).toISOString(),
                    amount: invoice.amount_paid / 100,
                    status: 'paid',
                  }).select().single();

                  if (invError) {
                    console.error('Error creating invoice:', invError);
                  } else if (newInvoice) {
                    const { error: itemError } = await supabase.from('invoice_items').insert({
                      invoice_id: newInvoice.id,
                      description: `Subscription payment for ${project.name}`,
                      quantity: 1,
                      unit_price: invoice.amount_paid / 100
                    });
                    if (itemError) console.error('Error creating invoice item:', itemError);
                  }
                }
              }
            }
            break;
          }
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`Checkout session completed: ${session.id}, mode: ${session.mode}`);
            
            if (session.mode === 'payment' && session.metadata?.invoiceId) {
              await supabase
                .from('invoices')
                .update({ status: 'paid' })
                .eq('id', session.metadata.invoiceId);
            } else if (session.mode === 'subscription' && session.metadata?.projectId) {
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
            console.log(`Subscription ${event.type}: ${subscription.id}, projectId: ${projectId}, status: ${subscription.status}`);
            
            if (projectId) {
              await supabase
                .from('projects')
                .update({ stripe_subscription_status: subscription.status })
                .eq('id', projectId);
            }
            break;
          }
        }
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        console.error('Error processing webhook:', err);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
      }
    }

    // JSON Endpoints
    if (req.method === 'POST') {
      if (action === 'create-payment-intent') {
        const { invoiceId, amount, invoiceNumber, clientName } = body;
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
        
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(parsedAmount * 100),
          currency: 'gbp',
          description: `Payment for Invoice ${invoiceNumber || ''} - ${clientName || 'Client'}`,
          metadata: { invoiceId: String(invoiceId || '') },
          automatic_payment_methods: { enabled: true },
        });

        return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'create-subscription') {
        const { projectId, projectName, amount, interval, clientEmail, clientName } = body;
        let parsedAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
        
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return new Response(JSON.stringify({ error: 'Invalid subscription amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // If interval is yearly, multiply the monthly amount by 12
        if (interval === 'year') {
          parsedAmount = parsedAmount * 12;
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
          metadata: { projectId: String(projectId || '') },
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

        // Update payment intent metadata to include projectId for easier webhook handling
        if (paymentIntent) {
          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: { projectId: String(projectId || '') }
          });
        }

        return new Response(JSON.stringify({ 
          subscriptionId: subscription.id,
          clientSecret: paymentIntent?.client_secret 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'cancel-subscription') {
        const { subscriptionId } = body;
        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        return new Response(JSON.stringify({ success: true, status: subscription.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'sync-subscription') {
        const { subscriptionId, projectId } = body;
        if (!subscriptionId || !projectId) {
          return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log(`Syncing subscription ${subscriptionId} for project ${projectId}. Status: ${subscription.status}`);

        // Update project status
        const { error: projError } = await supabase
          .from('projects')
          .update({ stripe_subscription_status: subscription.status })
          .eq('id', projectId);
        
        if (projError) console.error('Error syncing project status:', projError);

        // If active, check for invoices
        if (subscription.status === 'active') {
          const { data: project } = await supabase
            .from('projects')
            .select('client_id, entity_id, name')
            .eq('id', projectId)
            .single();

          if (project) {
            // Check if we already have an invoice for this subscription's latest invoice
            const latestInvoiceId = subscription.latest_invoice as string;
            if (latestInvoiceId) {
              const stripeInvoice = await stripe.invoices.retrieve(latestInvoiceId);
              if (stripeInvoice.status === 'paid') {
                // Check if we already have an invoice with this amount and date for this project
                const { data: existingInvoices } = await supabase
                  .from('invoices')
                  .select('id')
                  .eq('project_id', projectId)
                  .eq('status', 'paid')
                  .gte('issue_date', new Date(stripeInvoice.created * 1000 - 86400000).toISOString()) // Within 1 day
                  .lte('issue_date', new Date(stripeInvoice.created * 1000 + 86400000).toISOString());

                if (!existingInvoices || existingInvoices.length === 0) {
                  console.log(`No existing invoice found for subscription ${subscriptionId}. Creating one.`);
                  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
                  const { data: newInvoice, error: invError } = await supabase.from('invoices').insert({
                    project_id: projectId,
                    entity_id: project.entity_id,
                    invoice_number: invoiceNumber,
                    issue_date: new Date(stripeInvoice.created * 1000).toISOString(),
                    due_date: new Date(stripeInvoice.created * 1000).toISOString(),
                    amount: stripeInvoice.amount_paid / 100,
                    status: 'paid',
                  }).select().single();

                  if (newInvoice && !invError) {
                    await supabase.from('invoice_items').insert({
                      invoice_id: newInvoice.id,
                      description: `Subscription payment for ${project.name}`,
                      quantity: 1,
                      unit_price: stripeInvoice.amount_paid / 100
                    });
                  }
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, status: subscription.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'create-portal-session') {
        const { clientEmail, returnUrl } = body;
        if (!clientEmail) {
          return new Response(JSON.stringify({ error: 'Missing client email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const customers = await stripe.customers.list({ email: clientEmail, limit: 1 });
        if (customers.data.length === 0) {
          return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: customers.data[0].id,
          return_url: returnUrl || url.origin,
        });

        return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (req.method === 'GET' && action === 'subscription') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing subscription ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const subscription = await stripe.subscriptions.retrieve(id);
      return new Response(JSON.stringify({
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        amount: subscription.items.data[0]?.price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
        interval: subscription.items.data[0]?.price.recurring?.interval,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(serve);
