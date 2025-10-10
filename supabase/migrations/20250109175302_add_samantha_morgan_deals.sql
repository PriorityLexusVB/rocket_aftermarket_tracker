-- Schema Analysis: Complete sales tracking system exists
-- Integration Type: Addition - Adding Samantha Morgan's October 2025 deals
-- Dependencies: vehicles, jobs, transactions, user_profiles, products, job_parts

-- Add Samantha Morgan's October 2025 Sales Data
DO $$
DECLARE
    samantha_id UUID;
    lila_id UUID;
    outside_id UUID; 
    giuseppe_id UUID;
    william_id UUID;
    cam_id UUID;
    
    -- Vehicles
    sanchez_vehicle_id UUID := gen_random_uuid();
    vergara_vehicle_id UUID := gen_random_uuid();
    shaver_vehicle_id UUID := gen_random_uuid();
    richards_vehicle_id UUID := gen_random_uuid();
    hugenduble_vehicle_id UUID := gen_random_uuid();
    
    -- Jobs
    sanchez_job_id UUID := gen_random_uuid();
    vergara_job_id UUID := gen_random_uuid();
    shaver_job_id UUID := gen_random_uuid();
    richards_job_id UUID := gen_random_uuid();
    hugenduble_job_id UUID := gen_random_uuid();
    
    -- Products - Check if products exist first
    evernew_protection_id UUID;
    tint_package_id UUID;
    film_package_id UUID;
    
