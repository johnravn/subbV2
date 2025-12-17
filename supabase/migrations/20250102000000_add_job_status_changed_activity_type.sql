-- Add 'job_status_changed' to the activity_type enum
-- This allows logging job status changes (to confirmed, canceled, or paid) as activities
-- Note: The enum is created in the base schema migration, so we only need to add the value if it doesn't exist

DO $$
BEGIN
    -- Check if the value already exists before adding it (for idempotency)
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'job_status_changed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activity_type')
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'job_status_changed';
    END IF;
END $$;

