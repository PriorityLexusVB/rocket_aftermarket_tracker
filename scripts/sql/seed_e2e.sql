-- Seed minimal data for E2E runs: one org, staff entries, vendors, products
-- Idempotent upserts
--
-- 🚫 Production safety:
-- This file is intended to be executed by repo scripts (e.g. scripts/seedE2E.js) which
-- hard-abort if the target connection string contains the production project ref:
--   ogjtmtndgiqqdtwatsue
--
-- To override (NOT recommended), you must run the script with BOTH:
--   CONFIRM_PROD=YES and ALLOW_SEED_PROD=YES

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
  'admin'::public.user_role as role,
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

-- Insert a vehicle (optional)
insert into public.vehicles (id, stock_number, make, model, year, dealer_id)
values (
  '00000000-0000-0000-0000-0000000000d1',
  'E2E-STK-1',
  'Toyota',
  'Camry',
  2022,
  '00000000-0000-0000-0000-0000000000e2'::uuid
)
on conflict (id) do update set
  stock_number = excluded.stock_number,
  make = excluded.make,
  model = excluded.model,
  year = excluded.year,
  dealer_id = excluded.dealer_id;

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
  promised_date, requires_scheduling, scheduled_start_time, scheduled_end_time
)
values (
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000b1',
  1,
  100,
  date_trunc('day', now())::date,
  true,
  date_trunc('day', now()) + interval '10 hours',
  date_trunc('day', now()) + interval '12 hours'
)
on conflict (id) do update set
  product_id = excluded.product_id,
  quantity_used = excluded.quantity_used,
  unit_price = excluded.unit_price,
  promised_date = excluded.promised_date,
  requires_scheduling = excluded.requires_scheduling,
  scheduled_start_time = excluded.scheduled_start_time,
  scheduled_end_time = excluded.scheduled_end_time;

-- -----------------------------------------------------------
-- Scheduled job without loaner (time-editable example)
-- -----------------------------------------------------------

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
  '00000000-0000-0000-0000-0000000000e3'::uuid,
  'JOB-E2E-SCHEDULED',
  'E2E Scheduled Job',
  'Seeded job for time edit (no loaner)',
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  '00000000-0000-0000-0000-0000000000a2'::uuid,
  date_trunc('day', now()) + interval '14 hours',
  date_trunc('day', now()) + interval '15 hours',
  'scheduled',
  'medium',
  false,
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

insert into public.transactions (id, job_id, customer_name, total_amount, transaction_status, transaction_number)
values (
  '00000000-0000-0000-0000-0000000000f4',
  '00000000-0000-0000-0000-0000000000e3',
  'E2E Customer 2',
  200,
  'pending',
  'TXN-E2E-2'
)
on conflict (id) do update set customer_name = excluded.customer_name, total_amount = excluded.total_amount, transaction_status = excluded.transaction_status, transaction_number = excluded.transaction_number;

insert into public.job_parts (
  id, job_id, product_id, quantity_used, unit_price,
  promised_date, requires_scheduling, scheduled_start_time, scheduled_end_time
)
values (
  '00000000-0000-0000-0000-0000000000f5',
  '00000000-0000-0000-0000-0000000000e3',
  '00000000-0000-0000-0000-0000000000b2',
  1,
  200,
  date_trunc('day', now())::date,
  true,
  date_trunc('day', now()) + interval '14 hours',
  date_trunc('day', now()) + interval '15 hours'
)
on conflict (id) do update set
  product_id = excluded.product_id,
  quantity_used = excluded.quantity_used,
  unit_price = excluded.unit_price,
  promised_date = excluded.promised_date,
  requires_scheduling = excluded.requires_scheduling,
  scheduled_start_time = excluded.scheduled_start_time,
  scheduled_end_time = excluded.scheduled_end_time;

do $$
begin
  -- Prefer the minimal schema used by the E2E bootstrap (org_id + customer_phone).
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loaner_assignments'
      and column_name = 'customer_phone'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'loaner_assignments'
        and column_name = 'loaner_number'
    ) then
      with e2e_org as (
        select coalesce(
          (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
          '00000000-0000-0000-0000-0000000000e2'::uuid
        ) as org_id
      )
      insert into public.loaner_assignments (id, job_id, org_id, customer_phone, loaner_number)
      select
        '00000000-0000-0000-0000-0000000000f3'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        e2e_org.org_id,
        '555-0100',
        'E2E-LOANER-001'
      from e2e_org
      on conflict (id) do update
        set org_id = excluded.org_id,
            customer_phone = excluded.customer_phone,
            loaner_number = excluded.loaner_number;
    else
      with e2e_org as (
        select coalesce(
          (select org_id from public.user_profiles where email = $E2E_EMAIL$ limit 1),
          '00000000-0000-0000-0000-0000000000e2'::uuid
        ) as org_id
      )
      insert into public.loaner_assignments (id, job_id, org_id, customer_phone)
      select
        '00000000-0000-0000-0000-0000000000f3'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        e2e_org.org_id,
        '555-0100'
      from e2e_org
      on conflict (id) do update
        set org_id = excluded.org_id,
            customer_phone = excluded.customer_phone;
    end if;

  -- Legacy schema fallback (only if those columns exist).
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loaner_assignments'
      and column_name = 'eta_return_date'
  ) then
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
        'E2E-LOANER-001',
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

  -- Ultra-minimal fallback.
  else
    insert into public.loaner_assignments (id, job_id)
    values (
      '00000000-0000-0000-0000-0000000000f3',
      '00000000-0000-0000-0000-0000000000e1'
    )
    on conflict (id) do update set job_id = excluded.job_id;
  end if;
end $$;
