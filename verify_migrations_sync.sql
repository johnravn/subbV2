-- Verify Migration Sync Status
-- Run this in Supabase SQL Editor to compare remote vs local migrations
-- Run each section separately (they're independent queries)

-- ============================================
-- PART 1: Detailed Sync Status
-- ============================================
WITH remote_migrations AS (
  SELECT version, name
  FROM supabase_migrations.schema_migrations
),
local_migrations AS (
  SELECT version, name FROM (VALUES
    ('20250102000000', 'add_job_status_changed_activity_type'),
    ('20250103000000', 'enable_fuzzy_search'),
    ('20250104000000', 'add_job_number_system'),
    ('20250106000000', 'add_theme_properties'),
    ('20250107000000', 'add_terms_and_conditions'),
    ('20250107010000', 'create_company_files_bucket'),
    ('20250108000000', 'add_show_price_per_line_to_offers'),
    ('20250109000000', 'add_logo_paths'),
    ('20250110000000', 'add_vehicle_categories'),
    ('20250111000000', 'add_offer_rejection_and_revision'),
    ('20250112000000', 'add_vehicle_rates_fields'),
    ('20250113000000', 'remove_transport_rate_fields'),
    ('20250114000000', 'add_activity_notifications'),
    ('20250115000000', 'fix_conta_api_key_permissions'),
    ('20251103130000', 'add_accounting_organization_id'),
    ('20251201000000', 'add_offers_system'),
    ('20251202000000', 'handle_offer_acceptance_followup')
  ) AS t(version, name)
)
SELECT 
  COALESCE(r.version, l.version) as version,
  COALESCE(r.name, l.name) as name,
  CASE 
    WHEN r.version IS NULL THEN '❌ Missing in Remote'
    WHEN l.version IS NULL THEN '⚠️  Extra in Remote (duplicate)'
    ELSE '✅ Synced'
  END as status
FROM local_migrations l
FULL OUTER JOIN remote_migrations r ON l.version = r.version
ORDER BY COALESCE(r.version, l.version);

-- ============================================
-- PART 2: Summary Counts (run separately)
-- ============================================
WITH remote_migrations AS (
  SELECT version, name
  FROM supabase_migrations.schema_migrations
),
local_migrations AS (
  SELECT version, name FROM (VALUES
    ('20250102000000', 'add_job_status_changed_activity_type'),
    ('20250103000000', 'enable_fuzzy_search'),
    ('20250104000000', 'add_job_number_system'),
    ('20250106000000', 'add_theme_properties'),
    ('20250107000000', 'add_terms_and_conditions'),
    ('20250107010000', 'create_company_files_bucket'),
    ('20250108000000', 'add_show_price_per_line_to_offers'),
    ('20250109000000', 'add_logo_paths'),
    ('20250110000000', 'add_vehicle_categories'),
    ('20250111000000', 'add_offer_rejection_and_revision'),
    ('20250112000000', 'add_vehicle_rates_fields'),
    ('20250113000000', 'remove_transport_rate_fields'),
    ('20250114000000', 'add_activity_notifications'),
    ('20250115000000', 'fix_conta_api_key_permissions'),
    ('20251103130000', 'add_accounting_organization_id'),
    ('20251201000000', 'add_offers_system'),
    ('20251202000000', 'handle_offer_acceptance_followup')
  ) AS t(version, name)
),
sync_data AS (
  SELECT 
    r.version IS NOT NULL as in_remote,
    l.version IS NOT NULL as in_local,
    r.version IS NOT NULL AND l.version IS NOT NULL as is_synced
  FROM local_migrations l
  FULL OUTER JOIN remote_migrations r ON l.version = r.version
)
SELECT 
  COUNT(*) FILTER (WHERE in_remote) as remote_count,
  COUNT(*) FILTER (WHERE in_local) as local_count,
  COUNT(*) FILTER (WHERE is_synced) as synced_count,
  COUNT(*) FILTER (WHERE NOT in_remote AND in_local) as missing_in_remote,
  COUNT(*) FILTER (WHERE in_remote AND NOT in_local) as extra_in_remote
FROM sync_data;

