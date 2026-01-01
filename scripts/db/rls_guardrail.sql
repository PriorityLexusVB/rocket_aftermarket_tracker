-- Guardrail: DEALER_ID / auth_dealer_id() canon
--
-- This is intended to be executed against a Supabase Postgres database.
-- It fails fast (RAISE EXCEPTION) when the schema/RLS drifts from canon.

DO $$
DECLARE
  missing int;
BEGIN
  -- 1) Required function exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_dealer_id'
  ) THEN
    RAISE EXCEPTION 'RLS_CANON: missing function public.auth_dealer_id()';
  END IF;

  -- 2) Required columns exist (dealer_id) on core tables
  WITH required(table_name) AS (
    SELECT unnest(ARRAY[
      'user_profiles','jobs','job_parts','vehicles','vendors','products','sms_templates',
      'transactions','communications','loaner_assignments','claims','claim_attachments'
    ])
  )
  SELECT COUNT(*) INTO missing
  FROM required r
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=r.table_name AND c.column_name='dealer_id'
  );

  IF missing > 0 THEN
    RAISE EXCEPTION 'RLS_CANON: missing dealer_id column on % core tables', missing;
  END IF;

  -- 3) org_id should not exist on canonical tables
  WITH canonical(table_name) AS (
    SELECT unnest(ARRAY[
      'user_profiles','jobs','job_parts','vehicles','vendors','products','sms_templates',
      'transactions','communications','loaner_assignments','claims','claim_attachments'
    ])
  )
  SELECT COUNT(*) INTO missing
  FROM canonical t
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='org_id'
  );

  IF missing > 0 THEN
    RAISE EXCEPTION 'RLS_CANON: found org_id column on % canonical tables', missing;
  END IF;

  -- 4) RLS enabled on canonical tables
  WITH canonical(table_name) AS (
    SELECT unnest(ARRAY[
      'activity_history','claim_attachments','claims','communications','filter_presets','job_parts','jobs',
      'loaner_assignments','notification_outbox','notification_preferences','organizations','products',
      'sms_opt_outs','sms_templates','transactions','user_profiles','vehicles','vendor_hours','vendors'
    ])
  )
  SELECT COUNT(*) INTO missing
  FROM canonical t
  JOIN pg_class c ON c.relname=t.table_name
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
  WHERE c.relrowsecurity IS NOT TRUE;

  IF missing > 0 THEN
    RAISE EXCEPTION 'RLS_CANON: RLS not enabled on % tables', missing;
  END IF;

  RAISE NOTICE 'RLS_CANON: OK';
END $$;
