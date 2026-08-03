-- Rocket Auth, personnel, tenant-boundary, and atomic-deletion remediation.
--
-- This migration is intentionally generic. Ashley Terminello's production
-- offboarding is an operator action after these controls are live; no employee
-- UUID or generated identity is embedded in schema history.

begin;

-- Fail closed before adding identity uniqueness guarantees.
do $$
begin
  if exists (
    select 1
    from public.user_profiles
    where email is not null
    group by pg_catalog.lower(email)
    having count(*) > 1
  ) then
    raise exception 'Duplicate case-insensitive user profile emails exist';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate auth_user_id links exist';
  end if;

  if not exists (
    select 1
    from public.user_profiles
    where role = 'admin'
      and is_active is true
      and auth_user_id is not null
  ) then
    raise exception 'No active linked administrator exists';
  end if;
end
$$;

create unique index if not exists user_profiles_email_lower_uidx
  on public.user_profiles ((pg_catalog.lower(email)));

create unique index if not exists user_profiles_auth_user_id_uidx
  on public.user_profiles (auth_user_id)
  where auth_user_id is not null;

-- Rocket has always used one UUID as both the application profile identity
-- and the Supabase Auth identity. Eighteen foreign keys and existing client
-- writes depend on that invariant, so make it explicit before adding invites.
alter table public.user_profiles
  drop constraint if exists user_profiles_auth_identity_matches;
alter table public.user_profiles
  add constraint user_profiles_auth_identity_matches
  check (auth_user_id is null or auth_user_id = id);

-- Every data-access helper resolves the current profile from the database.
-- Stale JWT metadata can no longer keep a deactivated user inside a tenant.
create or replace function public.auth_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
  select exists (
    select 1
    from public.user_profiles up
    where (
      up.id = (select auth.uid())
      or up.auth_user_id = (select auth.uid())
    )
      and up.is_active is true
  );
$$;

revoke all on function public.auth_user_is_active() from public, anon;
grant execute on function public.auth_user_is_active() to authenticated, service_role;

create or replace function public.auth_user_org()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
  select up.org_id
  from public.user_profiles up
  where (
    up.id = (select auth.uid())
    or up.auth_user_id = (select auth.uid())
  )
    and up.is_active is true
  order by
    case when up.auth_user_id = (select auth.uid()) then 0 else 1 end,
    up.created_at,
    up.id
  limit 1;
$$;

revoke all on function public.auth_user_org() from public, anon;
grant execute on function public.auth_user_org() to authenticated, service_role;

create or replace function public.auth_dealer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
  select coalesce(up.dealer_id, up.org_id)
  from public.user_profiles up
  where (
    up.id = (select auth.uid())
    or up.auth_user_id = (select auth.uid())
  )
    and up.is_active is true
  order by
    case when up.auth_user_id = (select auth.uid()) then 0 else 1 end,
    up.created_at,
    up.id
  limit 1;
$$;

revoke all on function public.auth_dealer_id() from public, anon;
grant execute on function public.auth_dealer_id() to authenticated, service_role;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
  select exists (
    select 1
    from public.user_profiles up
    where (
      up.id = (select auth.uid())
      or up.auth_user_id = (select auth.uid())
    )
      and up.is_active is true
      and up.role in ('admin', 'manager')
  );
$$;

revoke all on function public.is_admin_or_manager() from public, anon;
grant execute on function public.is_admin_or_manager() to authenticated, service_role;

