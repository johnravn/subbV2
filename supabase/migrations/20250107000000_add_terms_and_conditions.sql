-- Add terms and conditions fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS terms_and_conditions_type TEXT,
ADD COLUMN IF NOT EXISTS terms_and_conditions_text TEXT,
ADD COLUMN IF NOT EXISTS terms_and_conditions_pdf_path TEXT;

-- Add check constraint to ensure valid type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_terms_and_conditions_type_check'
  ) THEN
    ALTER TABLE companies 
    ADD CONSTRAINT companies_terms_and_conditions_type_check 
      CHECK (terms_and_conditions_type IS NULL OR terms_and_conditions_type IN ('pdf', 'text'));
  END IF;
END $$;

