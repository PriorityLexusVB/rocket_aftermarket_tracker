
-- Seed data for E2E runs (idempotent).
-- Canon: dealer_id tenancy, with org_id fallback when running against older schemas.
-- Note: $E2E_EMAIL$ is replaced by the seed runner.

-- Create organization if missing (used as fallback tenant id)
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-0000000000e2', 'E2E Org')
on conflict (id) do update set name = excluded.name;

-- Insert a vehicle (tenantless)
insert into public.vehicles (id, stock_number, make, model, year)
values ('00000000-0000-0000-0000-0000000000d1', 'E2E-STK-1', 'Toyota', 'Camry', 2022)
on conflict (id) do update
set stock_number = excluded.stock_number,
    make = excluded.make,
    model = excluded.model,
    year = excluded.year;

do $$
declare
  e2e_org_id uuid := '00000000-0000-0000-0000-0000000000e2'::uuid;

  tenant_id uuid;

  -- per-table tenant column name (dealer_id preferred)
  user_profiles_tenant_col text;
  vendors_tenant_col text;
  products_tenant_col text;
  jobs_tenant_col text;
  transactions_tenant_col text;
  job_parts_tenant_col text;
  loaners_tenant_col text;

  e2e_user_id uuid;
  e2e_user_email text;
  e2e_user_full_name text;

  sql text;
