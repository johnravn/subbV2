-- Check Migration Status
-- Run this in Supabase SQL Editor to see what migrations are applied

-- View all applied migrations
-- First, let's see what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'supabase_migrations' 
  AND table_name = 'schema_migrations';

-- View all applied migrations (using correct columns)
SELECT 
  version,
  name
FROM supabase_migrations.schema_migrations
ORDER BY version ASC;

-- Count total migrations
SELECT COUNT(*) as total_applied_migrations 
FROM supabase_migrations.schema_migrations;

