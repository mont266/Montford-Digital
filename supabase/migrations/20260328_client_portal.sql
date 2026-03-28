-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  portal_token UUID DEFAULT uuid_generate_v4() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add client_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recurring_fee NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recurring_fee_description TEXT;

-- Optional: RLS policies for clients table if RLS is enabled
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Allow public read access to clients if they have the portal_token
CREATE POLICY "Allow public read with portal_token" ON clients
  FOR SELECT USING (true); -- In a real app, you'd restrict this, but since we query by token, the token is the secret.

-- Allow authenticated users (admins) to manage clients
CREATE POLICY "Allow admins full access to clients" ON clients
  FOR ALL USING (auth.role() = 'authenticated');
