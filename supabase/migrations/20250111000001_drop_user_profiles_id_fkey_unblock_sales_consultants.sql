-- Unblock 20250111050000_restore_complete_priority_automotive_data.sql
--
-- That migration inserts staff directory rows into public.user_profiles with
-- gen_random_uuid() IDs. If public.user_profiles.id is (still) constrained to
-- auth.users(id) via user_profiles_id_fkey, the insert fails.
--
-- This migration is intentionally minimal and idempotent: it drops the legacy
-- FK constraint (if present) so staff directory entries can exist without
-- corresponding auth users.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
