-- Automatically add company members as recipients to the welcome matter
-- This ensures every user added to a company receives the welcome message in their matter inbox
-- Works for:
--   - New users signing up and being added to a company (via pending invites)
--   - Existing users being added to a new company (directly via add_member_or_invite RPC)
--   - Any other way a user gets added to company_users table

CREATE OR REPLACE FUNCTION add_user_to_welcome_matter()
RETURNS TRIGGER AS $$
DECLARE
  welcome_matter_id UUID;
BEGIN
  -- Find the welcome matter for the company the user is being added to
  -- Welcome matters have title 'Welcome to our company' and type 'announcement'
  SELECT id INTO welcome_matter_id
  FROM matters
  WHERE company_id = NEW.company_id
    AND title = 'Welcome to our company'
    AND matter_type = 'announcement'
  LIMIT 1;

  -- If a welcome matter exists for this company, add the user as a recipient
  -- This works for both new and existing users being added to any company
  IF welcome_matter_id IS NOT NULL THEN
    -- Insert recipient if it doesn't already exist (avoid duplicates)
    -- ON CONFLICT handles case where user might already be a recipient (shouldn't happen but safe)
    INSERT INTO matter_recipients (matter_id, user_id, status)
    VALUES (welcome_matter_id, NEW.user_id, 'pending')
    ON CONFLICT (matter_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Create trigger that runs after ANY user is added to ANY company
-- This fires for both new and existing users, regardless of how they're added
DROP TRIGGER IF EXISTS trigger_add_user_to_welcome_matter ON company_users;
CREATE TRIGGER trigger_add_user_to_welcome_matter
  AFTER INSERT ON company_users
  FOR EACH ROW
  EXECUTE FUNCTION add_user_to_welcome_matter();

-- Also handle the case where a welcome matter is created after users already exist
-- This function can be called manually if needed, or we could trigger it when a welcome matter is created
CREATE OR REPLACE FUNCTION add_existing_users_to_welcome_matter(p_company_id UUID, p_matter_id UUID)
RETURNS void AS $$
BEGIN
  -- Add all existing company members as recipients to the welcome matter
  INSERT INTO matter_recipients (matter_id, user_id, status)
  SELECT p_matter_id, cu.user_id, 'pending'
  FROM company_users cu
  WHERE cu.company_id = p_company_id
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1
      FROM matter_recipients mr
      WHERE mr.matter_id = p_matter_id
        AND mr.user_id = cu.user_id
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

