-- Location: supabase/migrations/20250929235441_vendor_specific_access_control.sql
-- Schema Analysis: Existing automotive aftermarket system with user_profiles, vendors, vehicles, jobs tables
-- Integration Type: Extension - Adding vendor-specific access control
-- Dependencies: user_profiles, vendors, vehicles, jobs tables (existing)
-- FIX: Corrected LIMIT syntax error and enum transaction handling

-- Step 1: Add vendor_id column to user_profiles for vendor association
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Step 2: Create index for vendor_id lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_vendor_id ON public.user_profiles(vendor_id);

-- Step 3: Add 'vendor' role to the existing user_role enum
-- This needs to be committed before it can be used
DO $$
BEGIN
    -- Check if 'vendor' enum value already exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum e 
                   JOIN pg_type t ON e.enumtypid = t.oid 
                   WHERE t.typname = 'user_role' AND e.enumlabel = 'vendor') THEN
        ALTER TYPE public.user_role ADD VALUE 'vendor';
    END IF;
END $$;

-- Step 4: Commit the transaction to make the enum value available
COMMIT;
BEGIN;

-- Step 5: Create vendor-user association function (now enum is available)
CREATE OR REPLACE FUNCTION public.is_vendor_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.role::text = 'vendor'
    AND up.vendor_id IS NOT NULL
    AND up.is_active = true
)
$$;

-- Step 6: Create vendor vehicle access function
CREATE OR REPLACE FUNCTION public.vendor_can_access_vehicle(vehicle_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.jobs j ON j.vendor_id = up.vendor_id
    WHERE up.id = auth.uid()
    AND up.role::text = 'vendor'
    AND up.vendor_id IS NOT NULL
    AND j.vehicle_id = vehicle_uuid
    AND up.is_active = true
)
$$;

-- Step 7: Create vendor job access function
CREATE OR REPLACE FUNCTION public.vendor_can_access_job(job_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.jobs j ON j.vendor_id = up.vendor_id
    WHERE up.id = auth.uid()
    AND up.role::text = 'vendor'
    AND up.vendor_id IS NOT NULL
    AND j.id = job_uuid
    AND up.is_active = true
)
$$;

-- Step 8: Update RLS policies for vendor-specific access

-- Drop existing policies to replace with vendor-aware versions
DROP POLICY IF EXISTS "staff_can_view_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "managers_manage_vehicles" ON public.vehicles;

-- Create new vehicle policies with vendor access
CREATE POLICY "staff_can_view_all_vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.role::text IN ('staff', 'manager', 'admin')
        AND up.is_active = true
    )
);

CREATE POLICY "vendors_can_view_assigned_vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (public.vendor_can_access_vehicle(id));

CREATE POLICY "managers_manage_vehicles"
ON public.vehicles
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Drop existing job policies to replace with vendor-aware versions
DROP POLICY IF EXISTS "staff_can_view_jobs" ON public.jobs;
DROP POLICY IF EXISTS "staff_manage_assigned_jobs" ON public.jobs;
DROP POLICY IF EXISTS "managers_manage_jobs" ON public.jobs;

-- Create new job policies with vendor access
CREATE POLICY "staff_can_view_all_jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.role::text IN ('staff', 'manager', 'admin')
        AND up.is_active = true
    )
);

CREATE POLICY "vendors_can_view_assigned_jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (public.vendor_can_access_job(id));

CREATE POLICY "vendors_can_update_assigned_jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (public.vendor_can_access_job(id))
WITH CHECK (public.vendor_can_access_job(id));

CREATE POLICY "staff_manage_assigned_jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "managers_manage_all_jobs"
ON public.jobs
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Step 9: Add vendor access policies for other related tables

-- Communications table - vendors can view communications for their jobs
CREATE POLICY "vendors_can_view_job_communications"
ON public.communications
FOR SELECT
TO authenticated
USING (
    job_id IS NOT NULL 
    AND public.vendor_can_access_job(job_id)
);

CREATE POLICY "vendors_can_create_job_communications"
ON public.communications
FOR INSERT
TO authenticated
WITH CHECK (
    job_id IS NOT NULL 
    AND public.vendor_can_access_job(job_id)
    AND sent_by = auth.uid()
);

-- Transactions table - vendors can view transactions for their jobs
CREATE POLICY "vendors_can_view_job_transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
    job_id IS NOT NULL 
    AND public.vendor_can_access_job(job_id)
);

