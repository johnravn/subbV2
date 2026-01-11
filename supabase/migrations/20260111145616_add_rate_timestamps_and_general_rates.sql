-- Migration: Add rate timestamps and general rates
-- Created: 2025-01-11
-- 
-- This migration adds:
-- 1. rate_updated_at timestamp to company_users for tracking when individual rates were last updated
-- 2. General rate fields to companies table for employees and owners

-- Add rate_updated_at to company_users
ALTER TABLE company_users
ADD COLUMN IF NOT EXISTS rate_updated_at TIMESTAMPTZ;

-- Add general rate fields to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS employee_daily_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS employee_hourly_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS owner_daily_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS owner_hourly_rate NUMERIC(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN company_users.rate_updated_at IS 'Timestamp when the rate was last updated';
COMMENT ON COLUMN companies.employee_daily_rate IS 'General daily rate for employees';
COMMENT ON COLUMN companies.employee_hourly_rate IS 'General hourly rate for employees';
COMMENT ON COLUMN companies.owner_daily_rate IS 'General daily rate for owners';
COMMENT ON COLUMN companies.owner_hourly_rate IS 'General hourly rate for owners';

-- Update the company_user_profiles view to include rate_updated_at
DROP VIEW IF EXISTS company_user_profiles;

CREATE OR REPLACE VIEW company_user_profiles AS
SELECT 
  cu.company_id,
  cu.user_id,
  cu.role,
  cu.rate_type,
  cu.rate,
  cu.rate_updated_at,
  p.email,
  p.display_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.created_at
FROM company_users cu
JOIN profiles p ON p.user_id = cu.user_id;

-- Grant permissions on the view
ALTER VIEW company_user_profiles OWNER TO postgres;

