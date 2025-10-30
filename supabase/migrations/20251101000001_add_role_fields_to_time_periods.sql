-- Add is_role and role_category to time_periods table

DO $$
BEGIN
  -- Add is_role boolean column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'time_periods' 
      AND column_name = 'is_role'
  ) THEN
    ALTER TABLE public.time_periods 
      ADD COLUMN is_role boolean DEFAULT false;
  END IF;

  -- Add role_category text column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'time_periods' 
      AND column_name = 'role_category'
  ) THEN
    ALTER TABLE public.time_periods 
      ADD COLUMN role_category text;
  END IF;
END $$;

