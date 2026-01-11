-- Migration: Add INSERT policy for company_expansions
-- Created: 2026-01-10
-- 
-- This migration adds an INSERT policy for company_expansions to allow owners
-- and superusers to create company_expansions records.
--
-- The existing policy "Company owners can manage expansions" only has USING
-- which applies to SELECT/UPDATE/DELETE, but not INSERT. We need a separate
-- INSERT policy with WITH CHECK to allow inserts.

DROP POLICY IF EXISTS "Company owners can insert expansions" ON company_expansions;

CREATE POLICY "Company owners can insert expansions"
  ON company_expansions
  FOR INSERT
  WITH CHECK (
    -- Owners and super_users can insert expansions for their companies
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = company_expansions.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user')
    )
    OR
    -- Global superusers can insert expansions for any company
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

