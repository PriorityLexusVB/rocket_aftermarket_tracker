-- Wave XX: Add Rule 16 2-sentence justification comments to two anon-callable RPCs
-- (release-auditor REQUIRED carry from Wave XVII-B audit).
--
-- Both functions are confirmed safe per hostile-break-tester (Wave XVII-B Probe 1):
-- check_auth_connection returns boolean only; generate_claim_number returns a string ID.
-- Neither exposes PII or financial data. Documenting the justification in COMMENT ON FUNCTION
-- so any future audit can read the contract without rebuilding it from scratch.

COMMENT ON FUNCTION public.check_auth_connection() IS
  'Anon-callable health probe used by src/lib/supabase.js connection test on app boot. Returns BOOLEAN only — no schema metadata, no row data, no PII or financial information. Acceptable for anon because the response surface is a single boolean and the function is the canonical pre-auth liveness check.';

COMMENT ON FUNCTION public.generate_claim_number() IS
  'Anon-callable claim-number generator used by the public guest claims submission form (claimsService.createClaim) to obtain the next claim number before INSERT. Returns a generated TEXT id only — no PII, no financial data, no claim contents. Acceptable because the form is customer-facing and the number is non-confidential metadata; INSERT itself is independently gated by claims_guest_insert RLS WITH CHECK constraints.';

NOTIFY pgrst, 'reload schema';
