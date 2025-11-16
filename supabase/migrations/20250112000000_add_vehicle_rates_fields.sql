-- Migration: Add vehicle daily rate, distance rate, and distance increment fields
-- Replaces the old transport_rate_per_day and transport_rate_per_hour with:
-- - vehicle_daily_rate: Fixed daily rate for vehicles
-- - vehicle_distance_rate: Rate per distance increment
-- - vehicle_distance_increment: Distance increment in km (default 150)

-- Add new vehicle rate fields
ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS vehicle_daily_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS vehicle_distance_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS vehicle_distance_increment INTEGER DEFAULT 150;

-- Add constraints
ALTER TABLE company_expansions
ADD CONSTRAINT check_vehicle_daily_rate CHECK (vehicle_daily_rate IS NULL OR vehicle_daily_rate >= 0),
ADD CONSTRAINT check_vehicle_distance_rate CHECK (vehicle_distance_rate IS NULL OR vehicle_distance_rate >= 0),
ADD CONSTRAINT check_vehicle_distance_increment CHECK (vehicle_distance_increment IS NULL OR vehicle_distance_increment > 0);

-- Add comments for documentation
COMMENT ON COLUMN company_expansions.vehicle_daily_rate IS 'Fixed daily rate for vehicles in technical offers';
COMMENT ON COLUMN company_expansions.vehicle_distance_rate IS 'Rate per distance increment for vehicles in technical offers';
COMMENT ON COLUMN company_expansions.vehicle_distance_increment IS 'Distance increment in kilometers for calculating distance-based rates (default: 150)';

