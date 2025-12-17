-- Add customer_user_id column to jobs table
-- This allows setting a user from the company as the customer for a job

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN jobs.customer_user_id IS 'Optional reference to a user in the company who is the customer for this job';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_customer_user_id ON jobs(customer_user_id);

