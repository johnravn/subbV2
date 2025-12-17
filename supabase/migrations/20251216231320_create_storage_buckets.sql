-- Create storage bucket for vehicle images
-- This bucket stores vehicle photos

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle_images',
  'vehicle_images',
  true, -- Public bucket so images can be accessed via public URLs
  10485760, -- 10MB file size limit (10 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] -- Common image formats
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Files are stored with path structure: {company_id}/{filename}

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can manage vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vehicle images" ON storage.objects;

-- Allow authenticated users to upload/update/delete vehicle images for their company
CREATE POLICY "Users can manage vehicle images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'vehicle_images' AND
  EXISTS (
    SELECT 1
    FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.company_id = (storage.foldername(name))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'vehicle_images' AND
  EXISTS (
    SELECT 1
    FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.company_id = (storage.foldername(name))[1]::uuid
  )
);

-- Allow public read access to vehicle images
CREATE POLICY "Public can view vehicle images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vehicle_images');

