-- Add DELETE policy for matters table
-- Users can delete matters they created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'matters'
      AND policyname = 'Users can delete matters they created'
  ) THEN
    CREATE POLICY "Users can delete matters they created"
      ON public.matters FOR DELETE
      USING (created_by_user_id = auth.uid());
  END IF;
END $$;

