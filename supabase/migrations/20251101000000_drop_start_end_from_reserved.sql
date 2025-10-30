-- Drop start_at and end_at from reservation tables; rely on time_periods instead
-- Safe checks to avoid errors if columns already dropped

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_items' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE public.reserved_items DROP COLUMN start_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_items' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE public.reserved_items DROP COLUMN end_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_crew' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE public.reserved_crew DROP COLUMN start_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_crew' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE public.reserved_crew DROP COLUMN end_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_vehicles' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE public.reserved_vehicles DROP COLUMN start_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reserved_vehicles' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE public.reserved_vehicles DROP COLUMN end_at;
  END IF;
END $$;

-- Optional: add needed_count to time_periods for role capacity if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'time_periods' AND column_name = 'needed_count'
  ) THEN
    ALTER TABLE public.time_periods ADD COLUMN needed_count integer;
    UPDATE public.time_periods SET needed_count = 1 WHERE needed_count IS NULL;
  END IF;
END $$;


