-- Location: supabase/migrations/20250109165847_add_october_sales_data.sql
-- Schema Analysis: Existing automotive system with vehicles, jobs, transactions, user_profiles, products, vendors
-- Integration Type: Addition - Adding October 2025 sales transaction data
-- Dependencies: vehicles, jobs, transactions, user_profiles, products, vendors tables

-- October Sales Data Migration
-- Based on provided sales data for October 2025

DO $$
DECLARE
    -- Staff member IDs (using existing staff from schema)
    lila_id UUID;
    outside_id UUID;
    giuseppe_id UUID;
    william_id UUID;
    cam_id UUID;
    
    -- Product IDs for services
    evernew_product_id UUID;
    tint_product_id UUID;
    film_product_id UUID;
    
    -- Vehicle and transaction variables
    vehicle1_id UUID := gen_random_uuid();
    vehicle2_id UUID := gen_random_uuid();
    vehicle3_id UUID := gen_random_uuid();
    vehicle4_id UUID := gen_random_uuid();
    vehicle5_id UUID := gen_random_uuid();
    
    job1_id UUID := gen_random_uuid();
    job2_id UUID := gen_random_uuid();
    job3_id UUID := gen_random_uuid();
    job4_id UUID := gen_random_uuid();
    job5_id UUID := gen_random_uuid();
