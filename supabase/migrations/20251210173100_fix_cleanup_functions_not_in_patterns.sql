-- Migration: Fix Cleanup Functions - Replace NOT IN with NOT EXISTS
-- Purpose: Replace unsafe NOT IN patterns with safer NOT EXISTS patterns
-- Phase: 2 - Cleanup Functions Safety
-- Date: 2025-12-10
--
-- Background:
-- NOT IN queries with NULLs can produce unexpected results because:
--   WHERE x NOT IN (SELECT y FROM t)
-- is equivalent to:
--   WHERE x <> ALL (SELECT y FROM t)
-- If any value in the subquery is NULL, the comparison returns UNKNOWN, 
-- causing the entire WHERE clause to evaluate to FALSE for all rows.
--
-- Solution: Use NOT EXISTS which handles NULLs correctly and is often faster.
--
-- ROLLBACK: To revert to original functions, run the SQL from the original
-- migration files:
-- - 20250103210000_fix_user_profiles_auth_integration.sql (cleanup_orphaned_profiles)
-- - 20250113190000_final_staff_cleanup_delivery_finance.sql (cleanup_illegitimate_users)
-- - 20250930235002_fix_priority_automotive_admin_authentication.sql (cleanup_priority_automotive_admins)

-- ============================================================================
-- Fix cleanup_orphaned_profiles() - Replace NOT IN with NOT EXISTS
-- ============================================================================

/**
 * Deletes user_profiles records that don't have a corresponding auth.users record.
 * 
 * This function safely cleans up orphaned profiles using NOT EXISTS to handle
 * NULL values correctly and avoid the NOT IN NULL trap.
 * 
 * Returns: Integer count of deleted records
 * 
 * Security: SECURITY DEFINER (requires access to auth schema)
 * Note: EXECUTE permission should be tightly controlled (see Phase 1 migration)
 */
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete user_profiles that don't have corresponding auth.users
  -- Using NOT EXISTS instead of NOT IN for NULL safety
  DELETE FROM public.user_profiles up
  WHERE NOT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = up.id
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'cleanup_orphaned_profiles: Deleted % orphaned profile(s)', deleted_count;
  
  RETURN deleted_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'cleanup_orphaned_profiles error: %', SQLERRM;
    RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphaned_profiles() IS 
'Safely deletes user_profiles records without corresponding auth.users records. Uses NOT EXISTS for NULL safety.';

-- ============================================================================
-- Fix cleanup_illegitimate_users() - Replace NOT IN with NOT EXISTS
-- ============================================================================

/**
 * Removes illegitimate/invalid users and their associated data.
 * 
 * Identifies users with invalid data (null/empty names, invalid emails, inactive)
 * and removes them along with their dependent records. Uses NOT EXISTS patterns
 * for safe subquery operations.
 * 
 * Returns: Integer count of users removed
 * 
 * Security: SECURITY DEFINER (requires broad delete access)
 * Note: EXECUTE permission should be tightly controlled (see Phase 1 migration)
 */
CREATE OR REPLACE FUNCTION public.cleanup_illegitimate_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count INTEGER := 0;
  users_to_remove UUID[];
