# E2E Org Products Cleanup (E2E-only, org-scoped)

Goal: delete **E2E Org** products (and dependent rows) without any chance of impacting Priority Lexus VB.

Target org:

- E2E Org `org_id`: `00000000-0000-0000-0000-0000000000e2`

Safety rules:

- Every DELETE in this runbook is scoped to the E2E org.
- Delete dependent `job_parts` first (scoped via `jobs.org_id`), then delete `products`.
- Always run `begin; ... rollback;` first and verify counts.

## Step 1 — DRY RUN: confirm E2E products

```sql
select id, org_id, dealer_id, name, unit_price
from public.products
where org_id = '00000000-0000-0000-0000-0000000000e2'
order by name;
```

## Step 2 — DRY RUN: expected delete impact

This estimates how many E2E products will be removed and how many `job_parts` rows reference them (within the E2E org).

```sql
with
  target as (select '00000000-0000-0000-0000-0000000000e2'::uuid as org_id),
  products_to_delete as (
    select p.id
    from public.products p
    join target t on p.org_id = t.org_id
  )
select
  (select count(*)::int from products_to_delete) as products_to_delete,
  (
    select count(*)::int
    from public.job_parts jp
    join public.jobs j on j.id = jp.job_id
    join target t on j.org_id = t.org_id
    where jp.product_id in (select id from products_to_delete)
  ) as job_parts_to_delete;
```

## Step 3 — DELETE (rollback-by-default, E2E org only)

IMPORTANT: start with `rollback;` until the deleted counts are exactly what you expect.

```sql
begin;

with
  target as (select '00000000-0000-0000-0000-0000000000e2'::uuid as org_id),
  products_to_delete as (
    select p.id
    from public.products p
    join target t on p.org_id = t.org_id
  ),
  -- FK safety: remove dependent job_parts first (E2E org only)
  _del_job_parts as (
    delete from public.job_parts jp
    using public.jobs j, target t
    where jp.job_id = j.id
      and j.org_id = t.org_id
      and jp.product_id in (select id from products_to_delete)
    returning jp.id
  ),
  _del_products as (
    delete from public.products p
    using target t
    where p.org_id = t.org_id
    returning p.id
  )
select
  (select count(*)::int from products_to_delete) as products_to_delete,
  (select count(*)::int from _del_job_parts) as deleted_job_parts,
  (select count(*)::int from _del_products) as deleted_products;

rollback;
-- commit;
```

## Step 4 — Verify

```sql
select org_id, count(*)::int as products_total
from public.products
where org_id in (
  'a1ac6612-4108-483a-8fcb-62c9ceb2abb1',
  '00000000-0000-0000-0000-0000000000e2'
)
group by org_id
order by org_id;

select count(*)::int as e2e_job_parts_with_product_id
from public.job_parts jp
join public.jobs j on j.id = jp.job_id
where j.org_id = '00000000-0000-0000-0000-0000000000e2'
  and jp.product_id is not null;
```

## Optional — Schema cache reload (only if you see PostgREST schema cache errors)

```sql
NOTIFY pgrst, 'reload schema';
```
