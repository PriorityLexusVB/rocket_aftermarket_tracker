-- Improve notification_outbox partial index for outbox processor efficiency
-- Created: 2026-05-02
--
-- Problem with the previous index (idx_notification_outbox_retry_count):
--   Predicate was WHERE sent_at IS NULL only. This meant the outbox processor
--   had to read every unsent row — including rows already at MAX_RETRIES — and
--   filter them out in application code on every cron tick.
--
-- This replacement index adds status = 'pending' to the predicate and includes
-- retry_count as the leading column so the processor can push the MAX_RETRIES
-- guard into the index scan itself (e.g. WHERE retry_count < 3 AND sent_at IS NULL
-- AND status = 'pending'). That eliminates heap fetches for permanently-failed rows.
--
-- Rule 15 (replayability): DROP IF EXISTS + CREATE INDEX IF NOT EXISTS makes this
-- idempotent against a fresh DB or re-run scenario.
-- Rule 16 (anon-grant): No grants in this migration.

-- Drop the previous partial index from 20260430000003 (idempotent)
DROP INDEX IF EXISTS public.idx_notification_outbox_retry_count;

-- Drop the conflicting legacy index: the live DB has idx_notification_outbox_pending
-- defined as ON (not_before) WHERE sent_at IS NULL. CREATE INDEX IF NOT EXISTS silently
-- skips when the name already exists — even if the definition differs — so the optimized
-- index would never be created without removing the stale one first.
DROP INDEX IF EXISTS public.idx_notification_outbox_pending;

-- Replacement: leading retry_count column + tighter predicate
-- The processor queries: WHERE sent_at IS NULL AND status = 'pending' AND retry_count < MAX_RETRIES
-- With retry_count leading and the predicate covering status + sent_at, Postgres can
-- satisfy the entire filter from the index without a table heap scan.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending_v2
  ON public.notification_outbox(retry_count, created_at)
  WHERE sent_at IS NULL AND status = 'pending';

DO $$
BEGIN
  RAISE NOTICE 'notification_outbox index upgraded: idx_notification_outbox_pending_v2 replaces idx_notification_outbox_pending (legacy) and idx_notification_outbox_retry_count';
END $$;
