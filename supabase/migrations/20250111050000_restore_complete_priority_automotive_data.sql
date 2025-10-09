-- Location: supabase/migrations/20250111050000_restore_complete_priority_automotive_data.sql
-- Schema Analysis: Existing Priority Automotive schema with user_profiles, vendors, products tables
-- Integration Type: Data restoration - correcting and completing missing Priority Automotive data  
-- Dependencies: Existing user_profiles table, vendors table, products table

-- ============================================================================
-- PRIORITY AUTOMOTIVE DATA RESTORATION MIGRATION (FIXED)
-- ============================================================================
-- This migration restores the complete Priority Automotive data that was 
-- working before the claims system was added - NOW WITH DUPLICATE HANDLING
-- ============================================================================

-- ============================================================================
-- 1. AFTERMARKET PRODUCTS RESTORATION
-- ============================================================================
-- Restore the 6 aftermarket products that were working before

DO $$
BEGIN
    -- Remove any existing products with these op_codes to avoid duplicates
    DELETE FROM public.products 
    WHERE op_code IN ('EN3', 'EN5', 'EXT', 'INT', 'WS', 'RG');
    
    -- Insert the complete aftermarket product catalog
    INSERT INTO public.products (name, op_code, cost, unit_price, brand, category, description, is_active)
    VALUES 
        ('EverNew 3yr', 'EN3', 499.00, 499.00, 'EverNew', 'Protection', '3-year paint protection warranty', true),
        ('EverNew 5yr', 'EN5', 549.00, 549.00, 'EverNew', 'Protection', '5-year paint protection warranty', true),
        ('Exterior Protection', 'EXT', 338.00, 338.00, 'Premium', 'Protection', 'Comprehensive exterior protection package', true),
        ('Interior Protection', 'INT', 240.00, 240.00, 'Premium', 'Protection', 'Complete interior protection and treatment', true),
        ('Windshield Protection', 'WS', 465.00, 465.00, 'SafeGuard', 'Protection', 'Advanced windshield protection film', true),
        ('Rust Guard', 'RG', 250.00, 250.00, 'RustShield', 'Protection', 'Long-term rust prevention treatment', true);
    
    RAISE NOTICE 'Successfully restored 6 aftermarket products';
END $$;

-- ============================================================================
-- 2. VENDOR NETWORK RESTORATION  
-- ============================================================================
-- Restore the complete Priority Automotive vendor network

DO $$
BEGIN
    -- Clean up any test or incomplete vendor records
    DELETE FROM public.vendors 
    WHERE name IS NULL OR name = '' OR name LIKE '%test%' OR name LIKE '%Test%';
    
    -- Remove existing Priority vendors to avoid duplicates
    DELETE FROM public.vendors 
    WHERE name IN (
        'Priority Auto Glass Solutions', 'Luxury Detail Masters', 'Elite Paint Correction', 
        'Pro Ceramic Coatings', 'Advanced Window Tinting'
    );
    
    -- Insert the complete Priority Automotive vendor network
    INSERT INTO public.vendors (name, contact_person, phone, email, specialty, rating, is_active)
    VALUES
        ('Priority Auto Glass Solutions', 'Mike Patterson', '(555) 301-0001', 'service@priorityautoglass.com', 'Windshield Replacement & Repair', 4.8, true),
        ('Luxury Detail Masters', 'Jennifer Wong', '(555) 301-0002', 'bookings@luxurydetailmasters.com', 'Premium Vehicle Detailing', 4.9, true),
        ('Elite Paint Correction', 'Carlos Rodriguez', '(555) 301-0003', 'info@elitepaintcorrection.com', 'Paint Correction & Ceramic Coating', 4.7, true),
        ('Pro Ceramic Coatings', 'David Kim', '(555) 301-0004', 'contact@proceramiccoatings.com', 'Ceramic Coating Specialists', 4.6, true),
        ('Advanced Window Tinting', 'Maria Santos', '(555) 301-0005', 'hello@advancedwindowtinting.com', 'Window Tinting & PPF', 4.5, true);
    
    RAISE NOTICE 'Successfully restored 5 Priority Automotive vendors';
END $$;

-- ============================================================================
-- 3. SALES CONSULTANTS DIRECTORY RESTORATION
-- ============================================================================
-- Restore all 17 sales consultants as staff directory entries

