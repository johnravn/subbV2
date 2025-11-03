-- Add job_number_counter to companies table
-- Default to 1000, and it will wrap around from 9999 to 1000
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS job_number_counter INTEGER DEFAULT 1000;

-- Add jobnr to jobs table (6 digits: first 4 are counter, last 2 are year)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS jobnr INTEGER;

-- Create index on jobnr for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_jobnr ON jobs(jobnr);

-- Function to generate and set job number
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  counter_value INTEGER;
  new_jobnr INTEGER;
BEGIN
  -- Get the current year (last 2 digits)
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100;
  
  -- Get and increment the counter for this company
  -- Using SELECT FOR UPDATE to prevent race conditions
  SELECT job_number_counter + 1 INTO counter_value
  FROM companies
  WHERE id = NEW.company_id
  FOR UPDATE;
  
  -- Wrap around: if counter exceeds 9999, reset to 1000
  IF counter_value > 9999 THEN
    counter_value := 1000;
  END IF;
  
  -- Ensure counter is at least 1000 (handles edge cases)
  IF counter_value < 1000 THEN
    counter_value := 1000;
  END IF;
  
  -- Update the counter in the company table
  UPDATE companies
  SET job_number_counter = counter_value
  WHERE id = NEW.company_id;
  
  -- Generate jobnr: counter (4 digits) + year (2 digits)
  -- Counter ranges from 1000 to 9999, then wraps to 1000
  -- Example: counter=1000, year=25 -> 100025
  -- Example: counter=1234, year=25 -> 123425
  new_jobnr := (LPAD(counter_value::TEXT, 4, '0') || LPAD(current_year::TEXT, 2, '0'))::INTEGER;
  
  -- Set the jobnr on the new job
  NEW.jobnr := new_jobnr;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate job number on insert
DROP TRIGGER IF EXISTS trigger_generate_job_number ON jobs;
CREATE TRIGGER trigger_generate_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.jobnr IS NULL)
  EXECUTE FUNCTION generate_job_number();

-- Backfill existing jobs with job numbers
-- This will assign job numbers to existing jobs based on their creation order per company
DO $$
DECLARE
  company_rec RECORD;
  job_rec RECORD;
  current_year INTEGER;
  counter INTEGER;
  new_jobnr INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100;
  
  -- For each company
  FOR company_rec IN SELECT id FROM companies LOOP
    counter := 1000;
    
    -- For each job in creation order (oldest first)
    FOR job_rec IN 
      SELECT id, created_at 
      FROM jobs 
      WHERE company_id = company_rec.id 
        AND jobnr IS NULL
      ORDER BY created_at ASC
    LOOP
      -- Use the job's creation year, not current year
      new_jobnr := (LPAD(counter::TEXT, 4, '0') || LPAD((EXTRACT(YEAR FROM job_rec.created_at)::INTEGER % 100)::TEXT, 2, '0'))::INTEGER;
      
      UPDATE jobs 
      SET jobnr = new_jobnr
      WHERE id = job_rec.id;
      
      counter := counter + 1;
      
      -- Wrap around: if counter exceeds 9999, reset to 1000
      IF counter > 9999 THEN
        counter := 1000;
      END IF;
    END LOOP;
    
    -- Update the company counter to the next value to use
    -- If jobs were processed, counter will be the next value after the last job
    -- If no jobs were processed, counter remains 1000 (which is the default)
    UPDATE companies
    SET job_number_counter = counter
    WHERE id = company_rec.id;
  END LOOP;
END $$;

-- Ensure all existing companies have at least 1000 as their counter
UPDATE companies
SET job_number_counter = 1000
WHERE job_number_counter IS NULL OR job_number_counter < 1000;
