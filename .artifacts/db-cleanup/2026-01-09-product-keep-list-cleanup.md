# Product Keep-List Cleanup (Keep 6, delete all others)

Goal: keep only these 6 products (from your photo) and delete everything else:

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
- Non-keep products currently present:
  - E2E Product 1: `00000000-0000-0000-0000-0000000000b1`
  - E2E Product 2: `00000000-0000-0000-0000-0000000000b2`

Dependencies observed:

- `job_parts.product_id` references E2E Product 1 (116 rows) and EverNew 3yr (38 rows).
- This means product deletion must delete or re-point dependent `job_parts` rows first.

## Step 1 — DRY RUN: confirm current products

```sql
select id, org_id, dealer_id, name, unit_price
from public.products
order by org_id, dealer_id nulls first, name;
```

## Step 2 — DRY RUN: what would be deleted?

```sql
with keep_products as (
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
  where id not in (select id from keep_products)
)
select *
from products_to_delete
order by org_id, dealer_id nulls first, name;
```

## Step 3 — DELETE (rollback-by-default)

IMPORTANT: start with `ROLLBACK;` until the deleted counts are exactly what you expect.

```sql
begin;

with keep_products as (
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
  where p.id not in (select id from keep_products)
),
-- FK safety: remove dependent job_parts first
_del_job_parts as (
  delete from public.job_parts jp
  where jp.product_id in (select id from products_to_delete)
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
select count(*) as products_total from public.products;

select id, name
from public.products
order by name;

select count(*) as job_parts_with_product_id
from public.job_parts
where product_id is not null;
```
