# PROD Data Cleanup Resume (Tenant-scoped, Safety-First)

This doc is a copy/paste runbook for cleaning up **one tenant only** in the **Supabase PROD** project.

Goal:

- Derive the tenant (`dealer_id`/`org_id`) from the **real anchor deal** (customer name contains **ROB BRASCO**)
- Delete everything else **inside that tenant only**
- Leave all other tenants untouched

**Important:** You execute the SQL manually in the Supabase Dashboard SQL editor (PROD project). This repo should remain pointed at non-prod by default.

Production project ref (hard guard): `ogjtmtndgiqqdtwatsue`

---

## Step 0 — Make sure we only delete inside the correct tenant

We’ll:

- derive the tenant/dealer_id from that deal
- delete everything else inside that tenant (and only that tenant)
- leave all other tenants untouched

This prevents nuking unrelated prod data if anything exists.

---

## Step 1 — Run a “FK discovery” query first (no guessing what to delete)

In Supabase SQL editor (PROD project), run:

```sql
-- Find all tables that reference public.jobs(id) via foreign keys.
select
  conrelid::regclass as referencing_table,
  a.attname as referencing_column,
  confrelid::regclass as referenced_table,
  af.attname as referenced_column,
  pg_get_constraintdef(c.oid) as constraint_def
from pg_constraint c
join pg_attribute a
  on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
join pg_attribute af
  on af.attrelid = c.confrelid and af.attnum = any (c.confkey)
where c.contype = 'f'
  and c.confrelid = 'public.jobs'::regclass
order by referencing_table::text, referencing_column;
```

✅ This tells you exactly which tables must be deleted first (or which will cascade).

---

## Step 2 — Dry-run report (counts + ID lists) — DO NOT DELETE YET

Run this next:

```sql
-- DRY RUN: compute tenant from ROB BRASCO deal(s), build delete set, show counts + samples.

with keep_jobs as (
  select distinct t.job_id
  from public.transactions t
  where t.customer_name ilike '%ROB BRASCO%'
),
tenant as (
  select
    count(distinct coalesce(j.dealer_id, j.org_id)) as tenant_count,
    max(coalesce(j.dealer_id, j.org_id)) as tenant_id
  from public.jobs j
  where j.id in (select job_id from keep_jobs)
),
delete_jobs as (
  select j.id
  from public.jobs j
  cross join tenant t
  where coalesce(j.dealer_id, j.org_id) = t.tenant_id
    and j.id not in (select job_id from keep_jobs)
)
select
  (select tenant_count from tenant) as tenant_count,
  (select tenant_id from tenant) as tenant_id,
  (select count(*) from keep_jobs) as keep_job_count,
  (select count(*) from delete_jobs) as delete_job_count,
  (select count(*) from public.job_parts where job_id in (select id from delete_jobs)) as delete_job_parts,
  (select count(*) from public.loaner_assignments where job_id in (select id from delete_jobs)) as delete_loaner_assignments,
  (select count(*) from public.transactions where job_id in (select id from delete_jobs)) as delete_transactions,
  (select count(*) from public.deal_opportunities where job_id in (select id from delete_jobs)) as delete_opportunities;
```

Then also list sample delete jobs to make sure they look fake:

```sql
with keep_jobs as (
  select distinct t.job_id
  from public.transactions t
  where t.customer_name ilike '%ROB BRASCO%'
),
tenant as (
  select max(coalesce(j.dealer_id, j.org_id)) as tenant_id
  from public.jobs j
  where j.id in (select job_id from keep_jobs)
),
delete_jobs as (
  select j.id, j.job_number, j.title, j.description, j.created_at
  from public.jobs j
  cross join tenant t
  where coalesce(j.dealer_id, j.org_id) = t.tenant_id
    and j.id not in (select job_id from keep_jobs)
)
select *
from delete_jobs
order by created_at desc
limit 50;
```

✅ If `tenant_count ≠ 1` or `tenant_id` is null → STOP (that means “ROB BRASCO” data isn’t a clean anchor).

---

## Step 3 — Export the delete list (audit trail)

Run:

```sql
with keep_jobs as (
  select distinct t.job_id
  from public.transactions t
  where t.customer_name ilike '%ROB BRASCO%'
),
tenant as (
  select max(coalesce(j.dealer_id, j.org_id)) as tenant_id
  from public.jobs j
  where j.id in (select job_id from keep_jobs)
),
delete_jobs as (
  select j.id
  from public.jobs j
  cross join tenant t
  where coalesce(j.dealer_id, j.org_id) = t.tenant_id
    and j.id not in (select job_id from keep_jobs)
)
select id
from delete_jobs
order by id;
```