BEGIN
    -- Get existing staff members (or use first available if names don't match)
    SELECT id INTO lila_id FROM public.user_profiles WHERE full_name ILIKE '%LILA%' OR email ILIKE '%lila%' LIMIT 1;
    SELECT id INTO outside_id FROM public.user_profiles WHERE full_name ILIKE '%OUTSIDE%' OR department ILIKE '%outside%' LIMIT 1;
    SELECT id INTO giuseppe_id FROM public.user_profiles WHERE full_name ILIKE '%GIUSEPPE%' OR email ILIKE '%giuseppe%' LIMIT 1;
    SELECT id INTO william_id FROM public.user_profiles WHERE full_name ILIKE '%WILLIAM%' OR email ILIKE '%william%' LIMIT 1;
    SELECT id INTO cam_id FROM public.user_profiles WHERE full_name ILIKE '%CAM%' OR email ILIKE '%cam%' LIMIT 1;
    
    -- If specific staff not found, use first available staff members
    IF lila_id IS NULL THEN
        SELECT id INTO lila_id FROM public.user_profiles WHERE role = 'staff' LIMIT 1 OFFSET 0;
    END IF;
    IF outside_id IS NULL THEN
        SELECT id INTO outside_id FROM public.user_profiles WHERE role = 'staff' LIMIT 1 OFFSET 1;
    END IF;
    IF giuseppe_id IS NULL THEN
        SELECT id INTO giuseppe_id FROM public.user_profiles WHERE role = 'staff' LIMIT 1 OFFSET 2;
    END IF;
    IF william_id IS NULL THEN
        SELECT id INTO william_id FROM public.user_profiles WHERE role = 'staff' LIMIT 1 OFFSET 3;
    END IF;
    IF cam_id IS NULL THEN
        SELECT id INTO cam_id FROM public.user_profiles WHERE role = 'staff' LIMIT 1 OFFSET 4;
    END IF;
    
    -- Get existing products for services
    SELECT id INTO evernew_product_id FROM public.products WHERE name ILIKE '%evernew%' OR op_code = 'EN3' OR op_code = 'EN5' LIMIT 1;
    SELECT id INTO tint_product_id FROM public.products WHERE name ILIKE '%tint%' OR category ILIKE '%tint%' LIMIT 1;
    SELECT id INTO film_product_id FROM public.products WHERE name ILIKE '%film%' OR category ILIKE '%protection%' LIMIT 1;
    
    -- Create products if they don't exist
    IF evernew_product_id IS NULL THEN
        INSERT INTO public.products (name, category, unit_price, cost, op_code, description)
        VALUES ('EverNew Protection Package', 'Protection', 1710, 549, 'EN', 'Premium vehicle protection package')
        RETURNING id INTO evernew_product_id;
    END IF;
    
    IF tint_product_id IS NULL THEN
        INSERT INTO public.products (name, category, unit_price, cost, description)
        VALUES ('Window Tint Service', 'Tinting', 1790, 483, 'Professional window tinting service')
        RETURNING id INTO tint_product_id;
    END IF;
    
    IF film_product_id IS NULL THEN
        INSERT INTO public.products (name, category, unit_price, cost, description)
        VALUES ('Paint Protection Film', 'Protection', 1595, 445, 'High-quality paint protection film installation')
        RETURNING id INTO film_product_id;
    END IF;

    -- October Sales Transaction 1: 10/2/2025 - SANCHEZ, NX, EverNew Package
    INSERT INTO public.vehicles (
        id, year, make, model, owner_name, owner_email, owner_phone, 
        stock_number, created_at
    ) VALUES (
        vehicle1_id, 2024, 'Lexus', 'NX', 'SANCHEZ', 'sanchez@email.com', '555-0201',
        'OCT001', '2025-10-02 10:00:00+00'
    );
    
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, job_status, priority, 
        estimated_cost, actual_cost, created_at, completed_at,
        assigned_to
    ) VALUES (
        job1_id, 'EverNew Protection - Lexus NX', 'EverNew protection package installation for SANCHEZ',
        vehicle1_id, 'completed'::job_status, 'medium'::job_priority,
        1710, 1710, '2025-10-02 10:00:00+00', '2025-10-02 16:00:00+00',
        lila_id
    );
    
    INSERT INTO public.transactions (
        customer_name, customer_email, customer_phone, vehicle_id, job_id,
        subtotal, tax_amount, total_amount, transaction_status,
        created_at, processed_at, processed_by
    ) VALUES (
        'SANCHEZ', 'sanchez@email.com', '555-0201', vehicle1_id, job1_id,
        1161, 549, 1710, 'completed'::transaction_status,
        '2025-10-02 10:00:00+00', '2025-10-02 16:00:00+00', lila_id
    );

    -- October Sales Transaction 2: 10/3/2025 - VERGARA, VOLVO, Tint Service
    INSERT INTO public.vehicles (
        id, year, make, model, owner_name, owner_email, owner_phone,
        stock_number, created_at
    ) VALUES (
        vehicle2_id, 2023, 'Volvo', 'XC90', 'VERGARA', 'vergara@email.com', '555-0301',
        'OCT002', '2025-10-03 09:30:00+00'
    );
    
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, job_status, priority,
        estimated_cost, actual_cost, created_at, completed_at,
        assigned_to
    ) VALUES (
        job2_id, 'Window Tint - Volvo XC90', 'Professional window tinting service for VERGARA',
        vehicle2_id, 'completed'::job_status, 'medium'::job_priority,
        1790, 1790, '2025-10-03 09:30:00+00', '2025-10-03 15:30:00+00',
        outside_id
    );
    
    INSERT INTO public.transactions (
        customer_name, customer_email, customer_phone, vehicle_id, job_id,
        subtotal, tax_amount, total_amount, transaction_status,
        created_at, processed_at, processed_by
    ) VALUES (
        'VERGARA', 'vergara@email.com', '555-0301', vehicle2_id, job2_id,
        1307, 483, 1790, 'completed'::transaction_status,
        '2025-10-03 09:30:00+00', '2025-10-03 15:30:00+00', outside_id
    );

    -- October Sales Transaction 3: 10/3/2025 - SHAVER, R Model
    INSERT INTO public.vehicles (
        id, year, make, model, owner_name, owner_email, owner_phone,
        stock_number, created_at
    ) VALUES (
        vehicle3_id, 2024, 'BMW', 'R-Series', 'SHAVER', 'shaver@email.com', '555-0302',
        'OCT003', '2025-10-03 14:00:00+00'
    );
    
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, job_status, priority,
        estimated_cost, actual_cost, created_at, completed_at,
        assigned_to
    ) VALUES (
        job3_id, 'Service Package - BMW R-Series', 'Comprehensive service package for SHAVER',
        vehicle3_id, 'completed'::job_status, 'medium'::job_priority,
        1319, 1319, '2025-10-03 14:00:00+00', '2025-10-03 18:00:00+00',
        giuseppe_id
    );
    
    INSERT INTO public.transactions (
        customer_name, customer_email, customer_phone, vehicle_id, job_id,
        subtotal, tax_amount, total_amount, transaction_status,
        created_at, processed_at, processed_by
    ) VALUES (
        'SHAVER', 'shaver@email.com', '555-0302', vehicle3_id, job3_id,
        981, 338, 1319, 'completed'::transaction_status,
        '2025-10-03 14:00:00+00', '2025-10-03 18:00:00+00', giuseppe_id
    );

    -- October Sales Transaction 4: 10/4/2025 - RICHARDS, RXH, EverNew Package
    INSERT INTO public.vehicles (
        id, year, make, model, owner_name, owner_email, owner_phone,
        stock_number, created_at
    ) VALUES (
        vehicle4_id, 2025, 'Lexus', 'RXH', 'RICHARDS', 'richards@email.com', '555-0401',
        'OCT004', '2025-10-04 11:00:00+00'
    );
    
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, job_status, priority,
        estimated_cost, actual_cost, created_at, completed_at,
        assigned_to
    ) VALUES (
        job4_id, 'EverNew Protection - Lexus RXH', 'EverNew protection package for RICHARDS',
        vehicle4_id, 'completed'::job_status, 'medium'::job_priority,
        1799, 1799, '2025-10-04 11:00:00+00', '2025-10-04 17:00:00+00',
        william_id
    );
    
    INSERT INTO public.transactions (
        customer_name, customer_email, customer_phone, vehicle_id, job_id,
        subtotal, tax_amount, total_amount, transaction_status,
        created_at, processed_at, processed_by
    ) VALUES (
        'RICHARDS', 'richards@email.com', '555-0401', vehicle4_id, job4_id,
        1250, 549, 1799, 'completed'::transaction_status,
        '2025-10-04 11:00:00+00', '2025-10-04 17:00:00+00', william_id
    );

    -- October Sales Transaction 5: 10/4/2025 - HUGENDUBLE, RXHF, Film Package
    INSERT INTO public.vehicles (
        id, year, make, model, owner_name, owner_email, owner_phone,
        stock_number, created_at
    ) VALUES (
        vehicle5_id, 2024, 'Lexus', 'RXHF', 'HUGENDUBLE', 'hugenduble@email.com', '555-0402',
        'OCT005', '2025-10-04 13:30:00+00'
    );
    
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, job_status, priority,
        estimated_cost, actual_cost, created_at, completed_at,
        assigned_to
    ) VALUES (
        job5_id, 'Paint Protection Film - Lexus RXHF', 'Premium film protection service for HUGENDUBLE',
        vehicle5_id, 'completed'::job_status, 'medium'::job_priority,
        1595, 1595, '2025-10-04 13:30:00+00', '2025-10-04 19:00:00+00',
        cam_id
    );
    
    INSERT INTO public.transactions (
        customer_name, customer_email, customer_phone, vehicle_id, job_id,
        subtotal, tax_amount, total_amount, transaction_status,
        created_at, processed_at, processed_by
    ) VALUES (
        'HUGENDUBLE', 'hugenduble@email.com', '555-0402', vehicle5_id, job5_id,
        1150, 445, 1595, 'completed'::transaction_status,
        '2025-10-04 13:30:00+00', '2025-10-04 19:00:00+00', cam_id
    );

    -- Create job_parts relationships for the services provided
    INSERT INTO public.job_parts (job_id, product_id) VALUES
        (job1_id, evernew_product_id),
        (job2_id, tint_product_id),
        (job4_id, evernew_product_id),
        (job5_id, film_product_id);

    RAISE NOTICE 'Successfully added 5 October 2025 sales transactions';
    RAISE NOTICE 'Total Sales Amount: $8,613';
    RAISE NOTICE 'Total Cost: $2,364';
    RAISE NOTICE 'Total Gross Profit: $6,249';

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error while adding October sales data: %', SQLERRM;
        RAISE NOTICE 'Please ensure all required staff members exist in user_profiles table';
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error: %', SQLERRM;
        RAISE NOTICE 'Some sales data may already exist';
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error adding October sales data: %', SQLERRM;
END $$;

-- Create helpful view for October sales summary
CREATE OR REPLACE VIEW public.october_2025_sales_summary AS
SELECT 
    DATE(t.created_at) as sale_date,
    t.customer_name,
    CONCAT(v.year, ' ', v.make, ' ', v.model) as vehicle,
    j.title as service_description,
    t.total_amount as price,
    (t.total_amount - t.subtotal) as cost,
    t.subtotal as gross_sales,
    up.full_name as staff_member,
    t.transaction_status
FROM public.transactions t
JOIN public.vehicles v ON t.vehicle_id = v.id
JOIN public.jobs j ON t.job_id = j.id
LEFT JOIN public.user_profiles up ON t.processed_by = up.id
WHERE t.created_at >= '2025-10-01'::date 
  AND t.created_at < '2025-11-01'::date
ORDER BY t.created_at;

COMMENT ON VIEW public.october_2025_sales_summary IS 'Summary view of all October 2025 sales transactions matching the provided sales data';