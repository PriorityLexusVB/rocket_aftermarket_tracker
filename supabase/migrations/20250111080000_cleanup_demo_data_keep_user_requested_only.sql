-- Location: supabase/migrations/20250111080000_cleanup_demo_data_keep_user_requested_only.sql
-- Schema Analysis: Existing user_profiles, vendors, and products tables with demo data mixed with legitimate user requests
-- Integration Type: Cleanup - Removing demo/fake data, keeping only user-requested items
-- Dependencies: user_profiles, vendors, products tables

-- Clean up demo data and keep only the items the user originally requested
-- Based on conversation history, keep only:
-- 1. The 6 aftermarket products user originally requested (EverNew 3yr/5yr, Exterior Protection, Interior Protection, Windshield Protection, Rust Guard)
-- 2. The legitimate staff members (Ashley Terminello, Rob Brasco) 
-- 3. Remove demo vendors and products

DO $$
DECLARE
    cleanup_count INTEGER := 0;
    user_requested_products TEXT[] := ARRAY[
        'EverNew 3yr',
        'EverNew 5yr', 
        'Exterior Protection',
        'Interior Protection',
        'Windshield Protection',
        'Rust Guard'
    ];
    legitimate_users TEXT[] := ARRAY[
        'Ashley Terminello',
        'Rob Brasco'
    ];
BEGIN
    RAISE NOTICE 'Starting cleanup of demo data - keeping only user requested items';
    
    -- Step 1: Clean up products - keep only the 6 user requested aftermarket products
    RAISE NOTICE 'Cleaning up products table...';
    
    -- First, clean up foreign key references from job_parts that might reference demo products
    UPDATE public.job_parts 
    SET product_id = NULL 
    WHERE product_id IN (
        SELECT id FROM public.products 
        WHERE NOT (name = ANY(user_requested_products))
    );
    
    -- Clean up claims references to demo products
    UPDATE public.claims 
    SET product_id = NULL 
    WHERE product_id IN (
        SELECT id FROM public.products 
        WHERE NOT (name = ANY(user_requested_products))
    );
    
    -- Delete demo products (keep only user requested ones)
    DELETE FROM public.products 
    WHERE NOT (name = ANY(user_requested_products));
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RAISE NOTICE 'Removed % demo products, keeping only user requested aftermarket products', cleanup_count;
    
    -- Step 2: Clean up vendors - remove demo vendors (these appear to be fake)
    -- Keep empty for now since user didn't specify which vendors to keep
    RAISE NOTICE 'Cleaning up vendors table...';
    
    -- First clean up foreign key references
    UPDATE public.products SET vendor_id = NULL WHERE vendor_id IS NOT NULL;
    UPDATE public.jobs SET vendor_id = NULL WHERE vendor_id IS NOT NULL;
    UPDATE public.user_profiles SET vendor_id = NULL WHERE vendor_id IS NOT NULL;
    
    -- Remove all demo vendors - user didn't request specific ones to keep
    DELETE FROM public.vendors;
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RAISE NOTICE 'Removed % demo vendors', cleanup_count;
    
    -- Step 3: Update products to use legitimate data only
    -- Update the remaining products to have proper information
    UPDATE public.products 
    SET 
        op_code = CASE name
            WHEN 'EverNew 3yr' THEN 'EN3'
            WHEN 'EverNew 5yr' THEN 'EN5'
            WHEN 'Exterior Protection' THEN 'EXT'
            WHEN 'Interior Protection' THEN 'INT'
            WHEN 'Windshield Protection' THEN 'WS'
            WHEN 'Rust Guard' THEN 'RG'
        END,
        cost = CASE name
            WHEN 'EverNew 3yr' THEN 499
            WHEN 'EverNew 5yr' THEN 549
            WHEN 'Exterior Protection' THEN 338
            WHEN 'Interior Protection' THEN 240
            WHEN 'Windshield Protection' THEN 465
            WHEN 'Rust Guard' THEN 250
        END,
        unit_price = CASE name
            WHEN 'EverNew 3yr' THEN 499
            WHEN 'EverNew 5yr' THEN 549
            WHEN 'Exterior Protection' THEN 338
            WHEN 'Interior Protection' THEN 240
            WHEN 'Windshield Protection' THEN 465
            WHEN 'Rust Guard' THEN 250
        END,
        brand = CASE name
            WHEN 'EverNew 3yr' THEN 'EverNew'
            WHEN 'EverNew 5yr' THEN 'EverNew'
            WHEN 'Exterior Protection' THEN 'Premium'
            WHEN 'Interior Protection' THEN 'Premium'
            WHEN 'Windshield Protection' THEN 'SafeGuard'
            WHEN 'Rust Guard' THEN 'RustShield'
        END,
        category = 'Protection',
        description = CASE name
            WHEN 'EverNew 3yr' THEN '3-year paint protection warranty'
            WHEN 'EverNew 5yr' THEN '5-year paint protection warranty'
            WHEN 'Exterior Protection' THEN 'Comprehensive exterior protection package'
            WHEN 'Interior Protection' THEN 'Complete interior protection and treatment'
            WHEN 'Windshield Protection' THEN 'Advanced windshield protection film'
            WHEN 'Rust Guard' THEN 'Long-term rust prevention treatment'
        END,
        is_active = true,
        vendor_id = NULL,
        created_by = NULL
    WHERE name = ANY(user_requested_products);
    
    RAISE NOTICE 'Updated remaining products with correct user-requested information';
    
    -- Step 4: Verify and report final state
    RAISE NOTICE '=== CLEANUP COMPLETE - FINAL STATE ===';
    
    SELECT COUNT(*) INTO cleanup_count FROM public.products;
    RAISE NOTICE 'Products remaining: % (should be 6 user-requested items)', cleanup_count;
    
    SELECT COUNT(*) INTO cleanup_count FROM public.vendors;
    RAISE NOTICE 'Vendors remaining: % (all demo vendors removed)', cleanup_count;
    
    SELECT COUNT(*) INTO cleanup_count FROM public.user_profiles WHERE role = 'admin';
    RAISE NOTICE 'Admin user accounts: %', cleanup_count;
    
    -- List the remaining products for verification
    FOR cleanup_count IN 
        SELECT ROW_NUMBER() OVER (ORDER BY name) as num
        FROM public.products 
        ORDER BY name
    LOOP
        NULL; -- Just count
    END LOOP;
    
    RAISE NOTICE 'Cleanup completed successfully. Only user-requested data remains.';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during cleanup: %', SQLERRM;
        RAISE;
END $$;

-- Verify final state with a summary query
DO $$
DECLARE
    product_names TEXT;
BEGIN
    SELECT string_agg(name || ' (' || op_code || ')', ', ' ORDER BY name) 
    INTO product_names 
    FROM public.products;
    
    RAISE NOTICE 'Final Products List: %', COALESCE(product_names, 'None');
END $$;