-- Public sign-up is now functionally closed even if the hosted Auth setting
-- drifts open: an Auth identity can only link to a server-created, inactive,
-- same-email profile. Roles and tenant fields never come from user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_profile_id uuid;
begin
  if new.email is null then
    raise exception using
      errcode = '22004',
      message = 'Email is required';
  end if;

  -- The inactive pre-profile cannot keep its generated UUID: application
  -- foreign keys store user_profiles.id while current clients write Auth UUIDs.
  -- Updating both columns in one statement preserves the canonical invariant.
  -- A referenced pre-profile fails closed here instead of creating a split ID.
  update public.user_profiles as up
  set id = new.id,
      auth_user_id = new.id,
      updated_at = pg_catalog.now()
  where up.id = (
    select candidate.id
    from public.user_profiles candidate
    where pg_catalog.lower(candidate.email) = pg_catalog.lower(new.email)
      and candidate.auth_user_id is null
      and candidate.is_active is false
      and candidate.dealer_id is not null
      and candidate.org_id is not null
      and candidate.dealer_id = candidate.org_id
    order by candidate.created_at, candidate.id
    limit 1
  )
  returning up.id into v_profile_id;

  if v_profile_id is null then
    raise exception using
      errcode = '42501',
      message = 'Rocket access requires a pre-provisioned invitation';
  end if;

  if v_profile_id <> new.id then
    raise exception using
      errcode = '23514',
      message = 'Rocket profile identity did not match the Auth identity';
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Browser sessions may read their own profile and managers may continue to
-- maintain directory-only reference records. Self-provisioning, self-role
-- mutation, and destructive profile deletion are removed; linked account
-- changes go through the trusted server endpoint.
drop policy if exists user_profiles_insert_self on public.user_profiles;
drop policy if exists user_profiles_update_self on public.user_profiles;
drop policy if exists admin_manager_delete_user_profiles_in_org on public.user_profiles;

-- A restrictive policy is ANDed with every existing permissive policy. This
-- gives inactive accounts an immediate database kill switch even while an old
-- access-token JWT is waiting to expire.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'activity_history',
    'claim_attachments',
    'claims',
    'communications',
    'deal_opportunities',
    'filter_presets',
    'job_parts',
    'job_photos',
    'jobs',
    'loaner_assignments',
    'notification_outbox',
    'notification_preferences',
    'organizations',
    'products',
    'sms_opt_outs',
    'sms_templates',
    'transactions',
    'user_profiles',
    'vehicle_products',
    'vehicles',
    'vendor_hours',
    'vendors'
  ]
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      raise exception 'Expected Rocket table is missing: %', v_table;
    end if;

    execute pg_catalog.format(
      'drop policy if exists rocket_active_user_required on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'create policy rocket_active_user_required
         on public.%I
         as restrictive
         for all
         to authenticated
         using ((select public.auth_user_is_active()))
         with check ((select public.auth_user_is_active()))',
      v_table
    );
  end loop;
end
$$;

-- Public warranty claims use narrow SECURITY DEFINER RPCs. Anonymous callers
-- receive a receipt, never table SELECT access, and cannot choose a tenant.
-- The deployment precheck guarantees this internal organization label resolves
-- to exactly one Rocket tenant without embedding a generated UUID in code.
do $$
begin
  if (
    select count(*)
    from public.organizations
    where name = 'Priority Lexus VB'
  ) <> 1 then
    raise exception 'Expected exactly one Priority Lexus organization';
  end if;
end
$$;

create or replace function public.get_public_claim_products()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  unit_price numeric
)
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
  select p.id, p.name, p.brand, p.category, p.unit_price
  from public.products p
  join public.organizations o on o.id = p.dealer_id
  where o.name = 'Priority Lexus VB'
    and p.is_active is not false
  order by p.name, p.id;
$$;

revoke all on function public.get_public_claim_products()
  from public, anon, authenticated;
grant execute on function public.get_public_claim_products()
  to anon, authenticated;

