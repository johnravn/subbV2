-- Add time entries for company employees

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  job_number TEXT,
  note TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_entries_end_after_start CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_at ON time_entries(start_at DESC);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own time entries for their company (owners/employees/super_user)
DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
CREATE POLICY "Users can view their own time entries"
  ON time_entries
  FOR SELECT
  USING (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Users can insert their own time entries for their company
DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
CREATE POLICY "Users can insert their own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Users can update their own time entries for their company
DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
CREATE POLICY "Users can update their own time entries"
  ON time_entries
  FOR UPDATE
  USING (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Users can delete their own time entries for their company
DROP POLICY IF EXISTS "Users can delete their own time entries" ON time_entries;
CREATE POLICY "Users can delete their own time entries"
  ON time_entries
  FOR DELETE
  USING (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS time_entries_updated_at ON time_entries;
CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entries_updated_at();

COMMENT ON TABLE time_entries IS 'Time logging entries for company employees';
