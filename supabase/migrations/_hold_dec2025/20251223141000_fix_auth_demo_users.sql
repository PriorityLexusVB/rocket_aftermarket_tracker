-- Create missing staff demo user profile
INSERT INTO public.user_profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'staff@rocketaftermarket.com',
  'Staff Member',
  'staff'::user_role,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Update existing profiles to ensure consistency
UPDATE public.user_profiles 
SET 
  full_name = CASE 
    WHEN email = 'admin@rocketaftermarket.com' THEN 'System Administrator'
    WHEN email = 'manager@rocketaftermarket.com' THEN 'Operations Manager'
    WHEN email = 'staff@rocketaftermarket.com' THEN 'Staff Member'
    ELSE full_name
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE email IN ('admin@rocketaftermarket.com', 'manager@rocketaftermarket.com', 'staff@rocketaftermarket.com');

-- Note: You'll need to create the actual auth.users entries in Supabase Auth dashboard
-- Or use the Supabase CLI/API to create users with these emails and the passwords shown in the demo