-- Set default accent_color to 'indigo' for all companies that have NULL accent_color
UPDATE companies
SET accent_color = 'indigo'
WHERE accent_color IS NULL;

COMMENT ON COLUMN companies.accent_color IS 'Radix UI theme accent color preference for the company. Defaults to indigo if not set.';

