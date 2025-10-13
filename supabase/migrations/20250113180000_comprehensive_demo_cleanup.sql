-- Location: supabase/migrations/20250113180000_comprehensive_demo_cleanup.sql
-- Schema Analysis: Existing user_profiles table with is_active and department columns
-- Integration Type: Destructive - Comprehensive removal of all remaining demo/fake employee records
-- Dependencies: user_profiles table with foreign key relationships

-- Comprehensive cleanup of demo employees and fake users from user_profiles table
-- This migration is more aggressive in identifying and removing demo data patterns

DO $$
DECLARE
    demo_count INTEGER;
    cleanup_count INTEGER;
    remaining_count INTEGER;
BEGIN
    -- Count all potentially fake users before deletion for comprehensive logging
    SELECT COUNT(*) INTO demo_count 
    FROM public.user_profiles 
    WHERE 
        -- Demo/Test patterns in names
        full_name ILIKE '%demo%' 
        OR full_name ILIKE '%fake%' 
        OR full_name ILIKE '%test%'
        OR full_name ILIKE '%sample%'
        OR full_name ILIKE '%example%'
        -- Demo/Test patterns in emails
        OR email ILIKE '%demo%' 
        OR email ILIKE '%fake%' 
        OR email ILIKE '%test%'
        OR email ILIKE '%sample%'
        OR email ILIKE '%example.com%'
        OR email ILIKE '%example.org%'
        -- Generic placeholder names
        OR full_name = 'HOUSE'
        OR full_name ILIKE 'User %'
        OR full_name ILIKE 'Employee %'
        OR full_name ILIKE 'Staff %'
        -- Common demo company patterns
        OR email ILIKE '%@company.com%'
        OR email ILIKE '%@acme.com%'
        OR email ILIKE '%@demo.com%'
        -- Missing or empty department
        OR department IS NULL
        OR department = ''
        OR department = 'undefined'
        OR department = 'null'
        -- Suspicious email patterns
        OR email ILIKE '%+test%'
        OR email ILIKE '%+demo%'
        -- Generic automotive demo patterns
        OR full_name ILIKE '%automotive%'
        OR full_name ILIKE '%priority%'
        OR email ILIKE '%priority%@%'
        -- Names that are just roles/departments
        OR full_name ILIKE 'Finance Manager%'
        OR full_name ILIKE 'Delivery Coordinator%'
        OR full_name ILIKE 'Sales Consultant%'
        OR full_name ILIKE 'Manager'
        OR full_name ILIKE 'Coordinator'
        OR full_name ILIKE 'Consultant';

    RAISE NOTICE 'Found % potentially fake/demo user records to remove', demo_count;

    -- Delete comprehensive list of demo/fake employee records
    DELETE FROM public.user_profiles 
    WHERE 
        -- Demo/Test patterns in names
        full_name ILIKE '%demo%' 
        OR full_name ILIKE '%fake%' 
        OR full_name ILIKE '%test%'
        OR full_name ILIKE '%sample%'
        OR full_name ILIKE '%example%'
        -- Demo/Test patterns in emails
        OR email ILIKE '%demo%' 
        OR email ILIKE '%fake%' 
        OR email ILIKE '%test%'
        OR email ILIKE '%sample%'
        OR email ILIKE '%example.com%'
        OR email ILIKE '%example.org%'
        -- Generic placeholder names
        OR full_name = 'HOUSE'
        OR full_name ILIKE 'User %'
        OR full_name ILIKE 'Employee %'
        OR full_name ILIKE 'Staff %'
        -- Common demo company patterns
        OR email ILIKE '%@company.com%'
        OR email ILIKE '%@acme.com%'
        OR email ILIKE '%@demo.com%'
        -- Missing or empty department
        OR department IS NULL
        OR department = ''
        OR department = 'undefined'
        OR department = 'null'
        -- Suspicious email patterns
        OR email ILIKE '%+test%'
        OR email ILIKE '%+demo%'
        -- Generic automotive demo patterns
        OR full_name ILIKE '%automotive%'
        OR full_name ILIKE '%priority%'
        OR email ILIKE '%priority%@%'
        -- Names that are just roles/departments
        OR full_name ILIKE 'Finance Manager%'
        OR full_name ILIKE 'Delivery Coordinator%'
        OR full_name ILIKE 'Sales Consultant%'
        OR full_name ILIKE 'Manager'
        OR full_name ILIKE 'Coordinator'
        OR full_name ILIKE 'Consultant';

    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RAISE NOTICE 'Successfully removed % demo/fake employee records from user_profiles', cleanup_count;

    -- Standardize department names for remaining legitimate users
    UPDATE public.user_profiles 
    SET department = CASE 
        WHEN department ILIKE '%sales%' AND department NOT ILIKE '%manager%' THEN 'Sales Consultants'
        WHEN department ILIKE '%finance%' OR department ILIKE '%finance manager%' THEN 'Finance Managers'
        WHEN department ILIKE '%delivery%' OR department ILIKE '%coordinator%' THEN 'Delivery Coordinators'
        WHEN department ILIKE '%admin%' THEN 'Administration'
        WHEN department ILIKE '%service%' THEN 'Service Department'
        ELSE department
    END
    WHERE is_active = true
      AND department IS NOT NULL
      AND department != '';

    -- Remove any users without proper names (single words, numbers, etc.)
    DELETE FROM public.user_profiles 
    WHERE 
        is_active = true 
        AND (
            full_name !~ '^[A-Za-z]+ [A-Za-z]+' -- Must have at least first and last name
            OR LENGTH(full_name) < 3 -- Too short to be a real name
            OR full_name ~ '^[0-9]+' -- Starts with numbers
            OR full_name = UPPER(full_name) AND full_name NOT ILIKE '% %' -- All caps single word
        );

    -- Set inactive any remaining suspicious users
    UPDATE public.user_profiles 
    SET is_active = false
    WHERE 
        is_active = true 
        AND (
            email ILIKE '%noreply%'
            OR email ILIKE '%donotreply%'
            OR email = ''
            OR email IS NULL
        );

    -- Get final count of legitimate active users by department
    SELECT COUNT(*) INTO remaining_count 
    FROM public.user_profiles 
    WHERE is_active = true;

    RAISE NOTICE 'Cleanup complete. % total active users remaining', remaining_count;

    -- Log final counts by department for verification
    FOR cleanup_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Sales Consultants'
    ) LOOP
        RAISE NOTICE 'Sales Consultants: %', cleanup_count;
    END LOOP;

    FOR cleanup_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Finance Managers'
    ) LOOP
        RAISE NOTICE 'Finance Managers: %', cleanup_count;
    END LOOP;

    FOR cleanup_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND department = 'Delivery Coordinators'
    ) LOOP
        RAISE NOTICE 'Delivery Coordinators: %', cleanup_count;
    END LOOP;

    -- Show any remaining users with undefined departments as a warning
    FOR cleanup_count IN (
        SELECT COUNT(*) 
        FROM public.user_profiles 
        WHERE is_active = true AND (department IS NULL OR department = '' OR department NOT IN ('Sales Consultants', 'Finance Managers', 'Delivery Coordinators', 'Administration', 'Service Department'))
    ) LOOP
        IF cleanup_count > 0 THEN
            RAISE NOTICE 'Warning: % active users with undefined/other departments', cleanup_count;
        END IF;
    END LOOP;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint error during comprehensive cleanup: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during comprehensive demo employee cleanup: %', SQLERRM;
