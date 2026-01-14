# Supabase Access / RLS Audit (2026-01-13)

Scope: runtime source under `src/**` (excluding `src/tests/**`).
Prompt followed: `.github/prompts/supabase-access-audit.prompt.md`.

Supabase MCP context: non-prod project ref `ntpoblmjxfivomcwmjrj` (validated via `bash scripts/mcp/supabase-mcp.sh --check`).

Update (post-audit, applied 2026-01-13):
- Applied forward-only repair migration: `supabase/migrations/20260113190000_repair_missing_feature_tables_and_health_rpcs.sql`.
- Result: previously-missing feature tables/RPCs now exist in DB with RLS enabled and minimal policies; health/performance RPC wrappers now exist in `public`.
- Applied forward-only hardening migration: `supabase/migrations/20260113203000_harden_risky_public_rpcs.sql`.
- Result: risky RPCs are no longer executable by `anon`/`PUBLIC`, and the cross-tenant data-returning RPCs now run as `SECURITY INVOKER` (RLS applies).
- Applied forward-only access alignment migration: `supabase/migrations/20260113213000_align_full_access_rls_and_storage.sql`.
- Result: removed PUBLIC access to `claim-photos`, removed the `loaner_assignments` `roles={public}` policy, and simplified `vendors`/`products`/`loaner_assignments` to single authenticated full-access policies (org/dealer scoped).
- Applied forward-only grants migration: `supabase/migrations/20260113223000_grant_privileges_repaired_feature_tables.sql`.
- Result: restored feature tables now have the required table-level grants for PostgREST (`authenticated` full privileges; `anon` INSERT only for guest claim submission tables).
- Verified locally: `pnpm -s guard:client-env`, `pnpm -s lint`, `pnpm -s test`, `pnpm -s build` all pass.
- Optional decision: whether to revoke remaining `anon` EXECUTE on health/perf wrapper RPCs.

## Post-repair reconciliation (2026-01-13)

The Step B/C tables below originally recorded the **pre-repair** state.
After applying the migrations listed above, the following previously-missing objects are expected to exist.

### Previously-missing tables restored

- `claims`
- `claim_attachments`
- `filter_presets`
- `notification_outbox`
- `notification_preferences`
- `sms_templates`
- `vehicle_products`

Source: `supabase/migrations/20260113190000_repair_missing_feature_tables_and_health_rpcs.sql` and `supabase/migrations/20260113223000_grant_privileges_repaired_feature_tables.sql`.

### Previously-missing RPCs restored

- `bulk_update_jobs`
- `check_auth_connection` (health wrapper)
- `generate_claim_number`
- `generate_export_data`
- `get_overdue_jobs_enhanced`
- `notify_schema_reload`
- `pg_available_extensions` (wrapper)
- `pg_indexes` (wrapper)
- `pg_matviews` (wrapper)

Source: `supabase/migrations/20260113190000_repair_missing_feature_tables_and_health_rpcs.sql`.

---

## Step A — Repo scan (deduped)

### Tables / buckets referenced via `.from('...')`

- `activity_history`
- `claim_attachments` *(was missing in DB; restored 2026-01-13)*
- `claims` *(was missing in DB; restored 2026-01-13)*
- `communications`
- `filter_presets` *(was missing in DB; restored 2026-01-13)*
- `job_parts`
- `job_photos`
- `jobs`
- `loaner_assignments`
- `notification_outbox` *(was missing in DB; restored 2026-01-13)*
- `notification_preferences` *(was missing in DB; restored 2026-01-13)*
- `organizations`
- `products`
- `sms_templates` *(was missing in DB; restored 2026-01-13)*
- `transactions`
- `user_profiles`
- `vehicle_products` *(was missing in DB; restored 2026-01-13)*
- `vehicles`
- `vendors`

Non-public/system view referenced:
- `pg_stat_user_tables` (via health/perf checks)

Storage buckets referenced:
- `job-photos` (storage)
- `claim-photos` (storage)

### RPCs referenced via `.rpc('...')`

