-- Migration: Add RLS (Row Level Security) to addresses table
-- Created: 2025-12-17
-- 
-- This migration enables RLS and adds policies for:
-- - SELECT: Users can view company addresses for their companies and their personal addresses
-- - INSERT: Users can create company addresses for their companies and personal addresses
-- - UPDATE: Users can update company addresses for their companies and their personal addresses
-- - DELETE: Users can delete company addresses for their companies and their personal addresses
--
-- Superusers can access all addresses.
-- Personal addresses (is_personal = true) are accessible only to the owner.

-- Enable Row Level Security on addresses table
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view company addresses for companies they belong to
DROP POLICY IF EXISTS "Users can view company addresses" ON addresses;
CREATE POLICY "Users can view company addresses"
  ON addresses
  FOR SELECT
  USING (
    -- Company addresses: user must be a member of the company
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
      )
    )
    OR
    -- Personal addresses: user must own the address (via profiles.primary_address_id)
    (
      is_personal = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.primary_address_id = addresses.id
          AND profiles.user_id = auth.uid()
      )
    )
    OR
    -- Superusers can view all addresses
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Policy: Users can insert company addresses for their companies
DROP POLICY IF EXISTS "Users can create company addresses" ON addresses;
CREATE POLICY "Users can create company addresses"
  ON addresses
  FOR INSERT
  WITH CHECK (
    -- Company addresses: user must be a member of the company with appropriate role
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
          AND company_users.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR
    -- Personal addresses: user can create their own personal addresses
    (
      is_personal = true
      AND company_id IS NULL
    )
    OR
    -- Superusers can create any address
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Policy: Users can update company addresses for their companies
DROP POLICY IF EXISTS "Users can update company addresses" ON addresses;
CREATE POLICY "Users can update company addresses"
  ON addresses
  FOR UPDATE
  USING (
    -- Company addresses: user must be a member of the company with appropriate role
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
          AND company_users.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR
    -- Personal addresses: user must own the address
    (
      is_personal = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.primary_address_id = addresses.id
          AND profiles.user_id = auth.uid()
      )
    )
    OR
    -- Superusers can update any address
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    -- Same conditions for the updated row
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
          AND company_users.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR
    (
      is_personal = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.primary_address_id = addresses.id
          AND profiles.user_id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Policy: Users can delete company addresses for their companies
DROP POLICY IF EXISTS "Users can delete company addresses" ON addresses;
CREATE POLICY "Users can delete company addresses"
  ON addresses
  FOR DELETE
  USING (
    -- Company addresses: user must be a member of the company with appropriate role
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
          AND company_users.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR
    -- Personal addresses: user must own the address
    (
      is_personal = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.primary_address_id = addresses.id
          AND profiles.user_id = auth.uid()
      )
    )
    OR
    -- Superusers can delete any address
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Add comment
COMMENT ON TABLE addresses IS 'Addresses can be company addresses (company_id set) or personal addresses (is_personal = true). RLS policies ensure users can only access addresses for their companies or their own personal addresses.';

