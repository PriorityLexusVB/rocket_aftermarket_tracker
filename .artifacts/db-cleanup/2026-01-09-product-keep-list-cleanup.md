# Product Keep-List Cleanup (Org-scoped keep-list)

Goal: for **Priority Lexus VB only** (`org_id = a1ac6612-4108-483a-8fcb-62c9ceb2abb1`), keep only these 6 products (from your photo) and delete any other products **in that same org**:

- EverNew 5yr
- EverNew 3yr
- Rust Guard
- Windshield Protection
- Interior Protection
- Exterior Protection

## Evidence snapshot (read-only, Jan 9 2026)

Organizations present:

- `a1ac6612-4108-483a-8fcb-62c9ceb2abb1` (Priority Lexus VB)
- `00000000-0000-0000-0000-0000000000e2` (E2E Org)

Products present:

- Keep-list products (Priority Lexus VB):
  - EverNew 3yr: `bedd08f2-9714-447a-8b18-6f384da23204`
  - EverNew 5yr: `a1558ed3-eea3-419f-9641-5629386cb382`
  - Exterior Protection: `9d17a194-35b2-4e2b-bcbe-351adfc29f75`
  - Interior Protection: `2036ba17-a4ec-4788-bdc5-48e61b113a15`
  - Rust Guard: `0172da8c-e9b2-4882-bb8c-efd64c5b4b9f`
  - Windshield Protection: `e1e7bde4-3e0a-4e04-9599-1511730b5663`
- Non-keep products currently present (E2E org; **must not be impacted by this runbook**):
  - E2E Product 1: `00000000-0000-0000-0000-0000000000b1`
  - E2E Product 2: `00000000-0000-0000-0000-0000000000b2`

Dependencies observed:

- `job_parts.product_id` references products.
- In this environment, the FK `job_parts.product_id -> products.id` is configured with `ON DELETE CASCADE`.
- We still delete dependent `job_parts` first to keep the impact explicit during the rollback verification.

## Step 1 — DRY RUN: confirm current products

```sql
select id, org_id, dealer_id, name, unit_price
from public.products
order by org_id, dealer_id nulls first, name;
```

## Step 2 — DRY RUN: what would be deleted (Priority org only)?

```sql
with
target as (
  select 'a1ac6612-4108-483a-8fcb-62c9ceb2abb1'::uuid as org_id
),
keep_products as (
  select unnest(array[
    'bedd08f2-9714-447a-8b18-6f384da23204'::uuid,
    'a1558ed3-eea3-419f-9641-5629386cb382'::uuid,
    '9d17a194-35b2-4e2b-bcbe-351adfc29f75'::uuid,
    '2036ba17-a4ec-4788-bdc5-48e61b113a15'::uuid,
    '0172da8c-e9b2-4882-bb8c-efd64c5b4b9f'::uuid,
    'e1e7bde4-3e0a-4e04-9599-1511730b5663'::uuid
  ]) as id
),
products_to_delete as (
  select id, org_id, dealer_id, name
  from public.products
  where org_id = (select org_id from target)
    and id not in (select id from keep_products)
)
select *
from products_to_delete
order by org_id, dealer_id nulls first, name;
```

## Step 3 — DELETE (rollback-by-default, Priority org only)

IMPORTANT: start with `ROLLBACK;` until the deleted counts are exactly what you expect.

Expected result for Priority Lexus VB at time of writing: this is a **no-op** (`products_to_delete = 0`, `deleted_job_parts = 0`, `deleted_products = 0`). If it's a no-op, no COMMIT is needed.

```sql
begin;

with
target as (
  select 'a1ac6612-4108-483a-8fcb-62c9ceb2abb1'::uuid as org_id
),
keep_products as (
  select unnest(array[
    -- EverNew 3yr
    'bedd08f2-9714-447a-8b18-6f384da23204'::uuid,
    -- EverNew 5yr
    'a1558ed3-eea3-419f-9641-5629386cb382'::uuid,
    -- Exterior Protection
    '9d17a194-35b2-4e2b-bcbe-351adfc29f75'::uuid,
    -- Interior Protection
    '2036ba17-a4ec-4788-bdc5-48e61b113a15'::uuid,
    -- Rust Guard
    '0172da8c-e9b2-4882-bb8c-efd64c5b4b9f'::uuid,
    -- Windshield Protection
    'e1e7bde4-3e0a-4e04-9599-1511730b5663'::uuid
  ]) as id
),
products_to_delete as (
  select p.id
  from public.products p
  where p.org_id = (select org_id from target)
    and p.id not in (select id from keep_products)
),
-- FK safety: remove dependent job_parts first
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
  where p.id in (select id from products_to_delete)
  returning p.id
)
select
  (select count(*) from keep_products) as keep_products,
  (select count(*) from products_to_delete) as products_to_delete,
  (select count(*) from _del_job_parts) as deleted_job_parts,
  (select count(*) from _del_products) as deleted_products;

rollback;
-- commit;
```

## Step 4 — Verify

```sql
select org_id, count(*) as products_total
from public.products
group by org_id
order by org_id;

select id, org_id, name
from public.products
order by org_id, name;

select count(*) as job_parts_with_product_id
from public.job_parts
where product_id is not null;
```