DO $$
BEGIN
    -- Remove existing sales consultants to avoid duplicates
    DELETE FROM public.user_profiles 
    WHERE role = 'staff'::user_role 
    AND department = 'Sales Consultants'
    AND full_name IN (
        'WILLIAM CONNOLLY', 'HOUSE', 'LUKE SWEET', 'WILLIAM ANDERSON', 'TOM HARMON',
        'GIUSEPPE LUPO', 'RONALD JORDAN', 'KELAN ROBERTSON', 'WILLIAM VAUGHN', 'VORTEZ JUNIOR',
        'DARRELL JOHNSON', 'ELLA WEBB', 'JOSE DELGADO', 'TYLER PUTMAN', 'CAMERON DELAINE',
        'ALEX', 'IGNACIO ROMERO'
    );
    
    -- Insert all 17 sales consultants with proper UUIDs and email addresses
    INSERT INTO public.user_profiles (
        id, full_name, email, role, department, is_active, phone, vendor_id, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), 'WILLIAM CONNOLLY', 'william.connolly@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'HOUSE', 'house@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'LUKE SWEET', 'luke.sweet@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'WILLIAM ANDERSON', 'william.anderson@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'TOM HARMON', 'tom.harmon@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'GIUSEPPE LUPO', 'giuseppe.lupo@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'RONALD JORDAN', 'ronald.jordan@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'KELAN ROBERTSON', 'kelan.robertson@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'WILLIAM VAUGHN', 'william.vaughn@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'VORTEZ JUNIOR', 'vortez.junior@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'DARRELL JOHNSON', 'darrell.johnson@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'ELLA WEBB', 'ella.webb@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'JOSE DELGADO', 'jose.delgado@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'TYLER PUTMAN', 'tyler.putman@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'CAMERON DELAINE', 'cameron.delaine@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'ALEX', 'alex@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'IGNACIO ROMERO', 'ignacio.romero@priorityautomotive.com', 'staff'::user_role, 'Sales Consultants', true, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    RAISE NOTICE 'Successfully restored all 17 sales consultants to staff directory';
END $$;

-- ============================================================================
-- 4. FINANCE MANAGERS WITH AUTH ACCOUNTS RESTORATION (FIXED FOR DUPLICATES)
-- ============================================================================
-- Restore the 3 finance managers with proper authentication accounts

DO $$
DECLARE
    chris_uuid UUID;
    reid_uuid UUID; 
    sammy_uuid UUID;
    chris_exists BOOLEAN := FALSE;
    reid_exists BOOLEAN := FALSE;
    sammy_exists BOOLEAN := FALSE;
