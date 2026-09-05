-- Add Trello integration columns to projects and project_todos

ALTER TABLE projects ADD COLUMN IF NOT EXISTS trello_label_id TEXT;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS trello_card_id TEXT;
