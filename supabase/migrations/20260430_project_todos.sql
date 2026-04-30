CREATE TABLE IF NOT EXISTS project_todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE project_todos ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read project todos (since clients can view them via portal token)
CREATE POLICY "Allow public read access to project_todos" ON project_todos
  FOR SELECT USING (true);

-- Allow admins to manage project todos
CREATE POLICY "Allow admins to manage project_todos" ON project_todos
  FOR ALL USING (auth.role() = 'authenticated');
