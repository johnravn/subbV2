-- Add show_price_per_line field to job_offers table
-- This field controls whether prices are shown per line item in technical offers

ALTER TABLE job_offers
ADD COLUMN IF NOT EXISTS show_price_per_line BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN job_offers.show_price_per_line IS 'If true, show price per line item to customer. If false, only show total at bottom of each group.';

