-- Cleanup Migration History
-- Run this in Supabase SQL Editor to mark migrations as applied
-- This syncs your local migration files with what's actually in the database

-- Mark migrations that are already applied but missing from history
-- Based on the migration list output, these are already in the remote database:

-- January 2025 migrations (already applied)
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES 
  ('20250105000000', ARRAY[]::text[], 'add_offers_system'),
  ('20250106000000', ARRAY[]::text[], 'add_theme_properties'),
  ('20250107000000', ARRAY[]::text[], 'add_terms_and_conditions'),
  ('20250107010000', ARRAY[]::text[], 'create_company_files_bucket'),
  ('20250108000000', ARRAY[]::text[], 'add_show_price_per_line_to_offers'),
  ('20250109000000', ARRAY[]::text[], 'add_logo_paths'),
  ('20250110000000', ARRAY[]::text[], 'add_vehicle_categories'),
  ('20250111000000', ARRAY[]::text[], 'add_offer_rejection_and_revision'),
  ('20250112000000', ARRAY[]::text[], 'add_vehicle_rates_fields'),
  ('20250113000000', ARRAY[]::text[], 'remove_transport_rate_fields'),
  ('20250114000000', ARRAY[]::text[], 'add_activity_notifications'),
  ('20251202000000', ARRAY[]::text[], 'handle_offer_acceptance_followup')
ON CONFLICT (version) DO NOTHING;

-- IMPORTANT: Before marking 20250115000000 as applied, make sure you've run the SQL
-- from 20250115000000_fix_conta_api_key_permissions.sql in the SQL Editor first!
-- Then uncomment the line below:

-- INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
-- VALUES ('20250115000000', ARRAY[]::text[], 'fix_conta_api_key_permissions')
-- ON CONFLICT (version) DO NOTHING;

