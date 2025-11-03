-- Add 'job_status_changed' to the activity_type enum
-- This allows logging job status changes (to confirmed, canceled, or paid) as activities

-- Check if the value already exists before adding it (for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'job_status_changed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activity_type')
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'job_status_changed';
    END IF;
END $$;

