-- Guarded migration: enable RLS and add SELECT policy for loaner_assignments
-- Allows select when the related job belongs to the caller's org via auth_user_org()

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'loaner_assignments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'loaner_assignments' AND c.relrowsecurity
    ) THEN
      EXECUTE 'ALTER TABLE public.loaner_assignments ENABLE ROW LEVEL SECURITY';
    END IF;
  ELSE
    RAISE NOTICE 'loaner_assignments table not found, skipping RLS enable';
  END IF;
END
$$;

-- Add SELECT policy if not present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'loaner_assignments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = 'loaner_assignments' AND p.policyname = 'org_can_select_loaners_by_job_org'
    ) THEN
      EXECUTE $$
        CREATE POLICY "org_can_select_loaners_by_job_org"
        ON public.loaner_assignments
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = loaner_assignments.job_id
              AND j.org_id = auth_user_org()
          )
        );
      $$;
    END IF;
  END IF;
END
$$;

-- Helpful index for the join
CREATE INDEX IF NOT EXISTS loaner_assignments_job_id_idx ON public.loaner_assignments(job_id);
