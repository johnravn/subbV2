-- Simple version: Drop all triggers on reserved_crew (safe to run)
-- This is a simpler approach that just drops all triggers

DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  -- Drop specific known triggers first
  DROP TRIGGER IF EXISTS rc_set_during_upd ON public.reserved_crew CASCADE;
  DROP TRIGGER IF EXISTS rc_enforce_within_reservation_insupd ON public.reserved_crew CASCADE;
  DROP TRIGGER IF EXISTS rc_set_during_ins ON public.reserved_crew CASCADE;
  
  -- Drop the function that sets during (it references start_at/end_at)
  DROP FUNCTION IF EXISTS _rc_set_during() CASCADE;
  
  -- Drop ALL triggers on reserved_crew (they can be recreated if needed)
  FOR trigger_rec IN
    SELECT pg.tgname::text AS trigger_name
    FROM pg_trigger pg
    JOIN pg_class c ON c.oid = pg.tgrelid
    WHERE c.relname = 'reserved_crew'
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND pg.tgisinternal = false
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.reserved_crew CASCADE', trigger_rec.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;

