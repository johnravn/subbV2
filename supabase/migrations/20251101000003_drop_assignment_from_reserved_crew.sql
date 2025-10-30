-- Drop assignment column from reserved_crew table

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'reserved_crew' 
      AND column_name = 'assignment'
  ) THEN
    ALTER TABLE public.reserved_crew DROP COLUMN assignment;
  END IF;
END $$;