create or replace function public.submit_guest_claim(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_product_id uuid,
  p_issue_description text,
  p_preferred_resolution text,
  p_priority text
)
returns table (
  id uuid,
  claim_number text,
  customer_name text,
  status public.claim_status,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_dealer_id uuid;
  v_priority public.claim_priority;
begin
  select o.id
  into strict v_dealer_id
  from public.organizations o
  where o.name = 'Priority Lexus VB';

  if nullif(pg_catalog.btrim(p_customer_name), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_customer_name)) > 200 then
    raise exception using errcode = '22023', message = 'Invalid customer name';
  end if;

  if nullif(pg_catalog.btrim(p_customer_email), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_customer_email)) > 254
     or pg_catalog.btrim(p_customer_email)
        !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid customer email';
  end if;

  if nullif(pg_catalog.btrim(p_customer_phone), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_customer_phone)) > 50 then
    raise exception using errcode = '22023', message = 'Invalid customer phone';
  end if;

  if nullif(pg_catalog.btrim(p_issue_description), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_issue_description)) > 10000 then
    raise exception using errcode = '22023', message = 'Invalid issue description';
  end if;

  if nullif(pg_catalog.btrim(p_preferred_resolution), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_preferred_resolution)) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid preferred resolution';
  end if;

  if p_priority is null
     or p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'Invalid claim priority';
  end if;
  v_priority := p_priority::public.claim_priority;

  if p_product_id is not null and not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.dealer_id = v_dealer_id
      and p.is_active is not false
  ) then
    raise exception using errcode = '22023', message = 'Invalid claim product';
  end if;

  return query
  insert into public.claims as c (
    claim_number,
    customer_name,
    customer_email,
    customer_phone,
    product_id,
    issue_description,
    preferred_resolution,
    priority,
    status,
    dealer_id,
    org_id
  ) values (
    public.generate_claim_number(),
    pg_catalog.btrim(p_customer_name),
    pg_catalog.lower(pg_catalog.btrim(p_customer_email)),
    pg_catalog.btrim(p_customer_phone),
    p_product_id,
    pg_catalog.btrim(p_issue_description),
    nullif(pg_catalog.btrim(p_preferred_resolution), ''),
    v_priority,
    'submitted'::public.claim_status,
    v_dealer_id,
    v_dealer_id
  )
  returning c.id, c.claim_number, c.customer_name, c.status, c.created_at;
end;
$$;

