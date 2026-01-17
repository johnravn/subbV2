-- Migration: Add rate fields to company_users table
-- Created: 2025-01-11
-- 
-- This migration adds rate_type and rate columns to company_users table
-- to allow companies to set billing rates for freelancers and employees.
--
-- rate_type: 'daily' or 'hourly' - how the person invoices the company
-- rate: numeric - the rate amount

-- Add rate_type column (text with check constraint)
ALTER TABLE company_users
ADD COLUMN IF NOT EXISTS rate_type TEXT CHECK (rate_type IN ('daily', 'hourly'));

-- Add rate column (numeric, can be null)
ALTER TABLE company_users
ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN company_users.rate_type IS 'How the person invoices: daily or hourly';
COMMENT ON COLUMN company_users.rate IS 'The billing rate amount';

-- Update the company_user_profiles view to include rate fields
-- Note: rate_updated_at will be added in a later migration
DROP VIEW IF EXISTS company_user_profiles;

CREATE OR REPLACE VIEW company_user_profiles AS
SELECT 
  cu.company_id,
  cu.user_id,
  cu.role,
  cu.rate_type,
  cu.rate,
  p.email,
  p.display_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.created_at
FROM company_users cu
JOIN profiles p ON p.user_id = cu.user_id;

-- Grant permissions on the view (same as before)
ALTER VIEW company_user_profiles OWNER TO postgres;

