-- Add missing customer_phone column for performance index compatibility
--
-- Why: Migration 20251110023000_comprehensive_performance_indexes.sql creates
--       idx_loaner_assignments_customer on public.loaner_assignments(customer_phone).
--       Some environments have loaner_assignments without this column, causing
--       migration failure (SQLSTATE 42703).
--
-- Safety:
-- - Guarded: only runs when table exists
-- - Idempotent: ADD COLUMN IF NOT EXISTS

DO $$
BEGIN
  IF to_regclass('public.loaner_assignments') IS NULL THEN
    RAISE NOTICE 'loaner_assignments table not found, skipping customer_phone column add';
    RETURN;
  END IF;

  -- Add the column if missing (nullable, since customer contact data lives on transactions)
  EXECUTE 'ALTER TABLE public.loaner_assignments ADD COLUMN IF NOT EXISTS customer_phone TEXT';

  RAISE NOTICE 'Ensured public.loaner_assignments.customer_phone exists';
END $$;
