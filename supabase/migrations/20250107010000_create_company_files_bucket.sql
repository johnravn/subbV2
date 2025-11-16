-- Create storage bucket for company files (terms and conditions PDFs)
-- This bucket will store company-related files like terms and conditions PDFs

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company_files',
  'company_files',
  true, -- Public bucket so terms PDFs can be accessed via public URLs
  52428800, -- 50MB file size limit (50 * 1024 * 1024 bytes)
  ARRAY['application/pdf'] -- Only allow PDF files
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Note: Files are stored with path structure: {company_id}/terms/{filename}

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload company files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company files" ON storage.objects;

-- Allow authenticated users to upload files for their company
-- Check that the user is a member of the company by checking company_users table
CREATE POLICY "Users can upload company files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company_files' AND
  EXISTS (
    SELECT 1
    FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.company_id = (storage.foldername(name))[1]::uuid
  )
);

-- Allow public read access to files (for viewing terms PDFs in offers)
CREATE POLICY "Public can view company files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company_files');

-- Allow authenticated users to delete files for their company
CREATE POLICY "Users can delete company files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company_files' AND
  EXISTS (
    SELECT 1
    FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.company_id = (storage.foldername(name))[1]::uuid
  )
);

-- Allow authenticated users to update files for their company
CREATE POLICY "Users can update company files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company_files' AND
  EXISTS (
    SELECT 1
    FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.company_id = (storage.foldername(name))[1]::uuid
  )
);

