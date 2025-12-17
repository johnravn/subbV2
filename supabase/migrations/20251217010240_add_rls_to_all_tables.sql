-- Migration: Add RLS (Row Level Security) to all tables
-- Created: 2025-12-17
-- 
-- This migration enables RLS and adds policies for all tables that don't already have proper RLS.
-- Tables with existing RLS policies are not modified (they are already properly secured).
--
-- Policy patterns:
-- - Company-scoped data: Users can access data for companies they belong to via company_users
-- - Job-related data: Users can access via job -> company relationship
-- - Personal data: Users can access their own data
-- - Superusers: Can access all data

-- ============================================================================
-- COMPANIES
-- ============================================================================
-- Users can view companies they belong to
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON companies;

DROP POLICY IF EXISTS "Users can view companies they belong to" ON companies;
CREATE POLICY "Users can view companies they belong to"
  ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can insert companies" ON companies;
CREATE POLICY "Users can insert companies"
  ON companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can update their company" ON companies;
CREATE POLICY "Company owners can update their company"
  ON companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = companies.id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Superusers can delete companies" ON companies;
CREATE POLICY "Superusers can delete companies"
  ON companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- COMPANY_USERS
-- ============================================================================
-- Users can view company_users for companies they belong to
-- Note: To avoid infinite recursion, we use a SECURITY DEFINER function
-- that can check company_users without triggering RLS policies
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON company_users;

