-- Migration: Remove old transport_rate_per_day and transport_rate_per_hour fields
-- These have been replaced by vehicle_daily_rate, vehicle_distance_rate, and vehicle_distance_increment

-- Drop constraints first
ALTER TABLE company_expansions
DROP CONSTRAINT IF EXISTS check_transport_rate_per_day,
DROP CONSTRAINT IF EXISTS check_transport_rate_per_hour;

-- Drop columns
ALTER TABLE company_expansions
DROP COLUMN IF EXISTS transport_rate_per_day,
DROP COLUMN IF EXISTS transport_rate_per_hour;

