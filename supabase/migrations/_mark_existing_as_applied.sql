-- Run this ONCE in Supabase SQL Editor to mark all existing migrations as applied
-- This allows db:push to work correctly going forward
-- Only run this if you've already manually applied all these migrations!

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES 
  ('20251030101558', ARRAY[]::text[], 'remote_schema'),
  ('20251101000000', ARRAY[]::text[], 'drop_start_end_from_reserved'),
  ('20251101000001', ARRAY[]::text[], 'add_role_fields_to_time_periods'),
  ('20251101000002', ARRAY[]::text[], 'fix_reserved_crew_triggers'),
  ('20251101000003', ARRAY[]::text[], 'drop_assignment_from_reserved_crew'),
  ('20251101122912', ARRAY[]::text[], 'add_title_note_to_job_files'),
  ('20251102000000', ARRAY[]::text[], 'add_time_period_category_enum'),
  ('20251102120000', ARRAY[]::text[], 'create_matters_system'),
  ('20251102130000', ARRAY[]::text[], 'add_vote_options_and_files'),
  ('20251102140000', ARRAY[]::text[], 'add_delete_policy_for_matters'),
  ('20251102150000', ARRAY[]::text[], 'add_created_as_company_to_matters'),
  ('20251103000000', ARRAY[]::text[], 'create_company_expansions'),
  ('20251103000001', ARRAY[]::text[], 'add_accent_color_to_companies'),
  ('20251103000002', ARRAY[]::text[], 'set_default_indigo_accent_color'),
  ('20251103000003', ARRAY[]::text[], 'create_activity_log_system'),
  ('20251103000004', ARRAY[]::text[], 'add_get_conta_api_key_function'),
  ('20251103120938', ARRAY[]::text[], 'add_accounting_api_read_only'),
  ('20251103120939', ARRAY[]::text[], 'add_get_accounting_read_only_function')
ON CONFLICT (version) DO NOTHING;

