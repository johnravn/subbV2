-- Run this in Supabase SQL Editor to reset migration history
-- This allows us to start fresh with a new baseline migration

-- Clear all migration history
TRUNCATE TABLE supabase_migrations.schema_migrations;

-- After running this, you can create a baseline migration with:
-- npx supabase db pull

