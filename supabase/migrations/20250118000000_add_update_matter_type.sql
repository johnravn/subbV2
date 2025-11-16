-- Add 'update' to the matter_type enum
-- This allows matters to be marked as 'update' instead of 'chat' for offer acceptances and activity notifications

-- First, check if the enum value already exists, and add it if it doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'update' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'matter_type')
  ) THEN
    ALTER TYPE matter_type ADD VALUE 'update';
  END IF;
END $$;

