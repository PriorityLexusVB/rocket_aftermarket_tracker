-- Location: supabase/migrations/20250107150001_fix_claims_rls_policies.sql
-- Schema Analysis: Existing claims management system with RLS policies referencing auth.users incorrectly
-- Integration Type: Modification - Fixing RLS policies for proper authentication access
-- Dependencies: claims, claim_attachments tables, user_profiles table

-- Fix RLS policies that are causing "permission denied for table users" errors
-- The existing policies reference auth.users which causes PostgREST compatibility issues

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "staff_can_view_all_claims" ON public.claims;
DROP POLICY IF EXISTS "staff_can_create_claims" ON public.claims;
DROP POLICY IF EXISTS "staff_can_view_claim_attachments" ON public.claim_attachments;
DROP POLICY IF EXISTS "staff_can_create_claim_attachments" ON public.claim_attachments;

-- 2. Create helper function for role-based access using user_profiles (not auth.users)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.role IN ('admin', 'manager')
    AND up.is_active = true
)
$$;

-- 3. Create corrected RLS policies for public access with role-based management

-- Allow public read access for customer portal functionality
CREATE POLICY "public_can_view_claims"
ON public.claims
FOR SELECT
TO public
USING (true);

-- Allow public create for customer claim submissions
CREATE POLICY "public_can_create_claims"
ON public.claims
FOR INSERT
TO public
WITH CHECK (true);

-- Admin/Manager users can update and delete claims
CREATE POLICY "admin_can_manage_claims"
ON public.claims
FOR UPDATE
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "admin_can_delete_claims"
ON public.claims
FOR DELETE
TO authenticated
USING (public.is_admin_or_manager());

-- 4. Create corrected RLS policies for claim attachments

-- Allow public read access for claim attachments
CREATE POLICY "public_can_view_claim_attachments"
ON public.claim_attachments
FOR SELECT
TO public
USING (true);

-- Allow public create for customer attachment uploads
CREATE POLICY "public_can_create_claim_attachments"
ON public.claim_attachments
FOR INSERT
TO public
WITH CHECK (true);

-- Admin/Manager users can manage attachments
CREATE POLICY "admin_can_manage_claim_attachments"
ON public.claim_attachments
FOR UPDATE
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "admin_can_delete_claim_attachments"
ON public.claim_attachments
FOR DELETE
TO authenticated
USING (public.is_admin_or_manager());

-- 5. Update storage policies to work with the new approach
-- Drop existing problematic storage policies
DROP POLICY IF EXISTS "staff_can_view_claim_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_can_upload_claim_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_can_delete_claim_photos" ON storage.objects;

-- Create corrected storage policies that allow public access for customer functionality
CREATE POLICY "public_can_view_claim_photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'claim-photos');

CREATE POLICY "public_can_upload_claim_photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
    bucket_id = 'claim-photos'
    AND (storage.foldername(name))[1] ~ '^claim-[0-9a-f-]+$'
);

-- Authenticated admin users can delete claim photos
CREATE POLICY "admin_can_delete_claim_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'claim-photos' 
    AND public.is_admin_or_manager()
);

-- 6. Add helpful comment about the fix
COMMENT ON FUNCTION public.is_admin_or_manager() IS 'Helper function to check if current user has admin or manager role. Used by RLS policies to prevent auth.users reference issues.';