- `bulk_update_jobs` *(was missing in DB; restored 2026-01-13)*
- `check_auth_connection` *(was missing in DB; restored 2026-01-13)*
- `check_job_parts_vendor_fk` *(missing in DB)*
- `check_vendor_schedule_conflict`
- `exec_sql` *(missing in DB)*
- `generate_claim_number` *(was missing in DB; restored 2026-01-13)*
- `generate_export_data` *(was missing in DB; restored 2026-01-13)*
- `generate_job_number`
- `get_jobs_by_date_range`
- `get_overdue_jobs`
- `get_overdue_jobs_enhanced` *(was missing in DB; restored 2026-01-13)*
- `get_vendor_vehicles`
- `log_activity`
- `notify_schema_reload` *(missing in DB)*
- `pg_available_extensions` *(was missing in `public`; wrapper restored 2026-01-13)*
- `pg_indexes` *(was missing in DB; restored 2026-01-13)*
- `pg_matviews` *(was missing in DB; restored 2026-01-13)*
- `validate_status_progression`

Direct PostgREST usage:
- No `/rest/v1/` hits found in runtime source.

---

## Step B — Supabase MCP introspection (authoritative)

### Table existence + RLS + privileges (high level)

Notes:
- “Privileges” below are *table-level grants*; RLS policies still gate row access.
- At audit time, several referenced tables/RPCs were missing in this DB; the “repair” migration in the update section restores the missing objects.

| Object | Type | Exists | Schema | RLS | anon SELECT | auth SELECT | Notes |
|---|---|---:|---|---:|---:|---:|---|
| `activity_history` | table | ✅ | public | ✅ | ❌ | ✅ | append-only pattern (policies below) |
| `communications` | table | ✅ | public | ✅ | ❌ | ✅ | no UPDATE policy (and no runtime UPDATE usage found) |
| `job_parts` | table | ✅ | public | ✅ | ❌ | ✅ | policies include org + vendor paths |
| `job_photos` | table | ✅ | public | ✅ | ❌ | ✅ | managed by authenticated only |
| `jobs` | table | ✅ | public | ✅ | ❌ | ✅ | org-scoped policies present |
| `loaner_assignments` | table | ✅ | public | ✅ | ❌ | ✅ | single authenticated full-access policy (tenant scoped via jobs) |
| `organizations` | table | ✅ | public | ✅ | ❌ | ✅ | appears intentionally limited (no INSERT/DELETE policies) |
| `products` | table | ✅ | public | ✅ | ❌ | ✅ | single authenticated full-access policy (tenant scoped) |
| `transactions` | table | ✅ | public | ✅ | ❌ | ✅ | org + job scoping policies |
| `user_profiles` | table | ✅ | public | ✅ | ❌ | ✅ | includes org-admin delete policy |
| `vehicles` | table | ✅ | public | ✅ | ❌ | ✅ | vendor access via helper + org/job join |
| `vendors` | table | ✅ | public | ✅ | ❌ | ✅ | single authenticated full-access policy (tenant scoped) |
| `pg_stat_user_tables` | view | ✅ | pg_catalog | ❌ | ✅ | ✅ | system view used by perf/health checks |
| `claims` | table | ✅ | public | ✅ | ❌ | ✅ | guest INSERT allowed (anon) via policy; staff SELECT/UPDATE scoped via user_profiles |
| `claim_attachments` | table | ✅ | public | ✅ | ❌ | ✅ | guest INSERT allowed (anon) via policy; authenticated SELECT scoped to claim + user/email |
| `filter_presets` | table | ✅ | public | ✅ | ❌ | ✅ | owner-managed; includes public presets via `is_public` |
| `notification_outbox` | table | ✅ | public | ✅ | ❌ | ✅ | admin/manager managed (policies gate write paths) |
| `notification_preferences` | table | ✅ | public | ✅ | ❌ | ✅ | owner-managed |
| `sms_templates` | table | ✅ | public | ✅ | ❌ | ✅ | admin/manager managed; authenticated can read active templates |
| `vehicle_products` | table | ✅ | public | ✅ | ❌ | ✅ | authenticated can read; write is owner/admin gated |

