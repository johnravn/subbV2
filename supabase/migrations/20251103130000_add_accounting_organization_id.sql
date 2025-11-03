-- Add accounting_organization_id field to company_expansions
-- This stores the Conta organization ID (opContextOrgId) needed for API calls

ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS accounting_organization_id TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN company_expansions.accounting_organization_id IS 
'Organization ID for the accounting system (e.g., Conta opContextOrgId). Required for API calls to accounting endpoints.';

