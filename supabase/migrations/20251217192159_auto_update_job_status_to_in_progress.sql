-- Auto-update jobs to 'in_progress' when their start_at time has passed
-- This migration creates a function and schedules it to run periodically

-- Function to update jobs to in_progress status
CREATE OR REPLACE FUNCTION auto_update_jobs_to_in_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update jobs where:
  -- 1. start_at is in the past (or now)
  -- 2. status is one that can transition to in_progress (confirmed, planned, requested)
  -- 3. status is not already in_progress, completed, canceled, invoiced, or paid
  UPDATE jobs
  SET status = 'in_progress'
  WHERE 
    start_at IS NOT NULL
    AND start_at <= NOW()
    AND status IN ('confirmed', 'planned', 'requested')
    AND status != 'in_progress';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auto_update_jobs_to_in_progress() TO authenticated;

-- Schedule the function to run every hour using pg_cron
-- Note: pg_cron extension must be enabled in Supabase
-- If pg_cron is not available, you can call this function manually or via edge function
DO $schedule$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('auto-update-jobs-in-progress');
    
    -- Schedule job to run every hour
    PERFORM cron.schedule(
      'auto-update-jobs-in-progress',
      '0 * * * *', -- Every hour at minute 0
      'SELECT auto_update_jobs_to_in_progress();'
    );
  ELSE
    -- If pg_cron is not available, log a notice
    RAISE NOTICE 'pg_cron extension not found. Function created but not scheduled. You can call auto_update_jobs_to_in_progress() manually or via edge function.';
  END IF;
END;
$schedule$;

-- Alternative: You can also call this function on-demand via RPC
-- Example: SELECT auto_update_jobs_to_in_progress();

