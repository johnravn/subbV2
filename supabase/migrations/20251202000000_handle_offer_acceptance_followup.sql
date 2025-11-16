-- Ensure jobs, matters, and activity log are updated when an offer is accepted

CREATE OR REPLACE FUNCTION handle_offer_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  previous_status public.job_status;
  job_title TEXT;
  project_lead_id UUID;
  creator_user_id UUID;
  new_matter_id UUID;
  status_metadata JSONB;
  accepted_by_name TEXT;
  accepted_phone TEXT;
BEGIN
  -- Only proceed when status transitions into accepted
  -- Fetch job details needed for subsequent updates
  SELECT status, title, project_lead_user_id
  INTO previous_status, job_title, project_lead_id
  FROM jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Update job status to confirmed when needed
  IF previous_status IS DISTINCT FROM 'confirmed' THEN
    UPDATE jobs
    SET status = 'confirmed'
    WHERE id = NEW.job_id;
  END IF;

  -- Choose a creator user (prefer owner, then super_user, then employee, fallback to project lead)
  SELECT cu.user_id
  INTO creator_user_id
  FROM company_users cu
  WHERE cu.company_id = NEW.company_id
  ORDER BY
    CASE cu.role
      WHEN 'owner' THEN 1
      WHEN 'super_user' THEN 2
      WHEN 'employee' THEN 3
      WHEN 'freelancer' THEN 4
      ELSE 5
    END
  LIMIT 1;

  IF creator_user_id IS NULL THEN
    creator_user_id := project_lead_id;
  END IF;

  -- Prepare metadata for activity log
  status_metadata := jsonb_build_object(
    'job_id', NEW.job_id,
    'job_title', job_title,
    'previous_status', previous_status,
    'new_status', 'confirmed',
    'offer_id', NEW.id
  );

  -- Log activity for latest feed when we have a creator user
  IF creator_user_id IS NOT NULL THEN
    INSERT INTO activity_log (
      company_id,
      activity_type,
      created_by_user_id,
      title,
      metadata
    ) VALUES (
      NEW.company_id,
      'job_status_changed',
      creator_user_id,
      job_title,
      status_metadata
    );
  END IF;

  -- Send a matter to the project lead when available
  IF project_lead_id IS NOT NULL THEN
    accepted_by_name := coalesce(nullif(trim(NEW.accepted_by_name), ''), 'Customer');
    accepted_phone := coalesce(nullif(trim(NEW.accepted_by_phone), ''), NULL);

    INSERT INTO matters (
      company_id,
      created_by_user_id,
      matter_type,
      title,
      content,
      job_id,
      created_as_company,
      metadata
    ) VALUES (
      NEW.company_id,
      coalesce(creator_user_id, project_lead_id),
      'chat',
      'Offer accepted: ' || coalesce(job_title, 'Untitled job'),
      CASE
        WHEN accepted_phone IS NULL THEN
          accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '".'
        ELSE
          accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || accepted_phone || '.'
      END,
      NEW.job_id,
      TRUE,
      jsonb_build_object(
        'offer_id', NEW.id,
        'offer_version', NEW.version_number,
        'accepted_at', NEW.accepted_at,
        'accepted_by_name', NEW.accepted_by_name,
        'accepted_by_phone', NEW.accepted_by_phone
      )
    )
    RETURNING id INTO new_matter_id;

    INSERT INTO matter_recipients (
      matter_id,
      user_id,
      status
    ) VALUES (
      new_matter_id,
      project_lead_id,
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;


DROP TRIGGER IF EXISTS trigger_handle_offer_acceptance ON job_offers;
CREATE TRIGGER trigger_handle_offer_acceptance
  AFTER UPDATE ON job_offers
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted'))
  EXECUTE FUNCTION handle_offer_acceptance();

