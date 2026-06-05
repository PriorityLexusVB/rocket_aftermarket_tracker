-- Wave XXX-W security hotfix: reverse_deal cross-org guard.
--
-- Codex hostile probe (2026-06-05) caught: reverse_deal is SECURITY DEFINER,
-- which bypasses the RLS policies on jobs (`jobs_update_tenant` requires
-- dealer_id = auth_dealer_id()). The Wave XXX-V function only checks
-- authentication + reason presence + id existence — no org-scope check.
-- An authenticated user from Org A could theoretically reverse a deal from
-- Org B by guessing/leaking the UUID.
--
-- Currently rocket is single-tenant in practice (Priority Lexus), so no live
-- exploitation surface. But the gap is structural and would become live the
-- moment rocket adds a second tenant. Closing it now.
--
-- Fix: check the target row's dealer_id against the caller's auth_dealer_id()
-- BEFORE the UPDATE. Raise on mismatch with a distinct error.
--
-- Rule 14 (reproduction-runner gate): cross-org call deny path can be verified
-- after migration via execute_sql with SET ROLE / SET LOCAL request.jwt.claim.
-- Rule 15 (replayable): CREATE OR REPLACE FUNCTION is idempotent.
-- Rule 16 (anon grants): unchanged — REVOKE FROM anon already applied
-- in Wave XXX-V and CREATE OR REPLACE preserves grants. Defensive re-apply
-- per pitfall #4 anyway.

BEGIN;

CREATE OR REPLACE FUNCTION public.reverse_deal(
  p_deal_id UUID,
  p_reason  TEXT
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller        UUID;
  v_caller_dealer UUID;
  v_target_dealer UUID;
  v_result        public.jobs;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'reverse_deal requires an authenticated session';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'p_reason is required';
  END IF;

  -- Cross-org guard (Wave XXX-W Codex hostile-probe catch).
  -- SECURITY DEFINER bypasses jobs_update_tenant RLS, so we have to enforce
  -- org scope here manually. auth_dealer_id() is the project's standard
  -- caller-side org resolver used in every other RLS policy on jobs.
  v_caller_dealer := public.auth_dealer_id();

  SELECT dealer_id INTO v_target_dealer
  FROM public.jobs
  WHERE id = p_deal_id;

  IF v_target_dealer IS NULL THEN
    -- Don't leak whether the row exists across orgs — same error as not-found.
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  IF v_caller_dealer IS NULL OR v_target_dealer <> v_caller_dealer THEN
    -- Don't leak whether the row exists across orgs.
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  -- TOCTOU defense: re-assert dealer_id in the UPDATE WHERE so even if the
  -- SELECT-then-UPDATE has a race window, the UPDATE itself enforces the org guard.
  UPDATE public.jobs
  SET job_status      = 'reversed',
      reversed_at     = NOW(),
      reversed_by     = v_caller,
      reversed_reason = p_reason
  WHERE id = p_deal_id
    AND dealer_id = v_caller_dealer
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  RETURN v_result;
END;
$$;

-- Pitfall #4 defensive re-grant (CREATE OR REPLACE preserves grants in PG 14+,
-- but be explicit so a future grep + audit can see scope intent inline).
REVOKE EXECUTE ON FUNCTION public.reverse_deal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_deal(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reverse_deal(uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reverse_deal(uuid, text) TO service_role;

COMMENT ON FUNCTION public.reverse_deal(uuid, text) IS
'Rule 16 grant scope justification (Wave XXX-V + XXX-W org-guard):
Sentence 1: Only the authenticated coordinator/manager UI calls this — the Reverse button is behind a protected route requiring a valid session JWT; no anon path exists.
Sentence 2: The function writes job_status=reversed + reversed_at + reversed_by + reversed_reason on a jobs row scoped via cross-org guard (auth_dealer_id() must match target row dealer_id) — financial/operational data, must never be reachable by unauthenticated requests or by users from another org.';

COMMIT;

-- Post-migration assertions (Wave XXX-W security hotfix verification).
DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_func_body
  FROM pg_proc
  WHERE proname = 'reverse_deal'
    AND pronamespace = 'public'::regnamespace;

  IF v_func_body IS NULL THEN
    RAISE EXCEPTION 'reverse_deal function missing post-migration';
  END IF;

  IF v_func_body NOT LIKE '%auth_dealer_id()%' THEN
    RAISE EXCEPTION 'reverse_deal body does not reference auth_dealer_id() — org guard missing';
  END IF;

  IF v_func_body NOT LIKE '%v_target_dealer%' THEN
    RAISE EXCEPTION 'reverse_deal body does not select target dealer_id — org guard incomplete';
  END IF;

  IF (SELECT has_function_privilege('anon','public.reverse_deal(uuid, text)','EXECUTE')) THEN
    RAISE EXCEPTION 'anon has EXECUTE on reverse_deal post-migration — pitfall #4 grant strip';
  END IF;

  RAISE NOTICE 'WAVE XXX-W ASSERTIONS PASSED: reverse_deal cross-org guard PRESENT + auth_dealer_id reference confirmed + anon grant still revoked.';
END $$;
