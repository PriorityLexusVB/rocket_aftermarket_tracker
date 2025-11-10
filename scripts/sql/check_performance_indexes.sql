-- Simple Performance Index Check
-- Purpose: Quick verification that key performance indexes exist
-- Usage: Can be run via Supabase query or RPC
-- Date: 2025-11-10

-- Check pg_trgm extension and key indexes
WITH extension_check AS (
  SELECT 
    'pg_trgm' AS check_name,
    CASE 
      WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') 
      THEN 'PASS' 
      ELSE 'FAIL' 
    END AS status,
    'Trigram extension for ILIKE optimization' AS description
),
index_checks AS (
  SELECT 
    index_name AS check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname = index_name
      ) 
      THEN 'PASS' 
      ELSE 'FAIL' 
    END AS status,
    description
  FROM (VALUES
    ('idx_jobs_title_trgm', 'Jobs title search index'),
    ('idx_jobs_job_number_trgm', 'Jobs job_number search index'),
    ('idx_jobs_status_created', 'Jobs status+created composite index'),
    ('idx_jobs_org_id', 'Jobs org_id index for multi-tenant'),
    ('idx_job_parts_vendor_id', 'Job parts vendor FK index'),
    ('idx_job_parts_job_id', 'Job parts job FK index'),
    ('idx_job_parts_promised_sched', 'Job parts overdue composite index'),
    ('idx_vendors_name_trgm', 'Vendors name search index'),
    ('idx_vehicles_make_trgm', 'Vehicles make search index'),
    ('idx_vehicles_model_trgm', 'Vehicles model search index'),
    ('idx_vehicles_vin_trgm', 'Vehicles VIN search index')
  ) AS expected(index_name, description)
)
SELECT * FROM extension_check
UNION ALL
SELECT * FROM index_checks
ORDER BY 
  CASE WHEN status = 'FAIL' THEN 0 ELSE 1 END,
  check_name;
