-- Grants for repaired feature tables so PostgREST/JWT roles can use them.
-- RLS remains the primary access control; these are table-level grants.

DO $$
BEGIN
  -- Authenticated: allow PostgREST access; RLS still gates row-level.
  IF to_regclass('public.claims') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.claims TO authenticated;
  END IF;

  IF to_regclass('public.claim_attachments') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.claim_attachments TO authenticated;
  END IF;

  IF to_regclass('public.filter_presets') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.filter_presets TO authenticated;
  END IF;

  IF to_regclass('public.notification_outbox') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_outbox TO authenticated;
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_preferences TO authenticated;
  END IF;

  IF to_regclass('public.sms_templates') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sms_templates TO authenticated;
  END IF;

  IF to_regclass('public.vehicle_products') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_products TO authenticated;
  END IF;

  -- Anon: enable guest submission paths only where an RLS policy already exists.
  -- (We intentionally do NOT grant anon SELECT.)
  IF to_regclass('public.claims') IS NOT NULL THEN
    GRANT INSERT ON TABLE public.claims TO anon;
  END IF;

  IF to_regclass('public.claim_attachments') IS NOT NULL THEN
    GRANT INSERT ON TABLE public.claim_attachments TO anon;
  END IF;
END
$$;