END $$;

-- Enhanced function to validate legitimate employees with stricter criteria
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
      AND up.department IN ('Sales Consultants', 'Finance Managers', 'Delivery Coordinators', 'Administration', 'Service Department')
      AND up.full_name ~ '^[A-Za-z]+ [A-Za-z]+' -- Must have proper first and last name
      AND up.full_name NOT ILIKE '%demo%'
      AND up.full_name NOT ILIKE '%fake%'
      AND up.full_name NOT ILIKE '%test%'
      AND up.full_name NOT ILIKE '%sample%'
      AND up.email NOT ILIKE '%demo%'
      AND up.email NOT ILIKE '%fake%'
      AND up.email NOT ILIKE '%test%'
      AND up.email NOT ILIKE '%example.com%'
      AND up.email NOT ILIKE '%@company.com%'
      AND LENGTH(up.full_name) >= 3
)
$$;

-- Add a constraint to prevent future insertion of obvious demo data
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS check_no_demo_users;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_no_demo_users 
CHECK (
    full_name NOT ILIKE '%demo%' 
    AND full_name NOT ILIKE '%fake%' 
    AND full_name NOT ILIKE '%test%'
    AND email NOT ILIKE '%demo%'
    AND email NOT ILIKE '%fake%'
    AND email NOT ILIKE '%test%'
    AND email NOT ILIKE '%example.com%'
    AND LENGTH(full_name) >= 3
);