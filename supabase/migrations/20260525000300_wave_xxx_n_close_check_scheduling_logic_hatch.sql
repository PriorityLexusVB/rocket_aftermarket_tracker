-- Wave XXX-N: close the `requires_scheduling IS NULL` escape hatch in
-- check_scheduling_logic. The original constraint accepted three arms:
--   (requires_scheduling = true AND promised_date IS NOT NULL) OR
--   (requires_scheduling = false AND no_schedule_reason IS NOT NULL AND ...) OR
--   (requires_scheduling IS NULL)  <-- escape hatch
--
-- Any client that explicitly sets requires_scheduling = NULL bypasses both
-- branches. Latent data integrity gap (caught by calendar-flow-specialist
-- on the Wave XXX audit). Live: 0 rows currently NULL — safe to close.
--
-- Rule 15 replayability: idempotent (DROP CONSTRAINT IF EXISTS, conditional NOT NULL).

UPDATE public.job_parts SET requires_scheduling = true WHERE requires_scheduling IS NULL;

ALTER TABLE public.job_parts ALTER COLUMN requires_scheduling SET DEFAULT true;
ALTER TABLE public.job_parts ALTER COLUMN requires_scheduling SET NOT NULL;

ALTER TABLE public.job_parts DROP CONSTRAINT IF EXISTS check_scheduling_logic;
ALTER TABLE public.job_parts ADD CONSTRAINT check_scheduling_logic CHECK (
  (requires_scheduling = true AND promised_date IS NOT NULL) OR
  (requires_scheduling = false AND no_schedule_reason IS NOT NULL AND no_schedule_reason != '')
);
