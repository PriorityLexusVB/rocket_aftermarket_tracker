-- Migration: DEALER_ID CANON ENFORCER (Authoritative)
-- Date: 2026-01-01
-- Purpose:
--   Single-source-of-truth enforcement of the tenancy universe:
--     - dealer_id / public.auth_dealer_id()
--   Ensures core tables have dealer_id, are NOT NULL, FK validated, and RLS policies
--   are dropped/recreated to match the canonical allowlist.
--
-- Requirements (per repo guardrails):
--   - Idempotent and safe to re-run.
--   - Do not edit historical migrations (this is the authoritative one going forward).

DO $$
DECLARE
  t RECORD;
  c RECORD;
  missing_dealer_id_count int;
  has_jobs boolean;

  -- helper booleans for conditional org_id backfill
  has_jobs_org_id boolean;
  has_jobs_dealer_id boolean;

  -- loop vars
  pol RECORD;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Preconditions / detection
  -- ---------------------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) INTO has_jobs;

  IF NOT has_jobs THEN
    RAISE NOTICE 'DEALER_ID CANON: public.jobs missing; skipping tenant enforcement (schema not present).';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs' AND column_name='org_id'
  ) INTO has_jobs_org_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs' AND column_name='dealer_id'
  ) INTO has_jobs_dealer_id;

  -- ---------------------------------------------------------------------------
  -- Canon function: auth_dealer_id()
  --   - Prefer JWT claim dealer_id / dealerId
  --   - Fallback to user_profiles.dealer_id
  -- ---------------------------------------------------------------------------
  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.auth_dealer_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  AS $$
  DECLARE
    v text;
    out_id uuid;
  BEGIN
    BEGIN
      v := auth.jwt() ->> 'dealer_id';
      IF v IS NOT NULL AND btrim(v) <> '' THEN
        out_id := v::uuid;
        RETURN out_id;
      END IF;
    EXCEPTION WHEN others THEN
      -- ignore parse errors
    END;

    BEGIN
      v := auth.jwt() ->> 'dealerId';
      IF v IS NOT NULL AND btrim(v) <> '' THEN
        out_id := v::uuid;
        RETURN out_id;
      END IF;
    EXCEPTION WHEN others THEN
      -- ignore parse errors
    END;

    BEGIN
      SELECT up.dealer_id INTO out_id
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
      LIMIT 1;
      RETURN out_id;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END;
  $$;
  $fn$;

  -- ---------------------------------------------------------------------------
  -- Ensure dealer_id exists on canonical tables
  -- Note: We keep this conservative: only tables the app and policies rely on.
  -- ---------------------------------------------------------------------------
  PERFORM 1;

  -- organizations: already primary tenant dimension (no dealer_id column)

  -- user_profiles
  EXECUTE 'ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- jobs
  EXECUTE 'ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- job_parts
  EXECUTE 'ALTER TABLE IF EXISTS public.job_parts ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- vehicles
  EXECUTE 'ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- vendors, products, sms_templates
  EXECUTE 'ALTER TABLE IF EXISTS public.vendors ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.sms_templates ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- transactions
  EXECUTE 'ALTER TABLE IF EXISTS public.transactions ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- communications
  EXECUTE 'ALTER TABLE IF EXISTS public.communications ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- loaner_assignments
  EXECUTE 'ALTER TABLE IF EXISTS public.loaner_assignments ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- claims + claim_attachments
  EXECUTE 'ALTER TABLE IF EXISTS public.claims ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.claim_attachments ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- filter_presets + notification_* + sms_opt_outs + vendor_hours
  EXECUTE 'ALTER TABLE IF EXISTS public.filter_presets ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.notification_outbox ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.notification_preferences ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.sms_opt_outs ADD COLUMN IF NOT EXISTS dealer_id uuid';
  EXECUTE 'ALTER TABLE IF EXISTS public.vendor_hours ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- activity_history (tenant via dealer_id)
  EXECUTE 'ALTER TABLE IF EXISTS public.activity_history ADD COLUMN IF NOT EXISTS dealer_id uuid';

  -- ---------------------------------------------------------------------------
  -- Best-effort backfill dealer_id
  -- ---------------------------------------------------------------------------

  -- jobs: copy from org_id if present
  IF has_jobs_org_id THEN
    EXECUTE 'UPDATE public.jobs SET dealer_id = org_id WHERE dealer_id IS NULL AND org_id IS NOT NULL';
  END IF;

  -- user_profiles: copy from org_id if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=''public'' AND table_name=''user_profiles'' AND column_name=''org_id''
  ) THEN
    EXECUTE 'UPDATE public.user_profiles SET dealer_id = org_id WHERE dealer_id IS NULL AND org_id IS NOT NULL';
  END IF;

  -- vendors/products/sms_templates: copy from org_id if present
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''vendors'' AND column_name=''org_id'') THEN
    EXECUTE 'UPDATE public.vendors SET dealer_id = org_id WHERE dealer_id IS NULL AND org_id IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''products'' AND column_name=''org_id'') THEN
    EXECUTE 'UPDATE public.products SET dealer_id = org_id WHERE dealer_id IS NULL AND org_id IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''sms_templates'' AND column_name=''org_id'') THEN
    EXECUTE 'UPDATE public.sms_templates SET dealer_id = org_id WHERE dealer_id IS NULL AND org_id IS NOT NULL';
  END IF;

  -- vehicle/job_part/txn/comm/loaner: infer via jobs join when possible
  EXECUTE 'UPDATE public.job_parts jp SET dealer_id = j.dealer_id FROM public.jobs j WHERE jp.dealer_id IS NULL AND jp.job_id = j.id AND j.dealer_id IS NOT NULL';
  EXECUTE 'UPDATE public.vehicles v SET dealer_id = j.dealer_id FROM public.jobs j WHERE v.dealer_id IS NULL AND j.vehicle_id = v.id AND j.dealer_id IS NOT NULL';
  EXECUTE 'UPDATE public.transactions t SET dealer_id = j.dealer_id FROM public.jobs j WHERE t.dealer_id IS NULL AND t.job_id = j.id AND j.dealer_id IS NOT NULL';
  EXECUTE 'UPDATE public.communications c SET dealer_id = j.dealer_id FROM public.jobs j WHERE c.dealer_id IS NULL AND c.job_id = j.id AND j.dealer_id IS NOT NULL';
  EXECUTE 'UPDATE public.loaner_assignments la SET dealer_id = j.dealer_id FROM public.jobs j WHERE la.dealer_id IS NULL AND la.job_id = j.id AND j.dealer_id IS NOT NULL';

  -- claims + attachments (if claim_id exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''claim_attachments'' AND column_name=''claim_id'') THEN
    EXECUTE 'UPDATE public.claim_attachments ca SET dealer_id = cl.dealer_id FROM public.claims cl WHERE ca.dealer_id IS NULL AND ca.claim_id = cl.id AND cl.dealer_id IS NOT NULL';
  END IF;

  -- activity_history (if job_id exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''activity_history'' AND column_name=''job_id'') THEN
    EXECUTE 'UPDATE public.activity_history ah SET dealer_id = j.dealer_id FROM public.jobs j WHERE ah.dealer_id IS NULL AND ah.job_id = j.id AND j.dealer_id IS NOT NULL';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Enforce FK dealer_id -> organizations(id)
  -- ---------------------------------------------------------------------------
  PERFORM 1;

  -- helper: create FK if missing
  -- user_profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_dealer_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.organizations(id)';
  END IF;

  -- jobs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_dealer_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.jobs ADD CONSTRAINT jobs_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.organizations(id)';
  END IF;

  -- shared tables list
  FOR t IN
    SELECT unnest(ARRAY[
      'job_parts','vehicles','vendors','products','sms_templates','transactions','communications',
      'loaner_assignments','claims','claim_attachments','filter_presets','notification_outbox',
      'notification_preferences','sms_opt_outs','vendor_hours','activity_history'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t.table_name) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = format('%s_dealer_id_fkey', t.table_name)
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (dealer_id) REFERENCES public.organizations(id)',
          t.table_name,
          format('%s_dealer_id_fkey', t.table_name)
        );
      END IF;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Enforce NOT NULL dealer_id on core tenant tables
  --   (skip tables that may intentionally be global)
  -- ---------------------------------------------------------------------------
  FOR t IN
    SELECT unnest(ARRAY[
      'user_profiles','jobs','job_parts','vehicles','transactions','communications','loaner_assignments',
      'claims','claim_attachments','vendors','products','sms_templates','filter_presets'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t.table_name) THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE dealer_id IS NULL', t.table_name) INTO missing_dealer_id_count;
      IF missing_dealer_id_count > 0 THEN
        RAISE EXCEPTION 'DEALER_ID CANON: % has % rows with dealer_id IS NULL', t.table_name, missing_dealer_id_count;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN dealer_id SET NOT NULL', t.table_name);
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Optional cleanup: drop org_id columns (dealer_id is canonical)
  -- ---------------------------------------------------------------------------
  FOR t IN
    SELECT unnest(ARRAY[
      'user_profiles','jobs','job_parts','vehicles','transactions','communications','loaner_assignments',
      'claims','claim_attachments','vendors','products','sms_templates','filter_presets','activity_history'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.table_name AND column_name='org_id') THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN org_id', t.table_name);
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Enable RLS
  -- ---------------------------------------------------------------------------
  FOR t IN
    SELECT unnest(ARRAY[
      'activity_history','claim_attachments','claims','communications','filter_presets','job_parts','jobs',
      'loaner_assignments','notification_outbox','notification_preferences','organizations','products',
      'sms_opt_outs','sms_templates','transactions','user_profiles','vehicles','vendor_hours','vendors'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t.table_name) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Drop existing policies for canonical tables and recreate allowlist
  -- ---------------------------------------------------------------------------
  FOR t IN
    SELECT unnest(ARRAY[
      'activity_history','claim_attachments','claims','communications','filter_presets','job_parts','jobs',
      'loaner_assignments','notification_outbox','notification_preferences','organizations','products',
      'sms_opt_outs','sms_templates','transactions','user_profiles','vehicles','vendor_hours','vendors'
    ]) AS table_name
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t.table_name) THEN
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname='public' AND tablename=t.table_name
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t.table_name);
      END LOOP;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Canon policies (names must match KEEP list in prior policy-dedupe migration)
  -- ---------------------------------------------------------------------------

  -- activity_history
  EXECUTE 'CREATE POLICY system_manages_activity_history ON public.activity_history FOR INSERT TO service_role WITH CHECK (true)';
  EXECUTE 'CREATE POLICY users_can_view_activity_history ON public.activity_history FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';

  -- claim_attachments
  EXECUTE 'CREATE POLICY admin_can_manage_claim_attachments ON public.claim_attachments FOR UPDATE TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY admin_can_delete_claim_attachments ON public.claim_attachments FOR DELETE TO authenticated USING (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY public_can_create_claim_attachments ON public.claim_attachments FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY public_can_view_claim_attachments ON public.claim_attachments FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY claim_attachments_select_tenant ON public.claim_attachments FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';

  -- claims
  EXECUTE 'CREATE POLICY public_can_create_claims ON public.claims FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY admin_can_manage_claims ON public.claims FOR UPDATE TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY admin_can_delete_claims ON public.claims FOR DELETE TO authenticated USING (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY users_can_update_claims ON public.claims FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY public_can_view_claims ON public.claims FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY claims_select_tenant ON public.claims FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';

  -- communications
  EXECUTE 'CREATE POLICY users_can_view_communications ON public.communications FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY users_can_create_communications ON public.communications FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY communications_delete_tenant ON public.communications FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';

  -- filter_presets
  EXECUTE 'CREATE POLICY "User can manage own presets" ON public.filter_presets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY users_manage_own_filter_presets ON public.filter_presets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY users_view_public_filter_presets ON public.filter_presets FOR SELECT TO authenticated USING (is_public = true)';

  -- job_parts
  EXECUTE 'CREATE POLICY job_parts_select_tenant ON public.job_parts FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY job_parts_insert_tenant ON public.job_parts FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY job_parts_update_tenant ON public.job_parts FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY job_parts_delete_tenant ON public.job_parts FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY managers_manage_job_parts ON public.job_parts FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY users_can_view_job_parts ON public.job_parts FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY vendors_can_view_job_parts_via_per_line_vendor ON public.job_parts FOR SELECT TO authenticated USING (vendor_id IS NOT NULL)';
  EXECUTE 'CREATE POLICY vendors_can_insert_their_job_parts ON public.job_parts FOR INSERT TO authenticated WITH CHECK (vendor_id IS NOT NULL)';
  EXECUTE 'CREATE POLICY vendors_can_update_their_job_parts ON public.job_parts FOR UPDATE TO authenticated USING (vendor_id IS NOT NULL) WITH CHECK (vendor_id IS NOT NULL)';

  -- jobs
  EXECUTE 'CREATE POLICY staff_can_view_jobs ON public.jobs FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY staff_can_view_assigned_calendar_events ON public.jobs FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY staff_manage_assigned_jobs ON public.jobs FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY jobs_insert_tenant ON public.jobs FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY jobs_update_tenant ON public.jobs FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY jobs_delete_tenant ON public.jobs FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY managers_manage_jobs ON public.jobs FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';

  -- loaner_assignments
  EXECUTE 'CREATE POLICY loaner_assignments_select_tenant ON public.loaner_assignments FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY loaner_assignments_insert_tenant ON public.loaner_assignments FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY loaner_assignments_update_tenant ON public.loaner_assignments FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY loaner_assignments_delete_tenant ON public.loaner_assignments FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY users_can_view_loaner_assignments ON public.loaner_assignments FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY "managers can delete loaner_assignments" ON public.loaner_assignments FOR DELETE TO authenticated USING (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY managers_manage_loaner_assignments ON public.loaner_assignments FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';

  -- notification_outbox
  EXECUTE 'CREATE POLICY admin_manage_notification_outbox ON public.notification_outbox FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';

  -- notification_preferences
  EXECUTE 'CREATE POLICY users_manage_own_notification_preferences ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';

  -- organizations
  EXECUTE 'CREATE POLICY org_members_select_own_org ON public.organizations FOR SELECT TO authenticated USING (id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY org_members_update_own_org ON public.organizations FOR UPDATE TO authenticated USING (id = public.auth_dealer_id()) WITH CHECK (id = public.auth_dealer_id())';

  -- products
  EXECUTE 'CREATE POLICY app_org_staff_can_read_products ON public.products FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY managers_manage_products ON public.products FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY products_manage_tenant ON public.products FOR ALL TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';

  -- sms_opt_outs
  EXECUTE 'CREATE POLICY sms_opt_outs_select ON public.sms_opt_outs FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY admin_manage_sms_opt_outs ON public.sms_opt_outs FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY public_read_sms_opt_outs ON public.sms_opt_outs FOR SELECT TO anon, authenticated USING (true)';

  -- sms_templates
  EXECUTE 'CREATE POLICY sms_templates_select_tenant ON public.sms_templates FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY admin_manage_sms_templates ON public.sms_templates FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY "managers can delete sms_templates" ON public.sms_templates FOR DELETE TO authenticated USING (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY sms_templates_manage_tenant ON public.sms_templates FOR ALL TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';

  -- transactions
  EXECUTE 'CREATE POLICY transactions_select_tenant ON public.transactions FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY transactions_insert_tenant ON public.transactions FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY transactions_update_tenant ON public.transactions FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY transactions_delete_tenant ON public.transactions FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY staff_can_view_transactions ON public.transactions FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY "managers can delete transactions" ON public.transactions FOR DELETE TO authenticated USING (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY managers_manage_transactions ON public.transactions FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';

  -- user_profiles
  EXECUTE 'CREATE POLICY "own profile read" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid())';
  EXECUTE 'CREATE POLICY "own profile read by email via jwt" ON public.user_profiles FOR SELECT TO authenticated USING (lower(email) = lower(auth.jwt() ->> ''email''))';
  EXECUTE 'CREATE POLICY user_profiles_read_active ON public.user_profiles FOR SELECT TO authenticated USING (is_active = true AND dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY user_profiles_insert_self ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid())';
  EXECUTE 'CREATE POLICY user_profiles_update_self ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';

  -- vehicles
  EXECUTE 'CREATE POLICY vehicles_select_tenant ON public.vehicles FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY vehicles_insert_tenant ON public.vehicles FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY vehicles_update_tenant ON public.vehicles FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY vehicles_delete_tenant ON public.vehicles FOR DELETE TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY staff_can_view_vehicles ON public.vehicles FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY managers_manage_vehicles ON public.vehicles FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';

  -- vendor_hours
  EXECUTE 'CREATE POLICY vendors_manage_own_hours ON public.vendor_hours FOR ALL TO authenticated USING (true) WITH CHECK (true)';

  -- vendors
  EXECUTE 'CREATE POLICY vendors_select_tenant_active ON public.vendors FOR SELECT TO authenticated USING (dealer_id = public.auth_dealer_id() AND is_active = true)';
  EXECUTE 'CREATE POLICY admin_manager_full_vendor_access ON public.vendors FOR ALL TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager())';
  EXECUTE 'CREATE POLICY vendors_insert_tenant ON public.vendors FOR INSERT TO authenticated WITH CHECK (dealer_id = public.auth_dealer_id())';
  EXECUTE 'CREATE POLICY vendors_update_tenant ON public.vendors FOR UPDATE TO authenticated USING (dealer_id = public.auth_dealer_id()) WITH CHECK (dealer_id = public.auth_dealer_id())';

  RAISE NOTICE 'DEALER_ID CANON: enforcement completed.';
END $$;