### Policies snapshot (by table)

This section is summarized from `pg_policies`.

- `activity_history`: SELECT + INSERT only.
- `communications`: SELECT + INSERT + DELETE only.
- `job_parts`: has multiple org/vendor policies; includes `ALL` policies for managers/vendors.
- `job_photos`: `ALL` with `uploaded_by = auth.uid()`.
- `jobs`: SELECT/INSERT/UPDATE/DELETE policies present; org-scoped plus staff/vendor views.
- `loaner_assignments`: single authenticated full-access policy (tenant scoped via jobs).
- `organizations`: SELECT + UPDATE policies only.
- `products`: single authenticated full-access policy (tenant scoped).
- `transactions`: full CRUD policies.
- `user_profiles`: includes admin/manager delete-in-org policy and self-management.
- `vehicles`: full CRUD policies, with staff/vendor access patterns.
- `vendors`: single authenticated full-access policy (tenant scoped).

### Storage bucket policy snapshot (`storage.objects`)

| Object | Type | Exists | Read | Write | Notes/Risks |
|---|---|---:|---|---|---|
| `job-photos` | storage bucket | ✅ | authenticated SELECT | authenticated INSERT/UPDATE/DELETE (owner-scoped) | upload constrained to `jobs/...` prefix |
| `claim-photos` | storage bucket | ✅ | authenticated SELECT (tenant-scoped via claim id in object path) | authenticated INSERT/UPDATE/DELETE (tenant-scoped via claim id in object path) | enforced by claim id prefix + join to `claims` |

### RPC existence + privileges

| Object | Type | Exists | Security definer | anon EXECUTE | auth EXECUTE | Notes/Risks |
|---|---|---:|---:|---:|---:|---|
| `check_vendor_schedule_conflict(vendor_uuid uuid, start_time timestamptz, end_time timestamptz, exclude_job_id uuid)` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE (RLS applies) |
| `generate_job_number()` | RPC | ✅ | ✅ | ❌ | ✅ | Hardened: remains definer for sequence access, but authenticated-only EXECUTE |
| `get_jobs_by_date_range(start_date timestamptz, end_date timestamptz, vendor_filter uuid, status_filter text)` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE |
| `get_overdue_jobs()` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE |
| `get_vendor_vehicles(vendor_uuid uuid)` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE |
| `log_activity(p_entity_type text, p_entity_id uuid, p_action text, p_description text, p_old_values jsonb, p_new_values jsonb)` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE |
| `validate_status_progression(current_status text, new_status text)` | RPC | ✅ | ❌ | ❌ | ✅ | Hardened: `SECURITY INVOKER` + authenticated-only EXECUTE |
| `bulk_update_jobs(job_ids uuid[], updates jsonb, performed_by uuid)` | RPC | ✅ | ❌ | ❌ | ✅ | Restored via repair migration; authenticated-only EXECUTE |
| `get_overdue_jobs_enhanced()` | RPC | ✅ | ❌ | ❌ | ✅ | Restored via repair migration; authenticated-only EXECUTE |
| `generate_export_data(export_type text, filters jsonb, user_role text)` | RPC | ✅ | ❌ | ❌ | ✅ | Restored via repair migration; authenticated-only EXECUTE |
| `notify_schema_reload()` | RPC | ✅ | ✅ | ❌ | ✅ | Administrative helper; definer; authenticated-only EXECUTE |
| `check_auth_connection()` | RPC | ✅ | ❌ | ✅ | ✅ | Health wrapper; still allows anon EXECUTE (not `PUBLIC`) |
| `generate_claim_number()` | RPC | ✅ | ❌ | ✅ | ✅ | Helper; still allows anon EXECUTE (not `PUBLIC`) |
| `pg_available_extensions()` | RPC | ✅ | ❌ | ✅ | ✅ | Perf wrapper; still allows anon EXECUTE (not `PUBLIC`) |
| `pg_indexes()` | RPC | ✅ | ❌ | ✅ | ✅ | Perf wrapper; still allows anon EXECUTE (not `PUBLIC`) |
| `pg_matviews()` | RPC | ✅ | ❌ | ✅ | ✅ | Perf wrapper; still allows anon EXECUTE (not `PUBLIC`) |
| `exec_sql` | RPC | ❌ | — | — | — | intentionally not created (unsafe) |
| `check_job_parts_vendor_fk` | RPC | ❌ | — | — | — | still missing in DB |

