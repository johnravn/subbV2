-- Fix get_conta_api_key function to allow owners and employees, not just superusers
-- This function should allow any user who is a member of the company with role 'owner', 'employee', or 'super_user'

-- Enable pgcrypto extension if not already enabled
-- Note: This must be run as a superuser, which Supabase handles automatically
-- In Supabase, pgcrypto should already be enabled, but we ensure it's available
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    CREATE EXTENSION pgcrypto WITH SCHEMA public;
  END IF;
END $$;

-- Drop existing functions if they exist (to allow recreation with potentially different signatures)
DROP FUNCTION IF EXISTS encrypt_api_key(UUID, TEXT);
DROP FUNCTION IF EXISTS decrypt_api_key(UUID, TEXT);

-- Create encrypt_api_key function
-- This function encrypts an API key using pgcrypto with a secret derived from company_id
-- Note: In production, you should use Supabase Vault to store a master encryption key
CREATE OR REPLACE FUNCTION encrypt_api_key(
  p_company_id UUID,
  p_api_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_encrypted_key TEXT;
  v_secret_key TEXT;
  v_key_hash BYTEA;
BEGIN
  -- Generate a secret key from company_id and a fixed salt
  -- In production, replace this with a key from Supabase Vault
  -- For now, we use a combination that's unique per company
  v_secret_key := 'conta_api_key_secret_' || p_company_id::TEXT;
  
  -- Hash the secret key to get a fixed-length key (32 bytes for AES-256)
  -- This ensures the key is the right length for encryption
  v_key_hash := digest(v_secret_key, 'sha256');
  
  -- Encrypt using encrypt function from pgcrypto extension
  -- Using 'aes' (AES-256) cipher which supports 32-byte keys
  SELECT encode(
    encrypt(
      p_api_key::bytea,
      v_key_hash,
      'aes'
    ),
    'base64'
  ) INTO v_encrypted_key;
  
  RETURN v_encrypted_key;
EXCEPTION
  WHEN OTHERS THEN
    -- If encryption fails, raise an error
    RAISE EXCEPTION 'Failed to encrypt API key: %', SQLERRM;
END;
$$;

-- Create decrypt_api_key function
-- This function decrypts an API key that was encrypted with encrypt_api_key
CREATE OR REPLACE FUNCTION decrypt_api_key(
  p_company_id UUID,
  p_encrypted_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_decrypted_key TEXT;
  v_secret_key TEXT;
  v_key_hash BYTEA;
  v_clean_base64 TEXT;
  v_encrypted_bytes BYTEA;
BEGIN
  -- Generate the same secret key used during encryption
  v_secret_key := 'conta_api_key_secret_' || p_company_id::TEXT;
  
  -- Hash the secret key to get the same fixed-length key used during encryption
  v_key_hash := digest(v_secret_key, 'sha256');
  
  -- Clean the base64 string: remove all invalid characters
  -- First, explicitly remove backslashes (common escape character issue)
  v_clean_base64 := replace(p_encrypted_key, '\', '');
  -- Remove all other non-base64 characters (whitespace, newlines, etc.)
  v_clean_base64 := regexp_replace(v_clean_base64, '[^A-Za-z0-9+/=]', '', 'g');
  
  -- Decrypt using decrypt function from pgcrypto extension
  BEGIN
    -- Decode the base64 string
    v_encrypted_bytes := decode(v_clean_base64, 'base64');
    
    -- Now decrypt the bytes
    SELECT convert_from(
      decrypt(
        v_encrypted_bytes,
        v_key_hash,
        'aes'
      ),
      'UTF8'
    ) INTO v_decrypted_key;
    
    RETURN v_decrypted_key;
  EXCEPTION
    WHEN OTHERS THEN
      -- If decryption fails, raise a clear error with more context
      RAISE EXCEPTION 'Unable to decrypt API key. The key may be corrupted or encrypted with a different method. Error: %', SQLERRM;
  END;
END;
$$;

-- Add comments
COMMENT ON FUNCTION encrypt_api_key(UUID, TEXT) IS 
'Encrypts an API key for a company using pgcrypto. The company_id is used as part of the encryption key.';

COMMENT ON FUNCTION decrypt_api_key(UUID, TEXT) IS 
'Decrypts an API key that was encrypted with encrypt_api_key. Requires the same company_id used during encryption.';

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_conta_api_key();

-- Recreate the function with proper permissions
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

  -- Get the encrypted API key from company_expansions (stored as BYTEA)
  SELECT accounting_api_key_encrypted INTO v_api_key
  FROM company_expansions
  WHERE company_id = v_company_id;

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

-- Also update get_accounting_read_only to have the same permissions
DROP FUNCTION IF EXISTS get_accounting_read_only();

CREATE OR REPLACE FUNCTION get_accounting_read_only()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_read_only BOOLEAN;
  v_is_superuser BOOLEAN;
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

  -- If no company selected, try to get the first company they're a member of
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_users
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company';
  END IF;

  -- Check if user is a member of the company and get their role
  SELECT role INTO v_role
  FROM company_users
  WHERE user_id = v_user_id
    AND company_id = v_company_id;

  -- Allow superusers (global), owners, employees, and super_user role
  IF v_role IS NULL THEN
    -- Check if user is a global superuser
    SELECT COALESCE(superuser, false) INTO v_is_superuser
    FROM profiles
    WHERE user_id = v_user_id;
    
    IF NOT v_is_superuser THEN
      RAISE EXCEPTION 'User is not authorized to access accounting settings';
    END IF;
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    RAISE EXCEPTION 'User role does not have permission to access accounting settings';
  END IF;

  -- Get the read-only setting from company_expansions
  SELECT COALESCE(accounting_api_read_only, false) INTO v_read_only
  FROM company_expansions
  WHERE company_id = v_company_id;

  -- Default to read-only if not set
  RETURN COALESCE(v_read_only, true);
END;
$$;

-- Add comment explaining the functions
COMMENT ON FUNCTION get_conta_api_key() IS 
'Returns the decrypted Conta API key for the current user''s company. Requires user to be authenticated and have role owner, employee, or super_user in the company.';

COMMENT ON FUNCTION get_accounting_read_only() IS 
'Returns the read-only setting for accounting API operations. Requires user to be authenticated and have role owner, employee, or super_user in the company.';

