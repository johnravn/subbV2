-- Add columns for offer rejection and revision tracking

-- Add rejection columns
ALTER TABLE job_offers
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by_name TEXT,
ADD COLUMN IF NOT EXISTS rejected_by_phone TEXT,
ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

-- Add revision columns
ALTER TABLE job_offers
ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revision_requested_by_name TEXT,
ADD COLUMN IF NOT EXISTS revision_requested_by_phone TEXT,
ADD COLUMN IF NOT EXISTS revision_comment TEXT;

-- Add index for filtering rejected offers
CREATE INDEX IF NOT EXISTS idx_job_offers_rejected_at ON job_offers(rejected_at) WHERE rejected_at IS NOT NULL;

-- Add index for filtering revision requests
CREATE INDEX IF NOT EXISTS idx_job_offers_revision_requested_at ON job_offers(revision_requested_at) WHERE revision_requested_at IS NOT NULL;

-- Update offer status enum to include new statuses if needed
-- Note: We'll use 'rejected' status which already exists, and handle revision requests separately

COMMENT ON COLUMN job_offers.rejected_at IS 'Timestamp when offer was rejected';
COMMENT ON COLUMN job_offers.rejected_by_name IS 'Full name of person who rejected the offer';
COMMENT ON COLUMN job_offers.rejected_by_phone IS 'Phone number of person who rejected the offer';
COMMENT ON COLUMN job_offers.rejection_comment IS 'Optional comment explaining why the offer was rejected';
COMMENT ON COLUMN job_offers.revision_requested_at IS 'Timestamp when revision was requested';
COMMENT ON COLUMN job_offers.revision_requested_by_name IS 'Full name of person requesting revision';
COMMENT ON COLUMN job_offers.revision_requested_by_phone IS 'Phone number of person requesting revision';
COMMENT ON COLUMN job_offers.revision_comment IS 'Comment explaining what changes are requested';

