-- Migration: Fix Function Logic - Replace SELECT * and Add NULL Checks
-- Purpose: Improve function safety by using explicit columns and NULL guards
-- Phase: 4 - Targeted Logic Safety & Style Fixes
-- Date: 2025-12-10
--
-- This migration updates functions that use SELECT * patterns (which can break
-- when schema changes) and adds explicit NULL checks to prevent runtime errors.
--
-- ROLLBACK: To revert, run the original function definition from:
-- - 20250103200000_enhance_deal_management.sql (validate_deal_line_items)

-- ============================================================================
-- Fix validate_deal_line_items() - Use Explicit Columns and NULL Checks
-- ============================================================================

/**
 * Validates line items (job_parts) when inserted or updated.
 * 
 * This function ensures:
 * - Jobs with vendors have scheduled dates
 * - In-house services have correct service_type classification
 * - All required records exist (job, product)
 * 
 * Uses explicit column selection instead of SELECT * for schema stability.
 * Includes NULL checks to provide clear error messages.
 * 
 * Returns: NEW record (trigger function)
 * 
 * Security: SECURITY DEFINER (may need to update jobs)
 */
CREATE OR REPLACE FUNCTION public.validate_deal_line_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  product_record RECORD;
BEGIN
  -- Validate that job_id is provided
  IF NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'job_id cannot be NULL when adding line items';
  END IF;
  
  -- Get specific job details (explicit columns only)
  SELECT 
    j.id,
    j.vendor_id,
    j.scheduled_start_time,
    j.service_type,
    j.org_id  -- Include for tenant scoping if needed
  INTO job_record
  FROM public.jobs j
  WHERE j.id = NEW.job_id;
  
  -- Check if job exists
  IF NOT FOUND OR job_record.id IS NULL THEN
    RAISE EXCEPTION 'Job % not found when validating line items', NEW.job_id;
  END IF;
  
  -- Validate product exists if product_id is provided
  IF NEW.product_id IS NOT NULL THEN
    SELECT 
      p.id,
      p.name,
      p.is_active
    INTO product_record
    FROM public.products p
    WHERE p.id = NEW.product_id;
    
    IF NOT FOUND OR product_record.id IS NULL THEN
      RAISE EXCEPTION 'Product % not found when validating line items', NEW.product_id;
    END IF;
    
    -- Optionally warn about inactive products (but allow for compatibility)
    IF product_record.is_active = false THEN
      RAISE NOTICE 'Warning: Adding inactive product % to job %', product_record.name, NEW.job_id;
    END IF;
  END IF;
  
  -- Validate that jobs with vendors have scheduled dates
  IF job_record.vendor_id IS NOT NULL AND job_record.scheduled_start_time IS NULL THEN
    RAISE EXCEPTION 'Vendor jobs must have scheduled dates (job_id: %, vendor_id: %)', 
      job_record.id, job_record.vendor_id;
  END IF;
  
  -- Validate that in-house services have proper classification
  -- Only update if service_type is incorrect
  -- Use IS DISTINCT FROM for NULL-safe comparison
  IF job_record.vendor_id IS NULL AND job_record.service_type IS DISTINCT FROM 'in_house' THEN
    -- Update jobs table to fix service_type
    UPDATE public.jobs 
    SET service_type = 'in_house' 
    WHERE id = NEW.job_id;
    
    RAISE NOTICE 'Corrected service_type to in_house for job %', NEW.job_id;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Provide context in error message
    RAISE EXCEPTION 'validate_deal_line_items failed for job_id %: % (SQLSTATE: %)', 
      NEW.job_id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.validate_deal_line_items() IS
'Validates job_parts records on insert/update. Ensures jobs with vendors have scheduled dates and in-house jobs are properly classified. Uses explicit columns and NULL checks.';

-- ============================================================================
-- Fix auto_enqueue_status_sms() - Add Explicit NULL Checks
-- ============================================================================

/**
 * Automatically enqueues SMS notifications when job status changes.
 * 
 * This trigger function:
 * - Checks for vehicle phone numbers
 * - Respects SMS opt-out preferences
 * - Generates appropriate messages based on status change
 * - Uses explicit NULL checks and safe timestamp formatting
 * 
 * Returns: NEW record (trigger function)
 * 
 * Security: SECURITY DEFINER (accesses multiple tables)
 */
CREATE OR REPLACE FUNCTION public.auto_enqueue_status_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vehicle_phone TEXT;
  stock_num TEXT;
  template_msg TEXT;
  sms_vars JSONB;
  scheduled_start TEXT;
  scheduled_end TEXT;
