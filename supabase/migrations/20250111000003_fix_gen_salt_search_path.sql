-- Fix: some Supabase projects install pgcrypto into the "extensions" schema,
-- which makes functions like gen_salt() unavailable unless schema-qualified.
--
-- Older migrations call gen_salt() unqualified (e.g., crypt('pw', gen_salt('bf', 10))).
-- This creates a public wrapper so those migrations can run regardless of where
-- pgcrypto was installed.

DO $$
BEGIN
  -- If gen_salt is already available unqualified (via pg_catalog/public), do nothing.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'gen_salt'
      AND n.nspname IN ('pg_catalog', 'public')
  ) THEN
    RETURN;
  END IF;

  -- If pgcrypto lives in the extensions schema, add wrappers into public.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'gen_salt'
      AND n.nspname = 'extensions'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.gen_salt(type text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $body$ SELECT extensions.gen_salt($1); $body$;
    $sql$;

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.gen_salt(type text, iter integer)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $body$ SELECT extensions.gen_salt($1, $2); $body$;
    $sql$;
  END IF;
END $$;
