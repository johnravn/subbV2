-- Add crew billing fields for hourly/daily pricing.
alter table if exists offer_crew_items
  add column if not exists billing_type text,
  add column if not exists hourly_rate numeric,
  add column if not exists hours_per_day numeric;

-- Backfill existing rows to daily billing.
update offer_crew_items
set billing_type = 'daily'
where billing_type is null;
