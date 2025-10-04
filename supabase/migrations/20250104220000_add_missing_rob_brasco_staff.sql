-- Location: supabase/migrations/20250104220000_add_missing_rob_brasco_staff.sql
-- Schema Analysis: Existing user_profiles table with id, full_name, email, phone, department, role, is_active columns
-- Integration Type: Additive - Adding missing Rob Brasco user data
-- Dependencies: user_profiles table (already exists)

-- Add Rob Brasco to both user accounts and staff records
DO $$
DECLARE
    rob_uuid UUID := gen_random_uuid();
BEGIN
    -- Insert Rob Brasco as a user account with authentication
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES (
        rob_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rob.brasco@priorityautomotive.com', crypt('password123', gen_salt('bf', 10)), now(), 
        now(), now(), '{"full_name": "Rob Brasco"}'::jsonb, 
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    );

    -- Insert Rob Brasco as user profile (will be automatically created by trigger if exists, 
    -- but adding manually to ensure proper department assignment)
    INSERT INTO public.user_profiles (id, email, full_name, role, department, is_active, created_at, updated_at)
    VALUES (
        rob_uuid, 
        'rob.brasco@priorityautomotive.com', 
        'Rob Brasco', 
        'manager', 
        'Managers', 
        true, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
        department = 'Managers',
        role = 'manager';

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Rob Brasco already exists in the system';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding Rob Brasco: %', SQLERRM;
END $$;

-- Update existing Ashley record to ensure she has manager role and correct department
UPDATE public.user_profiles 
SET 
    role = 'manager',
    department = 'Managers'
WHERE email = 'ashley.terminello@priorityautomotive.com';

-- Clean up the incorrect sales person department entry
UPDATE public.user_profiles 
SET 
    department = 'Sales Consultants'
WHERE department = 'Sales Person';