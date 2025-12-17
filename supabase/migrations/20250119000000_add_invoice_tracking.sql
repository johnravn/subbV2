-- Add invoice tracking table to store invoices created via Conta API

CREATE TABLE IF NOT EXISTS job_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES job_offers(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL,
  conta_invoice_id TEXT, -- Invoice ID returned from Conta API
  conta_customer_id INTEGER, -- Customer ID in Conta
  invoice_basis TEXT NOT NULL CHECK (invoice_basis IN ('offer', 'bookings')),
  invoice_data JSONB NOT NULL, -- Full invoice data sent to Conta
  conta_response JSONB, -- Full response from Conta API
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'failed')),
  error_message TEXT,
  created_by_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_invoices_job_id ON job_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_job_invoices_offer_id ON job_invoices(offer_id);
CREATE INDEX IF NOT EXISTS idx_job_invoices_status ON job_invoices(status);
CREATE INDEX IF NOT EXISTS idx_job_invoices_created_at ON job_invoices(created_at DESC);

-- RLS policies
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;

-- Users can view invoices for jobs in their company
DROP POLICY IF EXISTS "Users can view invoices for their company jobs" ON job_invoices;
CREATE POLICY "Users can view invoices for their company jobs"
  ON job_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_invoices.job_id
        AND cu.user_id = auth.uid()
    )
  );

-- Users with appropriate permissions can create invoices
DROP POLICY IF EXISTS "Users can create invoices for their company jobs" ON job_invoices;
CREATE POLICY "Users can create invoices for their company jobs"
  ON job_invoices
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_invoices.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_job_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_invoices_updated_at ON job_invoices;
CREATE TRIGGER job_invoices_updated_at
  BEFORE UPDATE ON job_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_job_invoices_updated_at();

-- Add comment
COMMENT ON TABLE job_invoices IS 'Tracks invoices created via Conta API integration';
COMMENT ON COLUMN job_invoices.invoice_data IS 'Full invoice payload sent to Conta API';
COMMENT ON COLUMN job_invoices.conta_response IS 'Full response received from Conta API';
COMMENT ON COLUMN job_invoices.conta_invoice_id IS 'Invoice ID returned from Conta (if available)';

