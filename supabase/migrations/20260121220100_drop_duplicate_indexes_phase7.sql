-- Phase 7: Drop known duplicate indexes reported by Supabase performance advisors
-- Guardrails: destructive (index-only) but safe via IF EXISTS; does not change table data

begin;

-- jobs(delivery_coordinator_id): keep idx_jobs_delivery_coord (from comprehensive perf migration)
-- drop any duplicate with the long form name if present
drop index if exists public.idx_jobs_delivery_coordinator_id;

-- jobs(finance_manager_id): keep idx_jobs_finance_manager (from comprehensive perf migration)
drop index if exists public.idx_jobs_finance_manager_id;

-- vendors(is_active): keep idx_vendors_is_active
drop index if exists public.idx_vendors_active;

-- user_profiles(org_id): keep user_profiles_org_id_idx
drop index if exists public.idx_user_profiles_org_id;

analyze public.jobs;
analyze public.vendors;
analyze public.user_profiles;

commit;
