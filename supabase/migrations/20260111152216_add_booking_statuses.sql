-- Add booking statuses: Planned, Confirmed, Canceled
-- This migration adds unified booking status support for equipment, crew, and transport bookings

-- 1. Create new unified booking_status enum
CREATE TYPE "public"."booking_status" AS ENUM (
    'planned',
    'confirmed',
    'canceled'
);

-- 2. Add 'canceled' to external_request_status for backward compatibility
ALTER TYPE "public"."external_request_status" ADD VALUE IF NOT EXISTS 'canceled';

-- 3. Add status column to reserved_items (for all equipment bookings)
ALTER TABLE "public"."reserved_items"
    ADD COLUMN IF NOT EXISTS "status" "public"."booking_status" DEFAULT 'planned'::"public"."booking_status" NOT NULL;

-- 4. Add status column to reserved_vehicles (for all vehicle bookings)
ALTER TABLE "public"."reserved_vehicles"
    ADD COLUMN IF NOT EXISTS "status" "public"."booking_status" DEFAULT 'planned'::"public"."booking_status" NOT NULL;

-- 5. Migrate reserved_crew.status from crew_request_status to booking_status
-- First, add a temporary column
ALTER TABLE "public"."reserved_crew"
    ADD COLUMN IF NOT EXISTS "status_new" "public"."booking_status" DEFAULT 'planned'::"public"."booking_status";

-- Migrate existing data:
-- 'accepted' -> 'confirmed'
-- 'planned' -> 'planned'
-- 'requested' -> 'planned' (treat as planned)
-- 'declined' -> 'canceled' (treat declined as canceled)
UPDATE "public"."reserved_crew"
SET "status_new" = CASE
    WHEN "status" = 'accepted' THEN 'confirmed'::"public"."booking_status"
    WHEN "status" = 'planned' THEN 'planned'::"public"."booking_status"
    WHEN "status" = 'requested' THEN 'planned'::"public"."booking_status"
    WHEN "status" = 'declined' THEN 'canceled'::"public"."booking_status"
    ELSE 'planned'::"public"."booking_status"
END;

-- Drop the old column and rename the new one
ALTER TABLE "public"."reserved_crew"
    DROP COLUMN IF EXISTS "status";

ALTER TABLE "public"."reserved_crew"
    RENAME COLUMN "status_new" TO "status";

-- Make status NOT NULL
ALTER TABLE "public"."reserved_crew"
    ALTER COLUMN "status" SET NOT NULL;

-- 6. Update default values to ensure all new bookings start as 'planned'
ALTER TABLE "public"."reserved_items"
    ALTER COLUMN "status" SET DEFAULT 'planned'::"public"."booking_status";

ALTER TABLE "public"."reserved_vehicles"
    ALTER COLUMN "status" SET DEFAULT 'planned'::"public"."booking_status";

ALTER TABLE "public"."reserved_crew"
    ALTER COLUMN "status" SET DEFAULT 'planned'::"public"."booking_status";

-- 7. Add comments for documentation
COMMENT ON TYPE "public"."booking_status" IS 'Unified booking status: planned (initial/tentative), confirmed (booked), canceled (no longer needed)';
COMMENT ON COLUMN "public"."reserved_items"."status" IS 'Booking status: planned, confirmed, or canceled';
COMMENT ON COLUMN "public"."reserved_vehicles"."status" IS 'Booking status: planned, confirmed, or canceled';
COMMENT ON COLUMN "public"."reserved_crew"."status" IS 'Booking status: planned, confirmed, or canceled';

