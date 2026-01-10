# Schema Audit Report (MCP-first, Read-only)

Date: 2026-01-10

## Scope

Goal: determine whether the tenant model is **`org_id`** or **`dealer_id`** (or both), based on evidence from the configured Supabase project.

Constraints honored:

- **Read-only** database access (SELECT-only; no DDL/DML).
- MCP-first: Supabase MCP server configured via `.vscode/mcp.json`.

## Environment & Targeting

### MCP configuration (authoritative)

Workspace MCP config: `.vscode/mcp.json`

- Supabase MCP server configured with `--project-ref ogjtmtndgiqqdtwatsue`
- Supabase API URL: `https://api.supabase.com`

Supabase project URL (from MCP):

- `https://ogjtmtndgiqqdtwatsue.supabase.co`

### App runtime env files (non-authoritative for MCP)

This repo currently contains multiple Supabase targets depending on context:

- `.env.local` points the browser app to `https://ogjtmtndgiqqdtwatsue.supabase.co`.
- `.env.test` uses local Supabase (`http://localhost:54321`).

This report audits the MCP-configured project (`ogjtmtndgiqqdtwatsue`).

## DB Identity (evidence)

SQL:

```sql
select current_database() as db, current_user as user, version() as version;
```

Result (abridged):

- db: `postgres`
- user: `postgres`
- version: `PostgreSQL 17.6`

## Schema inventory

### Base tables by schema (evidence)

SQL:

```sql
select table_schema, table_name
from information_schema.tables
where table_type='BASE TABLE'
  and table_schema not in ('pg_catalog','information_schema')
order by table_schema, table_name;
```

Relevant application tables are under `public` (19 tables):

- `activity_history`
- `claim_attachments`
- `claims`
- `communications`
- `filter_presets`
- `job_parts`
- `jobs`
- `loaner_assignments`
- `notification_outbox`
- `notification_preferences`
- `organizations`
- `products`
- `sms_opt_outs`
- `sms_templates`
- `transactions`
- `user_profiles`
- `vehicles`
- `vendor_hours`
- `vendors`

## `org_id` vs `dealer_id` evidence

### Column prevalence (evidence)

SQL:

```sql
select column_name,
       count(distinct table_schema || '.' || table_name) as table_count
from information_schema.columns
where table_schema not in ('pg_catalog','information_schema')
  and column_name in ('org_id','dealer_id')
group by column_name
order by column_name;
```

Result:

- `dealer_id` appears in **14** tables
- `org_id` appears in **7** tables

### Which tables have which columns (evidence)

SQL:

```sql
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema not in ('pg_catalog','information_schema')
  and column_name in ('org_id','dealer_id')
order by table_schema, table_name, column_name;
```

In `public`, both columns exist together on:

- `jobs`
- `products`
- `sms_templates`
- `transactions`
- `user_profiles`
- `vehicles`
- `vendors`

And `dealer_id` exists without `org_id` on:

- `activity_history`
- `claim_attachments`
- `claims`
- `communications`
- `job_parts`
- `loaner_assignments`
- `sms_opt_outs`

(See raw query output for full nullability and types; all are `uuid`.)

### Foreign keys (evidence)

SQL:

```sql
select tc.table_name, kcu.column_name,
       ccu.table_name as foreign_table_name,
       ccu.column_name as foreign_column_name,
       tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.table_schema='public'
  and tc.constraint_type='FOREIGN KEY'
  and kcu.column_name in ('dealer_id','org_id')
order by tc.table_name, kcu.column_name, foreign_table_name;
```

Result summary:

- Every `dealer_id` FK found points to `organizations(id)`.
- Every `org_id` FK found points to `organizations(id)`.

So **both fields reference the same parent table**: `public.organizations(id)`.

### RLS policy usage (evidence)

RLS is enabled on all `public` tables:

SQL:

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
```

Policy definitions:

SQL:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
order by tablename, policyname;
```

Key observation:

- Policies consistently scope access using **`dealer_id`** and **`auth_dealer_id()`** (often with role gates like `is_admin_or_manager()`).
- In this project, policy expressions reference `dealer_id` heavily and do not reference `org_id`.

