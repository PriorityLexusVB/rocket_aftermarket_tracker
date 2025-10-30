-- Audit script: views, functions, tables and policies that can affect data exposure.
-- Run this in your Supabase SQL editor to get a complete picture.

-- 1) Check the flagged view: owner, definition, and security options
SELECT
  n.nspname  AS schema,
  c.relname  AS view_name,
  pg_get_userbyid(c.relowner) AS owner,
  -- security_invoker and security_barrier are stored in reloptions
  COALESCE(array_position(c.reloptions, 'security_invoker=true') IS NOT NULL, FALSE) AS security_invoker,
  COALESCE(array_position(c.reloptions, 'security_barrier=true') IS NOT NULL, FALSE) AS security_barrier,
  pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname = 'october_2025_sales_summary';

-- 2) List any public views that still behave as SECURITY DEFINER (i.e., invoker=false)
SELECT
  n.nspname  AS schema,
  c.relname  AS view_name,
  pg_get_userbyid(c.relowner) AS owner,
  COALESCE(array_position(c.reloptions, 'security_invoker=true') IS NOT NULL, FALSE) AS security_invoker,
  COALESCE(array_position(c.reloptions, 'security_barrier=true') IS NOT NULL, FALSE) AS security_barrier
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND COALESCE(array_position(c.reloptions, 'security_invoker=true') IS NOT NULL, FALSE) = FALSE
ORDER BY 1, 2;

-- 3) SECURITY DEFINER functions in public (review/limit these)
SELECT
  n.nspname  AS schema,
  p.proname  AS function,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = TRUE
ORDER BY 1, 2;

-- 4) RLS status across public tables
SELECT
  n.nspname  AS schema,
  c.relname  AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'  -- ordinary tables
  AND n.nspname = 'public'
ORDER BY 1, 2;

-- 5) Policies per table (helps confirm tenant/role scoping)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6) Index coverage on common FKs/filters (tune as needed for your workload)
SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  a.attname AS column_name
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS cols(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
WHERE n.nspname = 'public'
  AND t.relname IN (
    'jobs','job_parts','transactions','claims','products','vendors','vehicles',
    'filter_presets','notification_preferences','vendor_hours','loaner_assignments'
  )
ORDER BY 1, 2, 3;

-- 7) Tables with updated_at column missing a timestamp trigger
WITH cols AS (
  SELECT table_schema, table_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'updated_at'
), trig AS (
  SELECT DISTINCT event_object_schema AS table_schema, event_object_table AS table_name
  FROM information_schema.triggers
)
SELECT c.table_schema, c.table_name
FROM cols c
LEFT JOIN trig t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE t.table_name IS NULL
ORDER BY 1, 2;
