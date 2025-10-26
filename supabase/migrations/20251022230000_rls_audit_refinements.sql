-- RLS Audit Refinements: tighten org scoping and remove permissive public policies
-- Created: 2025-10-22
-- Safe/idempotent: uses conditional drops and IF NOT EXISTS checks

-- 0) Helper: ensure auth_user_org() exists (defined in earlier migration)
--    Do not overwrite, just verify it's present; if missing, create.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_user_org'
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.auth_user_org() RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
        select org_id from public.user_profiles where id = auth.uid();
      $fn$;
    ';
  END IF;
END $$;

-- 1) Revoke broad anon access on dropdown-related tables
DO $$
BEGIN
  -- user_profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = 'user_profiles' AND privilege_type = 'SELECT'
  ) THEN
    EXECUTE 'REVOKE SELECT ON public.user_profiles FROM anon';
  END IF;
  -- products
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = 'products' AND privilege_type = 'SELECT'
  ) THEN
    EXECUTE 'REVOKE SELECT ON public.products FROM anon';
  END IF;
  -- vendors
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = 'vendors' AND privilege_type = 'SELECT'
  ) THEN
    EXECUTE 'REVOKE SELECT ON public.vendors FROM anon';
  END IF;
END $$;

-- 2) Drop overly-permissive SELECT policies used for public dropdowns
DO $$
BEGIN
  -- user_profiles
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='dropdown_access_user_profiles'
  ) THEN
    EXECUTE 'DROP POLICY "dropdown_access_user_profiles" ON public.user_profiles';
  END IF;
  -- vendors
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='public_read_vendors'
  ) THEN
    EXECUTE 'DROP POLICY "public_read_vendors" ON public.vendors';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='staff_view_vendors_only'
  ) THEN
    EXECUTE 'DROP POLICY "staff_view_vendors_only" ON public.vendors';
  END IF;
  -- products
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='public_read_products'
  ) THEN
    EXECUTE 'DROP POLICY "public_read_products" ON public.products';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='staff_view_products'
  ) THEN
    EXECUTE 'DROP POLICY "staff_view_products" ON public.products';
  END IF;
END $$;

-- 3) Tighten admin manage policies to current org for vendors/products
DO $$
BEGIN
  -- vendors: drop and recreate with org guard
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='admin_manager_full_vendor_access'
  ) THEN
    EXECUTE 'DROP POLICY "admin_manager_full_vendor_access" ON public.vendors';
  END IF;
  EXECUTE '
    CREATE POLICY "admin_manager_full_vendor_access" ON public.vendors
    FOR ALL TO authenticated
    USING (public.is_admin_or_manager() AND (org_id = public.auth_user_org() OR org_id IS NULL))
    WITH CHECK (public.is_admin_or_manager() AND (org_id = public.auth_user_org() OR org_id IS NULL));
  ';

  -- products: drop and recreate with org guard
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='admin_manager_manage_products'
  ) THEN
    EXECUTE 'DROP POLICY "admin_manager_manage_products" ON public.products';
  END IF;
  EXECUTE '
    CREATE POLICY "admin_manager_manage_products" ON public.products
    FOR ALL TO authenticated
    USING (public.is_admin_or_manager() AND (org_id = public.auth_user_org() OR org_id IS NULL))
    WITH CHECK (public.is_admin_or_manager() AND (org_id = public.auth_user_org() OR org_id IS NULL));
  ';
END $$;

-- 4) Add org-scoped SELECT policies for dropdown reads (authenticated users only)
DO $$
BEGIN
  -- user_profiles: org members can read active staff in their org (for dropdowns)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='org members read user_profiles'
  ) THEN
    EXECUTE '
      CREATE POLICY "org members read user_profiles" ON public.user_profiles
      FOR SELECT TO authenticated
      USING (org_id = public.auth_user_org() AND coalesce(is_active, true));
    ';
  END IF;

  -- vendors: org members can read active vendors in their org or shared (NULL org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='org members read vendors'
  ) THEN
    EXECUTE '
      CREATE POLICY "org members read vendors" ON public.vendors
      FOR SELECT TO authenticated
      USING ((org_id = public.auth_user_org() OR org_id IS NULL) AND coalesce(is_active, true));
    ';
  END IF;

  -- products: org members can read active products in their org or shared (NULL org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='org members read products'
  ) THEN
    EXECUTE '
      CREATE POLICY "org members read products" ON public.products
      FOR SELECT TO authenticated
      USING ((org_id = public.auth_user_org() OR org_id IS NULL) AND coalesce(is_active, true));
    ';
  END IF;
END $$;

-- 5) Ensure RLS is enabled on affected tables (idempotent)
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
