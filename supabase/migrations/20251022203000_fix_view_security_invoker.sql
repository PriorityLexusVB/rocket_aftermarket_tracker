-- Guarded fix: ensure the view runs as SECURITY INVOKER (not definer) and add a security barrier.
-- This will only run if the view exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'
      AND n.nspname = 'public'
      AND c.relname = 'october_2025_sales_summary'
  ) THEN
    -- Switch the view to security_invoker so RLS/policies of the caller apply
    EXECUTE 'ALTER VIEW public.october_2025_sales_summary SET (security_invoker = true)';
    -- Defense-in-depth: mark as security_barrier to prevent leaky predicates
    EXECUTE 'ALTER VIEW public.october_2025_sales_summary SET (security_barrier = true)';
  END IF;
END $$;
