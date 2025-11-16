-- Apply Conta API Key Permissions Migration
-- Run this in Supabase SQL Editor to create/update the functions

-- This is the migration from 20250115000000_fix_conta_api_key_permissions.sql
-- Copy and paste the entire contents of that file here, or run it separately first,
-- then mark it as applied with the INSERT statement at the bottom.

-- After running the migration SQL, mark it as applied:
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20250115000000', ARRAY[]::text[], 'fix_conta_api_key_permissions')
ON CONFLICT (version) DO NOTHING;