---

## Step C — Access Matrix (required output)

Matrix interpretation:
- Tables: “SELECT/INSERT/UPDATE/DELETE” refers to *having at least one RLS policy* for that command (for authenticated users), not just grants.
- RPCs: “SELECT/INSERT/UPDATE/DELETE” is not applicable; use EXECUTE.

| Object | Type | RLS | SELECT | INSERT | UPDATE | DELETE | Notes/Risks |
|---|---|---:|---:|---:|---:|---:|---|
| `activity_history` | table | ✅ | ✅ | ✅ | ❌ | ❌ | appears intentionally append-only |
| `communications` | table | ✅ | ✅ | ✅ | ❌ | ✅ | no UPDATE policy (OK if immutable) |
| `job_parts` | table | ✅ | ✅ | ✅ | ✅ | ✅ | org + vendor policies |
| `job_photos` | table | ✅ | ✅ | ✅ | ✅ | ✅ | with_check restricts updates to uploader |
| `jobs` | table | ✅ | ✅ | ✅ | ✅ | ✅ | org-scoped + staff/vendor policies |
| `loaner_assignments` | table | ✅ | ✅ | ✅ | ✅ | ✅ | single authenticated full-access policy (tenant scoped via jobs) |
| `organizations` | table | ✅ | ✅ | ❌ | ✅ | ❌ | likely intentional: no create/delete from client |
| `products` | table | ✅ | ✅ | ✅ | ✅ | ✅ | single authenticated full-access policy (tenant scoped) |
| `transactions` | table | ✅ | ✅ | ✅ | ✅ | ✅ | org/job scoping |
| `user_profiles` | table | ✅ | ✅ | ✅ | ✅ | ✅ | includes admin/manager delete-in-org policy |
| `vehicles` | table | ✅ | ✅ | ✅ | ✅ | ✅ | org/vendor constraints |
| `vendors` | table | ✅ | ✅ | ✅ | ✅ | ✅ | single authenticated full-access policy (tenant scoped) |
| `claims` | table | ✅ | ✅ | ❌ | ✅ | ❌ | guest submit uses `anon` INSERT; authenticated staff update is scoped; no authenticated delete policy |
| `claim_attachments` | table | ✅ | ✅ | ❌ | ❌ | ❌ | guest submit uses `anon` INSERT; authenticated read scoped by claim/email/profile |
| `filter_presets` | table | ✅ | ✅ | ✅ | ✅ | ✅ | owner-managed via `ALL` policy; `is_public` allows authenticated reads |
| `notification_outbox` | table | ✅ | ✅ | ✅ | ✅ | ✅ | admin/manager-only `ALL` policy |
| `notification_preferences` | table | ✅ | ✅ | ✅ | ✅ | ✅ | owner-managed via `ALL` policy |
| `sms_templates` | table | ✅ | ✅ | ✅ | ✅ | ✅ | admin/manager-only `ALL` policy; authenticated SELECT for active templates |
| `vehicle_products` | table | ✅ | ✅ | ✅ | ✅ | ✅ | authenticated SELECT; writes gated to owner/admin via policy |
| `job-photos` | storage | ✅ | ✅ | ✅ | ✅ | ✅ | authenticated + owner-scoped |
| `claim-photos` | storage | ✅ | ✅ | ✅ | ✅ | ✅ | authenticated-only + tenant scoped via claim id in object path |
| `check_vendor_schedule_conflict(...)` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `generate_job_number()` | RPC | — | — | — | — | — | authenticated-only EXECUTE (remains `SECURITY DEFINER`) |
| `get_jobs_by_date_range(...)` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `get_overdue_jobs()` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `get_vendor_vehicles(...)` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `log_activity(...)` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `validate_status_progression(...)` | RPC | — | — | — | — | — | authenticated-only EXECUTE (`SECURITY INVOKER`) |
| `bulk_update_jobs` | RPC | — | — | — | — | — | exists; authenticated-only EXECUTE |
| `get_overdue_jobs_enhanced` | RPC | — | — | — | — | — | exists; authenticated-only EXECUTE |

