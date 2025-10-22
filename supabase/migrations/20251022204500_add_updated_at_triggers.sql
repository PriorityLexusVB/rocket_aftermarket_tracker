-- Adds/ensures a standard updated_at trigger across selected tables.
-- Safe to run multiple times; guards ensure idempotency.

-- 1) Create the timestamp trigger function if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trigger_set_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    COMMENT ON FUNCTION public.trigger_set_timestamp() IS 'Standard BEFORE UPDATE trigger to refresh updated_at';
  END IF;
END $$;

-- Helper to attach trigger if table has updated_at and trigger not already present
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'filter_presets',
      'notification_preferences',
      'products',
      'sms_templates',
      'transactions',
      'vehicles',
      'vendors'
    ]) AS tbl
  LOOP
    -- Only attach when column updated_at exists
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = r.tbl
        AND c.column_name = 'updated_at'
    ) THEN
      -- Create trigger name convention: set_timestamp_<table>
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class rel ON rel.oid = t.tgrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = 'public'
          AND rel.relname = r.tbl
          AND t.tgname = format('set_timestamp_%s', r.tbl)
      ) THEN
        EXECUTE format(
          'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp()',
          format('set_timestamp_%s', r.tbl), r.tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;
