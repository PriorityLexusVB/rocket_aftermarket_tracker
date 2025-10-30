-- Location: supabase/migrations/20250106155456_add_sales_consultants.sql
-- Schema Analysis: Existing user_profiles table with roles and departments
-- Integration Type: FIXED - Adding new sales consultant staff records with proper email handling
-- Dependencies: user_profiles table (existing)
-- Fix: Added proper email values to satisfy NOT NULL constraint

-- Add sales consultant names to the staff records
-- These are directory entries only (no login capabilities)
-- Role: staff, Department: Sales Consultants

DO $$
DECLARE
    consultant_count INTEGER := 0;
BEGIN
    -- First, remove any existing sales consultants to avoid duplicates
    DELETE FROM public.user_profiles 
    WHERE role = 'staff'::public.user_role 
    AND department = 'Sales Consultants'
    AND full_name IN (
        'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
        'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 'VORTEZ JUNIOR',
        'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 'TYLER PUTMAN', 'CAMERON DELAINE',
        'ALEX', 'IGNACIO ROMERO'
    );
    
    -- Insert sales consultants as staff records with proper email generation
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

    -- Get count of inserted records
    GET DIAGNOSTICS consultant_count = ROW_COUNT;
    
    -- Log the number of consultants added
    RAISE NOTICE 'Successfully added % sales consultants to staff records', consultant_count;

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate constraint violation during sales consultant insertion: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding sales consultants: %', SQLERRM;
        RAISE;
END $$;

-- Verify the insertion worked
DO $$
DECLARE
    total_count INTEGER;
    sales_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.user_profiles WHERE role = 'staff'::public.user_role;
    SELECT COUNT(*) INTO sales_count FROM public.user_profiles WHERE role = 'staff'::public.user_role AND department = 'Sales Consultants';
    
    RAISE NOTICE 'Total staff records: %, Sales Consultants: %', total_count, sales_count;
END $$;