Copy results into a file in your repo:

```
.artifacts/prod-cleanup/delete_jobs_<YYYYMMDD>.txt
```

---

## Step 4 — The actual delete (transactional + safety threshold)

Only after the dry-run looks correct.

IMPORTANT: This version includes a “too big” safety threshold so you don’t delete a thousand records by mistake.

```sql
do $$
declare
  v_tenant_count int;
  v_tenant_id uuid;
  v_delete_count int;
begin
  -- Resolve tenant from ROB BRASCO jobs
  select
    count(distinct coalesce(j.dealer_id, j.org_id)),
    max(coalesce(j.dealer_id, j.org_id))
  into v_tenant_count, v_tenant_id
  from public.jobs j
  where j.id in (
    select distinct t.job_id
    from public.transactions t
    where t.customer_name ilike '%ROB BRASCO%'
  );

  if v_tenant_count <> 1 or v_tenant_id is null then
    raise exception 'Abort: expected exactly 1 tenant from ROB BRASCO jobs, got % / %', v_tenant_count, v_tenant_id;
  end if;

  -- Count delete jobs inside tenant excluding ROB BRASCO keep set
  select count(*)
  into v_delete_count
  from public.jobs j
  where coalesce(j.dealer_id, j.org_id) = v_tenant_id
    and j.id not in (
      select distinct t.job_id
      from public.transactions t
      where t.customer_name ilike '%ROB BRASCO%'
    );

  raise notice 'Tenant: %, jobs to delete: %', v_tenant_id, v_delete_count;

  -- Safety threshold: adjust if needed, but forces a pause if counts are huge.
  if v_delete_count > 500 then
    raise exception 'Abort: refusing to delete % jobs (threshold exceeded). Review dry-run first.', v_delete_count;
  end if;

  -- Perform deletes in dependency-safe order.
  -- NOTE: If your FK discovery shows other referencing tables, add them here.
  delete from public.deal_opportunities where job_id in (
    select j.id from public.jobs j
    where coalesce(j.dealer_id, j.org_id) = v_tenant_id
      and j.id not in (
        select distinct t.job_id from public.transactions t
        where t.customer_name ilike '%ROB BRASCO%'
      )
  );

  delete from public.job_parts where job_id in (
    select j.id from public.jobs j
    where coalesce(j.dealer_id, j.org_id) = v_tenant_id
      and j.id not in (
        select distinct t.job_id from public.transactions t
        where t.customer_name ilike '%ROB BRASCO%'
      )
  );

  delete from public.loaner_assignments where job_id in (
    select j.id from public.jobs j
    where coalesce(j.dealer_id, j.org_id) = v_tenant_id
      and j.id not in (
        select distinct t.job_id from public.transactions t
        where t.customer_name ilike '%ROB BRASCO%'
      )
  );

  delete from public.transactions where job_id in (
    select j.id from public.jobs j
    where coalesce(j.dealer_id, j.org_id) = v_tenant_id
      and j.id not in (
        select distinct t.job_id from public.transactions t
        where t.customer_name ilike '%ROB BRASCO%'
      )
  );

  delete from public.jobs where coalesce(dealer_id, org_id) = v_tenant_id
    and id not in (
      select distinct t.job_id
      from public.transactions t
      where t.customer_name ilike '%ROB BRASCO%'
    );

end $$;
```

Supabase SQL editor runs statements individually, but the DO block executes atomically per statement.

Afterwards, re-run the dry-run counts and confirm `delete_job_count = 0`.

---

## Step 5 — Prevent this from ever happening again (the “don’t seed prod” guardrail)

In the repo, add a hard guard to any seed scripts:

- `seedE2E.js`
- `scripts/sql/seed_e2e.sql`
- etc.

Require two-key unlock to run against prod:

- `CONFIRM_PROD=YES` and `ALLOW_SEED_PROD=YES`

Default behavior must abort on prod project ref `ogjtmtndgiqqdtwatsue`.

---

## What to tell VS Code Agent to do tomorrow

If you want the agent to do it inside VS Code, the most efficient method is:

- Agent creates this doc with the exact SQL above
- You execute the SQL in Supabase dashboard (fast, no env issues)
- Agent hardens seed scripts with the double-confirm guard and runs `pnpm -s verify`
