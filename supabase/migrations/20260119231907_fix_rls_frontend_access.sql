-- Fix RLS policies to match frontend access for roles
-- - Allow company members to view profiles needed by crew views
-- - Allow company members to view crew personal addresses
-- - Allow employees to manage pending invites they can access in the UI
-- - Allow freelancers to update their own reserved_crew status
-- - Allow super_users to manage company expansions
-- - Allow employees to update crew rates in company_users

-- ============================================================================
-- PROFILES: allow company members to view each other
-- ============================================================================
DROP POLICY IF EXISTS "Company members can view profiles" ON profiles;
CREATE POLICY "Company members can view profiles"
  ON profiles
  FOR SELECT
  USING (
    -- Always allow reading your own profile
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM company_users cu_self
      JOIN company_users cu_target
        ON cu_target.company_id = cu_self.company_id
       AND cu_target.user_id = profiles.user_id
      WHERE cu_self.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

-- ============================================================================
-- ADDRESSES: allow company members to view crew personal addresses
-- ============================================================================
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
    -- Personal addresses: owner can view their own
    (
      is_personal = true
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.primary_address_id = addresses.id
          AND profiles.user_id = auth.uid()
      )
    )
    OR
    -- Personal addresses: company members can view crew addresses
    (
      is_personal = true
      AND EXISTS (
        SELECT 1
        FROM profiles p
        JOIN company_users cu_target
          ON cu_target.user_id = p.user_id
        JOIN company_users cu_self
          ON cu_self.company_id = cu_target.company_id
        WHERE p.primary_address_id = addresses.id
          AND cu_self.user_id = auth.uid()
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

-- ============================================================================
-- PENDING_INVITES: allow employees to manage invites they can access in UI
-- ============================================================================
DROP POLICY IF EXISTS "Users can view pending_invites for their companies" ON pending_invites;
CREATE POLICY "Users can view pending_invites for their companies"
  ON pending_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can create pending_invites" ON pending_invites;
CREATE POLICY "Company members can create pending_invites"
  ON pending_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can update pending_invites" ON pending_invites;
CREATE POLICY "Company members can update pending_invites"
  ON pending_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
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
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Company owners can delete pending_invites" ON pending_invites;
CREATE POLICY "Company members can delete pending_invites"
  ON pending_invites
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
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
-- RESERVED_CREW: allow freelancers to update their own status
-- ============================================================================
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
    OR reserved_crew.user_id = auth.uid()
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
    OR reserved_crew.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- ============================================================================
-- COMPANY_EXPANSIONS: allow super_user role to manage expansions
-- ============================================================================
DROP POLICY IF EXISTS "Company owners can manage expansions" ON company_expansions;
CREATE POLICY "Company owners can manage expansions"
  ON company_expansions
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = company_expansions.company_id
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
-- COMPANY_USERS: allow employees to update crew rates in UI
-- ============================================================================
DROP POLICY IF EXISTS "Company owners can update company_users" ON company_users;
CREATE POLICY "Company members can update company_users"
  ON company_users
  FOR UPDATE
  USING (
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    public.user_has_company_role(company_users.company_id, auth.uid(), ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
