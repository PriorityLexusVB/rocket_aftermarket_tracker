-- Tighten remaining RLS/storage policies to match intent:
-- - All authenticated users have equal access within their tenant (org_id/dealer_id)
-- - No global SELECT leaks ("using=true" or "exists(job)" without tenant check)
-- - Keep existing behavior where the UI enforces owner-only deletes for job photos
-- Forward-only + idempotent.

begin;

-- =============================================================================
-- Storage: job-photos bucket
-- =============================================================================
-- Expected object key format (see src/services/photoDocumentationService.js):
--   jobs/<job_uuid>/<filename>

-- Replace overly-broad SELECT policy (bucket-wide) with tenant-scoped job check.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_users_view_job_photos'
  ) then
    execute 'drop policy "authenticated_users_view_job_photos" on storage.objects';
  end if;

  execute $policy$
    create policy authenticated_users_view_job_photos
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'job-photos'
      and (storage.foldername(name))[1] = 'jobs'
      and exists (
        select 1
        from public.jobs j
        where j.id::text = (storage.foldername(name))[2]
          and (
            (j.org_id is not null and j.org_id = public.auth_user_org())
            or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
          )
      )
    );
  $policy$;
end $$;

-- Tighten INSERT to only allow uploads for jobs in the caller's tenant (still owner-only).
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_users_upload_job_photos'
  ) then
    execute 'drop policy "authenticated_users_upload_job_photos" on storage.objects';
  end if;

  execute $policy$
    create policy authenticated_users_upload_job_photos
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'job-photos'
      and owner = auth.uid()
      and (storage.foldername(name))[1] = 'jobs'
      and exists (
        select 1
        from public.jobs j
        where j.id::text = (storage.foldername(name))[2]
          and (
            (j.org_id is not null and j.org_id = public.auth_user_org())
            or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
          )
      )
    );
  $policy$;
end $$;

-- =============================================================================
-- public.job_photos (metadata table)
-- =============================================================================
-- Fix SELECT leak: the existing ALL policy uses `using=true`.

-- Drop the risky "ALL" policy and replace with scoped policies (tenant via jobs join).
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_photos'
      and policyname = 'authenticated_users_manage_job_photos'
  ) then
    execute 'drop policy "authenticated_users_manage_job_photos" on public.job_photos';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_photos'
      and policyname = 'job_photos_tenant_select'
  ) then
    execute $policy$
      create policy job_photos_tenant_select
      on public.job_photos
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = job_photos.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_photos'
      and policyname = 'job_photos_owner_insert'
  ) then
    execute $policy$
      create policy job_photos_owner_insert
      on public.job_photos
      for insert
      to authenticated
      with check (
        uploaded_by = auth.uid()
        and job_id is not null
        and exists (
          select 1
          from public.jobs j
          where j.id = job_photos.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;

  -- Keep delete/update behavior aligned with UI (only uploader can modify/delete).
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_photos'
      and policyname = 'job_photos_owner_update'
  ) then
    execute $policy$
      create policy job_photos_owner_update
      on public.job_photos
      for update
      to authenticated
      using (
        uploaded_by = auth.uid()
        and exists (
          select 1
          from public.jobs j
          where j.id = job_photos.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      )
      with check (
        uploaded_by = auth.uid()
        and exists (
          select 1
          from public.jobs j
          where j.id = job_photos.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_photos'
      and policyname = 'job_photos_owner_delete'
  ) then
    execute $policy$
      create policy job_photos_owner_delete
      on public.job_photos
      for delete
      to authenticated
      using (
        uploaded_by = auth.uid()
        and exists (
          select 1
          from public.jobs j
          where j.id = job_photos.job_id
            and (
              (j.org_id is not null and j.org_id = public.auth_user_org())
              or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- =============================================================================
-- public.communications
-- =============================================================================
-- Replace unscoped SELECT/INSERT policies with tenant-scoped equivalents.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'communications'
      and policyname = 'users_can_view_communications'
  ) then
    execute 'drop policy "users_can_view_communications" on public.communications';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'communications'
      and policyname = 'users_can_create_communications'
  ) then
    execute 'drop policy "users_can_create_communications" on public.communications';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'communications'
      and policyname = 'communications_tenant_select'
  ) then
    execute $policy$
      create policy communications_tenant_select
      on public.communications
      for select
      to authenticated
      using (
        (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = communications.job_id
              and (
                (j.org_id is not null and j.org_id = public.auth_user_org())
                or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
              )
          )
        )
        or (dealer_id is not null and dealer_id = public.auth_dealer_id())
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'communications'
      and policyname = 'communications_tenant_insert'
  ) then
    execute $policy$
      create policy communications_tenant_insert
      on public.communications
      for insert
      to authenticated
      with check (
        sent_by = auth.uid()
        and (
          (
            job_id is not null
            and exists (
              select 1
              from public.jobs j
              where j.id = communications.job_id
                and (
                  (j.org_id is not null and j.org_id = public.auth_user_org())
                  or (j.dealer_id is not null and j.dealer_id = public.auth_dealer_id())
                )
            )
          )
          or (dealer_id is not null and dealer_id = public.auth_dealer_id())
        )
      );
    $policy$;
  end if;

  -- Dealer-scoped delete via jobs (org-scoped delete policy already exists).
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'communications'
      and policyname = 'dealer can delete communications via jobs'
  ) then
    execute $policy$
      create policy "dealer can delete communications via jobs"
      on public.communications
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = communications.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      );
    $policy$;
  end if;
end $$;

-- =============================================================================
-- public.activity_history
-- =============================================================================
-- Ensure dealer_id is automatically populated, then scope SELECT/INSERT to tenant.

