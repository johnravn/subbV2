-- Script to verify RLS coverage across all tables
-- Run this in Supabase SQL Editor to check which tables need RLS policies

-- Find all tables in public schema
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN (
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'pg_catalog' 
            OR schemaname = 'information_schema'
            OR schemaname = 'pg_toast'
        ) THEN 'System Table'
        ELSE 'User Table'
    END as table_type
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN 'RLS Enabled ✅'
        ELSE 'RLS Disabled ⚠️'
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(p.polname) as policy_count,
    CASE 
        WHEN COUNT(p.polname) = 0 THEN 'No Policies ⚠️'
        WHEN COUNT(p.polname) < 2 THEN 'Limited Policies ⚠️'
        ELSE 'Has Policies ✅'
    END as policy_status
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.schemaname, t.tablename
ORDER BY policy_count, tablename;

-- Summary: Tables that need attention
SELECT 
    t.tablename,
    CASE 
        WHEN c.relrowsecurity THEN 'RLS Enabled'
        ELSE 'RLS Disabled ⚠️'
    END as rls_status,
    COUNT(p.polname) as policy_count,
    CASE 
        WHEN NOT c.relrowsecurity THEN 'Enable RLS and add policies'
        WHEN COUNT(p.polname) = 0 THEN 'Add RLS policies'
        ELSE 'OK'
    END as action_needed
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE '_%'  -- Exclude Supabase internal tables
GROUP BY t.tablename, c.relrowsecurity
HAVING NOT c.relrowsecurity OR COUNT(p.polname) = 0
ORDER BY c.relrowsecurity, t.tablename;

