-- Check if is_role and role_category columns exist in time_periods
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'time_periods'
  AND column_name IN ('is_role', 'role_category', 'needed_count')
ORDER BY column_name;

