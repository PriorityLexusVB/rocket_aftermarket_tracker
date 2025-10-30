-- Location: supabase/migrations/20250109183344_fix_deal_creation_job_number_generation.sql
-- Schema Analysis: Existing jobs table with NOT NULL job_number constraint causing failures
-- Integration Type: Modificative - Fix existing trigger function
-- Dependencies: jobs table, generate_job_number() function, set_deal_dates_and_calendar trigger

-- Update the existing trigger function to automatically generate job_number
CREATE OR REPLACE FUNCTION public.set_deal_dates_and_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- CRITICAL FIX: Auto-generate job_number if not provided
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
        NEW.job_number = public.generate_job_number();
    END IF;
    
    -- Set today's date if not provided
    IF NEW.created_at IS NULL THEN
        NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- OPTIONAL SCHEDULING: Only set promised date to scheduled_start_time if scheduled
    -- This allows deals to be created without scheduling (as requested)
    IF NEW.promised_date IS NULL AND NEW.scheduled_start_time IS NOT NULL THEN
        NEW.promised_date = NEW.scheduled_start_time;
    END IF;
    
    -- Set service_type based on vendor_id
    IF NEW.vendor_id IS NOT NULL THEN
        NEW.service_type = 'vendor';
    ELSE
        NEW.service_type = 'in_house';
    END IF;
    
    -- OPTIONAL CALENDAR: Only generate calendar event ID if actually scheduled
    -- This supports the requirement that "not all things are scheduled"
    IF NEW.calendar_event_id IS NULL AND NEW.scheduled_start_time IS NOT NULL THEN
        NEW.calendar_event_id = 'deal_' || NEW.id || '_' || extract(epoch from NEW.scheduled_start_time);
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Add comment explaining the optional scheduling behavior
COMMENT ON FUNCTION public.set_deal_dates_and_calendar() IS 'Trigger function that auto-generates job_number for all deals and optionally handles calendar integration only when deals are scheduled. Supports creating deals without scheduling as not all deals require immediate scheduling.';

-- Verify the sequence exists for job number generation (create if missing)
DO $$
BEGIN
    -- Check if sequence exists, create if missing
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'job_number_seq') THEN
        CREATE SEQUENCE public.job_number_seq
            START WITH 1
            INCREMENT BY 1
            MINVALUE 1
            MAXVALUE 999999
            CACHE 1
            CYCLE;
        
        -- Set starting point based on existing jobs (if any)
        PERFORM setval('public.job_number_seq', COALESCE(
            (SELECT MAX(CAST(SUBSTRING(job_number FROM 'JOB-\d{4}-(\d+)') AS INTEGER)) 
             FROM public.jobs 
             WHERE job_number ~ 'JOB-\d{4}-\d+'), 
            0
        ) + 1);
        
        RAISE NOTICE 'Created job_number_seq sequence with appropriate starting value';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error setting up job number sequence: %', SQLERRM;
END $$;