-- Job parts table - vendors can view and manage parts for their jobs
CREATE POLICY "vendors_can_view_job_parts"
ON public.job_parts
FOR SELECT
TO authenticated
USING (public.vendor_can_access_job(job_id));

CREATE POLICY "vendors_can_manage_job_parts"
ON public.job_parts
FOR ALL
TO authenticated
USING (public.vendor_can_access_job(job_id))
WITH CHECK (public.vendor_can_access_job(job_id));

-- Step 10: Create vendor management functions
CREATE OR REPLACE FUNCTION public.get_vendor_vehicles(vendor_uuid UUID DEFAULT NULL)
RETURNS TABLE(
    vehicle_id UUID,
    vehicle_vin TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    job_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    v.id as vehicle_id,
    v.vin as vehicle_vin,
    v.make as vehicle_make,
    v.model as vehicle_model,
    v.year as vehicle_year,
    COUNT(j.id) as job_count
FROM public.vehicles v
INNER JOIN public.jobs j ON v.id = j.vehicle_id
WHERE j.vendor_id = COALESCE(
    vendor_uuid,
    (SELECT up.vendor_id FROM public.user_profiles up WHERE up.id = auth.uid())
)
GROUP BY v.id, v.vin, v.make, v.model, v.year
ORDER BY v.make, v.model, v.year;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_jobs(vendor_uuid UUID DEFAULT NULL)
RETURNS TABLE(
    job_id UUID,
    job_number TEXT,
    job_title TEXT,
    job_status TEXT,
    vehicle_info TEXT,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id as job_id,
    j.job_number,
    j.title as job_title,
    j.job_status::TEXT,
    CONCAT(v.year, ' ', v.make, ' ', v.model) as vehicle_info,
    j.scheduled_start_time,
    j.scheduled_end_time
FROM public.jobs j
INNER JOIN public.vehicles v ON j.vehicle_id = v.id
WHERE j.vendor_id = COALESCE(
    vendor_uuid,
    (SELECT up.vendor_id FROM public.user_profiles up WHERE up.id = auth.uid())
)
ORDER BY j.scheduled_start_time DESC, j.created_at DESC;
$$;

-- Step 11: Create mock vendor users and associations
-- Using a separate transaction block to ensure enum is available
DO $$
DECLARE
    vendor_user1_id UUID := gen_random_uuid();
    vendor_user2_id UUID := gen_random_uuid();
    existing_vendor_id UUID;
    job_to_update_id UUID;
BEGIN
    -- Get existing vendor ID
    SELECT id INTO existing_vendor_id FROM public.vendors ORDER BY created_at LIMIT 1;
    
    IF existing_vendor_id IS NOT NULL THEN
        -- Create vendor auth users
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at, phone, phone_change,
            phone_change_token, phone_change_sent_at
        ) VALUES
            (vendor_user1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'vendor@premiumauto.com', crypt('vendor123', gen_salt('bf', 10)), now(), now(), now(),
             '{"full_name": "Premium Auto Vendor"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
             false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
            (vendor_user2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'vendorstaff@premiumauto.com', crypt('vendor456', gen_salt('bf', 10)), now(), now(), now(),
             '{"full_name": "Vendor Staff User"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
             false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
        ON CONFLICT (id) DO NOTHING;

        -- Create vendor user profiles with explicit casting to avoid enum issues
        INSERT INTO public.user_profiles (id, email, full_name, role, vendor_id, is_active)
        VALUES
            (vendor_user1_id, 'vendor@premiumauto.com', 'Premium Auto Vendor', 'vendor'::public.user_role, existing_vendor_id, true),
            (vendor_user2_id, 'vendorstaff@premiumauto.com', 'Vendor Staff User', 'vendor'::public.user_role, existing_vendor_id, true)
        ON CONFLICT (id) DO UPDATE SET 
            role = EXCLUDED.role,
            vendor_id = EXCLUDED.vendor_id,
            is_active = EXCLUDED.is_active;

        -- Get one job ID that needs vendor assignment (FIXED: Remove LIMIT from UPDATE)
        SELECT id INTO job_to_update_id 
        FROM public.jobs 
        WHERE vendor_id IS NULL 
        ORDER BY created_at 
        LIMIT 1;
        
        -- Update the specific job (PostgreSQL compliant syntax)
        IF job_to_update_id IS NOT NULL THEN
            UPDATE public.jobs 
            SET vendor_id = existing_vendor_id 
            WHERE id = job_to_update_id;
        END IF;
    END IF;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;

-- Final commit
COMMIT;