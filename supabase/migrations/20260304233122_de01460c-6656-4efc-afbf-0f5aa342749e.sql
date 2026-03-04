
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to mark screens offline when heartbeat > 2 minutes
CREATE OR REPLACE FUNCTION public.mark_stale_screens_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.screens
  SET status = 'offline', updated_at = now()
  WHERE status != 'offline'
    AND (
      last_heartbeat IS NULL
      OR last_heartbeat < now() - interval '2 minutes'
    );
END;
$$;

-- Schedule the function to run every minute
SELECT cron.schedule(
  'mark-stale-screens-offline',
  '* * * * *',
  'SELECT public.mark_stale_screens_offline()'
);
