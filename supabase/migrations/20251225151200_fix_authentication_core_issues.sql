-- Fix core authentication issues that have been causing login failures
-- This migration addresses: missing users, unconfirmed emails, auth/profile mismatches

-- First, ensure all demo users exist in auth.users with proper confirmation
DO $$ 
DECLARE 
    user_id UUID;
    admin_exists BOOLEAN := FALSE;
    manager_exists BOOLEAN := FALSE;
    staff_exists BOOLEAN := FALSE;
BEGIN
    -- Check if users exist in auth.users
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@rocketaftermarket.com') INTO admin_exists;
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@rocketaftermarket.com') INTO manager_exists;
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@rocketaftermarket.com') INTO staff_exists;

    -- Create admin user if missing
    IF NOT admin_exists THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            'c87860f7-5304-4c5f-a7b6-4ca163d3b07d',
            'authenticated',
            'authenticated',
            'admin@rocketaftermarket.com',
            crypt('Admin123!', gen_salt('bf')),
            NOW(),
            NULL,
            NULL,
            '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "System Administrator"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
    ELSE 
        -- Update existing admin to ensure confirmation
        UPDATE auth.users 
        SET email_confirmed_at = NOW(),
            encrypted_password = crypt('Admin123!', gen_salt('bf')),
            updated_at = NOW()
        WHERE email = 'admin@rocketaftermarket.com';
    END IF;

    -- Create manager user if missing
    IF NOT manager_exists THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            'd3dc402d-00a0-42f7-a4ea-e93a9af76630',
            'authenticated',
            'authenticated',
            'manager@rocketaftermarket.com',
            crypt('Manager123!', gen_salt('bf')),
            NOW(),
            NULL,
            NULL,
            '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "Operations Manager"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
    ELSE
        -- Update existing manager to ensure confirmation
        UPDATE auth.users 
        SET email_confirmed_at = NOW(),
            encrypted_password = crypt('Manager123!', gen_salt('bf')),
            updated_at = NOW()
        WHERE email = 'manager@rocketaftermarket.com';
    END IF;

    -- Create staff user (this is likely missing and causing failures)
    IF NOT staff_exists THEN
        user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            user_id,
            'authenticated',
            'authenticated',
            'staff@rocketaftermarket.com',
            crypt('Staff123!', gen_salt('bf')),
            NOW(),
            NULL,
            NULL,
            '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "Staff User"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        -- Create corresponding user profile for staff
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            role,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            'staff@rocketaftermarket.com',
            'Staff User',
            'staff'::public.user_role,
            true,
            NOW(),
            NOW()
        );
    ELSE
        -- Update existing staff to ensure confirmation
        UPDATE auth.users 
        SET email_confirmed_at = NOW(),
            encrypted_password = crypt('Staff123!', gen_salt('bf')),
            updated_at = NOW()
        WHERE email = 'staff@rocketaftermarket.com';
    END IF;

    -- Ensure user profiles exist and are properly linked
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active, created_at, updated_at)
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'full_name', 
                 CASE au.email
                     WHEN 'admin@rocketaftermarket.com' THEN 'System Administrator'
                     WHEN 'manager@rocketaftermarket.com' THEN 'Operations Manager'
                     WHEN 'staff@rocketaftermarket.com' THEN 'Staff User'
                     ELSE 'User'
                 END
        ),
        CASE au.email
            WHEN 'admin@rocketaftermarket.com' THEN 'admin'::public.user_role
            WHEN 'manager@rocketaftermarket.com' THEN 'manager'::public.user_role
            WHEN 'staff@rocketaftermarket.com' THEN 'staff'::public.user_role
            ELSE 'staff'::public.user_role
        END,
        true,
        NOW(),
        NOW()
    FROM auth.users au
    WHERE au.email IN ('admin@rocketaftermarket.com', 'manager@rocketaftermarket.com', 'staff@rocketaftermarket.com')
    AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
    );

    -- Update existing profiles to ensure they're active
    UPDATE public.user_profiles 
    SET is_active = true,
        updated_at = NOW()
    WHERE email IN ('admin@rocketaftermarket.com', 'manager@rocketaftermarket.com', 'staff@rocketaftermarket.com');

END $$;

-- Create function to verify authentication setup
CREATE OR REPLACE FUNCTION public.verify_auth_setup()
RETURNS TABLE(
    status text,
    email text,
    auth_user_exists boolean,
    profile_exists boolean,
    email_confirmed boolean,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN au.id IS NOT NULL AND up.id IS NOT NULL AND au.email_confirmed_at IS NOT NULL AND up.is_active = true 
            THEN '✅ Ready' 
            ELSE '❌ Issues Found'
        END as status,
        demo_email as email,
        au.id IS NOT NULL as auth_user_exists,
        up.id IS NOT NULL as profile_exists,
        au.email_confirmed_at IS NOT NULL as email_confirmed,
        COALESCE(up.is_active, false) as is_active
    FROM (
        VALUES 
            ('admin@rocketaftermarket.com'),
            ('manager@rocketaftermarket.com'),
            ('staff@rocketaftermarket.com')
    ) AS demo_emails(demo_email)
    LEFT JOIN auth.users au ON au.email = demo_email
    LEFT JOIN public.user_profiles up ON up.email = demo_email;
END;
$$;

-- Test the authentication setup
SELECT * FROM public.verify_auth_setup();

-- Add helpful comment
COMMENT ON FUNCTION public.verify_auth_setup() IS 'Verifies that all demo users are properly configured for authentication';