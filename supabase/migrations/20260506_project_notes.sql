CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to project_notes" ON project_notes
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage project_notes" ON project_notes
  FOR ALL USING (auth.role() = 'authenticated');
