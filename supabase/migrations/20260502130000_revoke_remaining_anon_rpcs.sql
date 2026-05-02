-- 2026-05-02: Complete the PUBLIC grant revocation for 5 SECURITY DEFINER functions.
--
-- Context: Migration 20260502041504 revoked FROM anon on these functions, but Postgres also
-- automatically grants EXECUTE TO PUBLIC when a function is created (unless explicitly revoked).
-- The anon role inherits from PUBLIC, so revoking FROM anon alone is insufficient if the PUBLIC
-- grant is still present on a fresh DB replay — a new role inheriting PUBLIC would still have
-- execute access. This migration closes that gap by revoking FROM PUBLIC and explicitly granting
-- TO authenticated so legitimate app paths are unambiguous.
--
-- Rule 15 (replayability): REVOKE and GRANT are idempotent. Re-running on a DB that already had
-- these statements applied is a safe no-op. The DO verification block is read-only.
--
-- Rule 16 (Anon-Grant Burden of Proof): None of the 5 functions have a documented anon caller
-- path or a data-exposure justification. All are dead code or internal-only. No replacement
-- anon grant is warranted.
--
-- Functions and threat closed by each revocation:
--
--   1. enqueue_sms_notification(text, text, jsonb, integer)
--      PUBLIC grant (from 20241231000000_calendar_first_sms_system.sql).
--      An anon caller could queue SMS messages to arbitrary phone numbers via the PostgREST RPC
--      endpoint, enabling SMS spam or phone number probing at zero auth cost.
--
--   2. get_vendor_availability(uuid, date, time, integer)
--      PUBLIC grant (from 20241231000000_calendar_first_sms_system.sql).
--      Exposes vendor scheduling slots and capacity data to unauthenticated callers. Missed in the
--      20260113203000 harden sweep. No public-facing calendar feature justifies this exposure.
--
--   3. mark_loaner_returned(uuid)
--      PUBLIC grant (from 20250117120000_add_loaner_assignments.sql). SECURITY DEFINER.
--      An anon caller can mark any loaner vehicle assignment as returned given a guessable or
--      enumerated UUID, corrupting loaner records and triggering false availability signals.
--
--   4. is_legitimate_employee(uuid)
--      PUBLIC grant (from 20250113180000_comprehensive_demo_cleanup.sql).
--      Returns a boolean confirming whether a given UUID belongs to a staff record. Allows anon
--      callers to enumerate staff UUIDs by binary probing the endpoint.
--
--   5. get_dropdown_users(text, text)
--      Authenticated grant in the defining migration, but PostgREST inherits PUBLIC by default
--      unless the function was created with SECURITY INVOKER and no PUBLIC grant present.
--      Dead code: confirmed absent from all src/ client paths. Revoke to shrink surface area.
--
--   6. check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid)
--      Migration 20260502041504 revoked FROM anon but did NOT revoke FROM PUBLIC. The anon role
--      inherits PUBLIC, so anon can still call this function via the inherited grant.
--      Threat: calendar overlap check exposes appointment slot occupancy to unauthenticated
--      callers. An attacker can probe any vehicle UUID across arbitrary time windows to
--      reconstruct the shop's booking density, identify available slots, and infer customer
--      appointment patterns — all without credentials.

-- ---------------------------------------------------------------------------
-- 1. enqueue_sms_notification
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.enqueue_sms_notification(text, text, jsonb, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_sms_notification(text, text, jsonb, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.enqueue_sms_notification(text, text, jsonb, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_vendor_availability
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_vendor_availability(uuid, date, time, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_availability(uuid, date, time, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_vendor_availability(uuid, date, time, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. mark_loaner_returned
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.mark_loaner_returned(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_loaner_returned(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_loaner_returned(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. is_legitimate_employee
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_legitimate_employee(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_legitimate_employee(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_legitimate_employee(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_dropdown_users
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_dropdown_users(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dropdown_users(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_dropdown_users(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. check_vehicle_overlap
--    20260502041504 revoked FROM anon but left the PUBLIC grant intact.
--    Closing the PUBLIC gap here; explicit authenticated grant preserves the
--    legitimate app path (booking overlap validation for logged-in users).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verification: fail fast if anon still has execute on any of the 6 functions.
-- has_function_privilege checks effective privilege (including role inheritance),
-- so a residual PUBLIC grant would be caught here.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.enqueue_sms_notification(text, text, jsonb, integer)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on enqueue_sms_notification';
  END IF;

  IF has_function_privilege('anon', 'public.get_vendor_availability(uuid, date, time, integer)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on get_vendor_availability';
  END IF;

  IF has_function_privilege('anon', 'public.mark_loaner_returned(uuid)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on mark_loaner_returned';
  END IF;

  IF has_function_privilege('anon', 'public.is_legitimate_employee(uuid)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on is_legitimate_employee';
  END IF;

  IF has_function_privilege('anon', 'public.get_dropdown_users(text, text)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on get_dropdown_users';
  END IF;

  IF has_function_privilege('anon', 'public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid)', 'execute') THEN
    RAISE EXCEPTION 'REVOKE failed: anon still has execute on check_vehicle_overlap';
  END IF;

  RAISE NOTICE 'PUBLIC + anon REVOKE confirmed on all 6 functions: enqueue_sms_notification, get_vendor_availability, mark_loaner_returned, is_legitimate_employee, get_dropdown_users, check_vehicle_overlap';
END $$;
