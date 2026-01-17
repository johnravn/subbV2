-- Add role_category to offer crew items for technical offers
ALTER TABLE IF EXISTS public.offer_crew_items
  ADD COLUMN IF NOT EXISTS role_category text;
