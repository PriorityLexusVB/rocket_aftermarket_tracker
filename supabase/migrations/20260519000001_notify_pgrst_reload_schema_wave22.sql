-- Force PostgREST schema cache reload.
-- Created: 2026-05-19
--
-- Context: rls-drift-nightly.yml failed 5/16-5/19 with
-- "Schema cache verification failed". verify-schema-cache.sh probes:
--   /rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1
-- A "Could not find a relationship" response means PostgREST's in-memory
-- schema cache does not reflect the live job_parts.vendor_id -> vendors.id FK.
--
-- Migrations 20260430000001 through 20260502160000 modified schema (RLS
-- policies, columns, indexes, REVOKE/GRANT) without a trailing NOTIFY. A
-- Supabase PostgREST restart since 5/16 then loaded a stale cache state.
--
-- Rule 15 (replayability): NOTIFY is a runtime signal with no persistent
-- state; re-running it is always safe and idempotent.
-- Rule 16 (anon-grant): no grants in this migration.

NOTIFY pgrst, 'reload schema';