begin
  -- Resolve auth user
  select au.id,
         au.email,
         coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email)
    into e2e_user_id, e2e_user_email, e2e_user_full_name
  from auth.users au
  where au.email = $E2E_EMAIL$
  limit 1;

  if e2e_user_id is null then
    raise exception 'E2E seed: auth.users row not found for %', $E2E_EMAIL$;
  end if;

  -- Determine tenant columns (dealer_id preferred)
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='org_id') then 'org_id'
           else null
         end
    into user_profiles_tenant_col;

  if user_profiles_tenant_col is null then
    raise exception 'E2E seed: user_profiles missing dealer_id/org_id';
  end if;

  -- Determine tenant_id from existing profile when possible
  sql := format('select %I from public.user_profiles where email = $1 limit 1', user_profiles_tenant_col);
  execute sql into tenant_id using $E2E_EMAIL$;
  tenant_id := coalesce(tenant_id, e2e_org_id);

  -- Upsert user profile with tenant
  sql := format($fmt$
    insert into public.user_profiles (id, email, full_name, role, %1$I, is_active)
    values ($1, $2, $3, 'admin'::public.user_role, $4, true)
    on conflict (id) do update
      set %1$I = excluded.%1$I,
          is_active = excluded.is_active,
          full_name = excluded.full_name
  $fmt$, user_profiles_tenant_col);
  execute sql using e2e_user_id, e2e_user_email, e2e_user_full_name, tenant_id;

  -- Vendors
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='vendors' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='vendors' and column_name='org_id') then 'org_id'
           else null
         end
    into vendors_tenant_col;

  if vendors_tenant_col is not null then
    sql := format($fmt$
      insert into public.vendors (id, name, is_active, %1$I)
      values ($1, $2, true, $3)
      on conflict (id) do update
        set name = excluded.name,
            is_active = excluded.is_active,
            %1$I = excluded.%1$I
    $fmt$, vendors_tenant_col);

    execute sql using '00000000-0000-0000-0000-0000000000a1'::uuid, 'E2E Vendor 1', tenant_id;
    execute sql using '00000000-0000-0000-0000-0000000000a2'::uuid, 'E2E Vendor 2', tenant_id;
  end if;

  -- Products
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='org_id') then 'org_id'
           else null
         end
    into products_tenant_col;

  if products_tenant_col is not null then
    sql := format($fmt$
      insert into public.products (id, name, brand, unit_price, is_active, %1$I)
      values ($1, $2, $3, $4, true, $5)
      on conflict (id) do update
        set name = excluded.name,
            brand = excluded.brand,
            unit_price = excluded.unit_price,
            is_active = excluded.is_active,
            %1$I = excluded.%1$I
    $fmt$, products_tenant_col);

    execute sql using '00000000-0000-0000-0000-0000000000b1'::uuid, 'E2E Product 1', 'Brand A', 100, tenant_id;
    execute sql using '00000000-0000-0000-0000-0000000000b2'::uuid, 'E2E Product 2', 'Brand B', 200, tenant_id;
  end if;

  -- Jobs
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='org_id') then 'org_id'
           else null
         end
    into jobs_tenant_col;

  if jobs_tenant_col is not null then
    sql := format($fmt$
      insert into public.jobs (
        id, job_number, title, description, vehicle_id, vendor_id,
        scheduled_start_time, scheduled_end_time, job_status, priority,
        customer_needs_loaner, %1$I
      )
      values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12
      )
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
        %1$I = excluded.%1$I
    $fmt$, jobs_tenant_col);

    execute sql using
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
      tenant_id;
  end if;

  -- Transactions (if table has tenant column)
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='org_id') then 'org_id'
           else null
         end
    into transactions_tenant_col;

  if transactions_tenant_col is not null then
    sql := format($fmt$
      insert into public.transactions (
        id, job_id, customer_name, total_amount, transaction_status, transaction_number, %1$I
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update set
        customer_name = excluded.customer_name,
        total_amount = excluded.total_amount,
        transaction_status = excluded.transaction_status,
        transaction_number = excluded.transaction_number,
        %1$I = excluded.%1$I
    $fmt$, transactions_tenant_col);

    execute sql using
      '00000000-0000-0000-0000-0000000000f1'::uuid,
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      'E2E Customer',
      100,
      'pending',
      'TXN-E2E-1',
      tenant_id;
  end if;

  -- Job parts (promised date)
  select case
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='job_parts' and column_name='dealer_id') then 'dealer_id'
           when exists (select 1 from information_schema.columns where table_schema='public' and table_name='job_parts' and column_name='org_id') then 'org_id'
           else null
         end
    into job_parts_tenant_col;

  if job_parts_tenant_col is not null then
    sql := format($fmt$
      insert into public.job_parts (
        id, job_id, product_id, quantity_used, unit_price, promised_date, %1$I
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update set
        product_id = excluded.product_id,
        quantity_used = excluded.quantity_used,
        unit_price = excluded.unit_price,
        promised_date = excluded.promised_date,
        %1$I = excluded.%1$I
    $fmt$, job_parts_tenant_col);

    execute sql using
      '00000000-0000-0000-0000-0000000000f2'::uuid,
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      '00000000-0000-0000-0000-0000000000b1'::uuid,
      1,
      100,
      (date_trunc('day', now()) + interval '1 day')::date,
      tenant_id;
  else
    -- legacy table without tenant column
    insert into public.job_parts (
      id, job_id, product_id, quantity_used, unit_price, promised_date
    )
    values (
      '00000000-0000-0000-0000-0000000000f2'::uuid,
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      '00000000-0000-0000-0000-0000000000b1'::uuid,
      1,
      100,
      (date_trunc('day', now()) + interval '1 day')::date
    )
    on conflict (id) do update
      set product_id = excluded.product_id,
          quantity_used = excluded.quantity_used,
          unit_price = excluded.unit_price,
          promised_date = excluded.promised_date;
  end if;

  -- Loaner assignment: prefer (customer_phone + tenant column) if available
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='loaner_assignments' and column_name='customer_phone'
  ) then
    select case
             when exists (select 1 from information_schema.columns where table_schema='public' and table_name='loaner_assignments' and column_name='dealer_id') then 'dealer_id'
             when exists (select 1 from information_schema.columns where table_schema='public' and table_name='loaner_assignments' and column_name='org_id') then 'org_id'
             else null
           end
      into loaners_tenant_col;

    if loaners_tenant_col is not null then
      sql := format($fmt$
        insert into public.loaner_assignments (id, job_id, %1$I, customer_phone)
        values ($1, $2, $3, $4)
        on conflict (id) do update
          set %1$I = excluded.%1$I,
              customer_phone = excluded.customer_phone
      $fmt$, loaners_tenant_col);

      execute sql using
        '00000000-0000-0000-0000-0000000000f3'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        tenant_id,
        '555-0100';
    else
      insert into public.loaner_assignments (id, job_id, customer_phone)
      values (
        '00000000-0000-0000-0000-0000000000f3'::uuid,
        '00000000-0000-0000-0000-0000000000e1'::uuid,
        '555-0100'
      )
      on conflict (id) do update set customer_phone = excluded.customer_phone;
    end if;

  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='loaner_assignments' and column_name='eta_return_date'
  ) then
    insert into public.loaner_assignments (id, job_id, eta_return_date, notes)
    values (
      '00000000-0000-0000-0000-0000000000f3'::uuid,
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      (date_trunc('day', now()) + interval '2 days')::date,
      'Seeded loaner assignment for E2E'
    )
    on conflict (id) do update
      set eta_return_date = excluded.eta_return_date,
          notes = excluded.notes;

  else
    insert into public.loaner_assignments (id, job_id)
    values (
      '00000000-0000-0000-0000-0000000000f3'::uuid,
      '00000000-0000-0000-0000-0000000000e1'::uuid
    )
    on conflict (id) do update set job_id = excluded.job_id;
  end if;
end $$;
