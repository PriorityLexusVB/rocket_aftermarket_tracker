-- Wave XXX-AH: enable Supabase realtime on the public.claims table so the
-- navbar New Claims pill lights up the moment a customer submits a guest
-- claim. Without this, the channel subscribes silently and never delivers
-- INSERT/UPDATE events.
--
-- Applied LIVE 2026-06-06 ~13:55 ET via Supabase Management API
-- (project ogjtmtndgiqqdtwatsue). This file is the repo-tracked equivalent
-- so a fresh DB pull stays in sync.
--
-- Codex BLOCKER B verified empirically — pre-apply query against
-- pg_publication_tables for {pubname=supabase_realtime, schema=public,
-- table=claims} returned ZERO rows. Post-apply: 1 row. Channel subscriptions
-- on src/services/claimsService.js:subscribeToClaims now receive events.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.claims;
    RAISE NOTICE 'Wave XXX-AH: added public.claims to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'Wave XXX-AH: public.claims already in supabase_realtime publication — no-op.';
  END IF;
END $$;

-- Self-verifying assertion: publication membership confirmed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'claims'
  ) THEN
    RAISE EXCEPTION 'Wave XXX-AH: claims table NOT in supabase_realtime publication after ALTER. Migration failed.';
  END IF;
  RAISE NOTICE 'Wave XXX-AH assertion passed: claims is in supabase_realtime.';
END $$;
