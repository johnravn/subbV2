-- Add offers system for job management
-- This migration creates tables for technical and pretty offers,
-- public access via tokens, versioning, and acceptance tracking

-- Create enum types
DO $$ BEGIN
  CREATE TYPE offer_type AS ENUM ('technical', 'pretty');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'superseded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pretty_section_type AS ENUM ('hero', 'problem', 'solution', 'benefits', 'testimonial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main job_offers table
CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_type offer_type NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  status offer_status NOT NULL DEFAULT 'draft',
  access_token TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  days_of_use INTEGER NOT NULL DEFAULT 1,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  vat_percent INTEGER NOT NULL DEFAULT 25 CHECK (vat_percent IN (0, 25)),
  equipment_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  crew_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  transport_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_before_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_after_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_with_vat NUMERIC(10,2) NOT NULL DEFAULT 0,
  based_on_offer_id UUID REFERENCES job_offers(id) ON DELETE SET NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_by_email TEXT,
  accepted_by_phone TEXT,
  CONSTRAINT fk_job_offers_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_job_offers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_job_offers_based_on FOREIGN KEY (based_on_offer_id) REFERENCES job_offers(id) ON DELETE SET NULL
);

-- Index for fast access token lookups
CREATE INDEX IF NOT EXISTS idx_job_offers_access_token ON job_offers(access_token);
CREATE INDEX IF NOT EXISTS idx_job_offers_job_id ON job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_company_id ON job_offers(company_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_offers_updated_at
BEFORE UPDATE ON job_offers
FOR EACH ROW
EXECUTE FUNCTION update_job_offers_updated_at();

-- Equipment groups for organizing equipment in offers
CREATE TABLE IF NOT EXISTS offer_equipment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_offer_equipment_groups_offer FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offer_equipment_groups_offer_id ON offer_equipment_groups(offer_id);

-- Equipment items in offers
CREATE TABLE IF NOT EXISTS offer_equipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_group_id UUID NOT NULL REFERENCES offer_equipment_groups(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_offer_equipment_items_group FOREIGN KEY (offer_group_id) REFERENCES offer_equipment_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_equipment_items_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_offer_equipment_items_group_id ON offer_equipment_items(offer_group_id);

-- Crew items in offers
CREATE TABLE IF NOT EXISTS offer_crew_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  crew_count INTEGER NOT NULL DEFAULT 1 CHECK (crew_count > 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_offer_crew_items_offer FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE CASCADE,
  CONSTRAINT chk_offer_crew_items_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_offer_crew_items_offer_id ON offer_crew_items(offer_id);

-- Transport items in offers
CREATE TABLE IF NOT EXISTS offer_transport_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  vehicle_name TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_offer_transport_items_offer FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_transport_items_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT chk_offer_transport_items_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_offer_transport_items_offer_id ON offer_transport_items(offer_id);

-- Pretty offer sections for rich content
CREATE TABLE IF NOT EXISTS offer_pretty_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  section_type pretty_section_type NOT NULL,
  title TEXT,
  content TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_offer_pretty_sections_offer FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offer_pretty_sections_offer_id ON offer_pretty_sections(offer_id);

-- RLS Policies

-- Enable RLS on all offer tables
ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_equipment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_crew_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_transport_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_pretty_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Company members can CRUD their company's offers
CREATE POLICY "Company members can manage their company's offers"
ON job_offers
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM company_expansions
    WHERE user_id = auth.uid() AND deleted = false
  )
);

CREATE POLICY "Company members can manage their company's equipment groups"
ON offer_equipment_groups
FOR ALL
USING (
  offer_id IN (
    SELECT o.id FROM job_offers o
    JOIN company_expansions ce ON o.company_id = ce.company_id
    WHERE ce.user_id = auth.uid() AND ce.deleted = false
  )
);

CREATE POLICY "Company members can manage their company's equipment items"
ON offer_equipment_items
FOR ALL
USING (
  offer_group_id IN (
    SELECT og.id FROM offer_equipment_groups og
    JOIN job_offers o ON og.offer_id = o.id
    JOIN company_expansions ce ON o.company_id = ce.company_id
    WHERE ce.user_id = auth.uid() AND ce.deleted = false
  )
);

CREATE POLICY "Company members can manage their company's crew items"
ON offer_crew_items
FOR ALL
USING (
  offer_id IN (
    SELECT o.id FROM job_offers o
    JOIN company_expansions ce ON o.company_id = ce.company_id
    WHERE ce.user_id = auth.uid() AND ce.deleted = false
  )
);

CREATE POLICY "Company members can manage their company's transport items"
ON offer_transport_items
FOR ALL
USING (
  offer_id IN (
    SELECT o.id FROM job_offers o
    JOIN company_expansions ce ON o.company_id = ce.company_id
    WHERE ce.user_id = auth.uid() AND ce.deleted = false
  )
);

CREATE POLICY "Company members can manage their company's pretty sections"
ON offer_pretty_sections
FOR ALL
USING (
  offer_id IN (
    SELECT o.id FROM job_offers o
    JOIN company_expansions ce ON o.company_id = ce.company_id
    WHERE ce.user_id = auth.uid() AND ce.deleted = false
  )
);

-- Policy: Public SELECT on job_offers via access_token (no auth required)
CREATE POLICY "Public can view non-draft offers via access token"
ON job_offers
FOR SELECT
TO anon, authenticated
USING (
  status != 'draft' AND
  (access_token IS NOT NULL)
);

-- Policy: Public SELECT on related tables via accessible offers
CREATE POLICY "Public can view equipment groups from accessible offers"
ON offer_equipment_groups
FOR SELECT
TO anon, authenticated
USING (
  offer_id IN (
    SELECT id FROM job_offers WHERE status != 'draft'
  )
);

CREATE POLICY "Public can view equipment items from accessible offers"
ON offer_equipment_items
FOR SELECT
TO anon, authenticated
USING (
  offer_group_id IN (
    SELECT og.id FROM offer_equipment_groups og
    JOIN job_offers o ON og.offer_id = o.id
    WHERE o.status != 'draft'
  )
);

CREATE POLICY "Public can view crew items from accessible offers"
ON offer_crew_items
FOR SELECT
TO anon, authenticated
USING (
  offer_id IN (
    SELECT id FROM job_offers WHERE status != 'draft'
  )
);

CREATE POLICY "Public can view transport items from accessible offers"
ON offer_transport_items
FOR SELECT
TO anon, authenticated
USING (
  offer_id IN (
    SELECT id FROM job_offers WHERE status != 'draft'
  )
);

CREATE POLICY "Public can view pretty sections from accessible offers"
ON offer_pretty_sections
FOR SELECT
TO anon, authenticated
USING (
  offer_id IN (
    SELECT id FROM job_offers WHERE status != 'draft'
  )
);

-- Policy: Public UPDATE for acceptance (only for 'sent' offers)
CREATE POLICY "Public can accept sent offers"
ON job_offers
FOR UPDATE
TO anon, authenticated
USING (status = 'sent')
WITH CHECK (
  status = 'accepted' OR status = 'rejected' OR status = 'viewed'
);

-- Comments for documentation
COMMENT ON TABLE job_offers IS 'Technical and pretty offers for jobs. Supports versioning, public access via tokens, and customer acceptance.';
COMMENT ON TABLE offer_equipment_groups IS 'Groups for organizing equipment in offers (e.g., Audio, Lights, AV, Rigging).';
COMMENT ON TABLE offer_equipment_items IS 'Equipment items included in offers with locked prices.';
COMMENT ON TABLE offer_crew_items IS 'Crew roles and staffing requirements in offers.';
COMMENT ON TABLE offer_transport_items IS 'Transportation requirements in offers (vehicles and logistics).';
COMMENT ON TABLE offer_pretty_sections IS 'Rich content sections for pretty offers (hero, problem statement, solution, benefits, testimonials).';