-- Create helper functions to check company membership without RLS recursion
CREATE OR REPLACE FUNCTION public.user_is_company_member(p_company_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE company_id = p_company_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_company_role(p_company_id uuid, p_user_id uuid, p_roles company_role[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE company_id = p_company_id 
      AND user_id = p_user_id
      AND role = ANY(p_roles)
  );
$$;

DROP POLICY IF EXISTS "Users can view company_users for their companies" ON company_users;
CREATE POLICY "Users can view company_users for their companies"
  ON company_users
  FOR SELECT
  USING (
    -- Users can always see their own company_users entries
    user_id = auth.uid()
    OR
    -- Users can see company_users for companies they belong to (using function to avoid recursion)
    public.user_is_company_member(company_id, auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can manage company_users" ON company_users;
CREATE POLICY "Company owners can manage company_users"
  ON company_users
  FOR INSERT
  WITH CHECK (
    -- Use function to check if user is owner/super_user of the company (avoids recursion)
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can update company_users" ON company_users;
CREATE POLICY "Company owners can update company_users"
  ON company_users
  FOR UPDATE
  USING (
    -- Use function to check if user is owner/super_user of the company (avoids recursion)
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can delete company_users" ON company_users;
CREATE POLICY "Company owners can delete company_users"
  ON company_users
  FOR DELETE
  USING (
    -- Use function to check if user is owner/super_user of the company (avoids recursion)
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- CONTACTS
-- ============================================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view contacts for their companies" ON contacts;
CREATE POLICY "Users can view contacts for their companies"
  ON contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = contacts.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create contacts for their companies" ON contacts;
CREATE POLICY "Users can create contacts for their companies"
  ON contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = contacts.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update contacts for their companies" ON contacts;
CREATE POLICY "Users can update contacts for their companies"
  ON contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = contacts.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = contacts.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete contacts for their companies" ON contacts;
CREATE POLICY "Users can delete contacts for their companies"
  ON contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = contacts.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view customers for their companies" ON customers;
CREATE POLICY "Users can view customers for their companies"
  ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = customers.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create customers for their companies" ON customers;
CREATE POLICY "Users can create customers for their companies"
  ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = customers.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update customers for their companies" ON customers;
CREATE POLICY "Users can update customers for their companies"
  ON customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = customers.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = customers.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete customers for their companies" ON customers;
CREATE POLICY "Users can delete customers for their companies"
  ON customers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = customers.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- JOBS
-- ============================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view jobs for their companies" ON jobs;
CREATE POLICY "Users can view jobs for their companies"
  ON jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = jobs.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create jobs for their companies" ON jobs;
CREATE POLICY "Users can create jobs for their companies"
  ON jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update jobs for their companies" ON jobs;
CREATE POLICY "Users can update jobs for their companies"
  ON jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete jobs for their companies" ON jobs;
CREATE POLICY "Users can delete jobs for their companies"
  ON jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- JOB_CONTACTS
-- ============================================================================
ALTER TABLE job_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_contacts for their company jobs" ON job_contacts;
CREATE POLICY "Users can view job_contacts for their company jobs"
  ON job_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_contacts.job_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create job_contacts for their company jobs" ON job_contacts;
CREATE POLICY "Users can create job_contacts for their company jobs"
  ON job_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_contacts.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update job_contacts for their company jobs" ON job_contacts;
CREATE POLICY "Users can update job_contacts for their company jobs"
  ON job_contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_contacts.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_contacts.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete job_contacts for their company jobs" ON job_contacts;
CREATE POLICY "Users can delete job_contacts for their company jobs"
  ON job_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_contacts.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- JOB_FILES
-- ============================================================================
ALTER TABLE job_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_files for their company jobs" ON job_files;
CREATE POLICY "Users can view job_files for their company jobs"
  ON job_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_files.job_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create job_files for their company jobs" ON job_files;
CREATE POLICY "Users can create job_files for their company jobs"
  ON job_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_files.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update job_files for their company jobs" ON job_files;
CREATE POLICY "Users can update job_files for their company jobs"
  ON job_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_files.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_files.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete job_files for their company jobs" ON job_files;
CREATE POLICY "Users can delete job_files for their company jobs"
  ON job_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_files.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- JOB_NOTES
-- ============================================================================
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_notes for their company jobs" ON job_notes;
CREATE POLICY "Users can view job_notes for their company jobs"
  ON job_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_notes.job_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create job_notes for their company jobs" ON job_notes;
CREATE POLICY "Users can create job_notes for their company jobs"
  ON job_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_notes.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update job_notes for their company jobs" ON job_notes;
CREATE POLICY "Users can update job_notes for their company jobs"
  ON job_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_notes.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_notes.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete job_notes for their company jobs" ON job_notes;
CREATE POLICY "Users can delete job_notes for their company jobs"
  ON job_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_notes.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- JOB_STATUS_HISTORY
-- ============================================================================
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_status_history for their company jobs" ON job_status_history;
CREATE POLICY "Users can view job_status_history for their company jobs"
  ON job_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_status_history.job_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create job_status_history for their company jobs" ON job_status_history;
CREATE POLICY "Users can create job_status_history for their company jobs"
  ON job_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_status_history.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update job_status_history for their company jobs" ON job_status_history;
CREATE POLICY "Users can update job_status_history for their company jobs"
  ON job_status_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_status_history.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_status_history.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete job_status_history for their company jobs" ON job_status_history;
CREATE POLICY "Users can delete job_status_history for their company jobs"
  ON job_status_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_status_history.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEMS
-- ============================================================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON items;

DROP POLICY IF EXISTS "Users can view items for their companies" ON items;
CREATE POLICY "Users can view items for their companies"
  ON items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = items.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create items for their companies" ON items;
CREATE POLICY "Users can create items for their companies"
  ON items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = items.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update items for their companies" ON items;
CREATE POLICY "Users can update items for their companies"
  ON items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = items.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = items.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete items for their companies" ON items;
CREATE POLICY "Users can delete items for their companies"
  ON items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = items.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEM_BRANDS
-- ============================================================================
ALTER TABLE item_brands ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON item_brands;

DROP POLICY IF EXISTS "Users can view item_brands for their companies" ON item_brands;
CREATE POLICY "Users can view item_brands for their companies"
  ON item_brands
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_brands.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create item_brands for their companies" ON item_brands;
CREATE POLICY "Users can create item_brands for their companies"
  ON item_brands
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_brands.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update item_brands for their companies" ON item_brands;
CREATE POLICY "Users can update item_brands for their companies"
  ON item_brands
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_brands.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_brands.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete item_brands for their companies" ON item_brands;
CREATE POLICY "Users can delete item_brands for their companies"
  ON item_brands
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_brands.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEM_CATEGORIES
-- ============================================================================
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON item_categories;

DROP POLICY IF EXISTS "Users can view item_categories for their companies" ON item_categories;
CREATE POLICY "Users can view item_categories for their companies"
  ON item_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_categories.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create item_categories for their companies" ON item_categories;
CREATE POLICY "Users can create item_categories for their companies"
  ON item_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_categories.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update item_categories for their companies" ON item_categories;
CREATE POLICY "Users can update item_categories for their companies"
  ON item_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_categories.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_categories.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete item_categories for their companies" ON item_categories;
CREATE POLICY "Users can delete item_categories for their companies"
  ON item_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_categories.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEM_GROUPS
-- ============================================================================
ALTER TABLE item_groups ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON item_groups;

DROP POLICY IF EXISTS "Users can view item_groups for their companies" ON item_groups;
CREATE POLICY "Users can view item_groups for their companies"
  ON item_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_groups.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create item_groups for their companies" ON item_groups;
CREATE POLICY "Users can create item_groups for their companies"
  ON item_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_groups.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update item_groups for their companies" ON item_groups;
CREATE POLICY "Users can update item_groups for their companies"
  ON item_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_groups.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_groups.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete item_groups for their companies" ON item_groups;
CREATE POLICY "Users can delete item_groups for their companies"
  ON item_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_groups.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEM_PRICE_HISTORY
-- ============================================================================
ALTER TABLE item_price_history ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON item_price_history;

DROP POLICY IF EXISTS "Users can view item_price_history for their companies" ON item_price_history;
CREATE POLICY "Users can view item_price_history for their companies"
  ON item_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_price_history.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create item_price_history for their companies" ON item_price_history;
CREATE POLICY "Users can create item_price_history for their companies"
  ON item_price_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update item_price_history for their companies" ON item_price_history;
CREATE POLICY "Users can update item_price_history for their companies"
  ON item_price_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete item_price_history for their companies" ON item_price_history;
CREATE POLICY "Users can delete item_price_history for their companies"
  ON item_price_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = item_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- ITEM_RELATED
-- ============================================================================
ALTER TABLE item_related ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON item_related;

DROP POLICY IF EXISTS "Users can view item_related for their company items" ON item_related;
CREATE POLICY "Users can view item_related for their company items"
  ON item_related
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      JOIN company_users ON company_users.company_id = items.company_id
      WHERE items.id = item_related.item_a_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create item_related for their company items" ON item_related;
CREATE POLICY "Users can create item_related for their company items"
  ON item_related
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      JOIN company_users ON company_users.company_id = items.company_id
      WHERE items.id = item_related.item_a_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update item_related for their company items" ON item_related;
CREATE POLICY "Users can update item_related for their company items"
  ON item_related
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM items
      JOIN company_users ON company_users.company_id = items.company_id
      WHERE items.id = item_related.item_a_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      JOIN company_users ON company_users.company_id = items.company_id
      WHERE items.id = item_related.item_a_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete item_related for their company items" ON item_related;
CREATE POLICY "Users can delete item_related for their company items"
  ON item_related
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM items
      JOIN company_users ON company_users.company_id = items.company_id
      WHERE items.id = item_related.item_a_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- GROUP_ITEMS
-- ============================================================================
ALTER TABLE group_items ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON group_items;

DROP POLICY IF EXISTS "Users can view group_items for their company groups" ON group_items;
CREATE POLICY "Users can view group_items for their company groups"
  ON group_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM item_groups
      JOIN company_users ON company_users.company_id = item_groups.company_id
      WHERE item_groups.id = group_items.group_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create group_items for their company groups" ON group_items;
CREATE POLICY "Users can create group_items for their company groups"
  ON group_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM item_groups
      JOIN company_users ON company_users.company_id = item_groups.company_id
      WHERE item_groups.id = group_items.group_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update group_items for their company groups" ON group_items;
CREATE POLICY "Users can update group_items for their company groups"
  ON group_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM item_groups
      JOIN company_users ON company_users.company_id = item_groups.company_id
      WHERE item_groups.id = group_items.group_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM item_groups
      JOIN company_users ON company_users.company_id = item_groups.company_id
      WHERE item_groups.id = group_items.group_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete group_items for their company groups" ON group_items;
CREATE POLICY "Users can delete group_items for their company groups"
  ON group_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM item_groups
      JOIN company_users ON company_users.company_id = item_groups.company_id
      WHERE item_groups.id = group_items.group_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- GROUP_PRICE_HISTORY
-- ============================================================================
ALTER TABLE group_price_history ENABLE ROW LEVEL SECURITY;

-- Drop any existing dev policies
DROP POLICY IF EXISTS "dev_allow_all" ON group_price_history;

DROP POLICY IF EXISTS "Users can view group_price_history for their companies" ON group_price_history;
CREATE POLICY "Users can view group_price_history for their companies"
  ON group_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = group_price_history.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create group_price_history for their companies" ON group_price_history;
CREATE POLICY "Users can create group_price_history for their companies"
  ON group_price_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = group_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update group_price_history for their companies" ON group_price_history;
CREATE POLICY "Users can update group_price_history for their companies"
  ON group_price_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = group_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = group_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete group_price_history for their companies" ON group_price_history;
CREATE POLICY "Users can delete group_price_history for their companies"
  ON group_price_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = group_price_history.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- VEHICLES
-- ============================================================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view vehicles for their companies" ON vehicles;
CREATE POLICY "Users can view vehicles for their companies"
  ON vehicles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = vehicles.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create vehicles for their companies" ON vehicles;
CREATE POLICY "Users can create vehicles for their companies"
  ON vehicles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = vehicles.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update vehicles for their companies" ON vehicles;
CREATE POLICY "Users can update vehicles for their companies"
  ON vehicles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = vehicles.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = vehicles.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete vehicles for their companies" ON vehicles;
CREATE POLICY "Users can delete vehicles for their companies"
  ON vehicles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = vehicles.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- TIME_PERIODS
-- ============================================================================
ALTER TABLE time_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view time_periods for their companies" ON time_periods;
CREATE POLICY "Users can view time_periods for their companies"
  ON time_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create time_periods for their companies" ON time_periods;
CREATE POLICY "Users can create time_periods for their companies"
  ON time_periods
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update time_periods for their companies" ON time_periods;
CREATE POLICY "Users can update time_periods for their companies"
  ON time_periods
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete time_periods for their companies" ON time_periods;
CREATE POLICY "Users can delete time_periods for their companies"
  ON time_periods
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- RESERVED_CREW
-- ============================================================================
ALTER TABLE reserved_crew ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reserved_crew for their company time_periods" ON reserved_crew;
CREATE POLICY "Users can view reserved_crew for their company time_periods"
  ON reserved_crew
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create reserved_crew for their company time_periods" ON reserved_crew;
CREATE POLICY "Users can create reserved_crew for their company time_periods"
  ON reserved_crew
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update reserved_crew for their company time_periods" ON reserved_crew;
CREATE POLICY "Users can update reserved_crew for their company time_periods"
  ON reserved_crew
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete reserved_crew for their company time_periods" ON reserved_crew;
CREATE POLICY "Users can delete reserved_crew for their company time_periods"
  ON reserved_crew
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- RESERVED_ITEMS
-- ============================================================================
ALTER TABLE reserved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reserved_items for their company time_periods" ON reserved_items;
CREATE POLICY "Users can view reserved_items for their company time_periods"
  ON reserved_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_items.time_period_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create reserved_items for their company time_periods" ON reserved_items;
CREATE POLICY "Users can create reserved_items for their company time_periods"
  ON reserved_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_items.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update reserved_items for their company time_periods" ON reserved_items;
CREATE POLICY "Users can update reserved_items for their company time_periods"
  ON reserved_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_items.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_items.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete reserved_items for their company time_periods" ON reserved_items;
CREATE POLICY "Users can delete reserved_items for their company time_periods"
  ON reserved_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_items.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- RESERVED_VEHICLES
-- ============================================================================
ALTER TABLE reserved_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reserved_vehicles" ON reserved_vehicles;
CREATE POLICY "Users can view reserved_vehicles"
  ON reserved_vehicles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_vehicles.time_period_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create reserved_vehicles" ON reserved_vehicles;
CREATE POLICY "Users can create reserved_vehicles"
  ON reserved_vehicles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_vehicles.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update reserved_vehicles" ON reserved_vehicles;
CREATE POLICY "Users can update reserved_vehicles"
  ON reserved_vehicles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_vehicles.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_vehicles.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete reserved_vehicles" ON reserved_vehicles;
CREATE POLICY "Users can delete reserved_vehicles"
  ON reserved_vehicles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM time_periods
      JOIN company_users ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_vehicles.time_period_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- PENDING_INVITES
-- ============================================================================
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pending_invites for their companies" ON pending_invites;
CREATE POLICY "Users can view pending_invites for their companies"
  ON pending_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can create pending_invites" ON pending_invites;
CREATE POLICY "Company owners can create pending_invites"
  ON pending_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can update pending_invites" ON pending_invites;
CREATE POLICY "Company owners can update pending_invites"
  ON pending_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can delete pending_invites" ON pending_invites;
CREATE POLICY "Company owners can delete pending_invites"
  ON pending_invites
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- DEV_AUTH_LOGS
-- ============================================================================
-- This table is for debugging authentication issues. Only allow users to see their own logs or superusers to see all.
ALTER TABLE dev_auth_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own auth logs" ON dev_auth_logs;
CREATE POLICY "Users can view their own auth logs"
  ON dev_auth_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "System can insert auth logs" ON dev_auth_logs;
CREATE POLICY "System can insert auth logs"
  ON dev_auth_logs
  FOR INSERT
  WITH CHECK (true);

-- Note: UPDATE and DELETE not allowed for dev_auth_logs (read-only audit log)

-- ============================================================================
-- FIX VIEWS: Change SECURITY DEFINER to SECURITY INVOKER
-- ============================================================================
-- Views with SECURITY DEFINER bypass RLS by running with the view creator's
-- permissions. This migration changes them to SECURITY INVOKER so they respect
-- the querying user's permissions and RLS policies.

-- company_user_profiles
CREATE OR REPLACE VIEW "public"."company_user_profiles" WITH ("security_invoker"='on') AS
 SELECT "cu"."company_id",
    "cu"."user_id",
    "cu"."role",
    "p"."email",
    "p"."display_name",
    "p"."first_name",
    "p"."last_name",
    "p"."phone",
    "p"."avatar_url",
    "p"."created_at"
   FROM ("public"."company_users" "cu"
     JOIN "public"."profiles" "p" ON (("p"."user_id" = "cu"."user_id")));

-- group_current_price
CREATE OR REPLACE VIEW "public"."group_current_price" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("group_id") "group_id",
    "amount" AS "current_price",
    "effective_from"
   FROM "public"."group_price_history"
  WHERE ("effective_to" IS NULL)
  ORDER BY "group_id", "effective_from" DESC;

-- group_on_hand
CREATE OR REPLACE VIEW "public"."group_on_hand" WITH ("security_invoker"='on') AS
 WITH "per_part" AS (
         SELECT "gi"."group_id",
            ("floor"((("i"."total_quantity")::numeric / (NULLIF("gi"."quantity", 0))::numeric)))::integer AS "possible_sets"
           FROM ("public"."group_items" "gi"
             JOIN "public"."items" "i" ON (("i"."id" = "gi"."item_id")))
        )
 SELECT "group_id",
    COALESCE("min"("possible_sets"), 0) AS "on_hand"
   FROM "per_part"
  GROUP BY "group_id";

-- group_parts
CREATE OR REPLACE VIEW "public"."group_parts" WITH ("security_invoker"='on') AS
 SELECT "gi"."group_id",
    "gi"."item_id",
    "i"."name" AS "item_name",
    "gi"."quantity",
    "icp"."current_price" AS "item_current_price"
   FROM (("public"."group_items" "gi"
     JOIN "public"."items" "i" ON (("i"."id" = "gi"."item_id")))
     LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "gi"."item_id")));

-- group_price_history_with_profile
CREATE OR REPLACE VIEW "public"."group_price_history_with_profile" WITH ("security_invoker"='on') AS
 SELECT "gph"."id",
    "gph"."company_id",
    "gph"."group_id",
    "gph"."amount",
    "gph"."effective_from",
    "gph"."effective_to",
    "gph"."set_by",
    COALESCE("p"."display_name", "p"."email") AS "set_by_name"
   FROM ("public"."group_price_history" "gph"
     LEFT JOIN "public"."profiles" "p" ON (("p"."user_id" = "gph"."set_by")));

-- inventory_index
CREATE OR REPLACE VIEW "public"."inventory_index" WITH ("security_invoker"='on') AS
 SELECT "i"."company_id",
    "i"."id",
    "i"."name",
    "ic"."name" AS "category_name",
    "ib"."name" AS "brand_name",
    "i"."total_quantity" AS "on_hand",
    "icp"."current_price",
    'NOK'::"text" AS "currency",
    false AS "is_group",
    NULL::boolean AS "unique",
    "i"."allow_individual_booking",
    "i"."active",
    "i"."deleted",
    "i"."internally_owned",
    "i"."external_owner_id",
    "co"."name" AS "external_owner_name"
   FROM (((("public"."items" "i"
     LEFT JOIN "public"."item_categories" "ic" ON (("ic"."id" = "i"."category_id")))
     LEFT JOIN "public"."item_brands" "ib" ON (("ib"."id" = "i"."brand_id")))
     LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "i"."id")))
     LEFT JOIN "public"."customers" "co" ON (("co"."id" = "i"."external_owner_id")))
UNION ALL
 SELECT "g"."company_id",
    "g"."id",
    "g"."name",
    "ic2"."name" AS "category_name",
    NULL::"text" AS "brand_name",
    "gr"."on_hand",
    "gcp"."current_price",
    'NOK'::"text" AS "currency",
    true AS "is_group",
    "g"."unique",
    true AS "allow_individual_booking",
    "g"."active",
    "g"."deleted",
    "g"."internally_owned",
    "g"."external_owner_id",
    "co2"."name" AS "external_owner_name"
   FROM (((("public"."item_groups" "g"
     LEFT JOIN "public"."item_categories" "ic2" ON (("ic2"."id" = "g"."category_id")))
     LEFT JOIN "public"."groups_with_rollups" "gr" ON (("gr"."id" = "g"."id")))
     LEFT JOIN "public"."group_current_price" "gcp" ON (("gcp"."group_id" = "g"."id")))
     LEFT JOIN "public"."customers" "co2" ON (("co2"."id" = "g"."external_owner_id")));

-- item_current_price
CREATE OR REPLACE VIEW "public"."item_current_price" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("item_id") "item_id",
    "amount" AS "current_price",
    "effective_from"
   FROM "public"."item_price_history"
  WHERE ("effective_to" IS NULL)
  ORDER BY "item_id", "effective_from" DESC;

-- item_index_ext
CREATE OR REPLACE VIEW "public"."item_index_ext" WITH ("security_invoker"='on') AS
 SELECT "i"."id",
    "i"."company_id",
    "i"."name",
    "i"."category_id",
    "i"."brand_id",
    "i"."model",
    "i"."allow_individual_booking",
    "i"."total_quantity",
    "i"."active",
    "i"."notes",
    "i"."deleted",
    "i"."internal_owner_company_id",
    "i"."external_owner_id",
    ("i"."external_owner_id" IS NOT NULL) AS "is_external",
    COALESCE("fc"."name", "c"."name") AS "owner_name"
   FROM (("public"."items" "i"
     LEFT JOIN "public"."customers" "fc" ON (("fc"."id" = "i"."external_owner_id")))
     LEFT JOIN "public"."companies" "c" ON (("c"."id" = "i"."internal_owner_company_id")));

-- item_price_history_with_profile
CREATE OR REPLACE VIEW "public"."item_price_history_with_profile" WITH ("security_invoker"='on') AS
 SELECT "iph"."id",
    "iph"."company_id",
    "iph"."item_id",
    "iph"."amount",
    "iph"."effective_from",
    "iph"."effective_to",
    "iph"."set_by",
    COALESCE("p"."display_name", "p"."email") AS "set_by_name"
   FROM ("public"."item_price_history" "iph"
     LEFT JOIN "public"."profiles" "p" ON (("p"."user_id" = "iph"."set_by")));

-- vehicle_detail
CREATE OR REPLACE VIEW "public"."vehicle_detail" WITH ("security_invoker"='on') AS
 SELECT "v"."id",
    "v"."company_id",
    "v"."name",
    "v"."registration_no",
    "v"."fuel",
    "v"."active",
    "v"."deleted",
    "v"."notes",
    "v"."image_path",
    "v"."internally_owned",
    "v"."external_owner_id",
        CASE
            WHEN "v"."internally_owned" THEN 'internal'::"text"
            ELSE 'external'::"text"
        END AS "owner_kind",
        CASE
            WHEN "v"."internally_owned" THEN "comp"."name"
            ELSE "cust"."name"
        END AS "owner_name",
        CASE
            WHEN "v"."internally_owned" THEN NULL::boolean
            ELSE "cust"."is_partner"
        END AS "external_owner_is_partner",
        CASE
            WHEN "v"."internally_owned" THEN NULL::"text"
            ELSE "cust"."email"
        END AS "external_owner_email",
        CASE
            WHEN "v"."internally_owned" THEN NULL::"text"
            ELSE "cust"."phone"
        END AS "external_owner_phone",
    "v"."created_at",
    "next_res"."reservation_id" AS "next_reservation_id",
    "next_res"."start_at" AS "next_reservation_start_at",
    "next_res"."end_at" AS "next_reservation_end_at",
    "next_res"."job_id" AS "next_reservation_job_id",
    "next_res"."title" AS "next_reservation_title"
   FROM ((("public"."vehicles" "v"
     JOIN "public"."companies" "comp" ON (("comp"."id" = "v"."company_id")))
     LEFT JOIN "public"."customers" "cust" ON (("cust"."id" = "v"."external_owner_id")))
     LEFT JOIN LATERAL ( SELECT "r"."id" AS "reservation_id",
            "r"."start_at",
            "r"."end_at",
            "r"."job_id",
            COALESCE("r"."title", 'Reservation'::"text") AS "title"
           FROM ("public"."time_periods" "r"
             JOIN "public"."reserved_vehicles" "rv" ON (("rv"."time_period_id" = "r"."id")))
          WHERE (("rv"."vehicle_id" = "v"."id") AND ("r"."company_id" = "v"."company_id") AND ("r"."end_at" > "now"()))
          ORDER BY "r"."start_at"
         LIMIT 1) "next_res" ON (true));

-- vehicle_index
CREATE OR REPLACE VIEW "public"."vehicle_index" WITH ("security_invoker"='on') AS
 SELECT "v"."id",
    "v"."company_id",
    "v"."name",
    "v"."registration_no" AS "reg_number",
    "v"."image_path",
    "v"."fuel",
    "v"."internally_owned",
    "v"."external_owner_id",
    "c"."name" AS "external_owner_name",
    "v"."active",
    "v"."deleted",
    "v"."created_at"
   FROM ("public"."vehicles" "v"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."external_owner_id")));

