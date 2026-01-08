-- Fix: when pgcrypto is installed into the "extensions" schema, crypt() may not
-- be available unqualified. Older migrations call crypt() directly.

DO $$
BEGIN
  -- If crypt is already available unqualified (via pg_catalog/public), do nothing.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'crypt'
      AND n.nspname IN ('pg_catalog', 'public')
  ) THEN
    RETURN;
  END IF;

  -- If pgcrypto lives in the extensions schema, add a wrapper into public.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'crypt'
      AND n.nspname = 'extensions'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.crypt(password text, salt text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      AS $body$ SELECT extensions.crypt($1, $2); $body$;
    $sql$;
  END IF;
END $$;
