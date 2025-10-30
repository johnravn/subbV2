-- Check what the _rc_set_during function does
SELECT pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = '_rc_set_during';

