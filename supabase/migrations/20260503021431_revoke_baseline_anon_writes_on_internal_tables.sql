-- Wave XVIII-A: Sweep baseline anon write grants on internal tables
--
-- JUSTIFICATION (Rule 16, anon-grant burden of proof):
-- 1. vehicles / jobs / transactions / job_parts have ZERO legitimate anon use case.
--    Their Supabase default-baseline INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
--    grants for `anon` are no-ops at runtime because no anon RLS policy permits
--    the cmd, but the grants themselves violate Rule 16 burden of proof. Hostile-
--    break-tester confirmed this in Wave XVII-B audit (DELETE returned HTTP 204
--    Content-Range: */0 instead of clean HTTP 401 — defense rests entirely on RLS
--    with no grant-layer backstop). Explicit REVOKE closes the door.
-- 2. claims / claim_attachments KEEP anon INSERT — intentional for the public
--    guest claims submission form (/guest-claims-submission-form route).
--    Existing RLS policies `claims_guest_insert` and `claim_attachments_guest_insert`
--    have WITH CHECK constraints validating non-empty customer_name/email/
--    issue_description (claims) and file_path scoping (claim_attachments). UPDATE/
--    DELETE/TRUNCATE/REFERENCES/TRIGGER are NOT needed for the guest flow and are
--    revoked. No PII or financial data ever exposed to anon — INSERT-only into
--    customer-scoped rows the customer themselves submits.

-- Tables with NO legitimate anon use case — full revoke
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.vehicles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.jobs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.job_parts FROM anon;

-- claims + claim_attachments — KEEP INSERT for guest flow, revoke the rest
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.claims FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.claim_attachments FROM anon;

NOTIFY pgrst, 'reload schema';
