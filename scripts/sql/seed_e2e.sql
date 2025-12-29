-- Seed minimal data for E2E runs: one org, staff entries, vendors, products
-- Idempotent upserts

-- Create organization if missing
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-0000000000e2', 'E2E Org')
on conflict (id) do update set name = excluded.name;

-- Vendors
with e2e_org as (
  select coalesce(
    (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
    '00000000-0000-0000-0000-0000000000e2'::uuid
  ) as org_id
)
insert into public.vendors (id, name, is_active, org_id)
select '00000000-0000-0000-0000-0000000000a1'::uuid, 'E2E Vendor 1', true, e2e_org.org_id from e2e_org
union all
select '00000000-0000-0000-0000-0000000000a2'::uuid, 'E2E Vendor 2', true, e2e_org.org_id from e2e_org
on conflict (id) do update set name = excluded.name, is_active = excluded.is_active, org_id = excluded.org_id;

-- Products
with e2e_org as (
  select coalesce(
    (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
    '00000000-0000-0000-0000-0000000000e2'::uuid
  ) as org_id
)
insert into public.products (id, name, brand, unit_price, is_active, org_id)
select '00000000-0000-0000-0000-0000000000b1'::uuid, 'E2E Product 1', 'Brand A', 100, true, e2e_org.org_id from e2e_org
union all
select '00000000-0000-0000-0000-0000000000b2'::uuid, 'E2E Product 2', 'Brand B', 200, true, e2e_org.org_id from e2e_org
on conflict (id) do update set name = excluded.name, brand = excluded.brand, unit_price = excluded.unit_price, is_active = excluded.is_active, org_id = excluded.org_id;

-- Associate the E2E test user with the E2E organization
-- This ensures RLS policies allow the test user to see seeded products/vendors
-- Uses parameterized query support: $E2E_EMAIL$ will be replaced by seedE2E.js
-- Uses INSERT ... ON CONFLICT to create the profile if it doesn't exist yet
insert into public.user_profiles (id, email, full_name, role, org_id, is_active)
with e2e_org as (
  select coalesce(
    (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
    '00000000-0000-0000-0000-0000000000e2'::uuid
  ) as org_id
)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email) as full_name,
  'staff'::public.user_role as role,
  e2e_org.org_id as org_id,
  true as is_active
from auth.users au
cross join e2e_org
where email = $E2E_EMAIL$
on conflict (id) do update 
set org_id = excluded.org_id,
    is_active = excluded.is_active;

-- -----------------------------------------------------------
-- Scheduled job with promised date and active loaner for E2E
-- -----------------------------------------------------------

-- This section is OPTIONAL. Some E2E DBs may not include all scheduling/loaner tables/columns.
-- If it fails, we still want the core seed (org/vendors/products) to succeed.
do $$
begin

-- Insert a vehicle (optional)
insert into public.vehicles (id, stock_number, make, model, year)
values ('00000000-0000-0000-0000-0000000000d1', 'E2E-STK-1', 'Toyota', 'Camry', 2022)
on conflict (id) do update set stock_number = excluded.stock_number, make = excluded.make, model = excluded.model, year = excluded.year;

-- Insert a scheduled job within current week/day
insert into public.jobs (
  id, job_number, title, description, vehicle_id, vendor_id,
  scheduled_start_time, scheduled_end_time, job_status, priority,
  customer_needs_loaner, org_id
)
with e2e_org as (
  select coalesce(
    (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
    '00000000-0000-0000-0000-0000000000e2'::uuid
  ) as org_id
)
select
  '00000000-0000-0000-0000-0000000000e1'::uuid,
  'JOB-E2E-LOANER',
  'E2E Loaner Job',
  'Seeded job for E2E calendar badge check',
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  date_trunc('day', now()) + interval '10 hours',
  date_trunc('day', now()) + interval '12 hours',
  'scheduled',
  'medium',
  true,
  e2e_org.org_id
from e2e_org
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  vehicle_id = excluded.vehicle_id,
  vendor_id = excluded.vendor_id,
  scheduled_start_time = excluded.scheduled_start_time,
  scheduled_end_time = excluded.scheduled_end_time,
  job_status = excluded.job_status,
  priority = excluded.priority,
  customer_needs_loaner = excluded.customer_needs_loaner,
  org_id = excluded.org_id;

-- Ensure a transaction row exists (minimal)
insert into public.transactions (id, job_id, customer_name, total_amount, transaction_status, transaction_number)
values (
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000e1',
  'E2E Customer',
  100,
  'pending',
  'TXN-E2E-1'
)
on conflict (id) do update set customer_name = excluded.customer_name, total_amount = excluded.total_amount, transaction_status = excluded.transaction_status, transaction_number = excluded.transaction_number;

-- Insert a job part with a promised date (tomorrow)
insert into public.job_parts (
  id, job_id, product_id, quantity_used, unit_price,
  promised_date, requires_scheduling, no_schedule_reason, is_off_site
)
values (
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000b1',
  1,
  100,
  (date_trunc('day', now()) + interval '1 day')::date,
  true,
  null,
  false
)
on conflict (id) do update set product_id = excluded.product_id, quantity_used = excluded.quantity_used, unit_price = excluded.unit_price, promised_date = excluded.promised_date, requires_scheduling = excluded.requires_scheduling, no_schedule_reason = excluded.no_schedule_reason, is_off_site = excluded.is_off_site;

-- Active loaner assignment
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loaner_assignments'
      and column_name = 'loaner_number'
  ) then
    insert into public.loaner_assignments (id, job_id, loaner_number, eta_return_date, notes)
    values (
      '00000000-0000-0000-0000-0000000000f3',
      '00000000-0000-0000-0000-0000000000e1',
      'LOANER-E2E-123',
      (date_trunc('day', now()) + interval '2 days')::date,
      'Seeded loaner assignment for E2E'
    )
    on conflict (id) do update
      set loaner_number = excluded.loaner_number,
          eta_return_date = excluded.eta_return_date,
          notes = excluded.notes;
  else
    insert into public.loaner_assignments (id, job_id, eta_return_date, notes)
    values (
      '00000000-0000-0000-0000-0000000000f3',
      '00000000-0000-0000-0000-0000000000e1',
      (date_trunc('day', now()) + interval '2 days')::date,
      'Seeded loaner assignment for E2E'
    )
    on conflict (id) do update
      set eta_return_date = excluded.eta_return_date,
          notes = excluded.notes;
  end if;
end $$;

exception
  when others then
    raise notice 'E2E optional scheduling/loaner seed skipped: %', SQLERRM;
end $$;
