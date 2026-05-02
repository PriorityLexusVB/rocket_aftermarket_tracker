-- 2026-05-02: Close hostile-break-tester confirmed PII leaks.
-- Discovered during the rocket migration deploy session — pre-existing prod leak
-- unrelated to migrations 20260430000001-5 but live-confirmed via anon REST probes.
--
-- Both functions were SECURITY DEFINER + anon-executable due to Postgres default
-- grant TO PUBLIC at function creation in 20250103200000_enhance_deal_management.sql.
-- They were missed by the REVOKE sweep in 20260113203000_harden_risky_public_rpcs.sql.
--
-- Live-confirmed leaks (hostile-break-tester probe with prod anon key):
--   1. get_deal_calendar_events() returned customer_name + vehicle stock_number
--      + vendor_name + scheduled times for all active jobs to anon callers.
--   2. get_deal_profit_analysis(uuid) returned revenue/cost/profit/margin given
--      a job UUID (obtainable via call #1 first).
--
-- Per Rule 16 (Anon-Grant Burden of Proof): any anon GRANT requires a 2-sentence
-- justification. None exists for either function. REVOKE with no replacement grant
-- needed — authenticated users still have access (Postgres role inheritance).
--
-- Rule 15 (replayability): pure REVOKE statements are idempotent; re-running on a
-- DB where anon already lacks the grant is a no-op.

REVOKE EXECUTE ON FUNCTION public.get_deal_calendar_events(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_deal_calendar_events(timestamptz, timestamptz) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_deal_profit_analysis(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_deal_profit_analysis(uuid) FROM anon;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_deal_calendar_events(timestamptz, timestamptz)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on get_deal_calendar_events';
  END IF;
  IF has_function_privilege('anon', 'public.get_deal_profit_analysis(uuid)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on get_deal_profit_analysis';
  END IF;
  RAISE NOTICE 'Anon REVOKE confirmed on get_deal_calendar_events + get_deal_profit_analysis';
END $$;
