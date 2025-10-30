-- Fix authentication demo users
-- This migration creates the auth.users entries that correspond to the user_profiles

-- Create auth users for demo accounts
-- Note: These passwords should match what's shown in the LoginForm demo section
-- Run these via Supabase Dashboard SQL Editor or CLI

-- Insert auth users (requires admin access to auth schema)
-- This should be run as a separate step in Supabase Dashboard

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
SELECT 
  gen_random_uuid(),
  'manager@rocketaftermarket.com',
  crypt('Manager123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'manager@rocketaftermarket.com'
);

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
SELECT 
  gen_random_uuid(),
  'staff@rocketaftermarket.com',
  crypt('Staff123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'staff@rocketaftermarket.com'
);

-- Update user_profiles to match auth.users IDs
UPDATE user_profiles 
SET id = (SELECT id FROM auth.users WHERE email = user_profiles.email)
WHERE email IN ('manager@rocketaftermarket.com', 'staff@rocketaftermarket.com')
AND EXISTS (SELECT 1 FROM auth.users WHERE email = user_profiles.email);