-- Schema Analysis: Existing user_profiles table with Ashley Terminello record, missing proper auth.users linkage
-- Integration Type: Modificative - Fix authentication linkage and add missing admin user
-- Dependencies: user_profiles table, auth.users schema

-- Update existing Ashley record with proper ID that will match auth.users
-- and add Rob Brasco as second admin user
DO $$
DECLARE
    ashley_auth_id UUID := gen_random_uuid();
    rob_auth_id UUID := gen_random_uuid();
    existing_ashley_id UUID;
BEGIN
    -- Get Ashley's existing user_profiles ID
    SELECT id INTO existing_ashley_id 
    FROM public.user_profiles 
    WHERE email = 'ashley.terminello@priorityautomotive.com';
    
    -- Create proper auth.users records with complete field structure
    -- **ALWAYS include all fields for auth.users** All of them even the null. Without it the user will not be able to signin.
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (ashley_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'ashley.terminello@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Ashley Terminello"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (rob_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'rob.brasco@priorityautomotive.com', crypt('Rocket123!', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Rob Brasco"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);
    
    -- Delete existing Ashley record first (to avoid FK conflicts)
    DELETE FROM public.user_profiles WHERE id = existing_ashley_id;
    
    -- Create new user_profiles records with matching auth.users IDs
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active, created_at, updated_at) VALUES
        (ashley_auth_id, 'ashley.terminello@priorityautomotive.com', 'Ashley Terminello', 'admin'::user_role, true, now(), now()),
        (rob_auth_id, 'rob.brasco@priorityautomotive.com', 'Rob Brasco', 'admin'::user_role, true, now(), now());
    
    RAISE NOTICE 'Successfully created Priority Automotive admin users with proper authentication';
    RAISE NOTICE 'Ashley Terminello: ashley.terminello@priorityautomotive.com / Rocket123!';
    RAISE NOTICE 'Rob Brasco: rob.brasco@priorityautomotive.com / Rocket123!';
    
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error during admin user creation: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error - user may already exist: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during admin user creation: %', SQLERRM;
END $$;

-- Create cleanup function for Priority Automotive admin users
CREATE OR REPLACE FUNCTION public.cleanup_priority_automotive_admins()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    admin_user_ids UUID[];
BEGIN
    -- Get admin user IDs
    SELECT ARRAY_AGG(id) INTO admin_user_ids
    FROM auth.users
    WHERE email IN ('ashley.terminello@priorityautomotive.com', 'rob.brasco@priorityautomotive.com');

    -- Delete in dependency order (children first, then auth.users last)
    DELETE FROM public.user_profiles WHERE id = ANY(admin_user_ids);
    DELETE FROM auth.users WHERE id = ANY(admin_user_ids);
    
    RAISE NOTICE 'Cleaned up Priority Automotive admin users';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint prevents admin user deletion: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Admin user cleanup failed: %', SQLERRM;
END;
$func$;

-- Verify authentication setup function
CREATE OR REPLACE FUNCTION public.verify_priority_automotive_auth()
RETURNS TABLE(
    status TEXT, 
    email TEXT, 
    auth_user_exists BOOLEAN, 
    profile_exists BOOLEAN, 
    email_confirmed BOOLEAN, 
    is_active BOOLEAN,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN au.id IS NOT NULL AND up.id IS NOT NULL AND au.email_confirmed_at IS NOT NULL AND up.is_active = true 
            THEN '✅ Ready' 
            ELSE '❌ Issues Found'
        END as status,
        admin_email as email,
        au.id IS NOT NULL as auth_user_exists,
        up.id IS NOT NULL as profile_exists,
        au.email_confirmed_at IS NOT NULL as email_confirmed,
        COALESCE(up.is_active, false) as is_active,
        COALESCE(up.role::TEXT, 'no_role') as role
    FROM (
        VALUES 
            ('ashley.terminello@priorityautomotive.com'),
            ('rob.brasco@priorityautomotive.com')
    ) AS admin_emails(admin_email)
    LEFT JOIN auth.users au ON au.email = admin_email
    LEFT JOIN public.user_profiles up ON up.email = admin_email AND up.id = au.id;
END;
$func$;