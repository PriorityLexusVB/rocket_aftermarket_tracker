-- Revoke anon execute on schema-introspection wrapper functions.
-- Created: 2026-05-02
--
-- Source of the grants:
--   Migration 20260113190000_repair_missing_feature_tables_and_health_rpcs.sql
--   created three wrapper functions and explicitly granted EXECUTE TO anon:
--
--     GRANT EXECUTE ON FUNCTION public.pg_indexes() TO anon;            (line 68)
--     GRANT EXECUTE ON FUNCTION public.pg_matviews() TO anon;           (line 89)
--     GRANT EXECUTE ON FUNCTION public.pg_available_extensions() TO anon; (line 47)
--
--   None of these grants were revoked by the subsequent harden sweep
--   (20260113203000_harden_risky_public_rpcs.sql) or the 20260502 anon-revoke
--   series (20260502041503, 20260502041504, 20260502130000).
--
-- Threat closed:
--   All three functions expose internal DB schema information to unauthenticated
--   callers via the PostgREST /rpc/* endpoint using a Supabase anon key:
--
--   - public.pg_indexes(): returns schemaname, tablename, indexname, indexdef for
--     every index in the 'public' schema. An unauthenticated caller learns the full
--     index surface — column names, composite key order, partial predicates — which
--     accelerates targeted injection probing and reveals data model internals that
--     should be private.
--
--   - public.pg_matviews(): returns all materialized view names, definitions, and
--     population state. Leaks query logic and schema structure to anon callers.
--
--   - public.pg_available_extensions(): returns installed Postgres extensions and
--     versions. Helps an attacker enumerate which extension-specific attack vectors
--     (e.g. pgcrypto, hstore, plv8) are present and what version is running.
--
-- Per Rule 16 (Anon-Grant Burden of Proof):
--   No client path in the app invokes any of these three functions with an anon JWT.
--   The /api/health/performance endpoint that consumes them is a backend health check
--   called with service-role credentials, not via the public PostgREST surface.
--   No 2-sentence anon justification exists in any migration comment block for these
--   grants. Revoking from both anon and PUBLIC; re-granting to authenticated so
--   the health-check path (if it ever used PostgREST with an authenticated JWT) is
--   uninterrupted.
--
-- Rule 15 (replayability): REVOKE and GRANT are idempotent. Re-running on a DB
--   where anon already lacks the grant is a no-op. Safe against fresh DB replay.
-- Rule 16 (anon-grant): No new anon grants introduced.

-- -----------------------------------------------------------------------
-- 1. public.pg_indexes()
--    Granted to anon in 20260113190000 line 68; not yet revoked.
-- -----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.pg_indexes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_indexes() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pg_indexes() TO authenticated;

-- -----------------------------------------------------------------------
-- 2. public.pg_matviews()
--    Granted to anon in 20260113190000 line 89; not yet revoked.
-- -----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.pg_matviews() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_matviews() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pg_matviews() TO authenticated;

-- -----------------------------------------------------------------------
-- 3. public.pg_available_extensions()
--    Granted to anon in 20260113190000 line 47; not yet revoked.
-- -----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.pg_available_extensions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_available_extensions() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pg_available_extensions() TO authenticated;

-- -----------------------------------------------------------------------
-- Verification: fail fast if anon still has execute on any of the three.
-- has_function_privilege checks effective privilege including role
-- inheritance, so a residual PUBLIC grant would be caught here.
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.pg_indexes()', 'execute') THEN
    RAISE EXCEPTION
      'REVOKE failed: anon still has execute on public.pg_indexes(). '
      'Check for residual PUBLIC grant or a new conflicting GRANT statement.';
  END IF;

  IF has_function_privilege('anon', 'public.pg_matviews()', 'execute') THEN
    RAISE EXCEPTION
      'REVOKE failed: anon still has execute on public.pg_matviews(). '
      'Check for residual PUBLIC grant or a new conflicting GRANT statement.';
  END IF;

  IF has_function_privilege('anon', 'public.pg_available_extensions()', 'execute') THEN
    RAISE EXCEPTION
      'REVOKE failed: anon still has execute on public.pg_available_extensions(). '
      'Check for residual PUBLIC grant or a new conflicting GRANT statement.';
  END IF;

  RAISE NOTICE
    'VERIFIED: anon execute revoked on pg_indexes(), pg_matviews(), pg_available_extensions()';
END $$;
