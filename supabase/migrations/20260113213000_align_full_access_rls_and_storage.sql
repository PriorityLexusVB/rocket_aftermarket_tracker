-- Align with intent: all authenticated users have equal "full" access
-- while preserving tenant isolation (org_id/dealer_id scoping).
-- Forward-only + idempotent.

begin;

-- ------------------------------
-- Storage: claim-photos bucket
-- ------------------------------
-- Replace PUBLIC read/write with authenticated + tenant-scoped (via claim id in object path).
-- Expected object key format: claim-<claim_uuid>/<filename>

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_view_claim_photos'
  ) then
    execute 'drop policy "public_can_view_claim_photos" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_upload_claim_photos'
  ) then
    execute 'drop policy "public_can_upload_claim_photos" on storage.objects';
  end if;
end $$;

-- Authenticated users can view claim photos only for claims in their org/dealer.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_can_view_claim_photos'
  ) then
    execute $policy$
      create policy authenticated_can_view_claim_photos
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'claim-photos'
        and exists (
          select 1
          from public.claims c
          where c.id = substring(name from '^claim-([0-9a-fA-F-]{36})/')::uuid
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- Authenticated users can upload claim photos only for claims in their org/dealer.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_can_upload_claim_photos'
  ) then
    execute $policy$
      create policy authenticated_can_upload_claim_photos
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'claim-photos'
        and exists (
          select 1
          from public.claims c
          where c.id = substring(name from '^claim-([0-9a-fA-F-]{36})/')::uuid
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- Optional: allow authenticated delete/update within tenant scope (matches "full access" intent).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_can_update_claim_photos'
  ) then
    execute $policy$
      create policy authenticated_can_update_claim_photos
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'claim-photos'
        and exists (
          select 1
          from public.claims c
          where c.id = substring(name from '^claim-([0-9a-fA-F-]{36})/')::uuid
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      )
      with check (
        bucket_id = 'claim-photos'
        and exists (
          select 1
          from public.claims c
          where c.id = substring(name from '^claim-([0-9a-fA-F-]{36})/')::uuid
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_can_delete_claim_photos'
  ) then
    execute $policy$
      create policy authenticated_can_delete_claim_photos
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'claim-photos'
        and exists (
          select 1
          from public.claims c
          where c.id = substring(name from '^claim-([0-9a-fA-F-]{36})/')::uuid
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- ---------------------------------------
-- RLS: vendors & products (authenticated)
-- ---------------------------------------

-- Vendors: replace role-gated/broad policies with a single authenticated full-access policy.
do $$
declare
  p text;
begin
  foreach p in ARRAY ARRAY[
    'admin_manager_full_vendor_access',
    'managers_manage_vendors',
    'org can insert vendors',
    'org can update vendors',
    'app_org_staff_can_read_vendors',
    'staff_can_view_vendors'
  ]
  loop
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'vendors'
        and policyname = p
    ) then
      execute format('drop policy %I on public.vendors', p);
    end if;
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vendors'
      and policyname = 'authenticated_full_access_vendors'
  ) then
    execute $policy$
      create policy authenticated_full_access_vendors
      on public.vendors
      for all
      to authenticated
      using (
        (org_id is not null and org_id = public.auth_user_org())
        or (dealer_id is not null and dealer_id = public.auth_dealer_id())
      )
      with check (
        (org_id is not null and org_id = public.auth_user_org())
        or (dealer_id is not null and dealer_id = public.auth_dealer_id())
      );
    $policy$;
  end if;
end $$;

-- Products: replace role-gated/broad policies with a single authenticated full-access policy.
do $$
declare
  p text;
begin
  foreach p in ARRAY ARRAY[
    'admin_manager_manage_products',
    'managers_manage_products',
    'org can insert products',
    'org can update products',
    'app_org_staff_can_read_products',
    'staff_can_view_products'
  ]
  loop
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'products'
        and policyname = p
    ) then
      execute format('drop policy %I on public.products', p);
    end if;
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'authenticated_full_access_products'
  ) then
    execute $policy$
      create policy authenticated_full_access_products
      on public.products
      for all
      to authenticated
      using (
        (org_id is not null and org_id = public.auth_user_org())
        or (dealer_id is not null and dealer_id = public.auth_dealer_id())
      )
      with check (
        (org_id is not null and org_id = public.auth_user_org())
        or (dealer_id is not null and dealer_id = public.auth_dealer_id())
      );
    $policy$;
  end if;
end $$;

-- -----------------------------------------------
-- RLS: loaner_assignments (authenticated, by job)
-- -----------------------------------------------

do $$
declare
  p text;
begin
  foreach p in ARRAY ARRAY[
    'managers_manage_loaner_assignments',
    'managers can delete loaner_assignments',
    'org can delete loaner_assignments via jobs',
    'org can insert loaner_assignments via jobs',
    'org can select loaner_assignments via jobs',
    'org_can_select_loaners_by_job_org',
    'org can update loaner_assignments via jobs'
  ]
  loop
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'loaner_assignments'
        and policyname = p
    ) then
      execute format('drop policy %I on public.loaner_assignments', p);
    end if;
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'loaner_assignments'
      and policyname = 'authenticated_full_access_loaner_assignments'
  ) then
    execute $policy$
      create policy authenticated_full_access_loaner_assignments
      on public.loaner_assignments
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = loaner_assignments.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      )
      with check (
        exists (
          select 1
          from public.jobs j
          where j.id = loaner_assignments.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- PostgREST schema cache reload
notify pgrst, 'reload schema';

commit;
