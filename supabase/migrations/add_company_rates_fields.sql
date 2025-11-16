-- Migration: Add rate and discount fields to company_expansions table
-- Created: For standard rates, discounts, and rental factors configuration

-- Add crew rate fields
ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS crew_rate_per_day NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS crew_rate_per_hour NUMERIC(10, 2);

-- Add transport rate fields
ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS transport_rate_per_day NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS transport_rate_per_hour NUMERIC(10, 2);

-- Add discount fields
ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS customer_discount_percent NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS partner_discount_percent NUMERIC(5, 2);

-- Add rental factor configuration (JSONB for flexibility)
ALTER TABLE company_expansions
ADD COLUMN IF NOT EXISTS rental_factor_config JSONB,
ADD COLUMN IF NOT EXISTS fixed_rate_start_day INTEGER,
ADD COLUMN IF NOT EXISTS fixed_rate_per_day NUMERIC(3, 2);

-- Add constraints
ALTER TABLE company_expansions
ADD CONSTRAINT check_crew_rate_per_day CHECK (crew_rate_per_day IS NULL OR crew_rate_per_day >= 0),
ADD CONSTRAINT check_crew_rate_per_hour CHECK (crew_rate_per_hour IS NULL OR crew_rate_per_hour >= 0),
ADD CONSTRAINT check_transport_rate_per_day CHECK (transport_rate_per_day IS NULL OR transport_rate_per_day >= 0),
ADD CONSTRAINT check_transport_rate_per_hour CHECK (transport_rate_per_hour IS NULL OR transport_rate_per_hour >= 0),
ADD CONSTRAINT check_customer_discount CHECK (customer_discount_percent IS NULL OR (customer_discount_percent >= 0 AND customer_discount_percent <= 100)),
ADD CONSTRAINT check_partner_discount CHECK (partner_discount_percent IS NULL OR (partner_discount_percent >= 0 AND partner_discount_percent <= 100)),
ADD CONSTRAINT check_fixed_rate_start_day CHECK (fixed_rate_start_day IS NULL OR fixed_rate_start_day >= 1),
ADD CONSTRAINT check_fixed_rate_per_day CHECK (fixed_rate_per_day IS NULL OR (fixed_rate_per_day >= 0 AND fixed_rate_per_day <= 1));

-- Add comments for documentation
COMMENT ON COLUMN company_expansions.crew_rate_per_day IS 'Standard daily rate for crew members in technical offers';
COMMENT ON COLUMN company_expansions.crew_rate_per_hour IS 'Standard hourly rate for crew members in technical offers';
COMMENT ON COLUMN company_expansions.transport_rate_per_day IS 'Standard daily rate for transport/vehicles in technical offers';
COMMENT ON COLUMN company_expansions.transport_rate_per_hour IS 'Standard hourly rate for transport/vehicles in technical offers';
COMMENT ON COLUMN company_expansions.customer_discount_percent IS 'Default discount percentage for regular customers (non-partners)';
COMMENT ON COLUMN company_expansions.partner_discount_percent IS 'Default discount percentage for partners';
COMMENT ON COLUMN company_expansions.rental_factor_config IS 'JSON object mapping days to rental factor multipliers (e.g., {"1": 1.0, "2": 1.6})';
COMMENT ON COLUMN company_expansions.fixed_rate_start_day IS 'Day number when fixed rate multiplier should start being applied';
COMMENT ON COLUMN company_expansions.fixed_rate_per_day IS 'Fixed rate multiplier (0-1) to apply after fixed_rate_start_day';

