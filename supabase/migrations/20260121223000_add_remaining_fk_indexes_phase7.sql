-- Phase 7: Add remaining FK covering indexes still flagged by performance advisors
-- Guardrails: additive only; uses IF NOT EXISTS; safe to re-run in non-prod

begin;

-- claim_attachments.uploaded_by -> user_profiles.id
create index if not exists idx_claim_attachments_uploaded_by
  on public.claim_attachments (uploaded_by);

-- claims.* foreign keys
create index if not exists idx_claims_assigned_to
  on public.claims (assigned_to);

create index if not exists idx_claims_product_id
  on public.claims (product_id);

create index if not exists idx_claims_submitted_by
  on public.claims (submitted_by);

create index if not exists idx_claims_vehicle_id
  on public.claims (vehicle_id);

-- loaner_assignments.job_id -> jobs.id
create index if not exists idx_loaner_assignments_job_id
  on public.loaner_assignments (job_id);

-- sms_templates.created_by -> user_profiles.id
create index if not exists idx_sms_templates_created_by
  on public.sms_templates (created_by);

-- vehicle_products.created_by -> user_profiles.id
create index if not exists idx_vehicle_products_created_by
  on public.vehicle_products (created_by);

analyze public.claim_attachments;
analyze public.claims;
analyze public.loaner_assignments;
analyze public.sms_templates;
analyze public.vehicle_products;

commit;
