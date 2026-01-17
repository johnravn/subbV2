-- Move extensions out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'citext'
      AND n.nspname <> 'extensions'
  ) THEN
    EXECUTE 'ALTER EXTENSION citext SET SCHEMA extensions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm'
      AND n.nspname <> 'extensions'
  ) THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist'
      AND n.nspname <> 'extensions'
  ) THEN
    EXECUTE 'ALTER EXTENSION btree_gist SET SCHEMA extensions';
  END IF;
END $$;

-- Lock down materialized view from the public API
REVOKE ALL ON TABLE public.vehicle_index_mat FROM anon, authenticated;

-- Fix function search_path to avoid role-mutable defaults
ALTER FUNCTION public._rv_set_during() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.normalize_email() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.fuzzy_search_text(text, text, real) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.set_updated_at() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.prevent_circular_group_reference() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.fuzzy_search_multi(text, text[], real) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.current_company_id() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.generate_job_number() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.reservations_kind_job_check() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.update_job_offers_updated_at() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.check_item_availability_for_job(uuid, uuid) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.notify_activity_creator() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.decrypt_api_key(uuid, bytea) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.decrypt_api_key(uuid, text) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.item_available_qty(uuid, uuid, timestamp with time zone, timestamp with time zone)
  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.update_job_invoices_updated_at() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.check_circular_group_reference(uuid, uuid) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.check_item_quantity() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.auto_update_jobs_to_in_progress() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.update_company_expansions_updated_at() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.update_activity_comments_updated_at() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.update_updated_at_column() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.enforce_within_time_period() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.trg_reserved_items_enforce() SET search_path TO 'public', 'extensions';
