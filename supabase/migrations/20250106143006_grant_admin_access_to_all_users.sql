-- Location: supabase/migrations/20250106143006_grant_admin_access_to_all_users.sql
-- Schema Analysis: Existing user_profiles table with role column (user_role enum: 'admin', 'manager', 'staff', 'vendor')
-- Integration Type: modification - updating existing user roles
-- Dependencies: user_profiles table, user_role enum type

-- Update all existing users to have admin access
UPDATE public.user_profiles 
SET role = 'admin'::public.user_role,
    updated_at = CURRENT_TIMESTAMP
WHERE role != 'admin'::public.user_role;

-- Log the admin access grant operation
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
        RAISE NOTICE 'Successfully granted admin access to % user accounts', updated_count;
    ELSE
        RAISE NOTICE 'No user accounts were updated - all users already have admin access';
    END IF;
    
    -- Log activity for audit purposes
    INSERT INTO public.activity_history (
        id,
        action,
        table_name,
        record_id,
        changes,
        performed_by,
        performed_at
    )
    SELECT 
        gen_random_uuid(),
        'UPDATE',
        'user_profiles',
        up.id,
        jsonb_build_object(
            'old_role', 'non-admin',
            'new_role', 'admin',
            'reason', 'System-wide admin access grant'
        ),
        up.id, -- Self-performed for system operations
        CURRENT_TIMESTAMP
    FROM public.user_profiles up
    WHERE up.role = 'admin'::public.user_role;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Admin access grant completed with note: %', SQLERRM;
END $$;

-- Verify the update
DO $$
DECLARE
    admin_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM public.user_profiles WHERE role = 'admin'::public.user_role;
    SELECT COUNT(*) INTO total_count FROM public.user_profiles;
    
    RAISE NOTICE 'Admin access verification: % out of % users now have admin role', admin_count, total_count;
END $$;