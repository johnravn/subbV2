-- Add archived column to jobs table
-- Allows jobs to be archived when status is "paid", hiding them from default view
-- Only the project lead can archive a job

-- Add archived column (default false to keep existing jobs visible)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Add index for efficient filtering of archived jobs
CREATE INDEX IF NOT EXISTS idx_jobs_archived ON jobs(archived) WHERE archived = true;

-- Add comment
COMMENT ON COLUMN jobs.archived IS 'When true, job is archived and hidden from default view. Only project lead can archive jobs with status "paid".';