BEGIN
    -- Get existing Samantha Morgan user profile
    SELECT id INTO samantha_id FROM public.user_profiles 
    WHERE LOWER(full_name) LIKE '%samantha%' AND LOWER(full_name) LIKE '%morgan%' LIMIT 1;
    
    -- If Samantha doesn't exist, create her profile
    IF samantha_id IS NULL THEN
        samantha_id := gen_random_uuid();
        INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
        VALUES (samantha_id, 'SAMANTHA MORGAN', 'samantha.morgan@priorityautomotive.com', 'staff', 'Sales Consultants', true);
    END IF;
    
    -- Get or create sales staff
    SELECT id INTO lila_id FROM public.user_profiles WHERE UPPER(full_name) = 'LILA' LIMIT 1;
    IF lila_id IS NULL THEN
        lila_id := gen_random_uuid();
        INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
        VALUES (lila_id, 'LILA', 'lila@priorityautomotive.com', 'staff', 'Sales Consultants', true);
    END IF;
    
    SELECT id INTO outside_id FROM public.user_profiles WHERE UPPER(full_name) = 'OUTSIDE' LIMIT 1;
    IF outside_id IS NULL THEN
        outside_id := gen_random_uuid();
        INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
        VALUES (outside_id, 'OUTSIDE', 'outside@priorityautomotive.com', 'staff', 'Sales Consultants', true);
    END IF;
    
    SELECT id INTO giuseppe_id FROM public.user_profiles WHERE UPPER(full_name) = 'GIUSEPPE' LIMIT 1;
    IF giuseppe_id IS NULL THEN
        giuseppe_id := gen_random_uuid();
        INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
        VALUES (giuseppe_id, 'GIUSEPPE', 'giuseppe@priorityautomotive.com', 'staff', 'Sales Consultants', true);
    END IF;
    
    SELECT id INTO william_id FROM public.user_profiles WHERE UPPER(full_name) = 'WILLIAM' LIMIT 1;
    IF william_id IS NULL THEN
        -- Check for WILLIAM ANDERSON first  
        SELECT id INTO william_id FROM public.user_profiles WHERE UPPER(full_name) LIKE '%WILLIAM%' LIMIT 1;
        IF william_id IS NULL THEN
            william_id := gen_random_uuid();
            INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
            VALUES (william_id, 'WILLIAM', 'william@priorityautomotive.com', 'staff', 'Sales Consultants', true);
        END IF;
    END IF;
    
    SELECT id INTO cam_id FROM public.user_profiles WHERE UPPER(full_name) = 'CAM' LIMIT 1;
    IF cam_id IS NULL THEN
        cam_id := gen_random_uuid();
        INSERT INTO public.user_profiles (id, full_name, email, role, department, is_active)
        VALUES (cam_id, 'CAM', 'cam@priorityautomotive.com', 'staff', 'Sales Consultants', true);
    END IF;
    
    -- Check and create products individually to avoid conflicts - using short op_codes to match existing pattern
    SELECT id INTO evernew_protection_id FROM public.products WHERE name = 'EverNew Protection' LIMIT 1;
    IF evernew_protection_id IS NULL THEN
        evernew_protection_id := gen_random_uuid();
        INSERT INTO public.products (id, name, brand, category, unit_price, cost, op_code, description, is_active, part_number)
        VALUES (evernew_protection_id, 'EverNew Protection', 'EverNew', 'Protection', 1710.00, 549.00, 'ENP', 'EverNew paint protection system', true, 'EVERNEW-PROT-001');
    END IF;
    
    SELECT id INTO tint_package_id FROM public.products WHERE name = 'Window Tint Package' LIMIT 1;
    IF tint_package_id IS NULL THEN
        tint_package_id := gen_random_uuid();
        INSERT INTO public.products (id, name, brand, category, unit_price, cost, op_code, description, is_active, part_number)
        VALUES (tint_package_id, 'Window Tint Package', 'Professional', 'Tinting', 1790.00, 483.00, 'WTP', 'Professional window tinting service', true, 'TINT-PKG-001');
    END IF;
    
    SELECT id INTO film_package_id FROM public.products WHERE name = 'Protective Film' LIMIT 1;
    IF film_package_id IS NULL THEN
        film_package_id := gen_random_uuid();
        INSERT INTO public.products (id, name, brand, category, unit_price, cost, op_code, description, is_active, part_number)
        VALUES (film_package_id, 'Protective Film', 'Premium', 'Protection', 1595.00, 445.00, 'PFM', 'Premium protective film installation', true, 'FILM-PROT-001');
    END IF;
    
    -- Create Vehicles
    INSERT INTO public.vehicles (id, make, model, year, owner_name, vehicle_status)
    VALUES 
        (sanchez_vehicle_id, 'Nissan', 'NX', 2024, 'SANCHEZ', 'active'),
        (vergara_vehicle_id, 'Volvo', 'Model', 2024, 'VERGARA', 'active'), 
        (shaver_vehicle_id, 'Generic', 'Street', 2024, 'SHAVER', 'active'),
        (richards_vehicle_id, 'Lexus', 'RXH', 2024, 'RICHARDS', 'active'),
        (hugenduble_vehicle_id, 'Lexus', 'RX', 2024, 'HUGENDUBLE', 'active');
    
    -- Create Jobs for each deal - NOW INCLUDING job_number using generate_job_number() function
    INSERT INTO public.jobs (id, job_number, vehicle_id, title, description, estimated_cost, job_status, priority, created_by, service_type, created_at)
    VALUES 
        (sanchez_job_id, generate_job_number(), sanchez_vehicle_id, '2024 Nissan NX - EverNew Protection', 'EverNew paint protection package - Samantha Morgan deal', 1710.00, 'completed', 'medium', lila_id, 'in_house', '2025-10-02 09:00:00-05'),
        (vergara_job_id, generate_job_number(), vergara_vehicle_id, '2024 Volvo - Window Tint', 'Professional window tinting package - Samantha Morgan deal', 1790.00, 'completed', 'medium', outside_id, 'vendor', '2025-10-03 10:00:00-05'),
        (shaver_job_id, generate_job_number(), shaver_vehicle_id, '2024 Street - Standard Package', 'Standard aftermarket package - Samantha Morgan deal', 1319.00, 'completed', 'medium', giuseppe_id, 'in_house', '2025-10-03 14:00:00-05'),
        (richards_job_id, generate_job_number(), richards_vehicle_id, '2024 Lexus RXH - EverNew Protection', 'EverNew paint protection package - Samantha Morgan deal', 1799.00, 'completed', 'medium', william_id, 'in_house', '2025-10-04 11:00:00-05'),
        (hugenduble_job_id, generate_job_number(), hugenduble_vehicle_id, '2024 Lexus RX - Protective Film', 'Premium protective film package - Samantha Morgan deal', 1595.00, 'completed', 'medium', cam_id, 'vendor', '2025-10-04 15:00:00-05');
    
    -- Create Job Parts linking jobs to products
    INSERT INTO public.job_parts (job_id, product_id, quantity_used, unit_price)
    VALUES 
        (sanchez_job_id, evernew_protection_id, 1, 1710.00),
        (vergara_job_id, tint_package_id, 1, 1790.00),
        (shaver_job_id, evernew_protection_id, 1, 1319.00),
        (richards_job_id, evernew_protection_id, 1, 1799.00),
        (hugenduble_job_id, film_package_id, 1, 1595.00);
    
    -- Create Transactions for each deal
    INSERT INTO public.transactions (job_id, vehicle_id, customer_name, total_amount, subtotal, transaction_status, processed_by, created_at)
    VALUES 
        (sanchez_job_id, sanchez_vehicle_id, 'SANCHEZ', 1710.00, 1710.00, 'completed', lila_id, '2025-10-02 16:00:00-05'),
        (vergara_job_id, vergara_vehicle_id, 'VERGARA', 1790.00, 1790.00, 'completed', outside_id, '2025-10-03 16:00:00-05'),
        (shaver_job_id, shaver_vehicle_id, 'SHAVER', 1319.00, 1319.00, 'completed', giuseppe_id, '2025-10-03 17:00:00-05'),
        (richards_job_id, richards_vehicle_id, 'RICHARDS', 1799.00, 1799.00, 'completed', william_id, '2025-10-04 16:00:00-05'),
        (hugenduble_job_id, hugenduble_vehicle_id, 'HUGENDUBLE', 1595.00, 1595.00, 'completed', cam_id, '2025-10-04 17:00:00-05');

END $$;

-- Migration Summary: Added Samantha Morgan October 2025 sales data - 5 completed deals totaling $8,613 revenue