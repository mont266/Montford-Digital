-- Add password column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS password TEXT;