BEGIN
  -- Skip if this is an insert (no OLD record to compare)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Skip if job_status hasn't changed
  IF OLD.job_status = NEW.job_status THEN
    RETURN NEW;
  END IF;
  
  -- Get vehicle phone and stock number with explicit NULL handling
  SELECT 
    v.owner_phone, 
    v.stock_number
  INTO vehicle_phone, stock_num
  FROM public.vehicles v 
  WHERE v.id = NEW.vehicle_id;
  
  -- Skip if no vehicle found or no phone number
  IF vehicle_phone IS NULL OR TRIM(vehicle_phone) = '' THEN
    RAISE NOTICE 'No phone number for vehicle % (job %)', NEW.vehicle_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- Check if customer opted out of SMS
  IF EXISTS (
    SELECT 1 
    FROM public.sms_opt_outs 
    WHERE phone_e164 = vehicle_phone
  ) THEN
    RAISE NOTICE 'Customer % opted out of SMS (job %)', vehicle_phone, NEW.id;
    RETURN NEW;
  END IF;
  
  -- Determine message template based on new status
  CASE NEW.job_status
    WHEN 'scheduled' THEN
      template_msg := 'Stock {STOCK} appointment confirmed for {DATE} at {TIME}. Reply YES to confirm.';
    WHEN 'in_progress' THEN
      template_msg := 'Stock {STOCK} service started. Estimated completion: {ETA}.';
    WHEN 'completed' THEN
      template_msg := 'Stock {STOCK} service complete! Ready for pickup. Call {PHONE} for details.';
    WHEN 'cancelled' THEN
      template_msg := 'Stock {STOCK} appointment cancelled. Call {PHONE} to reschedule.';
    ELSE
      -- No SMS for other status changes
      RETURN NEW;
  END CASE;
  
  -- Format timestamps safely with NULL checks
  -- Use COALESCE to provide fallback values
  IF NEW.scheduled_start_time IS NOT NULL THEN
    scheduled_start := TO_CHAR(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'Mon DD');
  ELSE
    scheduled_start := 'TBD';
  END IF;
  
  IF NEW.scheduled_start_time IS NOT NULL THEN
    scheduled_end := TO_CHAR(
      COALESCE(NEW.scheduled_end_time, NEW.scheduled_start_time + INTERVAL '2 hours') 
      AT TIME ZONE 'America/New_York', 
      'HH12:MI AM'
    );
  ELSE
    scheduled_end := 'TBD';
  END IF;
  
  -- Build variables with safe NULL handling
  sms_vars := jsonb_build_object(
    'STOCK', COALESCE(stock_num, 'N/A'),
    'DATE', scheduled_start,
    'TIME', COALESCE(
      TO_CHAR(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'HH12:MI AM'),
      'TBD'
    ),
    'ETA', scheduled_end,
    'PHONE', '555-SHOP'
  );
  
  -- Enqueue SMS notification
  PERFORM public.enqueue_sms_notification(
    vehicle_phone,
    template_msg,
    sms_vars
  );
  
  RAISE NOTICE 'Enqueued SMS for job % (status: % -> %)', NEW.id, OLD.job_status, NEW.job_status;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the job status update
    RAISE NOTICE 'auto_enqueue_status_sms error for job %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_enqueue_status_sms() IS
'Trigger function that enqueues SMS notifications on job status changes. Handles NULL timestamps and missing vehicle data safely.';

-- ============================================================================
-- Fix set_deal_dates_and_calendar() - Add NULL Guards
-- ============================================================================

/**
 * Automatically sets deal dates and calendar integration fields.
 * 
 * This trigger function:
 * - Sets promised_date from scheduled_start_time if not provided
 * - Determines service_type based on vendor_id
 * - Generates calendar_event_id for tracking
 * - Includes explicit NULL checks
 * 
 * Returns: NEW record (trigger function)
 * 
 * Security: SECURITY DEFINER
 */
CREATE OR REPLACE FUNCTION public.set_deal_dates_and_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set created_at if not provided (safety check)
  IF NEW.created_at IS NULL THEN
    NEW.created_at = CURRENT_TIMESTAMP;
  END IF;
  
  -- Set promised date to scheduled_start_time if not set
  -- Only set if scheduled_start_time is not NULL
  IF NEW.promised_date IS NULL AND NEW.scheduled_start_time IS NOT NULL THEN
    NEW.promised_date = NEW.scheduled_start_time;
  END IF;
  
  -- Set service_type based on vendor_id (explicit NULL check)
  IF NEW.vendor_id IS NOT NULL THEN
    NEW.service_type = 'vendor';
  ELSE
    NEW.service_type = 'in_house';
  END IF;
  
  -- Generate calendar event ID for tracking
  -- Only if scheduled_start_time exists and calendar_event_id not already set
  -- For INSERT operations, NEW.id is available because it's set by DEFAULT gen_random_uuid()
  -- For UPDATE operations, NEW.id is always present
  -- The NEW.id NULL check is defensive programming - if somehow NEW.id is NULL (should never
  -- happen given table structure), we skip calendar_event_id generation rather than crash
  IF NEW.calendar_event_id IS NULL AND NEW.scheduled_start_time IS NOT NULL AND NEW.id IS NOT NULL THEN
    -- Use EXTRACT instead of calling potentially NULL-unsafe functions
    NEW.calendar_event_id = 'deal_' || NEW.id::TEXT || '_' || 
      EXTRACT(EPOCH FROM NEW.scheduled_start_time)::BIGINT::TEXT;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with context but allow insert/update to proceed
    RAISE NOTICE 'set_deal_dates_and_calendar error for job %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_deal_dates_and_calendar() IS
'Trigger function that sets deal dates, service type, and calendar event ID. Includes NULL guards for all timestamp operations.';

-- ============================================================================
-- Summary
-- ============================================================================

-- This migration improves function safety by:
-- 1. Replacing SELECT * with explicit column lists (schema stability)
-- 2. Adding NOT FOUND checks after SELECT INTO operations
-- 3. Adding explicit NULL guards for all timestamp operations
-- 4. Using COALESCE for safe default values
-- 5. Improving error messages with context
-- 6. Preventing trigger failures from breaking main operations
--
-- Functions updated:
-- - validate_deal_line_items: Explicit columns + NULL checks
-- - auto_enqueue_status_sms: Safe timestamp formatting + NULL guards
-- - set_deal_dates_and_calendar: NULL guards for all operations
--
-- These changes make the functions more resilient to:
-- - Schema changes (explicit columns)
-- - Missing/NULL data (explicit checks)
-- - Timezone operations on NULL timestamps (COALESCE defaults)
