-- Add vote options to matters table
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_custom_responses BOOLEAN NOT NULL DEFAULT true;

-- Create storage bucket for matter files if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('matter_files', 'matter_files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for matter_files bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload matter files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'matter_files');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read matter files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'matter_files');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete matter files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'matter_files');

-- Create matter_files table for file attachments
CREATE TABLE IF NOT EXISTS public.matter_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  title TEXT,
  note TEXT,
  uploaded_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for matter_files
CREATE INDEX IF NOT EXISTS idx_matter_files_matter_id ON public.matter_files(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_files_uploaded_by_user_id ON public.matter_files(uploaded_by_user_id);

-- Enable RLS on matter_files
ALTER TABLE public.matter_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matter_files
-- Users can view files for matters they can see
CREATE POLICY "Users can view matter files"
  ON public.matter_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_files.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- Users can insert files for matters they can see
CREATE POLICY "Users can insert matter files"
  ON public.matter_files FOR INSERT
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_files.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- Users can update their own files
CREATE POLICY "Users can update their own files"
  ON public.matter_files FOR UPDATE
  USING (uploaded_by_user_id = auth.uid())
  WITH CHECK (uploaded_by_user_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "Users can delete their own files"
  ON public.matter_files FOR DELETE
  USING (uploaded_by_user_id = auth.uid());

