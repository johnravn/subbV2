ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS invoice_basis text;

ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_invoice_basis_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_invoice_basis_check
CHECK (invoice_basis IN ('offer', 'bookings'));
