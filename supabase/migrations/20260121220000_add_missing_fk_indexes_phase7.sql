-- Phase 7: Add missing covering indexes for foreign keys
-- Guardrails: additive only; uses IF NOT EXISTS; safe to re-run in non-prod

begin;

-- FK: job_parts.product_id -> products.id
create index if not exists idx_job_parts_product_id
  on public.job_parts (product_id);

-- FK: loaner_assignments.org_id -> organizations.id
create index if not exists idx_loaner_assignments_org_id
  on public.loaner_assignments (org_id);

analyze public.job_parts;
analyze public.loaner_assignments;

commit;
