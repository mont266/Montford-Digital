-- Add subscription details to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stripe_subscription_amount NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stripe_subscription_interval TEXT;
