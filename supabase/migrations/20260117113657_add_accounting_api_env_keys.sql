-- Add sandbox API key support and environment selection for accounting integrations

ALTER TABLE company_expansions
  ADD COLUMN IF NOT EXISTS accounting_api_environment TEXT DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS accounting_api_key_sandbox_encrypted BYTEA;

ALTER TABLE company_expansions
  DROP CONSTRAINT IF EXISTS company_expansions_accounting_api_environment_check;

ALTER TABLE company_expansions
  ADD CONSTRAINT company_expansions_accounting_api_environment_check
  CHECK (accounting_api_environment IN ('production', 'sandbox'));

UPDATE company_expansions
SET accounting_api_environment = 'production'
WHERE accounting_api_environment IS NULL;

COMMENT ON COLUMN company_expansions.accounting_api_environment IS
'Active Conta API environment for this company (production or sandbox).';

COMMENT ON COLUMN company_expansions.accounting_api_key_sandbox_encrypted IS
'Encrypted Conta sandbox API key for this company (stored as BYTEA).';

-- Update get_conta_api_key to use the selected environment
DROP FUNCTION IF EXISTS get_conta_api_key();

CREATE OR REPLACE FUNCTION get_conta_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_api_key BYTEA;
  v_api_key_base64 TEXT;
  v_is_superuser BOOLEAN;
  v_api_environment TEXT;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's selected company from their profile
  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  -- Verify the selected company exists and user is a member
  -- If selected_company_id is NULL or user is not a member, find a company they ARE a member of
  IF v_company_id IS NOT NULL THEN
    -- Check if user is actually a member of the selected company
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;

    -- If not a member of selected company, reset to NULL to find a valid company
    IF v_role IS NULL THEN
      v_company_id := NULL;
      v_role := NULL;
    END IF;
  END IF;

  -- If no valid company found yet, get the first company they're a member of with allowed role
  IF v_company_id IS NULL THEN
    SELECT company_id, role INTO v_company_id, v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND role IN ('owner', 'employee', 'super_user')
    ORDER BY
      CASE role
        WHEN 'owner' THEN 1
        WHEN 'super_user' THEN 2
        WHEN 'employee' THEN 3
      END
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company with access permissions';
  END IF;

  -- Get the role if we don't have it yet (should already have it from above, but just in case)
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  -- Check if user is a global superuser (can access any company's API key)
  SELECT COALESCE(superuser, false) INTO v_is_superuser
  FROM profiles
  WHERE user_id = v_user_id;

  -- Allow access if:
  -- 1. User is a global superuser, OR
  -- 2. User has role 'owner', 'employee', or 'super_user' in the company
  IF v_is_superuser THEN
    -- Global superuser can access any company's API key
    NULL; -- Allow access
  ELSIF v_role IS NULL THEN
    -- User is not a member of the company and not a superuser
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access Conta API key';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    -- User is a member but doesn't have the right role
    RAISE EXCEPTION 'User role "%" does not have permission to access Conta API key. Required roles: owner, employee, or super_user', v_role;
  END IF;

  -- Determine which environment to use (default to production)
  SELECT COALESCE(accounting_api_environment, 'production') INTO v_api_environment
  FROM company_expansions
  WHERE company_id = v_company_id;

  -- Get the encrypted API key from company_expansions (stored as BYTEA)
  IF v_api_environment = 'sandbox' THEN
    SELECT accounting_api_key_sandbox_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = v_company_id;
  ELSE
    SELECT accounting_api_key_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = v_company_id;
  END IF;

  IF v_api_key IS NULL THEN
    RAISE EXCEPTION 'No Conta API key configured for this company';
  END IF;

  -- Convert BYTEA back to base64 string for the decrypt function
  -- The column stores the base64 string as BYTEA (ASCII bytes of the base64 string)
  -- So we need to convert the bytes back to the original base64 TEXT string
  v_api_key_base64 := convert_from(v_api_key, 'UTF8');

  -- Decrypt and return the API key using the decrypt_api_key function
  RETURN decrypt_api_key(v_company_id, v_api_key_base64);
END;
$$;

COMMENT ON FUNCTION get_conta_api_key() IS
'Returns the decrypted Conta API key for the current user''s company based on the selected environment (production or sandbox).';

-- Expose the selected accounting API environment
DROP FUNCTION IF EXISTS get_accounting_api_environment();

CREATE OR REPLACE FUNCTION get_accounting_api_environment()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_is_superuser BOOLEAN;
  v_environment TEXT;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's selected company from their profile
  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  -- Verify the selected company exists and user is a member
  IF v_company_id IS NOT NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;

    IF v_role IS NULL THEN
      v_company_id := NULL;
      v_role := NULL;
    END IF;
  END IF;

  -- If no valid company found yet, get the first company they're a member of with allowed role
  IF v_company_id IS NULL THEN
    SELECT company_id, role INTO v_company_id, v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND role IN ('owner', 'employee', 'super_user')
    ORDER BY
      CASE role
        WHEN 'owner' THEN 1
        WHEN 'super_user' THEN 2
        WHEN 'employee' THEN 3
      END
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company with access permissions';
  END IF;

  -- Get the role if we don't have it yet (should already have it from above, but just in case)
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  -- Check if user is a global superuser (can access any company's settings)
  SELECT COALESCE(superuser, false) INTO v_is_superuser
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_is_superuser THEN
    NULL;
  ELSIF v_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access accounting settings';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    RAISE EXCEPTION 'User role "%" does not have permission to access accounting settings. Required roles: owner, employee, or super_user', v_role;
  END IF;

  SELECT COALESCE(accounting_api_environment, 'production') INTO v_environment
  FROM company_expansions
  WHERE company_id = v_company_id;

  RETURN COALESCE(v_environment, 'production');
END;
$$;

COMMENT ON FUNCTION get_accounting_api_environment() IS
'Returns the selected accounting API environment (production or sandbox) for the current user''s company.';
