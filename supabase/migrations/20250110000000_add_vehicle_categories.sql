-- Add vehicle category enum and update vehicles and offer_transport_items tables

-- Create vehicle_category enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_category') THEN
        CREATE TYPE vehicle_category AS ENUM (
  'passenger_car_small',
  'passenger_car_medium',
  'passenger_car_big',
  'van_small',
  'van_medium',
  'van_big',
  'C1',
  'C1E',
  'C',
  'CE'
        );
    END IF;
END $$;

-- Add vehicle_category column to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS vehicle_category vehicle_category;

-- Add vehicle_category, distance_km, and keep price fields to offer_transport_items
ALTER TABLE offer_transport_items
ADD COLUMN IF NOT EXISTS vehicle_category vehicle_category,
ADD COLUMN IF NOT EXISTS distance_km numeric(10, 2);

-- Add comment to explain the new fields
COMMENT ON COLUMN offer_transport_items.vehicle_category IS 'Category of vehicle needed for this offer item';
COMMENT ON COLUMN offer_transport_items.distance_km IS 'Approximate distance in kilometers for this transport item';

