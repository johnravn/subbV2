-- Cascade booking statuses when a job is confirmed or canceled

CREATE OR REPLACE FUNCTION public.handle_job_status_booking_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('draft', 'planned', 'confirmed', 'canceled') THEN
    UPDATE reserved_items ri
    SET status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.booking_status
      ELSE NEW.status::text::public.booking_status
    END
    FROM time_periods tp
    WHERE tp.id = ri.time_period_id
      AND tp.job_id = NEW.id;

    UPDATE reserved_crew rc
    SET status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.booking_status
      ELSE NEW.status::text::public.booking_status
    END
    FROM time_periods tp
    WHERE tp.id = rc.time_period_id
      AND tp.job_id = NEW.id;

    UPDATE reserved_vehicles rv
    SET status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.booking_status
      ELSE NEW.status::text::public.booking_status
    END
    FROM time_periods tp
    WHERE tp.id = rv.time_period_id
      AND tp.job_id = NEW.id;

    -- Keep external requests in sync when present
    UPDATE reserved_items ri
    SET external_status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.external_request_status
      ELSE NEW.status::text::public.external_request_status
    END
    FROM time_periods tp
    WHERE tp.id = ri.time_period_id
      AND tp.job_id = NEW.id
      AND ri.external_status IS NOT NULL;

    UPDATE reserved_vehicles rv
    SET external_status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.external_request_status
      ELSE NEW.status::text::public.external_request_status
    END
    FROM time_periods tp
    WHERE tp.id = rv.time_period_id
      AND tp.job_id = NEW.id
      AND rv.external_status IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_job_status_booking_cascade ON jobs;
CREATE TRIGGER trigger_handle_job_status_booking_cascade
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (
    NEW.status IN ('draft', 'planned', 'confirmed', 'canceled')
    AND (OLD.status IS DISTINCT FROM NEW.status)
  )
  EXECUTE FUNCTION public.handle_job_status_booking_cascade();
