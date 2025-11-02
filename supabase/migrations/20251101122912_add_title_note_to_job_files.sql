-- Add title and note columns to job_files table for better file descriptions
ALTER TABLE job_files
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;

-- Update comments to document the new columns
COMMENT ON COLUMN job_files.title IS 'User-friendly title for the file';
COMMENT ON COLUMN job_files.note IS 'Optional notes or description about the file';

-- Create storage bucket for job files if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job_files', 'job_files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for job_files bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job_files');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job_files');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job_files');

