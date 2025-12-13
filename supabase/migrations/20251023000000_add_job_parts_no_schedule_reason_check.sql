-- Enforce business rule at DB layer:
-- If requires_scheduling is false, no_schedule_reason must be non-empty
-- Use NOT VALID initially to avoid failing on existing bad rows; validate later after cleanup.

DO $$
BEGIN
  IF to_regclass('public.job_parts') IS NULL THEN
    RAISE NOTICE 'job_parts table not found, skipping job_parts_no_schedule_reason_chk';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name IN ('requires_scheduling', 'no_schedule_reason')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) THEN
    RAISE NOTICE 'job_parts missing requires_scheduling/no_schedule_reason columns, skipping job_parts_no_schedule_reason_chk';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'job_parts'
      AND c.conname = 'job_parts_no_schedule_reason_chk'
  ) THEN
    RAISE NOTICE 'Constraint job_parts_no_schedule_reason_chk already exists, skipping';
    RETURN;
  END IF;

  EXECUTE $$
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_no_schedule_reason_chk
    CHECK (
      requires_scheduling
      OR (
        NOT requires_scheduling
        AND COALESCE(NULLIF(trim(no_schedule_reason), ''), NULL) IS NOT NULL
      )
    ) NOT VALID
  $$;
END $$;

-- To validate later (optional, may fail if existing rows violate):
-- ALTER TABLE public.job_parts VALIDATE CONSTRAINT job_parts_no_schedule_reason_chk;
