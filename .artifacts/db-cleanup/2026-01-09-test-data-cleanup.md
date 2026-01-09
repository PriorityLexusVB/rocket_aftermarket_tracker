# Test Data Cleanup (Deals / Loaners / Job Parts)

This guide is for cleaning up *test* rows that were created by automated tests/E2E or manual testing.

## Safety rules

- Run this only in a **non-production** project *or* only after you verify the filters match test data exclusively.
- Start with the **DRY RUN** queries (counts + sample rows). Do not skip.
- Use a Supabase role/connection that can bypass RLS (typically the SQL editor in the Supabase dashboard, or a service role connection).

## Common test markers in this repo

From unit/E2E tests, common patterns include:

- `jobs.job_number` contains: `TEST-`, `JOB-TEST-`, `VENDOR-TEST-`, `ONSITE-TEST-`, `PROMISE-TEST-`, `TEST-RLS-`, `CANCEL-TEST-`
- `jobs.title` / `jobs.description` contains: `E2E`, `Rob Brasco Test Deal`
- `loaner_assignments.loaner_number` contains: `LOANER-E2E-`

If your real data can overlap these patterns, tighten the filter by **date range** and/or by a specific `created_by` user.

### Recommended for your screenshot (E2E-only)

Your UI rows are clearly tagged in the title (`E2E ...`) and some loaners are tagged (`LOANER-E2E-...`).
Avoid deleting by `job_number` (many real jobs may be `JOB-...`). Prefer:

- `jobs.title ILIKE 'E2E %'` (and optionally a date window)
- `loaner_assignments.loaner_number ILIKE 'LOANER-E2E-%'`

If you have multiple tenants/orgs, also add: `and org_id = '<YOUR_ORG_ID>'` to the `jobs` filter.

## Supabase MCP notes (Jan 9, 2026)

Using the E2E-only filter (`jobs.title ILIKE 'E2E %'`), the database currently contains:

- 152 jobs
- 152 job_parts
- 152 transactions
- 39 loaner_assignments (not all have `LOANER-E2E-%` in loaner_number)

Those E2E jobs span **two** org_ids:

- `00000000-0000-0000-0000-0000000000e2`
- `a1ac6612-4108-483a-8fcb-62c9ceb2abb1`

Additional FK tables referencing `jobs(id)` (delete these first if you want a clean wipe):

- `communications(job_id)`
- `job_photos(job_id)`

---

## Step 1 — DRY RUN: find candidate jobs

Run this first and confirm it only returns test jobs.

```sql
-- Adjust time window to reduce risk
-- Example: last 90 days
with target_jobs as (
  select id, job_number, title, description, created_at
  from jobs
  where created_at >= now() - interval '90 days'
    and (
      -- Safer default: match E2E labels in title/description
      title ilike 'E2E %'
      or description ilike '%E2E%'
      or title ilike '%Rob Brasco Test Deal%'
    )
)
select *
from target_jobs
order by created_at desc
limit 100;
```

## Step 2 — DRY RUN: counts by related tables

```sql
with target_jobs as (
  select id
  from jobs
  where created_at >= now() - interval '90 days'
    and (
      title ilike 'E2E %'
      or description ilike '%E2E%'
      or title ilike '%Rob Brasco Test Deal%'
    )
)
select
  (select count(*) from target_jobs) as jobs,
  (select count(*) from job_parts jp where jp.job_id in (select id from target_jobs)) as job_parts,
  (select count(*) from communications c where c.job_id in (select id from target_jobs)) as communications,
  (select count(*) from job_photos p where p.job_id in (select id from target_jobs)) as job_photos,
  (select count(*) from transactions t where t.job_id in (select id from target_jobs)) as transactions,
  (select count(*) from loaner_assignments la where la.job_id in (select id from target_jobs)) as loaner_assignments;
```

If you see other tables with `job_id` FK (e.g., notes/communications/appointments), run a quick search in SQL editor:

```sql
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'jobs'
  and ccu.column_name = 'id'
order by tc.table_name;
```

---

## Step 3 — DELETE (wrap in a transaction)

IMPORTANT: Start with `ROLLBACK;` until you’re confident, then switch to `COMMIT;`.

```sql
begin;

-- Define target set once
with target_jobs as (
  select id
  from jobs
  where created_at >= now() - interval '90 days'
    and (
      title ilike 'E2E %'
      or description ilike '%E2E%'
      or title ilike '%Rob Brasco Test Deal%'
    )
)
-- Delete children first
, del_communications as (
  delete from communications
  where job_id in (select id from target_jobs)
  returning id
)
, del_job_photos as (
  delete from job_photos
  where job_id in (select id from target_jobs)
  returning id
)
, del_loaners as (
  delete from loaner_assignments
  where job_id in (select id from target_jobs)
  returning id
)
, del_job_parts as (
  delete from job_parts
  where job_id in (select id from target_jobs)
  returning id
)
, del_transactions as (
  delete from transactions
  where job_id in (select id from target_jobs)
  returning id
)
-- Delete parent
, del_jobs as (
  delete from jobs
  where id in (select id from target_jobs)
  returning id
)
select
  (select count(*) from del_communications) as deleted_communications,
  (select count(*) from del_job_photos) as deleted_job_photos,
  (select count(*) from del_loaners) as deleted_loaner_assignments,
  (select count(*) from del_job_parts) as deleted_job_parts,
  (select count(*) from del_transactions) as deleted_transactions,
  (select count(*) from del_jobs) as deleted_jobs;

-- If counts look right:
-- commit;
rollback;
```

### Optional: cleanup E2E loaners by loaner_number

If you specifically want to remove test loaners (even if the job filter above is narrow), dry-run first:

```sql
select id, job_id, loaner_number, created_at
from loaner_assignments
where loaner_number ilike 'LOANER-E2E-%'
order by created_at desc
limit 100;
```

Then delete:

```sql
begin;

delete from loaner_assignments
where loaner_number ilike 'LOANER-E2E-%';

rollback;
-- commit;
```

---

## Step 4 — Verify

Re-run Step 2 counts. Also spot-check the UI (Deals list + Loaner badges).
