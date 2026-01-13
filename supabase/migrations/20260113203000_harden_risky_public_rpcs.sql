-- Migration: Harden risky public RPCs (revoke anon/public execute; prefer invoker)
-- Date: 2026-01-13
-- Purpose:
--   The access audit found multiple SECURITY DEFINER RPCs callable by anon/PUBLIC.
--   Because core tables are not FORCE RLS, SECURITY DEFINER can bypass RLS and leak
--   cross-tenant data. This migration is forward-only and idempotent:
--     - Revoke EXECUTE from PUBLIC + anon
--     - Grant EXECUTE to authenticated only
--     - Convert read-style RPCs to SECURITY INVOKER so RLS applies
--
-- Guardrails:
--   - No destructive DDL
--   - No historical migration edits
--   - Keep scope minimal and reversible

-- =============================================================================
-- 1) Convert data-returning RPCs to SECURITY INVOKER (RLS applies to caller)
-- =============================================================================

ALTER FUNCTION public.get_overdue_jobs() SECURITY INVOKER;
ALTER FUNCTION public.get_jobs_by_date_range(
  start_date timestamptz,
  end_date timestamptz,
  vendor_filter uuid,
  status_filter text
) SECURITY INVOKER;
ALTER FUNCTION public.get_vendor_vehicles(vendor_uuid uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_vendor_schedule_conflict(
  vendor_uuid uuid,
  start_time timestamptz,
  end_time timestamptz,
  exclude_job_id uuid
) SECURITY INVOKER;

-- log_activity writes and should still be invoker-safe (RLS + grants apply).
ALTER FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb,
  p_new_values jsonb
) SECURITY INVOKER;

-- Pure helper; security mode not important but keep consistent.
ALTER FUNCTION public.validate_status_progression(current_status text, new_status text) SECURITY INVOKER;

-- generate_job_number needs sequence access; keep SECURITY DEFINER but remove anon/public EXECUTE.
-- (Do not change its security mode here.)

-- =============================================================================
-- 2) Restrict EXECUTE privileges (authenticated only)
-- =============================================================================

-- get_overdue_jobs()
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_overdue_jobs() TO authenticated;

-- get_jobs_by_date_range(...)
REVOKE EXECUTE ON FUNCTION public.get_jobs_by_date_range(
  start_date timestamptz,
  end_date timestamptz,
  vendor_filter uuid,
  status_filter text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_jobs_by_date_range(
  start_date timestamptz,
  end_date timestamptz,
  vendor_filter uuid,
  status_filter text
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_jobs_by_date_range(
  start_date timestamptz,
  end_date timestamptz,
  vendor_filter uuid,
  status_filter text
) TO authenticated;

-- get_vendor_vehicles(vendor_uuid uuid)
REVOKE EXECUTE ON FUNCTION public.get_vendor_vehicles(vendor_uuid uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_vehicles(vendor_uuid uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_vendor_vehicles(vendor_uuid uuid) TO authenticated;

-- check_vendor_schedule_conflict(...)
REVOKE EXECUTE ON FUNCTION public.check_vendor_schedule_conflict(
  vendor_uuid uuid,
  start_time timestamptz,
  end_time timestamptz,
  exclude_job_id uuid
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_vendor_schedule_conflict(
  vendor_uuid uuid,
  start_time timestamptz,
  end_time timestamptz,
  exclude_job_id uuid
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.check_vendor_schedule_conflict(
  vendor_uuid uuid,
  start_time timestamptz,
  end_time timestamptz,
  exclude_job_id uuid
) TO authenticated;

-- log_activity(...)
REVOKE EXECUTE ON FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb,
  p_new_values jsonb
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb,
  p_new_values jsonb
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb,
  p_new_values jsonb
) TO authenticated;

-- validate_status_progression(...)
REVOKE EXECUTE ON FUNCTION public.validate_status_progression(current_status text, new_status text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_status_progression(current_status text, new_status text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.validate_status_progression(current_status text, new_status text) TO authenticated;

-- generate_job_number()
REVOKE EXECUTE ON FUNCTION public.generate_job_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_job_number() FROM anon;
GRANT  EXECUTE ON FUNCTION public.generate_job_number() TO authenticated;

-- =============================================================================
-- 3) PostgREST schema cache reload
-- =============================================================================

NOTIFY pgrst, 'reload schema';
