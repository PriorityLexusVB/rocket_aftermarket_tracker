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

- Supabase MCP server configured with `--project-ref ntpoblmjxfivomcwmjrj`
- Supabase API URL: `https://api.supabase.com`

Supabase project URL (from MCP):

- `https://ntpoblmjxfivomcwmjrj.supabase.co`

### App runtime env files (non-authoritative for MCP)

This repo currently contains multiple Supabase targets depending on context:

- `.env.local` points the browser app to **a different Supabase project** than MCP.
  - `VITE_SUPABASE_URL` is `https://ogjtmtndgiqqdtwatsue.supabase.co`
- `.env.test` uses local Supabase (`http://localhost:54321`).
- `.env.e2e.local` (found via grep) references `https://ntpoblmjxfivomcwmjrj.supabase.co`.

**Important:** This report audits the MCP-configured project (`ntpoblmjxfivomcwmjrj`). If you want the same audit for the `.env.local` project, we should either (a) temporarily switch MCP project-ref, or (b) add a second Supabase MCP server entry.

## DB Identity (evidence)

SQL:

```sql
select current_database() as db,
       current_user as user,
       inet_server_addr() as server_addr,
       inet_server_port() as server_port,
       version() as version;
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

Relevant application tables are under `public`:

- `activity_history`
- `communications`
- `job_parts`
- `job_photos`
- `jobs`
- `loaner_assignments`
- `organizations`
- `products`
- `transactions`
- `user_profiles`
- `vehicles`
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

- `dealer_id` appears in **11** tables
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
- `loaner_assignments`
- `products`
- `transactions`
- `vehicles`
- `vendors`
- `user_profiles`

And `dealer_id` exists without `org_id` on:

- `activity_history`
- `communications`
- `job_parts`
- `job_photos`

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

- Policies consistently scope access using **`org_id`** and **`auth_user_org()`** (e.g., `jobs.org_id = auth_user_org()`, joins via jobs `org_id`, etc.).
- A search for `dealer_id` in policy expressions returned **no matches**.

SQL:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and ((qual ilike '%dealer_id%') or (with_check ilike '%dealer_id%'))
order by tablename, policyname;
```

Result:

- no rows

### `auth_user_org()` definition (evidence)

SQL:

```sql
select pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='auth_user_org'
limit 1;
```

Result (abridged):

- `auth_user_org()` returns `org_id` from `public.user_profiles` based on `auth.uid()`.

### Data consistency check (evidence)

For tables that have both columns, we checked:

- how often each is non-null
- whether `dealer_id` equals `org_id` when both are present

Jobs:

```sql
select count(*) as total,
       count(dealer_id) as dealer_id_nonnull,
       count(org_id) as org_id_nonnull,
       count(*) filter (where dealer_id is not null and org_id is not null and dealer_id <> org_id) as dealer_org_mismatch
from public.jobs;
```

Result:

- total: 174
- dealer_id_nonnull: 174
- org_id_nonnull: 174
- mismatch: 0

User profiles:

```sql
select count(*) as total,
       count(dealer_id) as dealer_id_nonnull,
       count(org_id) as org_id_nonnull,
       count(*) filter (where dealer_id is not null and org_id is not null and dealer_id <> org_id) as dealer_org_mismatch
from public.user_profiles;
```

Result:

- total: 21
- dealer_id_nonnull: 0
- org_id_nonnull: 21

Vendors:

```sql
select count(*) as total,
       count(dealer_id) as dealer_id_nonnull,
       count(org_id) as org_id_nonnull,
       count(*) filter (where dealer_id is not null and org_id is not null and dealer_id <> org_id) as dealer_org_mismatch
from public.vendors;
```

Result:

- total: 10
- dealer_id_nonnull: 2
- org_id_nonnull: 10
- mismatch: 0

Vehicles:

```sql
select count(*) as total,
       count(dealer_id) as dealer_id_nonnull,
       count(org_id) as org_id_nonnull,
       count(*) filter (where dealer_id is not null and org_id is not null and dealer_id <> org_id) as dealer_org_mismatch
from public.vehicles;
```

Result:

- total: 1
- dealer_id_nonnull: 1
- org_id_nonnull: 1
- mismatch: 1

This indicates there is at least one row in `vehicles` where `dealer_id != org_id`.

## Conclusion (decision)

**Decision:** Treat **`org_id`** as the canonical tenant scoping field.

Rationale:

- RLS policies enforce access using `org_id` and `auth_user_org()`; there is no policy-based tenant enforcement using `dealer_id`.
- `auth_user_org()` is explicitly derived from `user_profiles.org_id`.
- Where both are populated (e.g., `jobs`), `dealer_id` and `org_id` are typically identical, suggesting `dealer_id` is a legacy alias for the same concept.

## Recommendations / Follow-ups (non-destructive)

1. **Clarify and converge naming**

- Target end-state should be `org_id` everywhere (including tables that currently only have `dealer_id`).
- Avoid adding new `dealer_id` usages in application code.

2. **Data drift check**

- Investigate and resolve the `vehicles` row where `dealer_id != org_id`.
  - This may indicate a backfill gap or a mismapped org.

3. **Future migration idea (requires explicit approval)**

- Add constraints or triggers to keep `dealer_id` and `org_id` consistent (or deprecate `dealer_id`).
- Backfill `org_id` into tables that only have `dealer_id`, then update RLS to rely exclusively on `org_id`.

---

Appendix: Extensions

Via `mcp_supabase_list_extensions`, `pg_trgm` is installed in schema `extensions` (version 1.6), along with other common Supabase extensions.
