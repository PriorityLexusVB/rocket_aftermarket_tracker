-- Comprehensive Performance Indexes Migration
-- Purpose: Reduce Supabase performance errors (slow queries, timeouts, excessive ILIKE scans)
-- Date: 2025-11-10
-- Related: Master prompt - Performance & Schema Simplification Plan

-- =====================================================================
-- A. Enable Required Extensions
-- =====================================================================

-- Enable pg_trgm for trigram indexes (ILIKE optimization)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- B. Index Hygiene - Foreign Keys
-- =====================================================================

-- job_parts foreign key indexes
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_job_id ON public.job_parts(job_id);

-- jobs foreign key indexes
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_id ON public.jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_delivery_coord ON public.jobs(delivery_coordinator_id);
CREATE INDEX IF NOT EXISTS idx_jobs_finance_manager ON public.jobs(finance_manager_id);

-- =====================================================================
-- C. Common Query Pattern Indexes
-- =====================================================================

-- Common status queries (job_status + created_at composite)
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs(job_status, created_at);

-- Overdue job parts queries (promised_date + requires_scheduling)
CREATE INDEX IF NOT EXISTS idx_job_parts_promised_sched ON public.job_parts(promised_date, requires_scheduling);

-- Jobs by org_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs(org_id);

-- =====================================================================
-- D. Search Optimization - Trigram Indexes for ILIKE
-- =====================================================================

-- jobs table - title search
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON public.jobs USING GIN (title gin_trgm_ops);

-- jobs table - job_number search (if exists)
CREATE INDEX IF NOT EXISTS idx_jobs_job_number_trgm ON public.jobs USING GIN (job_number gin_trgm_ops);

-- vendors table - name search
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm ON public.vendors USING GIN (name gin_trgm_ops);

-- vehicles table - make/model search
CREATE INDEX IF NOT EXISTS idx_vehicles_make_trgm ON public.vehicles USING GIN (make gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_model_trgm ON public.vehicles USING GIN (model gin_trgm_ops);

-- vehicles table - VIN search
CREATE INDEX IF NOT EXISTS idx_vehicles_vin_trgm ON public.vehicles USING GIN (vin gin_trgm_ops);

-- products table - name search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING GIN (name gin_trgm_ops);

-- =====================================================================
-- E. Additional Coverage Indexes
-- =====================================================================

-- loaner_assignments by customer for quick lookup
CREATE INDEX IF NOT EXISTS idx_loaner_assignments_customer ON public.loaner_assignments(customer_phone);

-- user_profiles by role and department for dropdown queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_dept ON public.user_profiles(role, department);

-- =====================================================================
-- F. Analyze Tables After Index Creation
-- =====================================================================

-- Update statistics for query planner
ANALYZE public.jobs;
ANALYZE public.job_parts;
ANALYZE public.vendors;
ANALYZE public.vehicles;
ANALYZE public.products;
ANALYZE public.user_profiles;

-- =====================================================================
-- Notes:
-- =====================================================================
-- 1. All indexes use IF NOT EXISTS for idempotency
-- 2. Trigram indexes enable efficient ILIKE pattern matching
-- 3. Composite indexes (status+created_at) accelerate common WHERE clauses
-- 4. FK indexes improve JOIN performance
-- 5. ANALYZE updates query planner statistics
-- 6. Run EXPLAIN ANALYZE on slow queries to verify index usage
-- 7. Monitor with: SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';
