-- Add logo_path columns to companies and customers tables

-- Add logo_path to companies table (keeping for backward compatibility)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS logo_path text;

-- Add logo_light_path and logo_dark_path for company logos (SVG/PNG with transparency)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS logo_light_path text;

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS logo_dark_path text;

-- Add logo_path to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS logo_path text;

-- Create storage bucket for logos if it doesn't exist
-- Update to allow JPG (for customers), SVG, and PNG (for company light/dark logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true, -- Public bucket so logos can be accessed via public URLs
  5242880, -- 5MB file size limit (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'] -- Allow JPG (customers), PNG and SVG (company logos)
)
ON CONFLICT (id) DO UPDATE
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Dev: Allow all authenticated users to manage logos" ON storage.objects;
DROP POLICY IF EXISTS "Dev: Allow public to view logos" ON storage.objects;

-- DEVELOPMENT ONLY: Very permissive policies - allow all authenticated users to do everything
-- TODO: Replace with proper RLS policies before production

-- Allow authenticated users to do everything with logos (INSERT, UPDATE, DELETE)
CREATE POLICY "Dev: Allow all authenticated users to manage logos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

-- Allow public read access to logos
CREATE POLICY "Dev: Allow public to view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

