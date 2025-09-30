-- Fix Demo Authentication - Create Missing Auth Users
-- This migration creates the auth.users entries that correspond to the existing user_profiles
-- Run timestamp: 2025-09-30 00:20:00

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to safely create auth users
CREATE OR REPLACE FUNCTION create_demo_auth_user(
  user_email TEXT,
  user_password TEXT
) RETURNS VOID AS $$
DECLARE
  existing_auth_id UUID;
  profile_id UUID;
BEGIN
  -- Check if auth user already exists
  SELECT id INTO existing_auth_id 
  FROM auth.users 
  WHERE email = user_email;
  
  -- Get the user_profile ID
  SELECT id INTO profile_id 
  FROM public.user_profiles 
  WHERE email = user_email;
  
  -- If auth user doesn't exist but profile does, create auth user
  IF existing_auth_id IS NULL AND profile_id IS NOT NULL THEN
    
    -- Insert into auth.users using the same ID from user_profiles
    INSERT INTO auth.users (
      id,
      instance_id,
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
      profile_id,
      '00000000-0000-0000-0000-000000000000',
      user_email,
      crypt(user_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    -- Also create auth.identities entry
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      profile_id,
      json_build_object('sub', profile_id::text, 'email', user_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created auth user for: %', user_email;
    
  ELSIF existing_auth_id IS NOT NULL THEN
    RAISE NOTICE 'Auth user already exists for: %', user_email;
  ELSE
    RAISE NOTICE 'No user_profile found for: %', user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create demo auth users for existing profiles
-- These passwords match the LoginForm demo section
SELECT create_demo_auth_user('admin@rocketaftermarket.com', 'Admin123!');
SELECT create_demo_auth_user('manager@rocketaftermarket.com', 'Manager123!');

-- Drop the function after use
DROP FUNCTION IF EXISTS create_demo_auth_user(TEXT, TEXT);

-- Verify the setup
DO $$
DECLARE
  admin_count INTEGER;
  manager_count INTEGER;
BEGIN
  -- Count auth users
  SELECT COUNT(*) INTO admin_count 
  FROM auth.users 
  WHERE email = 'admin@rocketaftermarket.com';
  
  SELECT COUNT(*) INTO manager_count 
  FROM auth.users 
  WHERE email = 'manager@rocketaftermarket.com';
  
  -- Report results
  RAISE NOTICE 'Demo Authentication Setup Complete:';
  RAISE NOTICE '  - Admin auth user: % (should be 1)', admin_count;
  RAISE NOTICE '  - Manager auth user: % (should be 1)', manager_count;
  
  IF admin_count = 1 AND manager_count = 1 THEN
    RAISE NOTICE '  ✅ All demo users are ready for authentication';
  ELSE
    RAISE WARNING '  ⚠️  Some demo users may not be properly configured';
  END IF;
END;
$$;