-- Location: supabase/migrations/20250111070000_remove_fake_test_users.sql
-- Schema Analysis: Existing user_profiles table with fake/test user entries
-- Integration Type: Destructive - removing fake user data added in previous migrations
-- Dependencies: user_profiles table, potential foreign key references

-- Remove fake/test users that were added in previous migrations
-- This migration cleans up the fake people entries that were added for testing

DO $$
DECLARE
    fake_user_count INTEGER := 0;
    deleted_count INTEGER := 0;
BEGIN
    -- First, count how many fake users exist
    SELECT COUNT(*) INTO fake_user_count
    FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role 
    AND (
        -- Remove all the fake sales consultants
        (department = 'Sales Consultants' AND full_name IN (
            'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
            'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
            'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
            'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
        ))
        OR
        -- Remove all the fake finance managers  
        (department = 'Finance Manager' AND full_name IN (
            'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
        ))
        OR
        -- Remove users with fake email domains
        (email LIKE '%@priorityautomotive.com' AND full_name IN (
            'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
            'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
            'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
            'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO',
            'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
        ))
    );

    RAISE NOTICE 'Found % fake/test users to remove', fake_user_count;

    -- Check for any dependent records that might reference these users
    -- This is important to prevent foreign key violations
    
    -- Check activity_history references
    IF EXISTS (
        SELECT 1 FROM public.activity_history ah
        JOIN public.user_profiles up ON ah.performed_by = up.id
        WHERE up.role = 'staff'::public.user_role 
        AND (
            (up.department = 'Sales Consultants' AND up.full_name IN (
                'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
                'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
                'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
                'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
            ))
            OR
            (up.department = 'Finance Manager' AND up.full_name IN (
                'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
            ))
        )
    ) THEN
        RAISE NOTICE 'Warning: Found activity_history records referencing fake users - cleaning up dependencies first';
        
        -- Remove activity history records for fake users
        DELETE FROM public.activity_history 
        WHERE performed_by IN (
            SELECT id FROM public.user_profiles 
            WHERE role = 'staff'::public.user_role 
            AND (
                (department = 'Sales Consultants' AND full_name IN (
                    'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
                    'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
                    'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
                    'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
                ))
                OR
                (department = 'Finance Manager' AND full_name IN (
                    'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
                ))
            )
        );
    END IF;

    -- Check and clean up any other potential references (jobs, communications, etc.)
    -- Clean up jobs assigned to fake users
    UPDATE public.jobs 
    SET assigned_to = NULL, delivery_coordinator_id = NULL
    WHERE assigned_to IN (
        SELECT id FROM public.user_profiles 
        WHERE role = 'staff'::public.user_role 
        AND (
            (department = 'Sales Consultants' AND full_name IN (
                'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
                'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
                'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
                'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
            ))
            OR
            (department = 'Finance Manager' AND full_name IN (
                'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
            ))
        )
    )
    OR delivery_coordinator_id IN (
        SELECT id FROM public.user_profiles 
        WHERE role = 'staff'::public.user_role 
        AND (
            (department = 'Sales Consultants' AND full_name IN (
                'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
                'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
                'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
                'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
            ))
            OR
            (department = 'Finance Manager' AND full_name IN (
                'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
            ))
        )
    );

    -- Clean up communications sent by fake users
    UPDATE public.communications 
    SET sent_by = NULL
    WHERE sent_by IN (
        SELECT id FROM public.user_profiles 
        WHERE role = 'staff'::public.user_role 
        AND (
            (department = 'Sales Consultants' AND full_name IN (
                'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
                'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
                'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
                'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
            ))
            OR
            (department = 'Finance Manager' AND full_name IN (
                'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
            ))
        )
    );

    -- Now safely delete the fake users
    DELETE FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role 
    AND (
        -- Remove all the fake sales consultants
        (department = 'Sales Consultants' AND full_name IN (
            'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
            'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
            'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
            'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
        ))
        OR
        -- Remove all the fake finance managers  
        (department = 'Finance Manager' AND full_name IN (
            'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
        ))
        OR
        -- Remove users with fake email domains
        (email LIKE '%@priorityautomotive.com' AND full_name IN (
            'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
            'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
            'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
            'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO',
            'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
        ))
    );

    -- Get the count of actually deleted records
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Successfully removed % fake/test users from the system', deleted_count;

    -- Verify the cleanup
    SELECT COUNT(*) INTO fake_user_count
    FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role 
    AND (
        (department = 'Sales Consultants' AND full_name IN (
            'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
            'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 
            'VORTEZ JUNIOR', 'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 
            'TYLER PUTMAN', 'CAMERON DELAINE', 'ALEX', 'IGNACIO ROMERO'
        ))
        OR
        (department = 'Finance Manager' AND full_name IN (
            'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
        ))
    );

    IF fake_user_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All fake/test users have been successfully removed from the system';
    ELSE
        RAISE NOTICE 'WARNING: % fake users still remain in the system', fake_user_count;
    END IF;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint error during cleanup: %', SQLERRM;
        RAISE NOTICE 'Some fake users may still have dependent records that need manual cleanup';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during fake user cleanup: %', SQLERRM;
        RAISE;
END $$;

-- Optional: Clean up any corresponding auth.users entries if they were created
-- This is safer to do after the user_profiles cleanup
DO $$
DECLARE
    auth_cleanup_count INTEGER := 0;
BEGIN
    -- Remove auth.users entries for the fake email addresses
    DELETE FROM auth.users 
    WHERE email LIKE '%@priorityautomotive.com' 
    AND email IN (
        'william.connolly@priorityautomotive.com', 'house@priorityautomotive.com', 
        'luke.sweet@priorityautomotive.com', 'william.anderson@priorityautomotive.com', 
        'tom.harmon@priorityautomotive.com', 'giuseppe.lupo@priorityautomotive.com', 
        'ronald.jordan@priorityautomotive.com', 'kelan.robertson@priorityautomotive.com', 
        'william.vaughn@priorityautomotive.com', 'vortez.junior@priorityautomotive.com', 
        'darrell.johnson@priorityautomotive.com', 'ella.webb@priorityautomotive.com', 
        'jose.delgado@priorityautomotive.com', 'tyler.putman@priorityautomotive.com', 
        'cameron.delaine@priorityautomotive.com', 'alex@priorityautomotive.com', 
        'ignacio.romero@priorityautomotive.com', 'chris.lagarenne@priorityautomotive.com', 
        'reid.schiff@priorityautomotive.com', 'sammy.custodio@priorityautomotive.com'
    );

    GET DIAGNOSTICS auth_cleanup_count = ROW_COUNT;

    IF auth_cleanup_count > 0 THEN
        RAISE NOTICE 'Successfully removed % corresponding auth.users entries', auth_cleanup_count;
    ELSE
        RAISE NOTICE 'No corresponding auth.users entries found to remove';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Note: Could not clean up auth.users entries (this is usually safe): %', SQLERRM;
END $$;

-- Final verification and summary
DO $$
DECLARE
    remaining_staff_count INTEGER;
    total_user_count INTEGER;
BEGIN
    -- Count remaining staff members
    SELECT COUNT(*) INTO remaining_staff_count 
    FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role;

    -- Count total users
    SELECT COUNT(*) INTO total_user_count 
    FROM public.user_profiles;

    RAISE NOTICE '=== CLEANUP SUMMARY ===';
    RAISE NOTICE 'Remaining staff members: %', remaining_staff_count;
    RAISE NOTICE 'Total users in system: %', total_user_count;
    RAISE NOTICE 'Fake user cleanup completed successfully';
    RAISE NOTICE '======================';
END $$;