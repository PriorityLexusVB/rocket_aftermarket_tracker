-- Add appointment_confirmed_at to jobs table
-- Required by twilioInbound edge function: when a customer replies YES, the
-- confirmation timestamp is written here. Without this column the entire
-- update call would fail in strict PostgREST mode.
--
-- Rule 15 (replayability): ADD COLUMN IF NOT EXISTS is idempotent.
-- Rule 16 (anon-grant): No anon grants in this migration.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS appointment_confirmed_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  RAISE NOTICE 'jobs.appointment_confirmed_at column added (idempotent)';
END $$;
