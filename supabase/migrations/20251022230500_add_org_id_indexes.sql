-- Add org_id indexes for tenant-scoped performance
-- Created: 2025-10-22

-- Create indexes only if the column exists
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY['user_profiles','vendors','products','transactions','vehicles','jobs','job_parts','claims','claim_attachments']) AS tbl
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = 'org_id'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', 'idx_'||r.tbl||'_org_id', r.tbl);
    END IF;
  END LOOP;
END $$;
