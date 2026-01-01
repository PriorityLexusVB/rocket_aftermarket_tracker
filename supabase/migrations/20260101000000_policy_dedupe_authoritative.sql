-- Migration: POLICY DEDUPE (Authoritative)
-- Date: 2026-01-01
-- Purpose:
--   Enforce the canonical RLS policy allowlist per table.
--   After the canon migration is applied, ONLY the KEEP list may exist per table
--   (plus explicitly allowed vendor carveout policies for job_parts).
--
-- IMPORTANT SAFETY:
--   This migration intentionally aborts if required KEEP policies are missing,
--   to prevent accidentally dropping policies on a database that has not yet
--   been updated to the canonical policy set.

DO $$
DECLARE
  r RECORD;
  p RECORD;
  missing_count int := 0;
  dropped_count int := 0;
  jobs_has_org_id boolean;
  jobs_has_dealer_id boolean;
  has_dealer_id boolean;
  has_is_active boolean;
  qual_text text;
  check_text text;
  qual_compact text;
  check_compact text;
  violates_extra boolean;
  expected_cmd text;
  is_tenant_table boolean;
BEGIN
  RAISE NOTICE 'POLICY DEDUPE (Authoritative): deprecated. Use 20260101000001_dealer_id_canon_enforcer.sql as the single authoritative RLS canon migration.';
  RETURN;

  -- ---------------------------------------------------------------------------
  -- SAFETY GUARD: This repo’s schema + RLS canon is org_id-based.
  --
  -- The initial version of this migration was written for a dealer_id-based
  -- policy universe. Running it against an org_id schema would be unsafe.
  --
  -- Detect the tenancy model using public.jobs columns:
  --   - org_id present and dealer_id absent => org_id tenancy => SKIP.
  --   - dealer_id present => dealer_id tenancy => proceed.
  --
  -- If you intend to enforce an org_id canonical allowlist/dedupe, create a
  -- dedicated org_id version of this migration instead of modifying this one
  -- to do both.
  -- ---------------------------------------------------------------------------

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'jobs'
      AND c.column_name = 'org_id'
  ) INTO jobs_has_org_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'jobs'
      AND c.column_name = 'dealer_id'
  ) INTO jobs_has_dealer_id;

  IF jobs_has_org_id AND NOT jobs_has_dealer_id THEN
    RAISE NOTICE 'POLICY DEDUPE (Authoritative): skipping because org_id tenancy detected on public.jobs (dealer_id not present).';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------------
  -- KEEP allowlist (exact policy names).
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE _policy_keep (
    tablename text NOT NULL,
    policyname text NOT NULL,
    expected_cmd text NOT NULL,
    is_optional boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  -- activity_history
  INSERT INTO _policy_keep VALUES
    ('activity_history', 'system_manages_activity_history', 'INSERT', false),
    ('activity_history', 'users_can_view_activity_history', 'SELECT', false);

  -- claim_attachments
  INSERT INTO _policy_keep VALUES
    ('claim_attachments', 'admin_can_manage_claim_attachments', 'UPDATE', false),
    ('claim_attachments', 'admin_can_delete_claim_attachments', 'DELETE', false),
    ('claim_attachments', 'public_can_create_claim_attachments', 'INSERT', false),
    ('claim_attachments', 'public_can_view_claim_attachments', 'SELECT', false),
    -- OPTIONAL in spec, REQUIRED by app code (claimsService reads attachments)
    ('claim_attachments', 'claim_attachments_select_tenant', 'SELECT', true);

  -- claims
  INSERT INTO _policy_keep VALUES
    ('claims', 'public_can_create_claims', 'INSERT', false),
    ('claims', 'admin_can_manage_claims', 'UPDATE', false),
    ('claims', 'admin_can_delete_claims', 'DELETE', false),
    ('claims', 'users_can_update_claims', 'UPDATE', false),
    ('claims', 'public_can_view_claims', 'SELECT', false),
    -- OPTIONAL in spec, REQUIRED by app code (claimsService reads claims)
    ('claims', 'claims_select_tenant', 'SELECT', true);

  -- communications
  INSERT INTO _policy_keep VALUES
    ('communications', 'users_can_view_communications', 'SELECT', false),
    ('communications', 'users_can_create_communications', 'INSERT', false),
    ('communications', 'communications_delete_tenant', 'DELETE', false);

  -- filter_presets
  INSERT INTO _policy_keep VALUES
    ('filter_presets', 'User can manage own presets', 'ALL', false),
    ('filter_presets', 'users_manage_own_filter_presets', 'ALL', false),
    -- OPTIONAL in spec, REQUIRED by app code (advancedFeaturesService selects is_public)
    ('filter_presets', 'users_view_public_filter_presets', 'SELECT', true);

  -- job_parts
  INSERT INTO _policy_keep VALUES
    ('job_parts', 'job_parts_select_tenant', 'SELECT', false),
    ('job_parts', 'job_parts_insert_tenant', 'INSERT', false),
    ('job_parts', 'job_parts_update_tenant', 'UPDATE', false),
    ('job_parts', 'job_parts_delete_tenant', 'DELETE', false),
    ('job_parts', 'managers_manage_job_parts', 'ALL', false),
    ('job_parts', 'users_can_view_job_parts', 'SELECT', false),
    -- Vendor carveout keep (exactly these 3)
    ('job_parts', 'vendors_can_view_job_parts_via_per_line_vendor', 'SELECT', false),
    ('job_parts', 'vendors_can_insert_their_job_parts', 'INSERT', false),
    ('job_parts', 'vendors_can_update_their_job_parts', 'UPDATE', false);

  -- jobs
  INSERT INTO _policy_keep VALUES
    ('jobs', 'staff_can_view_jobs', 'SELECT', false),
    ('jobs', 'staff_can_view_assigned_calendar_events', 'SELECT', false),
    ('jobs', 'staff_manage_assigned_jobs', 'UPDATE', false),
    ('jobs', 'jobs_insert_tenant', 'INSERT', false),
    ('jobs', 'jobs_update_tenant', 'UPDATE', false),
    ('jobs', 'jobs_delete_tenant', 'DELETE', false),
    ('jobs', 'managers_manage_jobs', 'ALL', false);

  -- loaner_assignments
  INSERT INTO _policy_keep VALUES
    ('loaner_assignments', 'loaner_assignments_select_tenant', 'SELECT', false),
    ('loaner_assignments', 'loaner_assignments_insert_tenant', 'INSERT', false),
    ('loaner_assignments', 'loaner_assignments_update_tenant', 'UPDATE', false),
    ('loaner_assignments', 'loaner_assignments_delete_tenant', 'DELETE', false),
    ('loaner_assignments', 'users_can_view_loaner_assignments', 'SELECT', false),
    ('loaner_assignments', 'managers can delete loaner_assignments', 'DELETE', false),
    ('loaner_assignments', 'managers_manage_loaner_assignments', 'ALL', false);

  -- notification_outbox
  INSERT INTO _policy_keep VALUES
    ('notification_outbox', 'admin_manage_notification_outbox', 'ALL', false);

  -- notification_preferences
  INSERT INTO _policy_keep VALUES
    ('notification_preferences', 'users_manage_own_notification_preferences', 'ALL', false);

  -- organizations
  INSERT INTO _policy_keep VALUES
    ('organizations', 'org_members_select_own_org', 'SELECT', false),
    ('organizations', 'org_members_update_own_org', 'UPDATE', false);

  -- products
  INSERT INTO _policy_keep VALUES
    ('products', 'app_org_staff_can_read_products', 'SELECT', false),
    ('products', 'managers_manage_products', 'ALL', false),
    ('products', 'products_manage_tenant', 'ALL', false);

  -- sms_opt_outs
  INSERT INTO _policy_keep VALUES
    ('sms_opt_outs', 'sms_opt_outs_select', 'SELECT', false),
    ('sms_opt_outs', 'admin_manage_sms_opt_outs', 'ALL', false),
    ('sms_opt_outs', 'public_read_sms_opt_outs', 'SELECT', false);

  -- sms_templates
  INSERT INTO _policy_keep VALUES
    ('sms_templates', 'sms_templates_select_tenant', 'SELECT', false),
    ('sms_templates', 'admin_manage_sms_templates', 'ALL', false),
    ('sms_templates', 'managers can delete sms_templates', 'DELETE', false),
    ('sms_templates', 'sms_templates_manage_tenant', 'ALL', false);

  -- transactions
  INSERT INTO _policy_keep VALUES
    ('transactions', 'transactions_select_tenant', 'SELECT', false),
    ('transactions', 'transactions_insert_tenant', 'INSERT', false),
    ('transactions', 'transactions_update_tenant', 'UPDATE', false),
    ('transactions', 'transactions_delete_tenant', 'DELETE', false),
    ('transactions', 'staff_can_view_transactions', 'SELECT', false),
    ('transactions', 'managers can delete transactions', 'DELETE', false),
    ('transactions', 'managers_manage_transactions', 'ALL', false);

  -- user_profiles
  INSERT INTO _policy_keep VALUES
    ('user_profiles', 'own profile read', 'SELECT', false),
    ('user_profiles', 'own profile read by email via jwt', 'SELECT', true),
    ('user_profiles', 'user_profiles_read_active', 'SELECT', false),
    ('user_profiles', 'user_profiles_insert_self', 'INSERT', false),
    ('user_profiles', 'user_profiles_update_self', 'UPDATE', false);

  -- vehicles
  INSERT INTO _policy_keep VALUES
    ('vehicles', 'vehicles_select_tenant', 'SELECT', false),
    ('vehicles', 'vehicles_insert_tenant', 'INSERT', false),
    ('vehicles', 'vehicles_update_tenant', 'UPDATE', false),
    ('vehicles', 'vehicles_delete_tenant', 'DELETE', false),
    ('vehicles', 'staff_can_view_vehicles', 'SELECT', false),
    ('vehicles', 'managers_manage_vehicles', 'ALL', false);

  -- vendor_hours
  INSERT INTO _policy_keep VALUES
    ('vendor_hours', 'vendors_manage_own_hours', 'ALL', false);

  -- vendors
  INSERT INTO _policy_keep VALUES
    ('vendors', 'vendors_select_tenant_active', 'SELECT', false),
    ('vendors', 'admin_manager_full_vendor_access', 'ALL', false),
    ('vendors', 'vendors_insert_tenant', 'INSERT', false),
    ('vendors', 'vendors_update_tenant', 'UPDATE', false);

  -- ---------------------------------------------------------------------------
  -- REQUIRED policies (must exist before we start dropping).
  -- NOTE: Some policies are optional in the spec, but are required by current app code.
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE _policy_required (
    tablename text NOT NULL,
    policyname text NOT NULL,
    expected_cmd text NOT NULL
  ) ON COMMIT DROP;

  -- Required: everything in KEEP except explicitly optional-but-unused.
  -- We treat these as required because this migration is meant to run only after
  -- the canonical policy set is installed.
  INSERT INTO _policy_required
  SELECT tablename, policyname, expected_cmd
  FROM _policy_keep
  WHERE is_optional = false;

  -- Verify required policies exist for tables that exist.
  FOR r IN
    SELECT DISTINCT pr.tablename, pr.policyname, pr.expected_cmd
    FROM _policy_required pr
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = r.tablename
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies pp
        WHERE pp.schemaname = 'public'
          AND pp.tablename = r.tablename
          AND pp.policyname = r.policyname
      ) THEN
        missing_count := missing_count + 1;
        RAISE WARNING 'Missing required policy "%" on public.%', r.policyname, r.tablename;
      ELSE
        -- Enforce expected command for required policies
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies pp
          WHERE pp.schemaname = 'public'
            AND pp.tablename = r.tablename
            AND pp.policyname = r.policyname
            AND upper(pp.cmd) = upper(r.expected_cmd)
        ) THEN
          missing_count := missing_count + 1;
          RAISE WARNING 'Policy "%" on public.% exists but has unexpected cmd (expected %)', r.policyname, r.tablename, r.expected_cmd;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Policy dedupe aborted: % required KEEP policies are missing. Apply the canonical policy migration first.', missing_count;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Drop any policy not in KEEP, plus any policy that violates EXTRA CANON RULES.
  -- EXTRA CANON RULES:
  --   - Any policy with qual = true must not exist.
  --   - Any policy that references org_id/auth_user_org/app_current_org_id on a tenant table must not exist.
  --   - Any SELECT policy that only checks is_active without dealer_id constraint must not exist.
  --   - Any SELECT policy with dealer_id IS NULL allowances must not exist.
  -- ---------------------------------------------------------------------------

  FOR p IN
    SELECT pp.schemaname, pp.tablename, pp.policyname, pp.cmd, pp.qual, pp.with_check
    FROM pg_policies pp
    WHERE pp.schemaname = 'public'
      AND pp.tablename IN (
        'activity_history',
        'claim_attachments',
        'claims',
        'communications',
        'filter_presets',
        'job_parts',
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
        'vehicles',
        'vendor_hours',
        'vendors'
      )
  LOOP
    -- Determine expected cmd for KEEP policies (if any)
    SELECT k.expected_cmd INTO expected_cmd
    FROM _policy_keep k
    WHERE k.tablename = p.tablename
      AND k.policyname = p.policyname;

    -- If not in KEEP list, drop unconditionally.
    IF NOT EXISTS (
      SELECT 1
      FROM _policy_keep k
      WHERE k.tablename = p.tablename
        AND k.policyname = p.policyname
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', p.policyname, p.schemaname, p.tablename);
      dropped_count := dropped_count + 1;
      CONTINUE;
    END IF;

    -- KEEP policy exists: enforce command matches expected
    IF expected_cmd IS NULL OR upper(p.cmd) <> upper(expected_cmd) THEN
      RAISE EXCEPTION 'KEEP policy "%" on public.% has cmd %, expected %', p.policyname, p.tablename, p.cmd, coalesce(expected_cmd, '<missing expected_cmd>');
    END IF;

    -- Enforce EXTRA CANON RULES even for KEEP policies.
    qual_text := coalesce(p.qual, '');
    check_text := coalesce(p.with_check, '');

    qual_compact := lower(regexp_replace(qual_text, '\\s+', '', 'g'));
    check_compact := lower(regexp_replace(check_text, '\\s+', '', 'g'));

    -- Detect whether this table has dealer_id/is_active columns.
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = p.tablename
        AND c.column_name = 'dealer_id'
    ) INTO has_dealer_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = p.tablename
        AND c.column_name = 'is_active'
    ) INTO has_is_active;

    -- Tenant tables for EXTRA CANON checks (explicit list; user_profiles excluded)
    is_tenant_table := p.tablename IN (
      'jobs',
      'job_parts',
      'vehicles',
      'vendors',
      'products',
      'transactions',
      'loaner_assignments',
      'sms_templates',
      'sms_opt_outs',
      'communications',
      'claims',
      'claim_attachments'
    );

    violates_extra := false;

    -- Any policy with qual='true' (or (true)) must not exist.
    IF qual_compact IN ('true', '(true)') OR check_compact IN ('true', '(true)') THEN
      violates_extra := true;
    END IF;

    -- Any policy that references org_id/auth_user_org/app_current_org_id on a tenant table must not exist.
    IF NOT violates_extra AND is_tenant_table THEN
      IF qual_text ILIKE '%auth_user_org%' OR qual_text ILIKE '%app_current_org_id%' OR qual_text ILIKE '%org_id%'
         OR check_text ILIKE '%auth_user_org%' OR check_text ILIKE '%app_current_org_id%' OR check_text ILIKE '%org_id%'
      THEN
        violates_extra := true;
      END IF;
    END IF;

    -- Any SELECT policy that only checks is_active without dealer_id constraint must not exist.
    IF NOT violates_extra AND has_dealer_id AND has_is_active AND upper(p.cmd) = 'SELECT' THEN
      IF (qual_text ILIKE '%is_active%' OR qual_text ILIKE '%coalesce(is_active%')
         AND qual_text NOT ILIKE '%dealer_id%'
      THEN
        violates_extra := true;
      END IF;
    END IF;

    -- Any policy with dealer_id IS NULL allowances must not exist.
    IF NOT violates_extra AND has_dealer_id THEN
      IF qual_text ~* 'dealer_id\\s+is\\s+null' OR check_text ~* 'dealer_id\\s+is\\s+null' THEN
        violates_extra := true;
      END IF;
    END IF;

    -- If a KEEP policy violates EXTRA CANON rules, abort (do not silently lock out access).
    IF violates_extra THEN
      RAISE EXCEPTION 'KEEP policy "%" on public.% violates EXTRA CANON rules; fix the policy definition before running policy dedupe.', p.policyname, p.tablename;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLICY DEDUPE (Authoritative) complete';
  RAISE NOTICE 'Policies dropped: %', dropped_count;
  RAISE NOTICE '========================================';
END $$;
