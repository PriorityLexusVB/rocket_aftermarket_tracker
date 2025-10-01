-- Migration: Update admin users with real Priority Automotive credentials
-- Schema Analysis: user_profiles and auth.users tables exist with admin role support
-- Integration Type: Modification - replacing demo users with real admin users
-- Dependencies: existing user_profiles table, auth.users schema

-- First, remove existing demo users
DO $$
DECLARE
    demo_user_ids UUID[];
BEGIN
    -- Get demo user IDs to delete
    SELECT ARRAY_AGG(id) INTO demo_user_ids
    FROM auth.users 
    WHERE email IN ('admin@rocketaftermarket.com', 'manager@rocketaftermarket.com');

    -- Delete from user_profiles first (foreign key dependency)
    DELETE FROM public.user_profiles WHERE id = ANY(demo_user_ids);
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = ANY(demo_user_ids);
    
    RAISE NOTICE 'Removed % demo users', array_length(demo_user_ids, 1);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during cleanup: %', SQLERRM;
END $$;

-- Create new Priority Automotive admin users
DO $$
DECLARE
    ashley_uuid UUID := gen_random_uuid();
    rob_uuid UUID := gen_random_uuid();
BEGIN
    -- Create auth.users with complete field structure
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (ashley_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'ashley.terminello@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), 
         now(), now(), '{"full_name": "Ashley Terminello"}'::jsonb, 
         '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (rob_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'rob.brasco@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), 
         now(), now(), '{"full_name": "Rob Brasco"}'::jsonb, 
         '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Create corresponding user_profiles entries
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active, created_at, updated_at)
    VALUES 
        (ashley_uuid, 'ashley.terminello@priorityautomotive.com', 'Ashley Terminello', 'admin'::public.user_role, true, now(), now()),
        (rob_uuid, 'rob.brasco@priorityautomotive.com', 'Rob Brasco', 'admin'::public.user_role, true, now(), now());

    RAISE NOTICE 'Successfully created Priority Automotive admin users: Ashley Terminello and Rob Brasco';
    
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Users already exist with these email addresses';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating users: %', SQLERRM;
END $$;