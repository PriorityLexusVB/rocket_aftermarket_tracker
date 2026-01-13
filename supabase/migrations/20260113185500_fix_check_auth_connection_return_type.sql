-- Fix PROD migration failure: cannot change return type of existing function
--
-- Some environments have an existing public.check_auth_connection() with a
-- different return type than our canonical boolean version used by health
-- checks. Postgres does not allow CREATE OR REPLACE to change a function's
-- return type.
--
-- This migration is safe and idempotent:
-- - Drops the no-arg function if it exists (regardless of return type)
-- - Recreates it with RETURNS boolean

DROP FUNCTION IF EXISTS public.check_auth_connection();

CREATE FUNCTION public.check_auth_connection()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;
