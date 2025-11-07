-- Migration: Multi-Tenant RLS Hardening and Write Policy Completion
-- Date: 2025-11-06
-- Purpose: Ensure comprehensive RLS policies for all tables with org_id
-- Context: Part of deal create/edit reliability stabilization effort
-- Dependencies: 
--   - 20251106120000_add_missing_org_id_columns.sql (adds org_id to tables)
--   - 20251105000000_fix_rls_policies_and_write_permissions.sql (base write policies)
--   - 20251104221500_fix_is_admin_or_manager_auth_users_references.sql (fixes helper functions)

-- =============================================================================
-- SECTION 1: Add Missing Write Policies for sms_templates
-- =============================================================================

-- Policy: Allow users to insert sms_templates in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='sms_templates' 
    AND policyname='org can insert sms_templates'
  ) THEN
    CREATE POLICY "org can insert sms_templates" ON public.sms_templates
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can insert sms_templates';
  END IF;
END $$;

-- Policy: Allow users to update sms_templates in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='sms_templates' 
    AND policyname='org can update sms_templates'
  ) THEN
    CREATE POLICY "org can update sms_templates" ON public.sms_templates
    FOR UPDATE TO authenticated
    USING (org_id = public.auth_user_org() OR public.is_admin_or_manager())
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can update sms_templates';
  END IF;
END $$;

-- Policy: Allow admins/managers to delete sms_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='sms_templates' 
    AND policyname='managers can delete sms_templates'
  ) THEN
    CREATE POLICY "managers can delete sms_templates" ON public.sms_templates
    FOR DELETE TO authenticated
    USING (public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: managers can delete sms_templates';
  END IF;
END $$;

-- =============================================================================
-- SECTION 2: Add Missing Write Policies for products
-- =============================================================================

-- Policy: Allow users to insert products in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='products' 
    AND policyname='org can insert products'
  ) THEN
    CREATE POLICY "org can insert products" ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can insert products';
  END IF;
END $$;

-- Policy: Allow users to update products in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='products' 
    AND policyname='org can update products'
  ) THEN
    CREATE POLICY "org can update products" ON public.products
    FOR UPDATE TO authenticated
    USING (org_id = public.auth_user_org() OR public.is_admin_or_manager())
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can update products';
  END IF;
END $$;

-- =============================================================================
-- SECTION 3: Add Missing Write Policies for vendors
-- =============================================================================

-- Policy: Allow users to insert vendors in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='vendors' 
    AND policyname='org can insert vendors'
  ) THEN
    CREATE POLICY "org can insert vendors" ON public.vendors
    FOR INSERT TO authenticated
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can insert vendors';
  END IF;
END $$;

-- Policy: Allow users to update vendors in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='vendors' 
    AND policyname='org can update vendors'
  ) THEN
    CREATE POLICY "org can update vendors" ON public.vendors
    FOR UPDATE TO authenticated
    USING (org_id = public.auth_user_org() OR public.is_admin_or_manager())
    WITH CHECK (org_id = public.auth_user_org() OR public.is_admin_or_manager());
    
    RAISE NOTICE 'Created policy: org can update vendors';
  END IF;
END $$;

-- =============================================================================
-- SECTION 4: Ensure RLS is enabled on all org-scoped tables
-- =============================================================================

ALTER TABLE IF EXISTS public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_parts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 5: Documentation and Validation
-- =============================================================================

-- Comment explaining the RLS pattern
COMMENT ON TABLE public.sms_templates IS 
'SMS templates for automated notifications. Multi-tenant isolation via org_id. 
RLS Pattern: SELECT (org match), INSERT/UPDATE (org match or admin), DELETE (admin only).';

COMMENT ON TABLE public.products IS 
'Products/services offered. Multi-tenant isolation via org_id.
RLS Pattern: SELECT (org match), INSERT/UPDATE (org match or admin), DELETE (admin only).';

COMMENT ON TABLE public.vendors IS 
'External vendors for off-site work. Multi-tenant isolation via org_id.
RLS Pattern: SELECT (org match), INSERT/UPDATE (org match or admin), DELETE (admin only).';

-- Validation check
DO $$
DECLARE
  policy_count INT;
BEGIN
  -- Count policies created by this migration
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename IN ('sms_templates', 'products', 'vendors')
  AND policyname LIKE 'org can %';
  
  RAISE NOTICE 'RLS Hardening Complete. Total org-scoped policies: %', policy_count;
  
  -- Ensure critical helper functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_user_org'
  ) THEN
    RAISE WARNING 'Helper function auth_user_org() not found. Please ensure migration 20251022230000_rls_audit_refinements.sql has been applied.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager'
  ) THEN
    RAISE WARNING 'Helper function is_admin_or_manager() not found. Please ensure migration 20251104221500_fix_is_admin_or_manager_auth_users_references.sql has been applied.';
  END IF;
END $$;
