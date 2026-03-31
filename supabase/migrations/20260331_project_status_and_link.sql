-- Add status and preview_url to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In development';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT;
