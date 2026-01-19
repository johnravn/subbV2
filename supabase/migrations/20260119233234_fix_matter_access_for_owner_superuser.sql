-- Ensure owners and superusers can manage matters like employees (and more)
-- Uses public.is_superuser helper from prior migration to avoid RLS recursion

-- ============================================================================
-- MATTERS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matters for their company" ON public.matters;
CREATE POLICY "Users can view matters for their company"
  ON public.matters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
    )
    OR public.is_superuser(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create matters for their company" ON public.matters;
CREATE POLICY "Users can create matters for their company"
  ON public.matters
  FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.company_users
        WHERE company_users.user_id = auth.uid()
          AND company_users.company_id = matters.company_id
          AND company_users.role IN ('owner', 'employee', 'super_user')
      )
      OR public.is_superuser(auth.uid())
    )
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update matters they created" ON public.matters;
CREATE POLICY "Users can update matters they created"
  ON public.matters
  FOR UPDATE
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
        AND company_users.role IN ('owner', 'super_user')
    )
    OR public.is_superuser(auth.uid())
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
        AND company_users.role IN ('owner', 'super_user')
    )
    OR public.is_superuser(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete matters they created" ON public.matters;
CREATE POLICY "Users can delete matters they created"
  ON public.matters
  FOR DELETE
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
        AND company_users.role IN ('owner', 'super_user')
    )
    OR public.is_superuser(auth.uid())
  );

-- ============================================================================
-- MATTER FILES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter files" ON public.matter_files;
CREATE POLICY "Users can view matter files"
  ON public.matter_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matters
      WHERE matters.id = matter_files.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
    OR public.is_superuser(auth.uid())
  );

-- ============================================================================
-- MATTER MESSAGES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter messages" ON public.matter_messages;
CREATE POLICY "Users can view matter messages"
  ON public.matter_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matters
      WHERE matters.id = matter_messages.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
    OR public.is_superuser(auth.uid())
  );

-- ============================================================================
-- MATTER RECIPIENTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter recipients" ON public.matter_recipients;
CREATE POLICY "Users can view matter recipients"
  ON public.matter_recipients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matters
      WHERE matters.id = matter_recipients.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
    OR public.is_superuser(auth.uid())
  );

-- ============================================================================
-- MATTER RESPONSES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter responses" ON public.matter_responses;
CREATE POLICY "Users can view matter responses"
  ON public.matter_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matters
      WHERE matters.id = matter_responses.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
    OR public.is_superuser(auth.uid())
  );
