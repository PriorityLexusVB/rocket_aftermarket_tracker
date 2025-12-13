-- Relax user_profiles schema to allow staff without email/auth user
-- and add optional linkage to auth.users for authenticated accounts.

-- 1) Drop strict FK from user_profiles.id to auth.users(id)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- 2) Make email optional (NULL allowed). Keep UNIQUE; Postgres allows multiple NULLs.
ALTER TABLE public.user_profiles ALTER COLUMN email DROP NOT NULL;

-- 3) Ensure id can be generated for non-auth-backed staff
DO $$
BEGIN
  -- Only set a default if one is not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
    WHERE n.nspname = 'public' AND c.relname = 'user_profiles' AND a.attname = 'id'
  ) THEN
    ALTER TABLE public.user_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Best effort; continue even if default already exists
  NULL;
END $$;

-- 4) Add optional auth_user_id that links to auth.users when present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);

-- 5) Backfill auth_user_id for existing rows (legacy rows had id == auth.users.id)
UPDATE public.user_profiles up
SET auth_user_id = up.id
WHERE auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = up.id);

-- 6) Update helper to recognize admin via either id or auth_user_id
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  -- Check auth.users metadata quickly
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' IN ('admin','manager') OR
      au.raw_app_meta_data->>'role' IN ('admin','manager')
    )
) OR EXISTS (
  -- Or check user_profiles by id or auth_user_id linkage
  SELECT 1 FROM public.user_profiles up
  WHERE (up.id = auth.uid() OR up.auth_user_id = auth.uid())
    AND up.role IN ('admin','manager')
);
$$;

-- 7) Ensure the auth user trigger populates auth_user_id too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, auth_user_id, email, full_name, role, department, is_active)
  VALUES (
    NEW.id,
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
    UPDATE public.user_profiles 
    SET 
      auth_user_id = COALESCE(auth_user_id, NEW.id),
      email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      role = COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, role),
      department = COALESCE(NEW.raw_user_meta_data->>'department', department),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id OR auth_user_id = NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;