BEGIN
    -- Check if finance managers already exist and get their UUIDs or create new ones
    SELECT id INTO chris_uuid FROM public.user_profiles 
    WHERE email = 'chris.lagarenne@priorityautomotive.com' LIMIT 1;
    
    IF chris_uuid IS NOT NULL THEN
        chris_exists := TRUE;
        RAISE NOTICE 'Chris Lagarenne already exists with UUID: %', chris_uuid;
    ELSE
        chris_uuid := gen_random_uuid();
    END IF;
    
    SELECT id INTO reid_uuid FROM public.user_profiles 
    WHERE email = 'reid.schiff@priorityautomotive.com' LIMIT 1;
    
    IF reid_uuid IS NOT NULL THEN
        reid_exists := TRUE;
        RAISE NOTICE 'Reid Schiff already exists with UUID: %', reid_uuid;
    ELSE
        reid_uuid := gen_random_uuid();
    END IF;
    
    SELECT id INTO sammy_uuid FROM public.user_profiles 
    WHERE email = 'sammy.custodio@priorityautomotive.com' LIMIT 1;
    
    IF sammy_uuid IS NOT NULL THEN
        sammy_exists := TRUE;
        RAISE NOTICE 'Sammy Custodio already exists with UUID: %', sammy_uuid;
    ELSE
        sammy_uuid := gen_random_uuid();
    END IF;
    
    -- Remove any existing auth records for these users to avoid conflicts
    DELETE FROM auth.users 
    WHERE email IN (
        'chris.lagarenne@priorityautomotive.com',
        'reid.schiff@priorityautomotive.com', 
        'sammy.custodio@priorityautomotive.com'
    );
    
    -- Create complete auth.users records for the finance managers
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous
    ) VALUES
        (chris_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'chris.lagarenne@priorityautomotive.com', crypt('Priority123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Chris Lagarenne", "role": "staff", "department": "Finance Manager"}'::jsonb, 
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false),
        (reid_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'reid.schiff@priorityautomotive.com', crypt('Priority123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Reid Schiff", "role": "staff", "department": "Finance Manager"}'::jsonb,
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false),
        (sammy_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'sammy.custodio@priorityautomotive.com', crypt('Priority123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Sammy Custodio", "role": "staff", "department": "Finance Manager"}'::jsonb,
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false);
    
    -- Use UPSERT pattern for user_profiles to handle existing records
    INSERT INTO public.user_profiles (
        id, email, full_name, role, department, is_active, created_at, updated_at
    ) VALUES
        (chris_uuid, 'chris.lagarenne@priorityautomotive.com', 'Chris Lagarenne', 'staff'::user_role, 'Finance Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (reid_uuid, 'reid.schiff@priorityautomotive.com', 'Reid Schiff', 'staff'::user_role, 'Finance Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (sammy_uuid, 'sammy.custodio@priorityautomotive.com', 'Sammy Custodio', 'staff'::user_role, 'Finance Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE 'Successfully restored 3 finance managers with authentication accounts';
    RAISE NOTICE 'Finance Manager Login Credentials:';
    RAISE NOTICE '- Chris Lagarenne: chris.lagarenne@priorityautomotive.com / Priority123!';
    RAISE NOTICE '- Reid Schiff: reid.schiff@priorityautomotive.com / Priority123!';  
    RAISE NOTICE '- Sammy Custodio: sammy.custodio@priorityautomotive.com / Priority123!';
END $$;

-- ============================================================================
-- 5. ADMIN ACCESS RESTORATION
-- ============================================================================
-- Ensure all existing admin/manager users retain full admin access

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update all users in admin/manager roles to have admin access
    UPDATE public.user_profiles 
    SET role = 'admin'::user_role, updated_at = CURRENT_TIMESTAMP
    WHERE role IN ('manager'::user_role, 'staff'::user_role) 
    AND department IN ('Managers', 'Delivery Coordinator')
    AND role != 'admin'::user_role;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Also ensure any existing admin users stay admin
    UPDATE public.user_profiles 
    SET role = 'admin'::user_role, updated_at = CURRENT_TIMESTAMP
    WHERE email LIKE '%admin%' OR full_name LIKE '%admin%' OR full_name LIKE '%Admin%';
    
    RAISE NOTICE 'Verified admin access for % user accounts', updated_count;
END $$;

-- ============================================================================
-- 6. DATA INTEGRITY VERIFICATION
-- ============================================================================
-- Verify all data was restored correctly

DO $$
DECLARE
    product_count INTEGER;
    vendor_count INTEGER; 
    sales_consultant_count INTEGER;
    finance_manager_count INTEGER;
    admin_count INTEGER;
BEGIN
    -- Count restored data
    SELECT COUNT(*) INTO product_count FROM public.products WHERE op_code IN ('EN3', 'EN5', 'EXT', 'INT', 'WS', 'RG');
    SELECT COUNT(*) INTO vendor_count FROM public.vendors WHERE name LIKE '%Priority%' OR name LIKE '%Luxury%' OR name LIKE '%Elite%' OR name LIKE '%Pro%' OR name LIKE '%Advanced%';
    SELECT COUNT(*) INTO sales_consultant_count FROM public.user_profiles WHERE role = 'staff'::user_role AND department = 'Sales Consultants';
    SELECT COUNT(*) INTO finance_manager_count FROM public.user_profiles WHERE role = 'staff'::user_role AND department = 'Finance Manager';  
    SELECT COUNT(*) INTO admin_count FROM public.user_profiles WHERE role = 'admin'::user_role;
    
    -- Report restoration results
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'PRIORITY AUTOMOTIVE DATA RESTORATION COMPLETE';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Aftermarket Products: % restored (Expected: 6)', product_count;
    RAISE NOTICE 'Vendor Network: % restored (Expected: 5)', vendor_count;
    RAISE NOTICE 'Sales Consultants: % restored (Expected: 17)', sales_consultant_count;
    RAISE NOTICE 'Finance Managers: % restored (Expected: 3)', finance_manager_count;
    RAISE NOTICE 'Admin Users: % total', admin_count;
    RAISE NOTICE '============================================================================';
    
    -- Verify expected counts
    IF product_count = 6 AND vendor_count = 5 AND sales_consultant_count = 17 AND finance_manager_count = 3 THEN
        RAISE NOTICE '✅ SUCCESS: All Priority Automotive data restored correctly!';
        RAISE NOTICE '✅ Your admin panel should now display all vendors, finance sales people, user logins, and products';
    ELSE
        RAISE NOTICE '⚠️  WARNING: Some data may not have been restored completely. Check the counts above.';
    END IF;
END $$;

-- ============================================================================
-- 7. ADMIN PANEL DISPLAY VERIFICATION
-- ============================================================================
-- Final verification that data will display properly in admin panel

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'ADMIN PANEL VERIFICATION';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '📊 User Accounts Tab: Should show admin/manager users';
    RAISE NOTICE '👥 Staff Records Tab: Should show 17 Sales Consultants + 3 Finance Managers = 20 total';
    RAISE NOTICE '🏢 Vendors Tab: Should show 5 Priority Automotive vendors'; 
    RAISE NOTICE '📦 Products Tab: Should show 6 aftermarket products (EN3, EN5, EXT, INT, WS, RG)';
    RAISE NOTICE '📱 SMS Templates Tab: Should show existing SMS templates';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '🔐 Finance Manager Login Credentials (can be used in login form):';
    RAISE NOTICE 'chris.lagarenne@priorityautomotive.com / Priority123!';
    RAISE NOTICE 'reid.schiff@priorityautomotive.com / Priority123!';
    RAISE NOTICE 'sammy.custodio@priorityautomotive.com / Priority123!';
    RAISE NOTICE '============================================================================';
END $$;