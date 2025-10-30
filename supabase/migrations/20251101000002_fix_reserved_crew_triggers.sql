-- Drop triggers and functions that reference start_at/end_at on reserved_crew
-- Run this migration to fix triggers that still reference the dropped columns

DO $$
DECLARE
  trigger_rec RECORD;
  func_rec RECORD;
BEGIN
  -- Drop specific known triggers first
  DROP TRIGGER IF EXISTS rc_set_during_upd ON public.reserved_crew CASCADE;
  DROP TRIGGER IF EXISTS rc_enforce_within_reservation_insupd ON public.reserved_crew CASCADE;
  DROP TRIGGER IF EXISTS rc_set_during_ins ON public.reserved_crew CASCADE;
  
  -- Drop the function that sets during (it references start_at/end_at)
  DROP FUNCTION IF EXISTS _rc_set_during() CASCADE;
  
  -- Drop all triggers on reserved_crew that might reference start_at/end_at
  FOR trigger_rec IN
    SELECT 
      pg.tgname::text AS trigger_name,
      pg_get_functiondef(pg.tgfoid) as func_def
    FROM pg_trigger pg
    JOIN pg_class c ON c.oid = pg.tgrelid
    WHERE c.relname = 'reserved_crew'
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND pg.tgisinternal = false
  LOOP
    -- Check if trigger function references start_at or end_at
    IF trigger_rec.func_def ILIKE '%start_at%' 
       OR trigger_rec.func_def ILIKE '%end_at%' 
       OR trigger_rec.func_def ILIKE '%NEW.start_at%' 
       OR trigger_rec.func_def ILIKE '%NEW.end_at%' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.reserved_crew CASCADE', trigger_rec.trigger_name);
      RAISE NOTICE 'Dropped trigger: %', trigger_rec.trigger_name;
    END IF;
  END LOOP;

  -- Drop functions that reference reserved_crew.start_at or reserved_crew.end_at
  FOR func_rec IN
    SELECT p.proname, p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND pg_get_functiondef(p.oid) ILIKE '%reserved_crew%'
      AND (
        pg_get_functiondef(p.oid) ILIKE '%NEW.start_at%'
        OR pg_get_functiondef(p.oid) ILIKE '%NEW.end_at%'
        OR pg_get_functiondef(p.oid) ILIKE '%.start_at%'
        OR pg_get_functiondef(p.oid) ILIKE '%.end_at%'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', func_rec.proname);
    RAISE NOTICE 'Dropped function: %', func_rec.proname;
  END LOOP;
END $$;

