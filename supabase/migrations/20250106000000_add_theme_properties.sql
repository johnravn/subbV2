-- Add theme properties to companies table for Radix UI customization
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS theme_radius TEXT DEFAULT 'small',
ADD COLUMN IF NOT EXISTS theme_gray_color TEXT DEFAULT 'gray',
ADD COLUMN IF NOT EXISTS theme_panel_background TEXT DEFAULT 'translucent',
ADD COLUMN IF NOT EXISTS theme_scaling TEXT DEFAULT '100%';

-- Add check constraints to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_theme_radius_check'
  ) THEN
    ALTER TABLE companies 
    ADD CONSTRAINT companies_theme_radius_check 
      CHECK (theme_radius IS NULL OR theme_radius IN ('none', 'small', 'medium', 'large', 'full'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_theme_gray_color_check'
  ) THEN
    ALTER TABLE companies 
    ADD CONSTRAINT companies_theme_gray_color_check 
      CHECK (theme_gray_color IS NULL OR theme_gray_color IN ('gray', 'mauve', 'slate', 'sage', 'olive', 'sand'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_theme_panel_background_check'
  ) THEN
    ALTER TABLE companies 
    ADD CONSTRAINT companies_theme_panel_background_check 
      CHECK (theme_panel_background IS NULL OR theme_panel_background IN ('solid', 'translucent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_theme_scaling_check'
  ) THEN
    ALTER TABLE companies 
    ADD CONSTRAINT companies_theme_scaling_check 
      CHECK (theme_scaling IS NULL OR theme_scaling IN ('90%', '95%', '100%', '105%', '110%'));
  END IF;
END $$;

