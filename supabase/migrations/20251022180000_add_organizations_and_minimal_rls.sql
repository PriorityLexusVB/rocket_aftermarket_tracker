-- organizations + minimal tenant read RLS
-- Created: 2025-10-22

-- Safety: required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Create organizations table (idempotent)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Add org_id to user_profiles (idempotent)
alter table if exists public.user_profiles
  add column if not exists org_id uuid null references public.organizations(id);

create index if not exists user_profiles_org_id_idx
  on public.user_profiles(org_id);

-- Optional: seed a default org for Priority Lexus VB
insert into public.organizations (name)
select 'Priority Lexus VB'
where not exists (select 1 from public.organizations where name = 'Priority Lexus VB');

-- NOTE: Attach your auth user to the org manually, replacing placeholders.
-- Example (uncomment & replace):
-- update public.user_profiles set org_id = (select id from public.organizations where name='Priority Lexus VB'), is_active = true
-- where id = '00000000-0000-0000-0000-000000000000'; -- <-- replace with your auth.uid


-- Minimal read RLS policies (tenant-aware SELECT)
-- These blocks are idempotent: they only create the policy if missing.

-- Ensure RLS is enabled (safe if already enabled)
alter table if exists public.user_profiles enable row level security;
alter table if exists public.vendors enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.sms_templates enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.job_parts enable row level security;
alter table if exists public.vehicles enable row level security;

-- Own profile read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='own profile read'
  ) THEN
    CREATE POLICY "own profile read" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());
  END IF;
END$$;

-- Org read vendors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='org read vendors'
  ) THEN
    CREATE POLICY "org read vendors" ON public.vendors
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid()));
  END IF;
END$$;

-- Org read products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='org read products'
  ) THEN
    CREATE POLICY "org read products" ON public.products
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid()));
  END IF;
END$$;

-- Org read sms_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sms_templates' AND policyname='org read sms templates'
  ) THEN
    CREATE POLICY "org read sms templates" ON public.sms_templates
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid()));
  END IF;
END$$;

-- Org read transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='org read transactions'
  ) THEN
    CREATE POLICY "org read transactions" ON public.transactions
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid()));
  END IF;
END$$;

-- Org read jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND policyname='org read jobs'
  ) THEN
    CREATE POLICY "org read jobs" ON public.jobs
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid()));
  END IF;
END$$;

-- Org read job_parts via jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_parts' AND policyname='org read job_parts via jobs'
  ) THEN
    CREATE POLICY "org read job_parts via jobs" ON public.job_parts
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_parts.job_id
        AND j.org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid())
    ));
  END IF;
END$$;

-- Org read vehicles via jobs (if vehicles has no org_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='org read vehicles via jobs'
  ) THEN
    CREATE POLICY "org read vehicles via jobs" ON public.vehicles
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.vehicle_id = vehicles.id
        AND j.org_id = (SELECT org_id FROM public.user_profiles p WHERE p.id = auth.uid())
    ));
  END IF;
END$$;
