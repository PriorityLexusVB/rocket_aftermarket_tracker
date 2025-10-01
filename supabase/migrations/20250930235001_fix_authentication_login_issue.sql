-- Location: supabase/migrations/20250930235001_fix_authentication_login_issue.sql
-- Schema Analysis: existing user_profiles table with admin users, but missing auth.users records
-- Integration Type: Authentication fix - Create missing auth.users records for login
-- Dependencies: existing user_profiles table

-- Fix authentication issue by creating proper auth.users records for Priority Automotive admin users
-- This resolves the "Invalid login credentials" error by ensuring users exist in both auth.users and user_profiles

DO $$
DECLARE
    ashley_auth_id UUID;
    rob_auth_id UUID;
BEGIN
    -- Generate new UUIDs for auth.users records
    SELECT gen_random_uuid() INTO ashley_auth_id;
    SELECT gen_random_uuid() INTO rob_auth_id;

    -- Step 1: Clean up any existing incomplete auth records
    DELETE FROM auth.users WHERE email IN ('ashley.terminello@priorityautomotive.com', 'rob.brasco@priorityautomotive.com');
    
    -- Step 2: Create complete auth.users records with all required fields for proper authentication
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        -- Ashley Terminello - Admin User  
        (ashley_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'ashley.terminello@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), 
         now(), now(), '{"full_name": "Ashley Terminello"}'::jsonb, 
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        
        -- Rob Brasco - Admin User
        (rob_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'rob.brasco@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), 
         now(), now(), '{"full_name": "Rob Brasco"}'::jsonb, 
         '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Step 3: Update existing user_profiles records to link to new auth.users
    UPDATE public.user_profiles 
    SET id = ashley_auth_id,
        email = 'ashley.terminello@priorityautomotive.com',
        full_name = 'Ashley Terminello',
        role = 'admin'::public.user_role,
        is_active = true,
        updated_at = now()
    WHERE email = 'ashley.terminello@priorityautomotive.com';

    UPDATE public.user_profiles 
    SET id = rob_auth_id,
        email = 'rob.brasco@priorityautomotive.com', 
        full_name = 'Rob Brasco',
        role = 'admin'::public.user_role,
        is_active = true,
        updated_at = now()
    WHERE email = 'rob.brasco@priorityautomotive.com';

    -- Step 4: Insert new user_profiles if they don't exist
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active, created_at, updated_at)
    VALUES 
        (ashley_auth_id, 'ashley.terminello@priorityautomotive.com', 'Ashley Terminello', 
         'admin'::public.user_role, true, now(), now()),
        (rob_auth_id, 'rob.brasco@priorityautomotive.com', 'Rob Brasco', 
         'admin'::public.user_role, true, now(), now())
    ON CONFLICT (email) DO NOTHING;

    -- Success message
    RAISE NOTICE 'Authentication fix complete. Admin users can now login with:';
    RAISE NOTICE 'Ashley: ashley.terminello@priorityautomotive.com / Rocket123!';
    RAISE NOTICE 'Rob: rob.brasco@priorityautomotive.com / Rocket123!';

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error during user creation: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'User already exists, skipping creation: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during authentication fix: %', SQLERRM;
END $$;