revoke all on function public.submit_guest_claim(
  text, text, text, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_guest_claim(
  text, text, text, uuid, text, text, text
) to anon, authenticated;

-- Compatibility bridge: the legacy anonymous table policies/grants remain
-- until the RPC client is live. The follow-up guest-claim cleanup migration
-- removes them only after the verified client deployment is promoted.

-- Authenticated claims policies are same-tenant only. The old unowned-row
-- branches made a null-tenant guest claim visible in every organization.
drop policy if exists claims_customer_select_own_email on public.claims;
create policy claims_customer_select_own_email
  on public.claims for select to authenticated
  using (
    dealer_id = public.auth_dealer_id()
    and customer_email = ((select auth.jwt()) ->> 'email')
  );

drop policy if exists claims_staff_select_scoped on public.claims;
create policy claims_staff_select_scoped
  on public.claims for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists claims_staff_update_scoped on public.claims;
create policy claims_staff_update_scoped
  on public.claims for update to authenticated
  using (
    dealer_id = public.auth_dealer_id()
    and (
      public.is_admin_or_manager()
      or assigned_to = (select auth.uid())
    )
  )
  with check (
    dealer_id = public.auth_dealer_id()
    and (
      public.is_admin_or_manager()
      or assigned_to = (select auth.uid())
    )
  );

drop policy if exists users_can_update_claims on public.claims;

drop policy if exists claim_attachments_customer_select on public.claim_attachments;
create policy claim_attachments_customer_select
  on public.claim_attachments for select to authenticated
  using (
    dealer_id = public.auth_dealer_id()
    and exists (
      select 1
      from public.claims c
      where c.id = claim_attachments.claim_id
        and c.dealer_id = public.auth_dealer_id()
        and c.customer_email = ((select auth.jwt()) ->> 'email')
    )
  );

drop policy if exists claim_attachments_staff_select on public.claim_attachments;
create policy claim_attachments_staff_select
  on public.claim_attachments for select to authenticated
  using (dealer_id = public.auth_dealer_id());

-- Remove manager-wide cross-tenant OR branches. Same-tenant behavior remains.
drop policy if exists job_parts_select_tenant on public.job_parts;
create policy job_parts_select_tenant
  on public.job_parts for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists staff_can_view_jobs on public.jobs;
create policy staff_can_view_jobs
  on public.jobs for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists loaner_assignments_select_tenant on public.loaner_assignments;
create policy loaner_assignments_select_tenant
  on public.loaner_assignments for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists users_can_view_loaner_assignments on public.loaner_assignments;
create policy users_can_view_loaner_assignments
  on public.loaner_assignments for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists sms_opt_outs_select on public.sms_opt_outs;
create policy sms_opt_outs_select
  on public.sms_opt_outs for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists sms_templates_select_tenant on public.sms_templates;
create policy sms_templates_select_tenant
  on public.sms_templates for select to authenticated
  using (dealer_id = public.auth_dealer_id());

-- These older permissive policies bypassed tenant scope by OR-ing a global
-- active-row or role-only branch with the scoped policies above.
drop policy if exists sms_templates_read_active on public.sms_templates;
create policy sms_templates_read_active
  on public.sms_templates for select to authenticated
  using (
    dealer_id = public.auth_dealer_id()
    and coalesce(is_active, true)
  );
drop policy if exists sms_templates_admin_manage on public.sms_templates;

drop policy if exists transactions_select_tenant on public.transactions;
create policy transactions_select_tenant
  on public.transactions for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists staff_can_view_vehicles on public.vehicles;
create policy staff_can_view_vehicles
  on public.vehicles for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists vehicles_select_tenant on public.vehicles;
create policy vehicles_select_tenant
  on public.vehicles for select to authenticated
  using (dealer_id = public.auth_dealer_id());

drop policy if exists vendors_select_tenant_active on public.vendors;
create policy vendors_select_tenant_active
  on public.vendors for select to authenticated
  using (
    dealer_id = public.auth_dealer_id()
    and (public.is_admin_or_manager() or coalesce(is_active, true))
  );

-- Notification rows contain customer phone numbers. Remove role-only global
-- access; future browser-created rows must carry the actor's tenant.
-- Preserve but quarantine legacy pending rows whose tenant cannot be proven;
-- the service-role outbox worker would otherwise still send them after RLS.
update public.notification_outbox
set status = 'failed',
    error_message = concat_ws(
      '; ',
      nullif(error_message, ''),
      'Quarantined 2026-08-02: missing tenant ownership'
    )
where dealer_id is null
  and sent_at is null
  and coalesce(status, 'pending') = 'pending';

drop policy if exists admin_manage_notification_outbox
  on public.notification_outbox;
drop policy if exists notification_outbox_admin_manage
  on public.notification_outbox;
drop policy if exists notification_outbox_select_tenant
  on public.notification_outbox;
create policy notification_outbox_select_tenant
  on public.notification_outbox for select to authenticated
  using (dealer_id = public.auth_dealer_id());
drop policy if exists notification_outbox_insert_tenant
  on public.notification_outbox;
create policy notification_outbox_insert_tenant
  on public.notification_outbox for insert to authenticated
  with check (dealer_id = public.auth_dealer_id());
drop policy if exists notification_outbox_manage_tenant
  on public.notification_outbox;
create policy notification_outbox_manage_tenant
  on public.notification_outbox for all to authenticated
  using (
    public.is_admin_or_manager()
    and dealer_id = public.auth_dealer_id()
  )
  with check (
    public.is_admin_or_manager()
    and dealer_id = public.auth_dealer_id()
  );

-- vehicle_products has no tenant column; scope every policy through its parent
-- vehicle instead of retaining the legacy USING (true) read policy.
drop policy if exists vehicle_products_read_authenticated
  on public.vehicle_products;
drop policy if exists vehicle_products_owner_or_admin_manage
  on public.vehicle_products;
drop policy if exists vehicle_products_read_tenant
  on public.vehicle_products;
create policy vehicle_products_read_tenant
  on public.vehicle_products for select to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_products.vehicle_id
        and v.dealer_id = public.auth_dealer_id()
    )
  );
drop policy if exists vehicle_products_manage_tenant
  on public.vehicle_products;
create policy vehicle_products_manage_tenant
  on public.vehicle_products for all to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_products.vehicle_id
        and v.dealer_id = public.auth_dealer_id()
    )
    and (
      created_by = (select auth.uid())
      or public.is_admin_or_manager()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_products.vehicle_id
        and v.dealer_id = public.auth_dealer_id()
    )
    and (
      created_by = (select auth.uid())
      or public.is_admin_or_manager()
    )
  );

