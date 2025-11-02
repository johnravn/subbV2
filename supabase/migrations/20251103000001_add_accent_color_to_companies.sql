-- Add accent_color column to companies table
-- This column stores the Radix theme accent color preference for each company

-- Check if column doesn't exist before adding it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN accent_color TEXT CHECK (accent_color IN (
      'gray', 'gold', 'bronze', 'brown', 'yellow', 'amber', 'orange', 
      'tomato', 'red', 'ruby', 'pink', 'plum', 'purple', 'violet', 
      'iris', 'indigo', 'blue', 'cyan', 'teal', 'jade', 'green', 
      'grass', 'mint', 'lime', 'sky'
    ));
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN companies.accent_color IS 'Radix UI theme accent color preference for the company. Valid values are the Radix accent color names.';

