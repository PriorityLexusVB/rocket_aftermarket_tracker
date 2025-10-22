-- Basic write policies for jobs and job_parts by org
-- Created: 2025-10-22

-- Helper to resolve caller org
create or replace function auth_user_org()
returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.user_profiles where id = auth.uid();
$$;

-- Ensure RLS is enabled (idempotent)
alter table if exists public.jobs enable row level security;
alter table if exists public.job_parts enable row level security;

-- Jobs: allow insert when org_id matches caller's org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND polname='org can insert jobs'
  ) THEN
    CREATE POLICY "org can insert jobs" ON public.jobs
    FOR INSERT TO authenticated
    WITH CHECK (org_id = auth_user_org());
  END IF;
END$$;

-- Jobs: allow update for same org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND polname='org can update jobs'
  ) THEN
    CREATE POLICY "org can update jobs" ON public.jobs
    FOR UPDATE TO authenticated
    USING (org_id = auth_user_org())
    WITH CHECK (org_id = auth_user_org());
  END IF;
END$$;

-- Job parts: allow insert only when parent job is caller's org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_parts' AND polname='org can insert job_parts via jobs'
  ) THEN
    CREATE POLICY "org can insert job_parts via jobs" ON public.job_parts
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_parts.job_id AND j.org_id = auth_user_org()
    ));
  END IF;
END$$;

-- Job parts: allow update only when parent job is caller's org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_parts' AND polname='org can update job_parts via jobs'
  ) THEN
    CREATE POLICY "org can update job_parts via jobs" ON public.job_parts
    FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_parts.job_id AND j.org_id = auth_user_org()
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_parts.job_id AND j.org_id = auth_user_org()
    ));
  END IF;
END$$;