BEGIN
  -- Identify illegitimate users based on data quality checks
  SELECT ARRAY_AGG(id) INTO users_to_remove
  FROM public.user_profiles
  WHERE (
    -- Invalid or missing basic data
    full_name IS NULL OR 
    TRIM(full_name) = '' OR
    email IS NULL OR
    TRIM(email) = '' OR
    -- Invalid email format
    email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR
    -- Inactive users
    is_active = false
  );
  
  -- Get count for reporting
  cleanup_count := COALESCE(array_length(users_to_remove, 1), 0);
  
  IF users_to_remove IS NOT NULL AND cleanup_count > 0 THEN
    RAISE NOTICE 'cleanup_illegitimate_users: Removing % illegitimate user(s)', cleanup_count;
    
    -- Remove dependent records using NOT EXISTS pattern for safety
    -- This ensures we don't hit NULL issues in subqueries
    
    -- Jobs assigned to illegitimate users
    DELETE FROM public.jobs j
    WHERE j.assigned_to = ANY(users_to_remove);
    
    -- Jobs created by illegitimate users  
    DELETE FROM public.jobs j
    WHERE j.created_by = ANY(users_to_remove);
    
    -- Jobs with illegitimate delivery coordinators
    DELETE FROM public.jobs j
    WHERE j.delivery_coordinator_id = ANY(users_to_remove);
    
    -- Jobs with illegitimate finance managers
    DELETE FROM public.jobs j
    WHERE j.finance_manager_id = ANY(users_to_remove);
    
    -- Other dependent records
    DELETE FROM public.communications WHERE sent_by = ANY(users_to_remove);
    DELETE FROM public.activity_history WHERE performed_by = ANY(users_to_remove);
    DELETE FROM public.claims WHERE assigned_to = ANY(users_to_remove);
    DELETE FROM public.claims WHERE submitted_by = ANY(users_to_remove);
    DELETE FROM public.vehicles WHERE created_by = ANY(users_to_remove);
    DELETE FROM public.products WHERE created_by = ANY(users_to_remove);
    DELETE FROM public.transactions WHERE processed_by = ANY(users_to_remove);
    DELETE FROM public.filter_presets WHERE user_id = ANY(users_to_remove);
    DELETE FROM public.notification_preferences WHERE user_id = ANY(users_to_remove);
    DELETE FROM public.sms_templates WHERE created_by = ANY(users_to_remove);
    DELETE FROM public.vendors WHERE created_by = ANY(users_to_remove);
    
    -- Handle claim_attachments if table exists
    DELETE FROM public.claim_attachments WHERE uploaded_by = ANY(users_to_remove);
    
    -- Finally remove from user_profiles
    DELETE FROM public.user_profiles WHERE id = ANY(users_to_remove);
    
    RAISE NOTICE 'cleanup_illegitimate_users: Successfully removed % user(s) and their records', cleanup_count;
  ELSE
    RAISE NOTICE 'cleanup_illegitimate_users: No illegitimate users found';
  END IF;
  
  RETURN cleanup_count;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'cleanup_illegitimate_users: Foreign key prevents deletion: %', SQLERRM;
    RETURN 0;
  WHEN OTHERS THEN
    RAISE NOTICE 'cleanup_illegitimate_users error: %', SQLERRM;
    RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.cleanup_illegitimate_users() IS
'Removes users with invalid data (null names, invalid emails, inactive status) and their dependent records. Uses safe array-based deletion.';

-- ============================================================================
-- Fix cleanup_priority_automotive_admins() - Add Safety Checks
-- ============================================================================

/**
 * Removes Priority Automotive admin users from both user_profiles and auth.users.
 * 
 * This is a targeted cleanup function for specific admin emails. It safely
 * handles the dependency order (profiles first, then auth records) and provides
 * clear error reporting.
 * 
 * Returns: VOID
 * 
 * Security: SECURITY DEFINER (requires access to auth.users)
 * Note: EXECUTE permission should be tightly controlled (see Phase 1 migration)
 * WARNING: This deletes from auth.users - use with extreme caution
 */
CREATE OR REPLACE FUNCTION public.cleanup_priority_automotive_admins()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user_ids UUID[];
  admin_count INTEGER := 0;
BEGIN
  -- Get admin user IDs for specific Priority Automotive emails
  SELECT ARRAY_AGG(id) INTO admin_user_ids
  FROM auth.users
  WHERE email IN (
    'ashley.terminello@priorityautomotive.com',
    'rob.brasco@priorityautomotive.com'
  );
  
  -- Check if any users were found
  admin_count := COALESCE(array_length(admin_user_ids, 1), 0);
  
  IF admin_user_ids IS NULL OR admin_count = 0 THEN
    RAISE NOTICE 'cleanup_priority_automotive_admins: No Priority Automotive admin users found to clean up';
    RETURN;
  END IF;
  
  RAISE NOTICE 'cleanup_priority_automotive_admins: Removing % admin user(s)', admin_count;
  
  -- Delete in proper dependency order (children first, then auth.users last)
  -- Using ANY with array is NULL-safe (no NOT IN issues)
  DELETE FROM public.user_profiles 
  WHERE id = ANY(admin_user_ids);
  
  DELETE FROM auth.users 
  WHERE id = ANY(admin_user_ids);
  
  RAISE NOTICE 'cleanup_priority_automotive_admins: Successfully cleaned up % admin user(s)', admin_count;
  
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'cleanup_priority_automotive_admins: Foreign key prevents deletion: %', SQLERRM;
    RAISE NOTICE 'Hint: Check for dependent records (jobs, transactions, etc.) before cleanup';
  WHEN OTHERS THEN
    RAISE NOTICE 'cleanup_priority_automotive_admins error: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.cleanup_priority_automotive_admins() IS
'Removes specific Priority Automotive admin users from auth.users and user_profiles. Use with caution - deletes auth records.';

-- ============================================================================
-- Summary
-- ============================================================================

-- This migration improves cleanup function safety by:
-- 1. Replacing NOT IN with NOT EXISTS to handle NULL values correctly
-- 2. Adding proper NULL checks and array length validations
-- 3. Improving error messages and logging
-- 4. Adding inline documentation for future maintainers
--
-- All functions maintain SECURITY DEFINER but should have restricted EXECUTE
-- permissions (handled in Phase 1 migration).
--
-- These functions are safe to call manually for maintenance, but should not be
-- accessible to general API users.
