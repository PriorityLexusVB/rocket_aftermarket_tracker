-- Migration: Harden SECURITY DEFINER Function Permissions
-- Purpose: Tighten EXECUTE permissions on high-risk SECURITY DEFINER functions
-- Phase: 1 - Permissions Hardening
-- Date: 2025-12-10
-- 
-- This migration revokes broad EXECUTE permissions from high-risk SECURITY DEFINER
-- functions that can delete data, modify auth.users, or perform bulk operations.
-- Only authenticated users who need these functions will have access via RLS policies
-- and controlled application flows.
--
-- ROLLBACK: To revert, run the following SQL:
-- GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_profiles() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.cleanup_illegitimate_users() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.cleanup_priority_automotive_admins() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.delete_job_cascade(uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, user_role, text) TO authenticated;

-- ============================================================================
-- Phase 1: Revoke EXECUTE on High-Risk Cleanup Functions
-- ============================================================================

-- These functions perform bulk deletes and should only be called by admin tooling
-- or migrations, not by general authenticated users via the API.

-- Cleanup function that deletes user_profiles without auth.users
DO $$
BEGIN
    -- Revoke from public role (catches anon and authenticated)
    REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_profiles() FROM public;
    REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_profiles() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_profiles() FROM authenticated;
    
    RAISE NOTICE 'Revoked EXECUTE on cleanup_orphaned_profiles from public, anon, authenticated';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function cleanup_orphaned_profiles does not exist, skipping';
    WHEN OTHERS THEN
        RAISE NOTICE 'Warning while revoking cleanup_orphaned_profiles: %', SQLERRM;
END $$;

-- Cleanup function that removes illegitimate users and their data
DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.cleanup_illegitimate_users() FROM public;
    REVOKE EXECUTE ON FUNCTION public.cleanup_illegitimate_users() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.cleanup_illegitimate_users() FROM authenticated;
    
    RAISE NOTICE 'Revoked EXECUTE on cleanup_illegitimate_users from public, anon, authenticated';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function cleanup_illegitimate_users does not exist, skipping';
    WHEN OTHERS THEN
        RAISE NOTICE 'Warning while revoking cleanup_illegitimate_users: %', SQLERRM;
END $$;

-- Cleanup function that deletes Priority Automotive admin users from auth.users
DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.cleanup_priority_automotive_admins() FROM public;
    REVOKE EXECUTE ON FUNCTION public.cleanup_priority_automotive_admins() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.cleanup_priority_automotive_admins() FROM authenticated;
    
    RAISE NOTICE 'Revoked EXECUTE on cleanup_priority_automotive_admins from public, anon, authenticated';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function cleanup_priority_automotive_admins does not exist, skipping';
    WHEN OTHERS THEN
        RAISE NOTICE 'Warning while revoking cleanup_priority_automotive_admins: %', SQLERRM;
END $$;

-- ============================================================================
-- Phase 2: Revoke EXECUTE on Cascade Delete Function
-- ============================================================================

-- This function performs cascading deletes across multiple tables
-- It should only be accessible via controlled application logic with proper authorization

DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.delete_job_cascade(uuid) FROM public;
    REVOKE EXECUTE ON FUNCTION public.delete_job_cascade(uuid) FROM anon;
    -- Note: This function previously had GRANT to authenticated in its migration
    -- We're revoking it to require explicit permission checks in the application layer
    REVOKE EXECUTE ON FUNCTION public.delete_job_cascade(uuid) FROM authenticated;
    
    RAISE NOTICE 'Revoked EXECUTE on delete_job_cascade from public, anon, authenticated';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function delete_job_cascade does not exist, skipping';
    WHEN OTHERS THEN
        RAISE NOTICE 'Warning while revoking delete_job_cascade: %', SQLERRM;
END $$;

-- ============================================================================
-- Phase 3: Revoke EXECUTE on User Creation Function
-- ============================================================================

-- This function inserts directly into auth.users and should only be used by
-- admin interfaces or controlled signup flows, not general API access

DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, user_role, text) FROM public;
    REVOKE EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, user_role, text) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, user_role, text) FROM authenticated;
    
    RAISE NOTICE 'Revoked EXECUTE on create_user_with_profile from public, anon, authenticated';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function create_user_with_profile does not exist, skipping';
    WHEN OTHERS THEN
        RAISE NOTICE 'Warning while revoking create_user_with_profile: %', SQLERRM;
END $$;

-- ============================================================================
-- Verification Query (Optional)
-- ============================================================================

-- To verify permissions have been revoked, run:
-- SELECT 
--     p.proname as function_name,
--     pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
--     array_agg(DISTINCT a.rolname) as granted_to
-- FROM pg_proc p
-- LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
-- LEFT JOIN pg_auth_members m ON m.member = p.proowner
-- LEFT JOIN pg_authid a ON a.oid = m.roleid
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'cleanup_orphaned_profiles',
--     'cleanup_illegitimate_users', 
--     'cleanup_priority_automotive_admins',
--     'delete_job_cascade',
--     'create_user_with_profile'
--   )
-- GROUP BY p.proname, p.oid;

-- ============================================================================
-- Summary
-- ============================================================================

-- This migration hardens security by:
-- 1. Preventing general API access to cleanup functions that delete data
-- 2. Requiring explicit permission for cascading job deletes
-- 3. Restricting user creation to controlled admin flows
--
-- These functions remain SECURITY DEFINER (to access auth schema) but now
-- require explicit permission grants or admin-only access patterns.
--
-- Application Impact:
-- - delete_job_cascade: Application must handle via RLS-protected endpoints
-- - cleanup_*: Should only be called from admin tools or maintenance scripts
-- - create_user_with_profile: Use Supabase Auth signup flows instead
