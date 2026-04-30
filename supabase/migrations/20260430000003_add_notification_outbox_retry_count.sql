-- Add retry_count to notification_outbox for exponential-backoff retry logic
-- Created: 2026-04-30
--
-- The processOutbox edge function previously marked notifications 'failed' on the
-- first Twilio error with no retry opportunity. This column enables up to 3 attempts
-- before permanently marking a row failed.
--
-- Rule 15 (replayability): ADD COLUMN IF NOT EXISTS guard makes this idempotent.
-- Rule 16 (anon-grant): No anon grants in this migration.

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Index to efficiently skip permanently-failed rows on every cron tick.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_retry_count
  ON public.notification_outbox(retry_count)
  WHERE sent_at IS NULL;

DO $$
BEGIN
  RAISE NOTICE 'notification_outbox.retry_count column added (default 0)';
END $$;
