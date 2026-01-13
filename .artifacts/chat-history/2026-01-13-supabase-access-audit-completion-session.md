# Chat History — 2026-01-13 (Supabase Access Audit → Repair → Harden → Align)

Repo: `rocket_aftermarket_tracker`
Stack: Vite + React + Tailwind + Supabase (PostgREST/RLS). pnpm + Node 20.
Supabase MCP (non-prod): project ref `ntpoblmjxfivomcwmjrj` (validated via `bash scripts/mcp/supabase-mcp.sh --check`).

## User intent (final)
- "Finish to completion" + "all users have the same access — full complete access".
- Interpretation implemented: **all authenticated users have equivalent access**, but still **tenant-scoped** (org/dealer), and **public/guest data exposure paths removed** (except explicitly needed guest claim submission paths).

## What was done (high level)
1) Repo scan + Supabase introspection per `.github/prompts/supabase-access-audit.prompt.md`.
2) Forward-only DB "repair" migration for missing tables/RPCs referenced by runtime code.
3) Forward-only RPC security hardening (revoke `anon`/`PUBLIC` execute; switch data-returning RPCs to `SECURITY INVOKER` so RLS applies).
4) Forward-only RLS/storage alignment to remove PUBLIC access and simplify key tables to single authenticated full-access policies (tenant scoped).
5) Added missing **table-level grants** so PostgREST can use repaired tables (RLS still controls rows).
6) Frontend timezone/day-shift stabilization for calendar/scheduling, with a regression test.

## Key migrations (forward-only)
- `supabase/migrations/20260113190000_repair_missing_feature_tables_and_health_rpcs.sql`
  - Restored missing feature tables and health/perf wrapper RPCs referenced by runtime code.

- `supabase/migrations/20260113203000_harden_risky_public_rpcs.sql`
  - Revoked execute from `anon`/`PUBLIC` on risky RPCs.
  - Converted most data-returning RPCs to `SECURITY INVOKER` so RLS applies.
  - Kept `generate_job_number()` as definer, but restricted execute to `authenticated`.

- `supabase/migrations/20260113213000_align_full_access_rls_and_storage.sql`
  - Removed PUBLIC storage policies for `claim-photos` and replaced with authenticated-only, tenant-scoped policies.
  - Simplified `vendors`, `products`, `loaner_assignments` to **single authenticated full-access** policies (tenant scoped).

- `supabase/migrations/20260113223000_grant_privileges_repaired_feature_tables.sql`
  - Added **table-level grants** so PostgREST can access repaired tables.
  - `authenticated`: SELECT/INSERT/UPDATE/DELETE on repaired feature tables.
  - `anon`: INSERT only for `claims` and `claim_attachments` (guest submission), no SELECT.

## DB evidence snapshots (authoritative)
### Table privileges after grants migration
- `authenticated` now has SELECT/INSERT/UPDATE/DELETE privileges on:
  - `claims`, `claim_attachments`, `filter_presets`, `notification_outbox`, `notification_preferences`, `sms_templates`, `vehicle_products`.
- `anon` has INSERT privilege on `claims` and `claim_attachments` only.

### RPC privileges after hardening migration
- Risky RPCs are `SECURITY INVOKER` and `authenticated`-only execute:
  - `check_vendor_schedule_conflict`, `get_jobs_by_date_range`, `get_overdue_jobs`, `get_vendor_vehicles`, `log_activity`, `validate_status_progression`.
- `generate_job_number()` remains `SECURITY DEFINER` but is `authenticated`-only execute.
- Some health/perf wrappers still allow `anon` execute (not `PUBLIC`):
  - `check_auth_connection`, `generate_claim_number`, `pg_available_extensions`, `pg_indexes`, `pg_matviews`.

## Frontend changes (timezone/day-shift)
- Multiple calendar/scheduling components updated to use ET-safe date formatting + date input normalization.
- Added regression test: `src/tests/scheduleDisplay.dateOnly.test.js`.

## Verification already run
- `bash scripts/mcp/supabase-mcp.sh --check` → OK
- `pnpm -s guard:client-env` → pass
- Prior run (same day/session): `pnpm -s lint`, `pnpm -s test`, `pnpm -s build` → all passed (984 tests passed; 2 skipped).
- Schema cache reload executed as needed: `NOTIFY pgrst, 'reload schema';`

## Current working state / unfinished items
### 1) Audit artifact still needs reconciliation
File: `.artifacts/supabase-access-audit-2026-01-13.md`
- Step B/C still contains stale rows marking repaired tables/RPCs as "missing".
- Needs update to reflect:
  - repaired tables exist + have policies
  - RPC security definer + anon execute states are hardened
  - newly added grants migration (table privileges) is applied

### 2) Decision point: "no anon RPCs"?
- If the posture should be **zero anon execute** across *all* RPCs (including health/perf wrappers), add a tiny forward-only migration revoking `anon` execute from:
  - `check_auth_connection`, `generate_claim_number`, `pg_available_extensions`, `pg_indexes`, `pg_matviews`.

## Next steps to finish (resume checklist)
1) Update `.artifacts/supabase-access-audit-2026-01-13.md` Step B/C tables & RPC section to match DB.
2) (Optional) Decide whether to revoke `anon` execute for health/perf wrappers.
3) Run:
   - `pnpm -s lint`
   - `pnpm -s test`
   - `pnpm -s build`
4) `git status` and confirm new/modified files are expected:
   - new migration: `supabase/migrations/20260113223000_grant_privileges_repaired_feature_tables.sql`
   - audit artifact updates
   - timezone fixes + test file

## Notes / constraints followed
- Forward-only migrations only; no historical migration edits.
- No Supabase client use added in React components.
- Tenant scoping preserved; public access paths removed where not explicitly intended.
