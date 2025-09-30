-- Fix the calendar date range function return type mismatch error
-- Problem: Cannot change return type with CREATE OR REPLACE
-- Solution: Drop function first, then recreate with new signature

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_jobs_by_date_range(timestamp with time zone, timestamp with time zone, uuid, text);

-- Create the function with expanded return type including job_number, location, calendar_notes
CREATE OR REPLACE FUNCTION public.get_jobs_by_date_range(
    start_date timestamp with time zone, 
    end_date timestamp with time zone, 
    vendor_filter uuid DEFAULT NULL::uuid, 
    status_filter text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid, 
    title text, 
    description text, 
    scheduled_start_time timestamp with time zone, 
    scheduled_end_time timestamp with time zone, 
    job_status text, 
    vendor_name text, 
    vendor_id uuid, 
    vehicle_info text, 
    color_code text, 
    priority text, 
    estimated_hours integer,
    job_number text,
    location text,
    calendar_notes text
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
SELECT 
    j.id,
    j.title,
    j.description,
    j.scheduled_start_time,
    j.scheduled_end_time,
    j.job_status::TEXT,
    COALESCE(v.name, 'Unassigned') as vendor_name,
    j.vendor_id,
    CASE 
        WHEN vh.id IS NOT NULL THEN CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model)
        ELSE 'No Vehicle'
    END as vehicle_info,
    COALESCE(j.color_code, '#3b82f6') as color_code,
    j.priority::TEXT,
    j.estimated_hours,
    j.job_number,
    j.location,
    j.calendar_notes
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE j.scheduled_start_time IS NOT NULL
-- Fix the date range logic to include overlapping jobs
AND (
    -- Job starts within the range
    (j.scheduled_start_time >= start_date AND j.scheduled_start_time <= end_date)
    OR
    -- Job ends within the range  
    (j.scheduled_end_time IS NOT NULL AND j.scheduled_end_time >= start_date AND j.scheduled_end_time <= end_date)
    OR  
    -- Job spans the entire range
    (j.scheduled_start_time <= start_date AND j.scheduled_end_time IS NOT NULL AND j.scheduled_end_time >= end_date)
)
AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter)
AND (status_filter IS NULL OR j.job_status::TEXT = status_filter)
ORDER BY j.scheduled_start_time ASC;
$function$;

-- Add comprehensive test calendar data to make the calendar visible
DO $$
DECLARE
    test_vendor_id uuid;
    test_vehicle_id uuid;
    admin_user_id uuid;
BEGIN
    -- Get the first admin user
    SELECT id INTO admin_user_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;
    
    -- Get or create a test vendor
    SELECT id INTO test_vendor_id FROM public.vendors LIMIT 1;
    
    -- Get a test vehicle
    SELECT id INTO test_vehicle_id FROM public.vehicles LIMIT 1;
    
    -- Skip if no users, vendors, or vehicles exist
    IF admin_user_id IS NULL OR test_vendor_id IS NULL OR test_vehicle_id IS NULL THEN
        RAISE NOTICE 'Skipping test data creation - missing required data (users: %, vendors: %, vehicles: %)', 
            admin_user_id IS NOT NULL, test_vendor_id IS NOT NULL, test_vehicle_id IS NOT NULL;
        RETURN;
    END IF;
    
    -- Insert some calendar test jobs for the current week if they do not exist
    INSERT INTO public.jobs (
        job_number, title, description, vehicle_id, vendor_id, 
        scheduled_start_time, scheduled_end_time, estimated_hours, 
        location, priority, job_status, color_code, calendar_notes, created_by
    ) 
    SELECT * FROM (VALUES
        ('CAL-TEST-001', 'Oil Change Service', 'Regular maintenance oil change', test_vehicle_id, test_vendor_id,
         (CURRENT_DATE + INTERVAL '1 day')::timestamp + INTERVAL '9 hours', 
         (CURRENT_DATE + INTERVAL '1 day')::timestamp + INTERVAL '10 hours', 1,
         'Service Bay 1', 'medium', 'scheduled', '#10b981', 'Quick oil change appointment', admin_user_id),
        
        ('CAL-TEST-002', 'Brake Inspection', 'Check brake pads and rotors', test_vehicle_id, test_vendor_id,
         (CURRENT_DATE + INTERVAL '2 days')::timestamp + INTERVAL '14 hours',
         (CURRENT_DATE + INTERVAL '2 days')::timestamp + INTERVAL '16 hours', 2,
         'Service Bay 2', 'high', 'scheduled', '#f59e0b', 'Priority brake check', admin_user_id),
        
        ('CAL-TEST-003', 'Tire Rotation', 'Rotate all four tires', test_vehicle_id, null,
         (CURRENT_DATE + INTERVAL '3 days')::timestamp + INTERVAL '11 hours',
         (CURRENT_DATE + INTERVAL '3 days')::timestamp + INTERVAL '12 hours', 1,
         'Service Bay 3', 'low', 'scheduled', '#6366f1', 'Routine tire service', admin_user_id),
        
        ('CAL-TEST-004', 'AC Repair', 'Fix air conditioning system', test_vehicle_id, test_vendor_id,
         CURRENT_DATE::timestamp + INTERVAL '15 hours',
         CURRENT_DATE::timestamp + INTERVAL '17 hours', 2,
         'Service Bay 1', 'urgent', 'in_progress', '#ef4444', 'Emergency AC repair', admin_user_id),

        ('CAL-TEST-005', 'Transmission Service', 'Check transmission fluid and filters', test_vehicle_id, test_vendor_id,
         (CURRENT_DATE + INTERVAL '4 days')::timestamp + INTERVAL '10 hours',
         (CURRENT_DATE + INTERVAL '4 days')::timestamp + INTERVAL '13 hours', 3,
         'Service Bay 4', 'medium', 'scheduled', '#8b5cf6', 'Scheduled transmission maintenance', admin_user_id),

        ('CAL-TEST-006', 'Battery Replacement', 'Replace old car battery', test_vehicle_id, null,
         (CURRENT_DATE + INTERVAL '5 days')::timestamp + INTERVAL '8 hours',
         (CURRENT_DATE + INTERVAL '5 days')::timestamp + INTERVAL '9 hours', 1,
         'Service Bay 2', 'low', 'scheduled', '#06b6d4', 'Simple battery swap', admin_user_id)
    ) AS t(job_number, title, description, vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time, estimated_hours, location, priority, job_status, color_code, calendar_notes, created_by)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.jobs WHERE job_number = t.job_number
    );
    
    -- Update the existing job to have proper calendar scheduling
    UPDATE public.jobs 
    SET 
        scheduled_start_time = (CURRENT_DATE + INTERVAL '1 day')::timestamp + INTERVAL '9 hours',
        scheduled_end_time = (CURRENT_DATE + INTERVAL '1 day')::timestamp + INTERVAL '11 hours',
        job_status = 'scheduled'::public.job_status,
        calendar_notes = 'Updated for calendar display'
    WHERE job_number = 'JOB-2025-001001'
    AND scheduled_start_time IS NULL;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating calendar test data: %', SQLERRM;
END $$;