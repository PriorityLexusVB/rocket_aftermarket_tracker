-- Location: supabase/migrations/20251223141002_fix_auth_demo_users.sql
-- Schema Analysis: user_profiles table exists with demo users but missing auth.users entries
-- Integration Type: Fix authentication by adding missing auth.users records
-- Dependencies: existing user_profiles table with demo data

-- Create missing auth.users entries for existing demo users
DO $$
DECLARE
    manager_uuid UUID;
    staff_uuid UUID;
    admin_uuid UUID;
BEGIN
    -- Get existing user profile IDs
    SELECT id INTO manager_uuid FROM public.user_profiles WHERE email = 'manager@rocketaftermarket.com';
    SELECT id INTO staff_uuid FROM public.user_profiles WHERE email = 'staff@rocketaftermarket.com';
    SELECT id INTO admin_uuid FROM public.user_profiles WHERE email = 'admin@rocketaftermarket.com';

    -- Create auth.users entries with complete field structure for existing profiles
    IF manager_uuid IS NOT NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at, phone, phone_change,
            phone_change_token, phone_change_sent_at
        ) VALUES (
            manager_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'manager@rocketaftermarket.com', crypt('Manager123!', gen_salt('bf', 10)), now(), 
            now(), now(), '{"full_name": "Operations Manager"}'::jsonb, 
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    IF staff_uuid IS NOT NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at, phone, phone_change,
            phone_change_token, phone_change_sent_at
        ) VALUES (
            staff_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'staff@rocketaftermarket.com', crypt('Staff123!', gen_salt('bf', 10)), now(),
            now(), now(), '{"full_name": "Staff Member"}'::jsonb,
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    IF admin_uuid IS NOT NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at, phone, phone_change,
            phone_change_token, phone_change_sent_at
        ) VALUES (
            admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'admin@rocketaftermarket.com', crypt('Admin123!', gen_salt('bf', 10)), now(),
            now(), now(), '{"full_name": "System Administrator"}'::jsonb,
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Auth user already exists, skipping creation';
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error creating auth user: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error creating auth users: %', SQLERRM;
END $$;

-- Create helper function for authentication validation
CREATE OR REPLACE FUNCTION public.validate_demo_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    JOIN public.user_profiles up ON au.id = up.id
    WHERE au.email = user_email 
    AND up.is_active = true
    AND au.email_confirmed_at IS NOT NULL
)
$$;

-- Create function to check auth connection status
CREATE OR REPLACE FUNCTION public.check_auth_connection()
RETURNS TABLE(
    auth_users_count BIGINT,
    user_profiles_count BIGINT,
    matched_users_count BIGINT,
    connection_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auth_count BIGINT;
    profile_count BIGINT;
    matched_count BIGINT;
BEGIN
    -- Count auth.users
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    
    -- Count user_profiles
    SELECT COUNT(*) INTO profile_count FROM public.user_profiles;
    
    -- Count matched users
    SELECT COUNT(*) INTO matched_count 
    FROM auth.users au
    JOIN public.user_profiles up ON au.id = up.id;
    
    RETURN QUERY SELECT 
        auth_count,
        profile_count,
        matched_count,
        CASE 
            WHEN matched_count = profile_count THEN 'All profiles have auth users'
            WHEN matched_count = 0 THEN 'No auth users found for profiles'
            ELSE 'Partial match - some profiles missing auth users'
        END;
END;
$$;