-- Guarded migration to attach a known user to the org for RLS-compliant writes
-- Safe to re-run: uses ON CONFLICT and conditional checks.

DO $$
DECLARE
  v_org uuid;
  v_user uuid;
  v_user2 uuid;
BEGIN
  -- Ensure org exists
  INSERT INTO public.organizations(name)
  VALUES ('Priority Lexus VB')
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO v_org FROM public.organizations WHERE name = 'Priority Lexus VB';

  -- Find the auth users by email (adjust emails if needed)
  SELECT id INTO v_user FROM auth.users WHERE email = 'rob.brasco@priorityautomotive.com';
  SELECT id INTO v_user2 FROM auth.users WHERE email = 'ashley.terminello@priorityautomotive.com';

  IF v_user IS NOT NULL AND v_org IS NOT NULL THEN
    -- Ensure a user_profiles row exists for this auth user
    INSERT INTO public.user_profiles (id, email, full_name, is_active, created_at, updated_at, role)
    SELECT
      u.id,
      u.email,
      COALESCE((u.raw_user_meta_data ->> 'full_name'), 'E2E User'),
      true,
      NOW(),
      NOW(),
      COALESCE((SELECT up.role FROM public.user_profiles up WHERE up.id = u.id), 'staff'::public.user_role)
    FROM auth.users u
    WHERE u.id = v_user
    ON CONFLICT (id) DO NOTHING;

    -- Attach to org and activate
    UPDATE public.user_profiles
    SET org_id = v_org,
        is_active = true,
        updated_at = NOW()
    WHERE id = v_user;
  END IF;

  IF v_user2 IS NOT NULL AND v_org IS NOT NULL THEN
    -- Ensure a user_profiles row exists for Ashley
    INSERT INTO public.user_profiles (id, email, full_name, is_active, created_at, updated_at, role)
    SELECT
      u.id,
      u.email,
      COALESCE((u.raw_user_meta_data ->> 'full_name'), 'E2E Admin 2'),
      true,
      NOW(),
      NOW(),
      COALESCE((SELECT up.role FROM public.user_profiles up WHERE up.id = u.id), 'admin'::public.user_role)
    FROM auth.users u
    WHERE u.id = v_user2
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_profiles
    SET org_id = v_org,
        is_active = true,
        role = 'admin'::public.user_role,
        updated_at = NOW()
    WHERE id = v_user2;
  END IF;
END $$;

-- Optional: tag global rows to the org for immediate counts (idempotent)
UPDATE public.vendors      SET org_id = (SELECT id FROM public.organizations WHERE name='Priority Lexus VB') WHERE org_id IS NULL;
UPDATE public.products     SET org_id = (SELECT id FROM public.organizations WHERE name='Priority Lexus VB') WHERE org_id IS NULL;
UPDATE public.transactions SET org_id = (SELECT id FROM public.organizations WHERE name='Priority Lexus VB') WHERE org_id IS NULL;
UPDATE public.vehicles     SET org_id = (SELECT id FROM public.organizations WHERE name='Priority Lexus VB') WHERE org_id IS NULL;

-- Ensure all active staff are assigned to the org if missing (they might not have auth accounts)
UPDATE public.user_profiles up
SET org_id = (SELECT id FROM public.organizations WHERE name='Priority Lexus VB'),
    is_active = COALESCE(is_active, true),
    updated_at = NOW()
WHERE up.org_id IS NULL AND (up.is_active IS DISTINCT FROM false);
