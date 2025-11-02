-- Create company_expansions table for storing integration configurations
-- This includes encrypted API keys for accounting software and other integrations

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create company_expansions table
CREATE TABLE IF NOT EXISTS company_expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Accounting software configuration
  accounting_software TEXT CHECK (accounting_software IN ('none', 'conta')),
  accounting_api_key_encrypted BYTEA, -- Encrypted API key
  
  -- Theme configuration
  accent_color TEXT CHECK (accent_color IN (
    'gray', 'gold', 'bronze', 'brown', 'yellow', 'amber', 'orange', 
    'tomato', 'red', 'ruby', 'pink', 'plum', 'purple', 'violet', 
    'iris', 'indigo', 'blue', 'cyan', 'teal', 'jade', 'green', 
    'grass', 'mint', 'lime', 'sky'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one expansion record per company
  UNIQUE(company_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_expansions_company_id ON company_expansions(company_id);

-- RLS Policies
ALTER TABLE company_expansions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view expansions for companies they belong to
CREATE POLICY "Users can view company expansions"
  ON company_expansions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = company_expansions.company_id
      AND company_users.user_id = auth.uid()
    )
  );

-- Policy: Only owners can insert/update expansions
CREATE POLICY "Company owners can manage expansions"
  ON company_expansions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = company_expansions.company_id
      AND company_users.user_id = auth.uid()
      AND company_users.role = 'owner'
    )
  );

-- Function to encrypt API key
-- Uses a master encryption key that should be set via Supabase secrets or environment
-- In production, set this via: ALTER DATABASE SET app.settings.encryption_key = 'your-secret-key';
CREATE OR REPLACE FUNCTION encrypt_api_key(
  p_company_id UUID,
  p_api_key TEXT
) RETURNS BYTEA AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Try to get encryption key from database setting, fallback to a default for development
  encryption_key := coalesce(
    current_setting('app.settings.encryption_key', true),
    'dev-encryption-key-change-in-production-' || p_company_id::TEXT
  );
  
  RETURN pgp_sym_encrypt(
    p_api_key,
    encryption_key || p_company_id::TEXT -- Add company_id for additional uniqueness
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt API key (for use in server-side functions only)
-- This should NOT be exposed to clients - only use in secure server functions
CREATE OR REPLACE FUNCTION decrypt_api_key(
  p_company_id UUID,
  p_encrypted_key BYTEA
) RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := coalesce(
    current_setting('app.settings.encryption_key', true),
    'dev-encryption-key-change-in-production-' || p_company_id::TEXT
  );
  
  RETURN pgp_sym_decrypt(
    p_encrypted_key,
    encryption_key || p_company_id::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_company_expansions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_expansions_updated_at
  BEFORE UPDATE ON company_expansions
  FOR EACH ROW
  EXECUTE FUNCTION update_company_expansions_updated_at();

