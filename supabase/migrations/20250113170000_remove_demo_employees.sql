-- Location: supabase/migrations/20250113170000_remove_demo_employees.sql
-- Schema Analysis: Existing user_profiles table with is_active and department columns
-- Integration Type: Destructive - Remove demo/fake employee records
-- Dependencies: user_profiles table exists with proper relationships

-- Remove demo employees and fake users from user_profiles table
-- Keep only legitimate staff with proper department assignments

DO $$
DECLARE
    demo_count INTEGER;
    fake_count INTEGER;
BEGIN
    -- Count demo/fake users before deletion for logging
    SELECT COUNT(*) INTO demo_count 
    FROM public.user_profiles 
    WHERE full_name ILIKE '%demo%' 
       OR full_name ILIKE '%fake%' 
       OR full_name ILIKE '%test%'
       OR email ILIKE '%demo%' 
       OR email ILIKE '%fake%' 
       OR email ILIKE '%test%'
       OR email ILIKE '%example.com%'
       OR full_name = 'HOUSE'  -- Specific demo user
       OR department IS NULL
       OR department = '';

    -- Delete demo/fake employee records from user_profiles
    -- This will cascade delete related records due to foreign key constraints
    DELETE FROM public.user_profiles 
    WHERE full_name ILIKE '%demo%' 
       OR full_name ILIKE '%fake%' 
       OR full_name ILIKE '%test%'
       OR email ILIKE '%demo%' 
       OR email ILIKE '%fake%' 
       OR email ILIKE '%test%'
       OR email ILIKE '%example.com%'
       OR full_name = 'HOUSE'  -- Remove specific demo user
       OR department IS NULL
       OR department = '';

    -- Log the cleanup operation
    RAISE NOTICE 'Removed % demo/fake employee records from user_profiles', demo_count;

    -- Update any remaining users to ensure proper department categorization
    -- Standardize department names for consistent filtering
    UPDATE public.user_profiles 
    SET department = CASE 
        WHEN department ILIKE '%sales%' THEN 'Sales Consultants'
        WHEN department ILIKE '%finance%' THEN 'Finance Managers'
        WHEN department ILIKE '%delivery%' OR department ILIKE '%coordinator%' THEN 'Delivery Coordinators'
        ELSE department
    END
    WHERE is_active = true
      AND department IS NOT NULL
      AND department != '';

    -- Ensure all remaining active users have proper departments
    SELECT COUNT(*) INTO fake_count 
    FROM public.user_profiles 
    WHERE is_active = true AND (department IS NULL OR department = '');

    IF fake_count > 0 THEN
        RAISE NOTICE 'Warning: % active users found without proper department assignment', fake_count;
    END IF;

    -- Log final counts by department
    RAISE NOTICE 'Remaining active staff by department:';
    FOR demo_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Sales Consultants'
    ) LOOP
        RAISE NOTICE 'Sales Consultants: %', demo_count;
    END LOOP;

    FOR demo_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Finance Managers'
    ) LOOP
        RAISE NOTICE 'Finance Managers: %', demo_count;
    END LOOP;

    FOR demo_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Delivery Coordinators'
    ) LOOP
        RAISE NOTICE 'Delivery Coordinators: %', demo_count;
    END LOOP;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint error during cleanup: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during demo employee cleanup: %', SQLERRM;
END $$;

-- Add constraint to prevent future demo users if needed
-- ALTER TABLE public.user_profiles 
-- ADD CONSTRAINT check_no_demo_users 
-- CHECK (full_name NOT ILIKE '%demo%' AND full_name NOT ILIKE '%fake%' AND full_name NOT ILIKE '%test%');

-- Create function to validate legitimate employees
CREATE OR REPLACE FUNCTION public.is_legitimate_employee(user_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = user_profile_id
      AND up.is_active = true
      AND up.department IS NOT NULL
      AND up.department != ''
      AND up.full_name NOT ILIKE '%demo%'
      AND up.full_name NOT ILIKE '%fake%'
      AND up.full_name NOT ILIKE '%test%'
      AND up.email NOT ILIKE '%demo%'
      AND up.email NOT ILIKE '%fake%'
      AND up.email NOT ILIKE '%test%'
      AND up.email NOT ILIKE '%example.com%'
)
$$;