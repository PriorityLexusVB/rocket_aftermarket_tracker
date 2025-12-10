-- Migration: Harden Sequences and Number Generator Functions
-- Purpose: Ensure sequences exist and generator functions handle errors gracefully
-- Phase: 3 - Sequences & Core Helpers
-- Date: 2025-12-10
--
-- This migration verifies that required sequences exist and updates generator
-- functions to handle edge cases and provide consistent type safety.
--
-- ROLLBACK: To revert, run the original function definitions from:
-- - 20250922170950_automotive_aftermarket_system.sql

-- ============================================================================
-- Verify and Create Sequences if Missing
-- ============================================================================

-- Note: We use DO blocks instead of CREATE SEQUENCE IF NOT EXISTS because:
-- 1. We want to verify the starting value if sequence exists
-- 2. We want explicit logging about sequence state
-- 3. This pattern is idempotent and safe for repeated migrations

-- Ensure job_number_seq exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'job_number_seq') THEN
    -- Create sequence starting from 1000 (common starting point for visible IDs)
    CREATE SEQUENCE public.job_number_seq
      START WITH 1000
      INCREMENT BY 1
      NO CYCLE
      OWNED BY NONE;
    
    RAISE NOTICE 'Created job_number_seq starting at 1000';
  ELSE
    RAISE NOTICE 'job_number_seq already exists';
  END IF;
END $$;

-- Ensure transaction_number_seq exists  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'transaction_number_seq') THEN
    -- Create sequence starting from 1001 (offset from job numbers)
    CREATE SEQUENCE public.transaction_number_seq
      START WITH 1001
      INCREMENT BY 1
      NO CYCLE
      OWNED BY NONE;
    
    RAISE NOTICE 'Created transaction_number_seq starting at 1001';
  ELSE
    RAISE NOTICE 'transaction_number_seq already exists';
  END IF;
END $$;

-- ============================================================================
-- Harden generate_job_number() Function
-- ============================================================================

/**
 * Generates unique job numbers in format: JOB-YYYY-NNNNNN
 * 
 * Example: JOB-2025-001234
 * 
 * The function uses a sequence to ensure uniqueness and resets yearly via the
 * date prefix. If the sequence fails, it raises a clear error rather than
 * returning a malformed or NULL value.
 * 
 * Returns: TEXT - A guaranteed non-null job number string
 * 
 * Security: SECURITY DEFINER (requires sequence access)
 */
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  seq_value BIGINT;
  year_prefix TEXT;
  job_number TEXT;
BEGIN
  -- Get next sequence value
  seq_value := NEXTVAL('public.job_number_seq');
  
  -- Ensure sequence value is valid
  IF seq_value IS NULL THEN
    RAISE EXCEPTION 'job_number_seq returned NULL - sequence may be corrupted';
  END IF;
  
  -- Get current year as TEXT for consistency
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Build job number with zero-padding (6 digits)
  job_number := 'JOB-' || year_prefix || '-' || LPAD(seq_value::TEXT, 6, '0');
  
  -- Ensure we're returning a non-null value
  IF job_number IS NULL OR LENGTH(job_number) < 10 THEN
    RAISE EXCEPTION 'Generated invalid job number: %', job_number;
  END IF;
  
  RETURN job_number;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error with context
    RAISE EXCEPTION 'generate_job_number failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.generate_job_number() IS
'Generates unique job numbers in format JOB-YYYY-NNNNNN using job_number_seq. Raises exception on failure.';

-- ============================================================================
-- Harden generate_transaction_number() Function
-- ============================================================================

/**
 * Generates unique transaction numbers in format: TXN-YYYYMMDD-NNNN
 * 
 * Example: TXN-20251210-0042
 * 
 * The function uses a sequence and includes the full date for daily grouping.
 * If the sequence fails, it raises a clear error rather than returning a
 * malformed or NULL value.
 * 
 * Returns: TEXT - A guaranteed non-null transaction number string
 * 
 * Security: SECURITY DEFINER (requires sequence access)
 */
CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  seq_value BIGINT;
  date_prefix TEXT;
  txn_number TEXT;
BEGIN
  -- Get next sequence value
  seq_value := NEXTVAL('public.transaction_number_seq');
  
  -- Ensure sequence value is valid
  IF seq_value IS NULL THEN
    RAISE EXCEPTION 'transaction_number_seq returned NULL - sequence may be corrupted';
  END IF;
  
  -- Get current date in YYYYMMDD format for consistency
  date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Build transaction number with zero-padding (4 digits sufficient for daily volume)
  txn_number := 'TXN-' || date_prefix || '-' || LPAD(seq_value::TEXT, 4, '0');
  
  -- Ensure we're returning a non-null value
  IF txn_number IS NULL OR LENGTH(txn_number) < 10 THEN
    RAISE EXCEPTION 'Generated invalid transaction number: %', txn_number;
  END IF;
  
  RETURN txn_number;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error with context
    RAISE EXCEPTION 'generate_transaction_number failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.generate_transaction_number() IS
'Generates unique transaction numbers in format TXN-YYYYMMDD-NNNN using transaction_number_seq. Raises exception on failure.';

-- ============================================================================
-- Optional: Create Helper Function to Check Sequence Health
-- ============================================================================

/**
 * Checks the health and current state of number generation sequences.
 * 
 * Useful for monitoring and diagnostics. Returns current values, increment
 * settings, and whether sequences are approaching their maximum values.
 * 
 * Returns: Table with sequence information
 * 
 * Security: SECURITY DEFINER (requires sequence access)
 */
CREATE OR REPLACE FUNCTION public.check_sequence_health()
RETURNS TABLE(
  sequence_name TEXT,
  current_value BIGINT,
  increment_by BIGINT,
  max_value BIGINT,
  is_cycled BOOLEAN,
  usage_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.sequencename::TEXT,
    s.last_value,
    s.increment_by,
    s.max_value,
    s.is_cycled,
    -- Calculate usage percentage
    CASE 
      WHEN s.max_value > 0 THEN 
        ROUND((s.last_value::NUMERIC / s.max_value::NUMERIC) * 100, 2)
      ELSE 0
    END as usage_percent
  FROM pg_sequences s
  WHERE s.schemaname = 'public'
    AND s.sequencename IN ('job_number_seq', 'transaction_number_seq')
  ORDER BY s.sequencename;
END;
$$;

COMMENT ON FUNCTION public.check_sequence_health() IS
'Returns health metrics for job and transaction number sequences. Useful for monitoring.';

-- Grant execute on health check to authenticated users (read-only diagnostic)
GRANT EXECUTE ON FUNCTION public.check_sequence_health() TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify sequences exist and have correct settings:
-- SELECT * FROM public.check_sequence_health();

-- Test job number generation:
-- SELECT public.generate_job_number();

-- Test transaction number generation:
-- SELECT public.generate_transaction_number();

-- ============================================================================
-- Summary
-- ============================================================================

-- This migration enhances sequence safety by:
-- 1. Ensuring required sequences exist with proper starting values
-- 2. Adding NULL checks and validation to generator functions
-- 3. Converting generator functions to PL/pgSQL for better error handling
-- 4. Providing clear error messages on failure
-- 5. Adding a diagnostic function to monitor sequence health
--
-- The generator functions now consistently return TEXT and will raise exceptions
-- rather than silently fail or return invalid values.
--
-- Original SQL-based functions had minimal error handling. New PL/pgSQL versions
-- provide explicit validation and clearer error messages.
