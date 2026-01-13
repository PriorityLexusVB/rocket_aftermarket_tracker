-- Migration: Repair missing feature tables + health RPC wrappers
-- Date: 2026-01-13
-- Purpose:
--   This environment shows migration versions recorded in `supabase_migrations.schema_migrations`
--   but several feature tables/RPCs are missing in the actual schema (claims, advanced features).
--   This migration is forward-only and idempotent: it (re)creates missing objects without
--   modifying historical migrations.
--
-- Guardrails:
--   - No destructive DDL
--   - No mock data inserts
--   - Prefer RLS-safe policies and avoid auth.users references in RLS

-- =============================================================================
-- 0) Health/diagnostic RPC wrappers used by /api/health/*
-- =============================================================================

-- check_auth_connection(): used by src/lib/supabase.js connection test; safe for anon.
CREATE OR REPLACE FUNCTION public.check_auth_connection()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;

REVOKE EXECUTE ON FUNCTION public.check_auth_connection() FROM public;
GRANT EXECUTE ON FUNCTION public.check_auth_connection() TO anon;
GRANT EXECUTE ON FUNCTION public.check_auth_connection() TO authenticated;

-- pg_available_extensions(): wrapper so PostgREST can call it via public RPC.
CREATE OR REPLACE FUNCTION public.pg_available_extensions()
RETURNS TABLE(
  name text,
  default_version text,
  installed_version text,
  comment text
)
LANGUAGE sql
STABLE
AS $$
  SELECT name, default_version, installed_version, comment
  FROM pg_catalog.pg_available_extensions;
$$;

REVOKE EXECUTE ON FUNCTION public.pg_available_extensions() FROM public;
GRANT EXECUTE ON FUNCTION public.pg_available_extensions() TO anon;
GRANT EXECUTE ON FUNCTION public.pg_available_extensions() TO authenticated;

-- pg_indexes(): wrapper used by /api/health/performance
CREATE OR REPLACE FUNCTION public.pg_indexes()
RETURNS TABLE(
  schemaname text,
  tablename text,
  indexname text,
  indexdef text
)
LANGUAGE sql
STABLE
AS $$
  SELECT schemaname, tablename, indexname, indexdef
  FROM pg_catalog.pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
$$;

REVOKE EXECUTE ON FUNCTION public.pg_indexes() FROM public;
GRANT EXECUTE ON FUNCTION public.pg_indexes() TO anon;
GRANT EXECUTE ON FUNCTION public.pg_indexes() TO authenticated;

-- pg_matviews(): wrapper used by /api/health/performance
CREATE OR REPLACE FUNCTION public.pg_matviews()
RETURNS TABLE(
  schemaname text,
  matviewname text,
  ispopulated boolean,
  definition text
)
LANGUAGE sql
STABLE
AS $$
  SELECT schemaname, matviewname, ispopulated, definition
  FROM pg_catalog.pg_matviews
  WHERE schemaname = 'public'
  ORDER BY matviewname;
$$;

REVOKE EXECUTE ON FUNCTION public.pg_matviews() FROM public;
GRANT EXECUTE ON FUNCTION public.pg_matviews() TO anon;
GRANT EXECUTE ON FUNCTION public.pg_matviews() TO authenticated;

-- =============================================================================
-- 1) Claims module (guest + staff)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'claim_status'
  ) THEN
    CREATE TYPE public.claim_status AS ENUM ('submitted','under_review','approved','denied','resolved');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'claim_priority'
  ) THEN
    CREATE TYPE public.claim_priority AS ENUM ('low','medium','high','urgent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid,
  org_id uuid,
  claim_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  issue_description text NOT NULL,
  preferred_resolution text,
  claim_amount numeric(10,2),
  status public.claim_status DEFAULT 'submitted'::public.claim_status,
  priority public.claim_priority DEFAULT 'medium'::public.claim_priority,
  submitted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS dealer_id uuid;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS org_id uuid;

CREATE TABLE IF NOT EXISTS public.claim_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  description text,
  uploaded_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_claim_number ON public.claims(claim_number);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON public.claims(created_at);
CREATE INDEX IF NOT EXISTS idx_claims_dealer_id ON public.claims(dealer_id);
CREATE INDEX IF NOT EXISTS idx_claims_org_id ON public.claims(org_id);
CREATE INDEX IF NOT EXISTS idx_claim_attachments_claim_id ON public.claim_attachments(claim_id);

-- Trigger helper: maintain updated_at + resolved_at.
CREATE OR REPLACE FUNCTION public.validate_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at = CURRENT_TIMESTAMP;
  END IF;

  IF NEW.status IS DISTINCT FROM 'resolved' AND OLD.status = 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;

  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'validate_claim_status_progression'
  ) THEN
    CREATE TRIGGER validate_claim_status_progression
    BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION public.validate_claim_status_change();
  END IF;
END $$;

-- Claim numbers: used by guest submission flow; safe to allow anon execute.
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'CLM-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' ||
         SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6);
$$;

REVOKE EXECUTE ON FUNCTION public.generate_claim_number() FROM public;
GRANT EXECUTE ON FUNCTION public.generate_claim_number() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_claim_number() TO authenticated;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_attachments ENABLE ROW LEVEL SECURITY;

-- Claims policies (idempotent)
DO $$
BEGIN
  -- Guest claim submission (anon INSERT)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claims' AND policyname='claims_guest_insert'
  ) THEN
    CREATE POLICY "claims_guest_insert" ON public.claims
      FOR INSERT TO anon
      WITH CHECK (
        customer_name IS NOT NULL
        AND NULLIF(TRIM(customer_name), '') IS NOT NULL
        AND customer_email IS NOT NULL
        AND NULLIF(TRIM(customer_email), '') IS NOT NULL
        AND issue_description IS NOT NULL
        AND NULLIF(TRIM(issue_description), '') IS NOT NULL
      );
  END IF;

  -- Staff can read claims in their org/dealer (or unscoped guest claims)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claims' AND policyname='claims_staff_select_scoped'
  ) THEN
    CREATE POLICY "claims_staff_select_scoped" ON public.claims
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND (
              (claims.dealer_id IS NULL AND claims.org_id IS NULL)
              OR (claims.dealer_id IS NOT NULL AND claims.dealer_id = up.dealer_id)
              OR (claims.org_id IS NOT NULL AND claims.org_id = up.org_id)
            )
        )
      );
  END IF;

  -- Customers (authenticated) can read their own claims by JWT email
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claims' AND policyname='claims_customer_select_own_email'
  ) THEN
    CREATE POLICY "claims_customer_select_own_email" ON public.claims
      FOR SELECT TO authenticated
      USING (
        customer_email = ((SELECT auth.jwt()) ->> 'email')
      );
  END IF;

  -- Staff updates: admin/manager OR assignee, tenant scoped
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claims' AND policyname='claims_staff_update_scoped'
  ) THEN
    CREATE POLICY "claims_staff_update_scoped" ON public.claims
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND (
              COALESCE(up.role::text, '') IN ('admin', 'manager')
              OR claims.assigned_to = (SELECT auth.uid())
            )
            AND (
              (claims.dealer_id IS NULL AND claims.org_id IS NULL)
              OR (claims.dealer_id IS NOT NULL AND claims.dealer_id = up.dealer_id)
              OR (claims.org_id IS NOT NULL AND claims.org_id = up.org_id)
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND (
              COALESCE(up.role::text, '') IN ('admin', 'manager')
              OR claims.assigned_to = (SELECT auth.uid())
            )
            AND (
              (claims.dealer_id IS NULL AND claims.org_id IS NULL)
              OR (claims.dealer_id IS NOT NULL AND claims.dealer_id = up.dealer_id)
              OR (claims.org_id IS NOT NULL AND claims.org_id = up.org_id)
            )
        )
      );
  END IF;
END $$;

-- Claim attachments policies
DO $$
BEGIN
  -- Guest uploads: allow anon INSERT of attachment rows for claim folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claim_attachments' AND policyname='claim_attachments_guest_insert'
  ) THEN
    CREATE POLICY "claim_attachments_guest_insert" ON public.claim_attachments
      FOR INSERT TO anon
      WITH CHECK (
        claim_id IS NOT NULL
        AND file_name IS NOT NULL
        AND file_path IS NOT NULL
        AND file_path ~ ('^claim-' || claim_id::text || '/.*')
      );
  END IF;

  -- Staff can read attachments for accessible claims
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claim_attachments' AND policyname='claim_attachments_staff_select'
  ) THEN
    CREATE POLICY "claim_attachments_staff_select" ON public.claim_attachments
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.claims c
          JOIN public.user_profiles up ON up.id = (SELECT auth.uid())
          WHERE c.id = claim_attachments.claim_id
            AND COALESCE(up.is_active, true)
            AND (
              (c.dealer_id IS NULL AND c.org_id IS NULL)
              OR (c.dealer_id IS NOT NULL AND c.dealer_id = up.dealer_id)
              OR (c.org_id IS NOT NULL AND c.org_id = up.org_id)
            )
        )
      );
  END IF;

  -- Customers can read attachments for their own claims (JWT email)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='claim_attachments' AND policyname='claim_attachments_customer_select'
  ) THEN
    CREATE POLICY "claim_attachments_customer_select" ON public.claim_attachments
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.claims c
          WHERE c.id = claim_attachments.claim_id
            AND c.customer_email = ((SELECT auth.jwt()) ->> 'email')
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 2) Advanced features tables (SMS templates, filter presets, notification prefs)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'template_type'
  ) THEN
    CREATE TYPE public.template_type AS ENUM (
      'job_status', 'overdue_alert', 'customer_notification', 'vendor_assignment', 'completion_notice'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'notification_method'
  ) THEN
    CREATE TYPE public.notification_method AS ENUM ('email', 'sms', 'desktop', 'in_app');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_type public.template_type NOT NULL,
  subject text,
  message_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  page_type text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  method public.notification_method NOT NULL,
  is_enabled boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON public.sms_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON public.sms_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_page ON public.filter_presets(user_id, page_type);
CREATE INDEX IF NOT EXISTS idx_filter_presets_public ON public.filter_presets(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- sms_templates: authenticated can read active; admin/manager can manage.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sms_templates' AND policyname='sms_templates_read_active'
  ) THEN
    CREATE POLICY "sms_templates_read_active" ON public.sms_templates
      FOR SELECT TO authenticated
      USING (COALESCE(is_active, true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sms_templates' AND policyname='sms_templates_admin_manage'
  ) THEN
    CREATE POLICY "sms_templates_admin_manage" ON public.sms_templates
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      );
  END IF;

  -- filter_presets: owner can manage; authenticated can read own + public.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='filter_presets' AND policyname='filter_presets_read_own_or_public'
  ) THEN
    CREATE POLICY "filter_presets_read_own_or_public" ON public.filter_presets
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()) OR is_public = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='filter_presets' AND policyname='filter_presets_owner_manage'
  ) THEN
    CREATE POLICY "filter_presets_owner_manage" ON public.filter_presets
      FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  -- notification_preferences: user manages own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_owner_manage'
  ) THEN
    CREATE POLICY "notification_preferences_owner_manage" ON public.notification_preferences
      FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3) Notification outbox (SMS queue)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid,
  phone_e164 text NOT NULL,
  message_template text NOT NULL,
  variables jsonb,
  not_before timestamptz DEFAULT CURRENT_TIMESTAMP,
  sent_at timestamptz,
  twilio_sid text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.notification_outbox ADD COLUMN IF NOT EXISTS dealer_id uuid;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON public.notification_outbox(not_before) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_outbox_phone ON public.notification_outbox(phone_e164);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notification_outbox' AND policyname='notification_outbox_admin_manage'
  ) THEN
    CREATE POLICY "notification_outbox_admin_manage" ON public.notification_outbox
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 4) Vehicle products (initial aftermarket assignments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  unit_price numeric,
  is_initial_assignment boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_products_vehicle_id ON public.vehicle_products(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_products_product_id ON public.vehicle_products(product_id);

ALTER TABLE public.vehicle_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='vehicle_products' AND policyname='vehicle_products_read_authenticated'
  ) THEN
    CREATE POLICY "vehicle_products_read_authenticated" ON public.vehicle_products
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='vehicle_products' AND policyname='vehicle_products_owner_or_admin_manage'
  ) THEN
    CREATE POLICY "vehicle_products_owner_or_admin_manage" ON public.vehicle_products
      FOR ALL TO authenticated
      USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
            AND COALESCE(up.is_active, true)
            AND COALESCE(up.role::text, '') IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 5) Advanced feature RPCs (RLS-safe: SECURITY INVOKER)
-- =============================================================================

-- Overdue jobs enhanced
CREATE OR REPLACE FUNCTION public.get_overdue_jobs_enhanced()
RETURNS TABLE(
  id uuid,
  job_number text,
  title text,
  due_date timestamptz,
  job_status text,
  priority text,
  vendor_name text,
  vendor_contact text,
  vehicle_info text,
  owner_contact text,
  days_overdue integer,
  severity_level text,
  assigned_to_name text
)
LANGUAGE sql
STABLE
AS $$
SELECT
  j.id,
  j.job_number,
  j.title,
  j.due_date,
  j.job_status::text,
  j.priority::text,
  v.name as vendor_name,
  v.phone as vendor_contact,
  CONCAT(vh.year::text, ' ', vh.make, ' ', vh.model, ' (', vh.license_plate, ')') as vehicle_info,
  vh.owner_phone as owner_contact,
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date))::integer as days_overdue,
  CASE
    WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 1 THEN 'low'
    WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 3 THEN 'medium'
    WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date)) <= 7 THEN 'high'
    ELSE 'critical'
  END as severity_level,
  up.full_name as assigned_to_name
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
LEFT JOIN public.user_profiles up ON j.assigned_to = up.id
WHERE j.due_date < CURRENT_TIMESTAMP
  AND j.job_status::text NOT IN ('completed', 'cancelled', 'delivered')
ORDER BY j.due_date ASC, j.priority DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs_enhanced() FROM public;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs_enhanced() TO authenticated;

-- Export data
CREATE OR REPLACE FUNCTION public.generate_export_data(
  export_type text,
  filters jsonb DEFAULT '{}'::jsonb,
  user_role text DEFAULT 'staff'
)
RETURNS TABLE(export_data jsonb)
LANGUAGE plpgsql
AS $func$
DECLARE
  start_date date;
  end_date date;
  status_filter text;
  vendor_filter uuid;
BEGIN
  start_date := (filters->>'start_date')::date;
  end_date := (filters->>'end_date')::date;
  status_filter := filters->>'status';
  vendor_filter := (filters->>'vendor_id')::uuid;

  IF export_type = 'jobs' THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'job_number', j.job_number,
      'title', j.title,
      'status', j.job_status,
      'priority', j.priority,
      'vehicle', CONCAT(v.year::text, ' ', v.make, ' ', v.model),
      'vendor', vnd.name,
      'assigned_to', up.full_name,
      'due_date', j.due_date,
      'estimated_cost', j.estimated_cost,
      'actual_cost', j.actual_cost,
      'profit', COALESCE(j.estimated_cost, 0) - COALESCE(j.actual_cost, 0),
      'created_at', j.created_at
    )
    FROM public.jobs j
    LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
    LEFT JOIN public.vendors vnd ON j.vendor_id = vnd.id
    LEFT JOIN public.user_profiles up ON j.assigned_to = up.id
    WHERE (start_date IS NULL OR j.created_at::date >= start_date)
      AND (end_date IS NULL OR j.created_at::date <= end_date)
      AND (status_filter IS NULL OR j.job_status::text = status_filter)
      AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter);

  ELSIF export_type = 'vehicles' THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'vin', v.vin,
      'make', v.make,
      'model', v.model,
      'year', v.year,
      'stock_number', v.stock_number,
      'owner_name', v.owner_name,
      'owner_phone', v.owner_phone,
      'status', v.vehicle_status,
      'total_jobs', COALESCE(job_counts.job_count, 0),
      'total_profit', CASE WHEN user_role IN ('admin', 'manager') THEN COALESCE(job_profits.total_profit, 0) ELSE NULL END
    )
    FROM public.vehicles v
    LEFT JOIN (
      SELECT vehicle_id, COUNT(*) as job_count
      FROM public.jobs
      GROUP BY vehicle_id
    ) job_counts ON v.id = job_counts.vehicle_id
    LEFT JOIN (
      SELECT vehicle_id, SUM(COALESCE(estimated_cost, 0) - COALESCE(actual_cost, 0)) as total_profit
      FROM public.jobs
      WHERE job_status = 'completed'
      GROUP BY vehicle_id
    ) job_profits ON v.id = job_profits.vehicle_id;

  ELSIF export_type = 'vendors' THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'name', vnd.name,
      'specialty', vnd.specialty,
      'contact_person', vnd.contact_person,
      'phone', vnd.phone,
      'email', vnd.email,
      'rating', vnd.rating,
      'active_jobs', COALESCE(active_jobs.count, 0),
      'completed_jobs', COALESCE(completed_jobs.count, 0),
      'avg_completion_time', vendor_stats.avg_completion_hours
    )
    FROM public.vendors vnd
    LEFT JOIN (
      SELECT vendor_id, COUNT(*) as count
      FROM public.jobs
      WHERE job_status IN ('pending', 'in_progress', 'scheduled')
      GROUP BY vendor_id
    ) active_jobs ON vnd.id = active_jobs.vendor_id
    LEFT JOIN (
      SELECT vendor_id, COUNT(*) as count
      FROM public.jobs
      WHERE job_status = 'completed'
      GROUP BY vendor_id
    ) completed_jobs ON vnd.id = completed_jobs.vendor_id
    LEFT JOIN (
      SELECT vendor_id, AVG(actual_hours) as avg_completion_hours
      FROM public.jobs
      WHERE job_status = 'completed' AND actual_hours IS NOT NULL
      GROUP BY vendor_id
    ) vendor_stats ON vnd.id = vendor_stats.vendor_id;
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.generate_export_data(text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_export_data(text, jsonb, text) TO authenticated;

-- Bulk update jobs
CREATE OR REPLACE FUNCTION public.bulk_update_jobs(
  job_ids uuid[],
  updates jsonb,
  performed_by uuid
)
RETURNS TABLE(success_count integer, failed_count integer, errors text[])
LANGUAGE plpgsql
AS $func$
DECLARE
  job_id uuid;
  success_counter integer := 0;
  failed_counter integer := 0;
  error_messages text[] := ARRAY[]::text[];
  actor uuid;
BEGIN
  actor := (SELECT auth.uid());
  IF actor IS NULL THEN
    RAISE EXCEPTION 'bulk_update_jobs requires authenticated user';
  END IF;

  FOREACH job_id IN ARRAY job_ids LOOP
    BEGIN
      UPDATE public.jobs
      SET
        job_status = COALESCE((updates->>'job_status')::job_status, job_status),
        priority = COALESCE((updates->>'priority')::job_priority, priority),
        assigned_to = COALESCE((updates->>'assigned_to')::uuid, assigned_to),
        vendor_id = COALESCE((updates->>'vendor_id')::uuid, vendor_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = job_id;

      INSERT INTO public.activity_history (
        performed_by,
        action_type,
        description,
        new_values,
        created_at
      ) VALUES (
        actor,
        'bulk_update',
        'Bulk update applied to job',
        updates,
        CURRENT_TIMESTAMP
      );

      success_counter := success_counter + 1;
    EXCEPTION
      WHEN OTHERS THEN
        failed_counter := failed_counter + 1;
        error_messages := array_append(error_messages, 'Job ' || job_id::text || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT success_counter, failed_counter, error_messages;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.bulk_update_jobs(uuid[], jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.bulk_update_jobs(uuid[], jsonb, uuid) TO authenticated;

-- =============================================================================
-- 6) PostgREST schema cache reload
-- =============================================================================

NOTIFY pgrst, 'reload schema';
