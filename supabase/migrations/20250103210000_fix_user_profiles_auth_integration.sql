-- Location: supabase/migrations/20250103210000_fix_user_profiles_auth_integration.sql
-- Schema Analysis: Existing user_profiles table with foreign key constraint to auth.users
-- Integration Type: Fix foreign key constraint and enhance user creation workflow
-- Dependencies: user_profiles, auth.users tables, existing user_role enum

-- First, fix the broken foreign key constraint by ensuring proper relationship
-- Remove the problematic constraint if it exists
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Recreate the proper foreign key constraint
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create enhanced function to handle new user creation with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into user_profiles using auth.users data
  INSERT INTO public.user_profiles (id, email, full_name, role, department, is_active)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If user_profiles record already exists, update it
    UPDATE public.user_profiles 
    SET 
      email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      role = COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, role),
      department = COALESCE(NEW.raw_user_meta_data->>'department', department),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to safely create user with auth and profile
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role public.user_role DEFAULT 'staff'::public.user_role,
  user_department TEXT DEFAULT 'General'
)
RETURNS TABLE(
  user_id UUID,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  auth_user_record RECORD;
BEGIN
  -- Generate new user ID
  new_user_id := gen_random_uuid();
  
  -- Create auth user first
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    user_email, crypt(user_password, gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', user_full_name, 'role', user_role::TEXT, 'department', user_department),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  );
  
  -- The trigger will automatically create the user_profile record
  
  RETURN QUERY SELECT new_user_id, true, ''::TEXT;
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT null::UUID, false, 'Email address already exists'::TEXT;
  WHEN OTHERS THEN
    RETURN QUERY SELECT null::UUID, false, SQLERRM::TEXT;
END;
$$;

-- Function to clean up orphaned user_profiles records
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete user_profiles that don't have corresponding auth.users
  DELETE FROM public.user_profiles 
  WHERE id NOT IN (SELECT id FROM auth.users);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Clean up any existing orphaned records
SELECT public.cleanup_orphaned_profiles();

-- Create demo users for testing with proper auth integration
DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  manager_uuid UUID := gen_random_uuid();
  staff_uuid UUID := gen_random_uuid();
BEGIN
  -- Create admin user
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
    'admin@priorityautomotive.com', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
    '{"full_name": "System Administrator", "role": "admin", "department": "Administration"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  );
  
  -- Create manager user
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
    'manager@priorityautomotive.com', crypt('manager123', gen_salt('bf', 10)), now(), now(), now(),
    '{"full_name": "Department Manager", "role": "manager", "department": "Operations"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  );
  
  -- Create staff user
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
    'staff@priorityautomotive.com', crypt('staff123', gen_salt('bf', 10)), now(), now(), now(),
    '{"full_name": "Staff Member", "role": "staff", "department": "Sales Person"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Demo users already exist, skipping creation';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating demo users: %', SQLERRM;
END $$;