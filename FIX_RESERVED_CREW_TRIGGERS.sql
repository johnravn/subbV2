-- Find triggers and functions that reference start_at or end_at on reserved_crew

-- 1. List all triggers on reserved_crew
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'reserved_crew'
  AND event_object_schema = 'public';

-- 2. Get function definitions for triggers on reserved_crew
SELECT 
  t.tgname::text AS trigger_name,
  p.proname::text AS function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'reserved_crew'
  AND t.tgisinternal = false;

-- 2b. Get function definition for a specific function (run this separately for each function_name from query 2)
-- Replace FUNCTION_NAME with the actual function name from query 2
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'FUNCTION_NAME';

-- 3. Find function names that might reference reserved_crew (run query 3b to check)
SELECT 
  p.proname::text AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- 3b. Check a specific function for start_at/end_at references (replace FUNCTION_NAME)
-- SELECT 
--   proname::text AS function_name,
--   CASE 
--     WHEN pg_get_functiondef(oid) ILIKE '%reserved_crew%' AND (
--       pg_get_functiondef(oid) ILIKE '%NEW.start_at%'
--       OR pg_get_functiondef(oid) ILIKE '%NEW.end_at%'
--       OR pg_get_functiondef(oid) ILIKE '%start_at%'
--       OR pg_get_functiondef(oid) ILIKE '%end_at%'
--     ) THEN pg_get_functiondef(oid)
--     ELSE NULL
--   END AS function_definition
-- FROM pg_proc 
-- WHERE proname = 'FUNCTION_NAME';

