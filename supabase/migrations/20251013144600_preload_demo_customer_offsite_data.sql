-- Location: supabase/migrations/20251013144600_preload_demo_customer_offsite_data.sql
-- Schema Analysis: Existing schema has vehicles, jobs, vendors, and user_profiles tables
-- Integration Type: Data insertion - adding demo customer data with off-site jobs
-- Dependencies: vehicles, jobs, vendors, user_profiles tables

-- Preload demo customer info with off-site work and promise date of 10/17/2025
DO $$
DECLARE
    customer1_vehicle_id UUID := gen_random_uuid();
    customer2_vehicle_id UUID := gen_random_uuid();
    customer3_vehicle_id UUID := gen_random_uuid();
    offsite_vendor_id UUID;
    detailing_vendor_id UUID;
    demo_job1_id UUID := gen_random_uuid();
    demo_job2_id UUID := gen_random_uuid();
    demo_job3_id UUID := gen_random_uuid();
    admin_user_id UUID;
BEGIN
    -- Get existing vendor IDs for off-site work
    SELECT id INTO offsite_vendor_id FROM public.vendors WHERE name = 'Simple Details' LIMIT 1;
    SELECT id INTO detailing_vendor_id FROM public.vendors WHERE name = 'Priority Automotive Detailing' LIMIT 1;
    
    -- Get an admin user for job assignment
    SELECT id INTO admin_user_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;
    
    -- If no admin found, get any user
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM public.user_profiles LIMIT 1;
    END IF;

    -- Insert demo customer vehicles with detailed customer info
    INSERT INTO public.vehicles (
        id, make, model, year, color, vin, stock_number, 
        owner_name, owner_email, owner_phone, license_plate,
        mileage, notes, vehicle_status, created_by
    ) VALUES
        (customer1_vehicle_id, 'Ford', 'F-150', 2022, 'Midnight Blue', 
         '1FTFW1E50NFA12345', 'DEMO001',
         'Michael Rodriguez', 'mrodriguez@email.com', '555-2100', 
         'TX-DEMO1', 35000, 
         'Customer requested ceramic coating and paint protection', 
         'active'::public.vehicle_status, admin_user_id),
        
        (customer2_vehicle_id, 'Chevrolet', 'Tahoe', 2023, 'Pearl White', 
         '1GNSKCKC0PR123456', 'DEMO002',
         'Sarah Chen', 'sarah.chen@email.com', '555-2101', 
         'TX-DEMO2', 18500,
         'Full interior detail and leather conditioning needed',
         'active'::public.vehicle_status, admin_user_id),
         
        (customer3_vehicle_id, 'BMW', 'X5', 2021, 'Alpine White', 
         'XBMCW1C50MG123456', 'DEMO003',
         'James Thompson', 'jthompson@email.com', '555-2102',
         'TX-DEMO3', 42800,
         'Premium detailing package with paint correction',
         'active'::public.vehicle_status, admin_user_id);

    -- Insert jobs with off-site work and promise date of 10/17/2025
    INSERT INTO public.jobs (
        id, title, description, vehicle_id, vendor_id, 
        promised_date, job_status, priority, service_type,
        estimated_cost, estimated_hours, created_by, assigned_to,
        customer_needs_loaner, calendar_notes
    ) VALUES
        (demo_job1_id, 
         'DEMO001: Ceramic Coating & Paint Protection',
         'Full ceramic coating application with 5-year warranty, paint correction, and protective film installation',
         customer1_vehicle_id, offsite_vendor_id,
         '2025-10-17 17:00:00+00', 'scheduled'::public.job_status, 'medium'::public.job_priority,
         'off_site', 1800.00, 8, admin_user_id, admin_user_id,
         true, 'Customer Michael Rodriguez - Loaner vehicle required. Off-site ceramic coating work.'),
         
        (demo_job2_id,
         'DEMO002: Premium Interior Detail',
         'Complete interior detailing including leather conditioning, carpet shampooing, and UV protection treatment',
         customer2_vehicle_id, detailing_vendor_id,
         '2025-10-17 17:00:00+00', 'scheduled'::public.job_status, 'high'::public.job_priority,
         'off_site', 950.00, 6, admin_user_id, admin_user_id,
         false, 'Customer Sarah Chen - No loaner needed. Premium interior detail off-site.'),
         
        (demo_job3_id,
         'DEMO003: Paint Correction & Detail',
         'Multi-stage paint correction, premium wash, wax application, and wheel restoration',
         customer3_vehicle_id, offsite_vendor_id,
         '2025-10-17 17:00:00+00', 'scheduled'::public.job_status, 'medium'::public.job_priority,
         'off_site', 1350.00, 10, admin_user_id, admin_user_id,
         true, 'Customer James Thompson - BMW X5 premium detail package. Loaner vehicle arranged.');

    -- Log the activity
    INSERT INTO public.activity_history (
        performed_by, activity_type, description, 
        related_table, related_id
    ) VALUES
        (admin_user_id, 'data_load', 'Demo customer data preloaded with off-site jobs for 10/17/2025', 
         'vehicles', customer1_vehicle_id),
        (admin_user_id, 'data_load', 'Demo customer data preloaded with off-site jobs for 10/17/2025', 
         'vehicles', customer2_vehicle_id),
        (admin_user_id, 'data_load', 'Demo customer data preloaded with off-site jobs for 10/17/2025', 
         'vehicles', customer3_vehicle_id);

    RAISE NOTICE 'Demo customer data successfully preloaded:';
    RAISE NOTICE '- 3 customer vehicles with detailed contact information';
    RAISE NOTICE '- 3 off-site jobs with promise date of 10/17/2025';
    RAISE NOTICE '- Jobs assigned to existing vendors for off-site work';
    RAISE NOTICE '- Customer loaner vehicle preferences configured';
    
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error during demo data load: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error during demo data load: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during demo data load: %', SQLERRM;
END $$;

-- Verify the loaded data
SELECT 
    'Demo Customer Data Summary:' as info,
    (SELECT COUNT(*) FROM public.vehicles WHERE stock_number LIKE 'DEMO%') as demo_vehicles_count,
    (SELECT COUNT(*) FROM public.jobs WHERE promised_date::date = '2025-10-17') as promise_date_jobs_count,
    (SELECT COUNT(*) FROM public.jobs WHERE service_type = 'off_site' AND promised_date::date = '2025-10-17') as offsite_jobs_count;