-- Location: supabase/migrations/20250102215814_fix_user_role_enum_values.sql
-- Schema Analysis: user_profiles table exists with role column using user_role enum
-- Integration Type: Data correction migration  
-- Dependencies: user_profiles table, user_role enum type

-- Fix invalid user role values in existing data
-- Update any invalid role values to valid enum values
UPDATE public.user_profiles 
SET role = 'staff'::public.user_role 
WHERE role::text NOT IN ('admin', 'manager', 'staff', 'vendor');

-- Log the changes for reference
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Get count of rows that were updated
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the operation
    RAISE NOTICE 'Updated % user_profiles records with invalid role values to staff', updated_count;
    
    -- Insert activity log entry if activity_history table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_history' AND table_schema = 'public') THEN
        INSERT INTO public.activity_history (
            id,
            activity_type,
            description,
            performed_by,
            created_at
        ) VALUES (
            gen_random_uuid(),
            'data_correction',
            'Fixed invalid user role enum values - updated to staff role',
            '5cf8d360-f9a9-47a2-8112-bbd13497dd4f', -- Ashley Terminello admin user
            CURRENT_TIMESTAMP
        );
    END IF;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during role update: %', SQLERRM;
END $$;

-- Add a constraint to prevent future invalid enum insertions
-- This is mainly for documentation as PostgreSQL enum already enforces this
COMMENT ON COLUMN public.user_profiles.role IS 'User role must be one of: admin, manager, staff, vendor';

-- Verify the fix by checking for any remaining invalid values
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.user_profiles 
    WHERE role::text NOT IN ('admin', 'manager', 'staff', 'vendor');
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'WARNING: % user_profiles still have invalid role values', invalid_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All user_profiles now have valid role values';
    END IF;
END $$;