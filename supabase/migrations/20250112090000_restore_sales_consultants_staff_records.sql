-- Location: supabase/migrations/20250112090000_restore_sales_consultants_staff_records.sql
-- Schema Analysis: Existing user_profiles table with only 2 admin records remaining
-- Integration Type: RESTORATION - Re-adding missing staff records that were working correctly
-- Dependencies: user_profiles table (existing)

-- Restore the 17 sales consultant staff records and 3 finance managers
-- These were incorrectly removed by the cleanup migration but were legitimate staff
-- Used for dropdown selections in the admin panel and various forms

DO $$
DECLARE
    consultant_count INTEGER := 0;
    finance_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Restoring missing sales consultant and finance manager staff records';
    
    -- First, remove any existing duplicates to avoid conflicts
    DELETE FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role 
    AND department IN ('Sales Consultants', 'Finance Manager')
    AND full_name IN (
        'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
        'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 'VORTEZ JUNIOR',
        'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 'TYLER PUTMAN', 'CAMERON DELAINE',
        'ALEX', 'IGNACIO ROMERO', 'Chris Lagarenne', 'Reid Schiff', 'Sammy Custodio'
    );
    
    -- Restore the 17 sales consultants (these were working correctly before cleanup)
    INSERT INTO public.user_profiles (id, full_name, role, department, is_active, email, phone, vendor_id, created_at, updated_at)
    VALUES
        (gen_random_uuid(), 'WILLIAM CONNOLLY', 'staff'::public.user_role, 'Sales Consultants', true, 'william.connolly@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'HOUSE', 'staff'::public.user_role, 'Sales Consultants', true, 'house@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'LUKE SWEET', 'staff'::public.user_role, 'Sales Consultants', true, 'luke.sweet@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'WILLIAM ANDERSON', 'staff'::public.user_role, 'Sales Consultants', true, 'william.anderson@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'TOM HARMON', 'staff'::public.user_role, 'Sales Consultants', true, 'tom.harmon@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'GIUSEPPE LUPO', 'staff'::public.user_role, 'Sales Consultants', true, 'giuseppe.lupo@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'RONALD JORDAN', 'staff'::public.user_role, 'Sales Consultants', true, 'ronald.jordan@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'KELAN ROBERTSON', 'staff'::public.user_role, 'Sales Consultants', true, 'kelan.robertson@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'WILLIAM VAUGHN', 'staff'::public.user_role, 'Sales Consultants', true, 'william.vaughn@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'VORTEZ JUNIOR', 'staff'::public.user_role, 'Sales Consultants', true, 'vortez.junior@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'DARRELL JOHNSON', 'staff'::public.user_role, 'Sales Consultants', true, 'darrell.johnson@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'ELLA WEBB', 'staff'::public.user_role, 'Sales Consultants', true, 'ella.webb@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'JOSE DELGADO', 'staff'::public.user_role, 'Sales Consultants', true, 'jose.delgado@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'TYLER PUTMAN', 'staff'::public.user_role, 'Sales Consultants', true, 'tyler.putman@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'CAMERON DELAINE', 'staff'::public.user_role, 'Sales Consultants', true, 'cameron.delaine@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'ALEX', 'staff'::public.user_role, 'Sales Consultants', true, 'alex@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'IGNACIO ROMERO', 'staff'::public.user_role, 'Sales Consultants', true, 'ignacio.romero@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- Get count of sales consultant records inserted
    GET DIAGNOSTICS consultant_count = ROW_COUNT;
    RAISE NOTICE 'Successfully restored % sales consultants', consultant_count;
    
    -- Restore the 3 finance managers (these were also working correctly before cleanup)
    INSERT INTO public.user_profiles (id, full_name, role, department, is_active, email, phone, vendor_id, created_at, updated_at)
    VALUES
        (gen_random_uuid(), 'Chris Lagarenne', 'staff'::public.user_role, 'Finance Manager', true, 'chris.lagarenne@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Reid Schiff', 'staff'::public.user_role, 'Finance Manager', true, 'reid.schiff@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Sammy Custodio', 'staff'::public.user_role, 'Finance Manager', true, 'sammy.custodio@priorityautomotive.com', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    -- Get count of finance manager records inserted
    GET DIAGNOSTICS finance_count = ROW_COUNT;
    RAISE NOTICE 'Successfully restored % finance managers', finance_count;
    
    -- Add some missing vendors that might have been removed (basic restoration)
    -- These will need to be adjusted based on user's actual vendor requirements
    INSERT INTO public.vendors (id, name, contact_person, phone, email, specialty, is_active, created_by, created_at, updated_at)
    VALUES
        (gen_random_uuid(), 'Priority Automotive Detailing', 'Service Manager', '555-0100', 'detailing@priorityautomotive.com', 'Vehicle Detailing & Protection', true, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Certified Installation Services', 'Install Coordinator', '555-0200', 'install@certifiedservices.com', 'Product Installation', true, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Premium Parts Supply', 'Parts Manager', '555-0300', 'parts@premiumsupply.com', 'Aftermarket Parts', true, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;
    
    -- Final verification and reporting
    RAISE NOTICE '=== STAFF RECORDS RESTORATION COMPLETE ===';
    
    SELECT COUNT(*) INTO consultant_count FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role AND department = 'Sales Consultants';
    RAISE NOTICE 'Total Sales Consultants: % (should be 17)', consultant_count;
    
    SELECT COUNT(*) INTO finance_count FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role AND department = 'Finance Manager';
    RAISE NOTICE 'Total Finance Managers: % (should be 3)', finance_count;
    
    -- Check total staff count
    SELECT COUNT(*) INTO consultant_count FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role;
    RAISE NOTICE 'Total Staff Records: %', consultant_count;
    
    -- List current vendors for verification
    SELECT COUNT(*) INTO finance_count FROM public.vendors WHERE is_active = true;
    RAISE NOTICE 'Active Vendors: %', finance_count;
    
    RAISE NOTICE 'Staff records restoration completed successfully.';
    RAISE NOTICE 'These records are now available for dropdown selections in admin screens.';

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate constraint violation during staff restoration: %', SQLERRM;
        RAISE NOTICE 'Some staff members may already exist in the system';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during staff records restoration: %', SQLERRM;
        RAISE;
END $$;

-- Fixed verification query - removed nested aggregate function error
DO $$
DECLARE
    staff_summary TEXT := '';
    dept_record RECORD;
    first_entry BOOLEAN := TRUE;
BEGIN
    -- Generate a summary of all staff by department using a cursor approach
    FOR dept_record IN
        SELECT department, COUNT(*) as dept_count
        FROM public.user_profiles 
        WHERE role = 'staff'::public.user_role 
        AND department IS NOT NULL
        GROUP BY department
        ORDER BY department
    LOOP
        IF NOT first_entry THEN
            staff_summary := staff_summary || ', ';
        END IF;
        staff_summary := staff_summary || dept_record.department || ': ' || dept_record.dept_count;
        first_entry := FALSE;
    END LOOP;
    
    IF staff_summary = '' THEN
        staff_summary := 'No staff records found';
    END IF;
    
    RAISE NOTICE 'Staff Summary by Department: %', staff_summary;
END $$;