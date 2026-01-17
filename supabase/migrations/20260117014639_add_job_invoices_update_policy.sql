-- Allow users to update invoices for jobs in their company
DROP POLICY IF EXISTS "Users can update invoices for their company jobs" ON job_invoices;
CREATE POLICY "Users can update invoices for their company jobs"
  ON job_invoices
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_invoices.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_invoices.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );
