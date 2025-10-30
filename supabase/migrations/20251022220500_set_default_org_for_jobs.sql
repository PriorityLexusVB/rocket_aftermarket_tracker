-- Ensure NEW.jobs.org_id defaults to caller's org when not provided
-- This helps satisfy RLS WITH CHECK policies when UI omits org_id

CREATE OR REPLACE FUNCTION public.set_default_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := auth_user_org();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'bi_jobs_set_default_org_id'
      AND n.nspname = 'public'
      AND c.relname = 'jobs'
  ) THEN
    CREATE TRIGGER bi_jobs_set_default_org_id
    BEFORE INSERT ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_org_id();
  END IF;
END $$;
