-- Replace is_role boolean and role_category text with category enum

DO $$
BEGIN
  -- Create enum type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_period_category') THEN
    CREATE TYPE time_period_category AS ENUM ('program', 'equipment', 'crew', 'transport');
  END IF;
END $$;

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'time_periods'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.time_periods
      ADD COLUMN category time_period_category DEFAULT 'program';
  END IF;
END $$;

-- Migrate existing data:
-- - is_role = true -> category = 'crew'
-- - Titles containing "Equipment" or "Equipment period" -> category = 'equipment'
-- - Titles containing "Transport" or "Transport period" -> category = 'transport'
-- - Everything else -> category = 'program'
UPDATE public.time_periods
SET category = CASE
  WHEN is_role = true THEN 'crew'::time_period_category
  WHEN title ILIKE '%equipment%' OR title ILIKE '%equipment period%' THEN 'equipment'::time_period_category
  WHEN title ILIKE '%transport%' OR title ILIKE '%transport period%' THEN 'transport'::time_period_category
  ELSE 'program'::time_period_category
END
WHERE category IS NULL OR category = 'program'::time_period_category;

-- Make category NOT NULL after migration
ALTER TABLE public.time_periods
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'program'::time_period_category;

-- Drop is_role column (role_category is kept for crew sub-categories)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'time_periods'
      AND column_name = 'is_role'
  ) THEN
    ALTER TABLE public.time_periods DROP COLUMN is_role;
  END IF;
END $$;
