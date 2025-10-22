-- Set a safe, explicit search_path for all public functions that currently do not define one.
-- This addresses Supabase lint: function_search_path_mutable (0011)
-- Strategy: ALTER FUNCTION ... SET search_path = public
-- - Keeps name resolution predictable and avoids role-controlled path hijacking.
-- - Applies to both SECURITY INVOKER and SECURITY DEFINER functions.

DO $$
DECLARE
  r RECORD;
  cmd text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS kv
        WHERE kv LIKE 'search_path=%'
      )
  LOOP
    cmd := format('ALTER FUNCTION %I.%I(%s) SET search_path = %I', r.schema, r.name, r.args, 'public');
    EXECUTE cmd;
  END LOOP;
END $$;