-- If dealer_id exists, default it to auth_dealer_id() so client inserts need not pass it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_history'
      and column_name = 'dealer_id'
  ) then
    execute 'alter table public.activity_history alter column dealer_id set default public.auth_dealer_id()';
  end if;
end $$;

-- Replace unscoped policies.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_history'
      and policyname = 'users_can_view_activity_history'
  ) then
    execute 'drop policy "users_can_view_activity_history" on public.activity_history';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_history'
      and policyname = 'system_manages_activity_history'
  ) then
    execute 'drop policy "system_manages_activity_history" on public.activity_history';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_history'
      and policyname = 'activity_history_tenant_select'
  ) then
    execute $policy$
      create policy activity_history_tenant_select
      on public.activity_history
      for select
      to authenticated
      using (
        dealer_id is not null
        and dealer_id = public.auth_dealer_id()
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_history'
      and policyname = 'activity_history_tenant_insert'
  ) then
    execute $policy$
      create policy activity_history_tenant_insert
      on public.activity_history
      for insert
      to authenticated
      with check (
        performed_by = auth.uid()
        and dealer_id is not null
        and dealer_id = public.auth_dealer_id()
      );
    $policy$;
  end if;
end $$;

-- =============================================================================
-- public.claim_attachments
-- =============================================================================
-- Allow authenticated staff uploads (DB record) scoped to the same claim tenant.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'claim_attachments'
      and policyname = 'claim_attachments_staff_insert_scoped'
  ) then
    execute $policy$
      create policy claim_attachments_staff_insert_scoped
      on public.claim_attachments
      for insert
      to authenticated
      with check (
        claim_id is not null
        and file_path is not null
        and file_path ~ (('^claim-' || claim_id::text) || '/.*')
        and exists (
          select 1
          from public.claims c
          where c.id = claim_attachments.claim_id
            and (
              (c.org_id is not null and c.org_id = public.auth_user_org())
              or (c.dealer_id is not null and c.dealer_id = public.auth_dealer_id())
            )
        )
      );
    $policy$;
  end if;
end $$;

-- =============================================================================
-- public.job_parts
-- =============================================================================
-- Remove unscoped read + add dealer-scoped CRUD via jobs.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'users_can_view_job_parts'
  ) then
    execute 'drop policy "users_can_view_job_parts" on public.job_parts';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'managers_manage_job_parts'
  ) then
    execute 'drop policy "managers_manage_job_parts" on public.job_parts';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'dealer read job_parts via jobs'
  ) then
    execute $policy$
      create policy "dealer read job_parts via jobs"
      on public.job_parts
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = job_parts.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'dealer can insert job_parts via jobs'
  ) then
    execute $policy$
      create policy "dealer can insert job_parts via jobs"
      on public.job_parts
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.jobs j
          where j.id = job_parts.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'dealer can update job_parts via jobs'
  ) then
    execute $policy$
      create policy "dealer can update job_parts via jobs"
      on public.job_parts
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = job_parts.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      )
      with check (
        exists (
          select 1
          from public.jobs j
          where j.id = job_parts.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_parts'
      and policyname = 'dealer can delete job_parts via jobs'
  ) then
    execute $policy$
      create policy "dealer can delete job_parts via jobs"
      on public.job_parts
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = job_parts.job_id
            and j.dealer_id = public.auth_dealer_id()
        )
      );
    $policy$;
  end if;
end $$;

-- =============================================================================
-- public.transactions
-- =============================================================================
-- Remove unscoped read + add dealer-scoped CRUD.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'staff_can_view_transactions'
  ) then
    execute 'drop policy "staff_can_view_transactions" on public.transactions';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'txn_select_via_job'
  ) then
    execute 'drop policy "txn_select_via_job" on public.transactions';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'managers_manage_transactions'
  ) then
    execute 'drop policy "managers_manage_transactions" on public.transactions';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'managers can delete transactions'
  ) then
    execute 'drop policy "managers can delete transactions" on public.transactions';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'dealer read transactions'
  ) then
    execute $policy$
      create policy "dealer read transactions"
      on public.transactions
      for select
      to authenticated
      using (
        (dealer_id is not null and dealer_id = public.auth_dealer_id())
        or (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = transactions.job_id
              and j.dealer_id = public.auth_dealer_id()
          )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'dealer can insert transactions'
  ) then
    execute $policy$
      create policy "dealer can insert transactions"
      on public.transactions
      for insert
      to authenticated
      with check (
        (dealer_id is not null and dealer_id = public.auth_dealer_id())
        or (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = transactions.job_id
              and j.dealer_id = public.auth_dealer_id()
          )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'dealer can update transactions'
  ) then
    execute $policy$
      create policy "dealer can update transactions"
      on public.transactions
      for update
      to authenticated
      using (
        (dealer_id is not null and dealer_id = public.auth_dealer_id())
        or (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = transactions.job_id
              and j.dealer_id = public.auth_dealer_id()
          )
        )
      )
      with check (
        (dealer_id is not null and dealer_id = public.auth_dealer_id())
        or (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = transactions.job_id
              and j.dealer_id = public.auth_dealer_id()
          )
        )
      );
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'dealer can delete transactions'
  ) then
    execute $policy$
      create policy "dealer can delete transactions"
      on public.transactions
      for delete
      to authenticated
      using (
        (dealer_id is not null and dealer_id = public.auth_dealer_id())
        or (
          job_id is not null
          and exists (
            select 1
            from public.jobs j
            where j.id = transactions.job_id
              and j.dealer_id = public.auth_dealer_id()
          )
        )
      );
    $policy$;
  end if;
end $$;

commit;
