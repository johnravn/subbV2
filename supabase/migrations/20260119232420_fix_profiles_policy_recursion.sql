-- Fix profiles RLS recursion by using SECURITY DEFINER helpers

-- Helper: check global superuser without invoking profiles RLS
CREATE OR REPLACE FUNCTION public.is_superuser(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id
      AND superuser = true
  );
$$;

-- Helper: check if two users share any company
CREATE OR REPLACE FUNCTION public.users_share_company(p_user_id uuid, p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_users cu_self
    JOIN company_users cu_other
      ON cu_other.company_id = cu_self.company_id
     AND cu_other.user_id = p_other_user_id
    WHERE cu_self.user_id = p_user_id
  );
$$;

-- Replace profiles policy to avoid recursive references
DROP POLICY IF EXISTS "Company members can view profiles" ON profiles;
CREATE POLICY "Company members can view profiles"
  ON profiles
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.users_share_company(auth.uid(), profiles.user_id)
    OR public.is_superuser(auth.uid())
  );
