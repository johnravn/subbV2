-- Allow freelancers to create matters for their company
-- Uses public.is_superuser helper from prior migration

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
          AND company_users.role IN ('owner', 'employee', 'super_user', 'freelancer')
      )
      OR public.is_superuser(auth.uid())
    )
    AND created_by_user_id = auth.uid()
  );
