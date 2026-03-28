-- Add stripe_subscription_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;
