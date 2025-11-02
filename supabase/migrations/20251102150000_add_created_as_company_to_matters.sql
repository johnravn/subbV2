-- Add created_as_company boolean field to matters table
-- When true, the matter should display the company name instead of the user who created it
ALTER TABLE public.matters
ADD COLUMN IF NOT EXISTS created_as_company BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.matters.created_as_company IS 'When true, the matter was created on behalf of the company and should display the company name instead of the creator''s name';