---

## Step D — Smallest fix plan (no destructive edits)

### 1) High priority: RPC security (cross-tenant exposure risk)

Problem:
- Several RPCs are `SECURITY DEFINER` and executable by `anon`.
- The functions’ SQL does not include org scoping, and core tables are **not FORCE RLS**, so these RPCs can bypass RLS and leak cross-tenant data.

Smallest safe migration (proposed):
- New migration under `supabase/migrations/` that:
  1) Sets these RPCs to `SECURITY INVOKER` (so RLS applies to the caller)
  2) Revokes EXECUTE from `anon` (and optionally from `public`) and grants to `authenticated` only

Target functions:
- `public.get_jobs_by_date_range(...)`
- `public.get_overdue_jobs()`
- `public.get_vendor_vehicles(...)`
- `public.check_vendor_schedule_conflict(...)`
- `public.log_activity(...)`
- `public.validate_status_progression(...)`

Notes:
- `public.generate_job_number()` may need to remain `SECURITY DEFINER` to access the sequence; still revoke `anon` EXECUTE.

Status:
- Resolved via `supabase/migrations/20260113203000_harden_risky_public_rpcs.sql`.

### 2) Medium priority: “org_id is null” bypasses in policies

Problem:
- Some read policies include `auth_user_org() IS NULL` as an allow condition (e.g., `vendors`/`products`).
- Any authenticated user missing a `user_profiles` row (or with NULL org_id) would satisfy that condition and could gain broad read.

Smallest fix:
- Remove `auth_user_org() IS NULL` allowances from policies where not strictly required.
- If needed for bootstrap UX, replace with a safer allowlist (e.g., only admins) rather than “any user with no org”.

Status:
- Resolved for `vendors`/`products`/`loaner_assignments` and `claim-photos` via `supabase/migrations/20260113213000_align_full_access_rls_and_storage.sql`.

### 3) Missing tables/RPCs referenced by runtime code

These objects were referenced by UI/services but were absent in this DB at audit time:
- Tables: `claims`, `claim_attachments`, `filter_presets`, `notification_outbox`, `notification_preferences`, `sms_templates`, `vehicle_products`
- RPCs: `bulk_update_jobs`, `get_overdue_jobs_enhanced`, `generate_claim_number`, plus health/perf wrappers (`check_auth_connection`, `pg_available_extensions`, `pg_indexes`, `pg_matviews`)

Smallest fix options:
- **Option A (schema forward):** add new migrations to create the missing objects + RLS/policies.
- **Option B (app resilient):** gate these features behind capability checks (like `SMS_TEMPLATES_TABLE_AVAILABLE`) and fail closed when missing (code-only change).

Update:
- Implemented **Option A** via `supabase/migrations/20260113190000_repair_missing_feature_tables_and_health_rpcs.sql` (idempotent “repair + minimal hardening”).

---

## Step E — Verification checklist

After applying any migration(s):
1) Schema cache reload:
   - `NOTIFY pgrst, 'reload schema';`
2) Smoke test one CRUD action per core table (authenticated):
   - `jobs`: create → update status → delete
   - `job_parts`: create → schedule times → delete
   - `vendors`/`products`/`vehicles`: list + create + edit
   - `loaner_assignments`: create + read + delete (scoped by job org/dealer)
   - `user_profiles`: admin delete another user in-org (ensure self-delete blocked)
3) RPC checks:
   - Call each RPC as `authenticated` (expected success)
   - Call each RPC as `anon` (expected denial)
4) Storage buckets:
   - Upload job photo as authenticated, ensure only owner can mutate
   - Upload claim photo as authenticated, ensure cross-tenant access is denied
