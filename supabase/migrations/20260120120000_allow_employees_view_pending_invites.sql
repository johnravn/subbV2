-- Allow employees to view pending invites for their companies
-- Keeps owners/superusers and global superusers as before

DROP POLICY IF EXISTS "Users can view pending_invites for their companies" ON pending_invites;
CREATE POLICY "Users can view pending_invites for their companies"
  ON pending_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = pending_invites.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
