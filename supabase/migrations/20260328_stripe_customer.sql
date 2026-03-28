-- Add stripe_customer_id to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