SQL:

```sql
select
  (select count(*) from pg_policies where schemaname='public' and (coalesce(qual,'') ilike '%org_id%' or coalesce(with_check,'') ilike '%org_id%')) as policies_mention_org_id,
  (select count(*) from pg_policies where schemaname='public' and (coalesce(qual,'') ilike '%dealer_id%' or coalesce(with_check,'') ilike '%dealer_id%')) as policies_mention_dealer_id;
```

Result:

- policies mentioning `org_id`: **0**
- policies mentioning `dealer_id`: **64**

### `auth_dealer_id()` and `auth_user_org()` definitions (evidence)

SQL:

```sql
select p.proname, substr(pg_get_functiondef(p.oid), 1, 400) as def_snip
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('auth_dealer_id','auth_user_org')
order by p.proname;
```

Result (abridged):

- `auth_dealer_id()` returns a `uuid` derived from JWT claim `dealer_id` when present (and not the all-zero UUID), falling back to `public.auth_user_org()`.
- `auth_user_org()` returns `org_id` from `public.user_profiles` based on `auth.uid()`.

### Data consistency check (evidence)

For tables that have both columns, we checked:

- how often each is non-null
- whether `dealer_id` equals `org_id` when both are present

Results observed in this project:

- `jobs`: total 0; dealer_id_nonnull 0; org_id_nonnull 0; mismatch 0
- `user_profiles`: total 10; dealer_id_nonnull 10; org_id_nonnull 10; mismatch 0
- `vendors`: total 2; dealer_id_nonnull 2; org_id_nonnull 2; mismatch 0
- `vehicles`: total 0; dealer_id_nonnull 0; org_id_nonnull 0; mismatch 0
- `products`: total 6; dealer_id_nonnull 6; org_id_nonnull 0; mismatch 0
- `transactions`: total 162; dealer_id_nonnull 162; org_id_nonnull 0; mismatch 0
- `sms_templates`: total 7; dealer_id_nonnull 0; org_id_nonnull 7; mismatch 0

Spot-check queries for actual mismatching rows (`... where org_id is not null and dealer_id is not null and org_id <> dealer_id limit 10`) returned no rows for these tables.

## Conclusion (decision)

**Decision:** Treat **`dealer_id`** as the canonical tenant scoping field for this project.

Rationale:

- RLS policies overwhelmingly enforce tenant scope using `dealer_id` (64 policies mention `dealer_id`; 0 mention `org_id`).
- `dealer_id` is present as `NOT NULL` on more tables, while `org_id` is always nullable.
- `auth_dealer_id()` is the primary RLS helper, with a fallback path through `auth_user_org()`.

Interpretation:

- `org_id` exists and is used for profile-derived organization lookup, but it is not the authorization primitive used by policies.
- If the long-term goal is to standardize on `org_id`, that requires an explicit, coordinated migration and RLS rewrite.

## Recommendations / Follow-ups (non-destructive)

1. **Align application scoping with RLS today**

- Avoid introducing new query filters that assume `org_id` is the policy-enforced tenant key.
- When in doubt, use `dealer_id` for tenant filtering because RLS is already written that way.

2. **If moving toward `org_id`, plan a safe migration** (requires explicit approval)

- Backfill `org_id` to be `NOT NULL` everywhere and guarantee `org_id = dealer_id` (or deprecate one).
- Update RLS policies to use `org_id` consistently.
- Ensure the JWT custom claim (`dealer_id`) strategy is updated (or replaced) so `auth_dealer_id()` continues to work.

3. **Supabase advisor findings (optional hardening)**

No changes were applied in this audit, but Supabase advisors reported:

- Multiple warnings about functions with mutable `search_path` (security hardening opportunity).
- RLS initplan performance warnings suggesting `(select auth.<fn>())` patterns.
- Auth “leaked password protection” disabled.

---

Appendix: Extensions

Installed extensions include `pg_trgm`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `pg_graphql`, and `supabase_vault`.