-- Vendor hours inherit tenant identity from vendors. All active tenant users
-- may read hours; only managers or the linked vendor account may mutate them.
drop policy if exists vendors_manage_own_hours on public.vendor_hours;
drop policy if exists vendor_hours_select_tenant on public.vendor_hours;
create policy vendor_hours_select_tenant
  on public.vendor_hours for select to authenticated
  using (
    exists (
      select 1
      from public.vendors v
      where v.id = vendor_hours.vendor_id
        and v.dealer_id = public.auth_dealer_id()
    )
  );
drop policy if exists vendor_hours_manage_tenant on public.vendor_hours;
create policy vendor_hours_manage_tenant
  on public.vendor_hours for all to authenticated
  using (
    exists (
      select 1
      from public.vendors v
      where v.id = vendor_hours.vendor_id
        and v.dealer_id = public.auth_dealer_id()
        and (
          public.is_admin_or_manager()
          or exists (
            select 1
            from public.user_profiles up
            where up.id = (select auth.uid())
              and up.vendor_id = v.id
              and up.is_active is true
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.vendors v
      where v.id = vendor_hours.vendor_id
        and v.dealer_id = public.auth_dealer_id()
        and (
          public.is_admin_or_manager()
          or exists (
            select 1
            from public.user_profiles up
            where up.id = (select auth.uid())
              and up.vendor_id = v.id
              and up.is_active is true
          )
        )
    )
  );

-- Sequence allocation is exposed to authenticated app users, so it must use
-- the same active-account guard as table access.
create or replace function public.generate_job_number()
returns text
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
begin
  if not public.auth_user_is_active() then
    raise exception using
      errcode = '42501',
      message = 'Active Rocket user required';
  end if;

  return
    'JOB-' ||
    pg_catalog.to_char(current_date, 'YYYY') ||
    '-' ||
    pg_catalog.lpad(
      pg_catalog.nextval('public.job_number_seq'::pg_catalog.regclass)::text,
      6,
      '0'
    );
end;
$$;

revoke all on function public.generate_job_number() from public, anon;
grant execute on function public.generate_job_number() to authenticated, service_role;
revoke all on sequence public.job_number_seq from public, anon, authenticated;

-- One authorized RPC replaces the client's multi-request partial deletion.
-- A PostgreSQL function invocation is one transaction: child-trigger/FK errors
-- roll back the transaction delete and the parent delete together.
create or replace function public.delete_deal_atomic(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_caller uuid := (select auth.uid());
  v_caller_dealer uuid;
  v_target_dealer uuid;
begin
  if v_caller is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select coalesce(up.dealer_id, up.org_id)
  into v_caller_dealer
  from public.user_profiles up
  where (up.id = v_caller or up.auth_user_id = v_caller)
    and up.is_active is true
    and up.role in ('admin', 'manager')
  limit 1;

  if v_caller_dealer is null then
    raise exception using errcode = '42501', message = 'Manager access required';
  end if;

  select j.dealer_id
  into v_target_dealer
  from public.jobs j
  where j.id = p_job_id
    and j.dealer_id = v_caller_dealer
  for update;

  if v_target_dealer is null then
    raise exception using
      errcode = 'P0002',
      message = 'Deal not found or access denied';
  end if;

  delete from public.transactions where job_id = p_job_id;
  delete from public.jobs
  where id = p_job_id
    and dealer_id = v_caller_dealer;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Deal not found or access denied';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_deal_atomic(uuid) from public, anon;
grant execute on function public.delete_deal_atomic(uuid) to authenticated;
comment on function public.delete_deal_atomic(uuid) is
  'Atomically deletes one same-tenant deal and its dependent aggregate; active manager/admin only.';

-- These legacy routines are unsafe by design: they remove identities or
-- historical attribution and have no valid production operator use.
drop function if exists public.cleanup_priority_automotive_admins();
drop function if exists public.cleanup_illegitimate_users();
drop function if exists public.cleanup_orphaned_profiles();
drop function if exists public.create_user_with_profile(
  text, text, text, public.user_role, text
);
drop function if exists public.delete_job_cascade(uuid);

-- Keep the internal SMS trigger path, but bind opt-outs and outbox ownership to
-- NEW.dealer_id. The legacy enqueue RPC had no tenant parameter and is removed.
create or replace function public.auto_enqueue_status_sms()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_vehicle_phone text;
  v_stock_number text;
  v_template text;
  v_variables jsonb;
  v_scheduled_date text;
  v_scheduled_time text;
  v_eta text;
begin
  if tg_op <> 'UPDATE'
     or old.job_status is not distinct from new.job_status then
    return new;
  end if;

  select v.owner_phone, v.stock_number
  into v_vehicle_phone, v_stock_number
  from public.vehicles v
  where v.id = new.vehicle_id
    and v.dealer_id = new.dealer_id;

  if nullif(pg_catalog.btrim(v_vehicle_phone), '') is null then
    return new;
  end if;

  if exists (
    select 1
    from public.sms_opt_outs soo
    where soo.phone_e164 = v_vehicle_phone
      and soo.dealer_id = new.dealer_id
  ) then
    return new;
  end if;

  case new.job_status
    when 'scheduled' then
      v_template := 'Stock {STOCK} appointment confirmed for {DATE} at {TIME}. Reply YES to confirm.';
    when 'in_progress' then
      v_template := 'Stock {STOCK} service started. Estimated completion: {ETA}.';
    when 'completed' then
      v_template := 'Stock {STOCK} service complete! Ready for pickup. Call {PHONE} for details.';
    else
      return new;
  end case;

  if new.scheduled_start_time is null then
    v_scheduled_date := 'TBD';
    v_scheduled_time := 'TBD';
    v_eta := 'TBD';
  else
    v_scheduled_date := pg_catalog.to_char(
      new.scheduled_start_time at time zone 'America/New_York',
      'Mon DD'
    );
    v_scheduled_time := pg_catalog.to_char(
      new.scheduled_start_time at time zone 'America/New_York',
      'HH12:MI AM'
    );
    v_eta := pg_catalog.to_char(
      coalesce(
        new.scheduled_end_time,
        new.scheduled_start_time + interval '2 hours'
      ) at time zone 'America/New_York',
      'HH12:MI AM'
    );
  end if;

  v_variables := pg_catalog.jsonb_build_object(
    'STOCK', coalesce(v_stock_number, 'N/A'),
    'DATE', v_scheduled_date,
    'TIME', v_scheduled_time,
    'ETA', v_eta,
    'PHONE', '757-486-3500'
  );

  insert into public.notification_outbox (
    phone_e164,
    message_template,
    variables,
    not_before,
    status,
    dealer_id
  ) values (
    v_vehicle_phone,
    v_template,
    v_variables,
    pg_catalog.now(),
    'pending',
    new.dealer_id
  );

  return new;
exception
  when others then
    raise notice 'auto_enqueue_status_sms error for job %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.auto_enqueue_status_sms()
  from public, anon, authenticated;
drop function if exists public.enqueue_sms_notification(text, text, jsonb, integer);

-- Obsolete diagnostic/global-query RPCs stay available only to service-role
-- operators. None is called by the current Rocket client.
revoke all on function public.get_deal_calendar_events(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_deal_profit_analysis(uuid)
  from public, anon, authenticated;
revoke all on function public.get_dropdown_users(text, text)
  from public, anon, authenticated;
revoke all on function public.mark_loaner_returned(uuid)
  from public, anon, authenticated;
revoke all on function public.validate_demo_user(text)
  from public, anon, authenticated;
revoke all on function public.verify_auth_setup()
  from public, anon, authenticated;
revoke all on function public.verify_priority_automotive_auth()
  from public, anon, authenticated;

-- Trigger functions are not RPCs. Direct execution grants are unnecessary.
revoke all on function public.user_profiles_set_dealer_id()
  from public, anon, authenticated;
revoke all on function public.validate_user_legitimacy()
  from public, anon, authenticated;

commit;
