-- Location: supabase/migrations/20250923142511_calendar_scheduling_enhancement.sql
-- Schema Analysis: Extending existing aftermarket tracking system with calendar scheduling
-- Integration Type: Enhancement - Adding calendar scheduling fields to existing jobs table
-- Dependencies: jobs, user_profiles, vendors, vehicles (all existing)
--
-- ⚠️ DEPRECATION NOTICE (as of 2025-11-14):
-- The job-level scheduling fields (scheduled_start_time, scheduled_end_time) added by this migration
-- are DEPRECATED. Calendar scheduling has been migrated to line-item level via job_parts table.
-- See migration 20251114163000_calendar_line_item_scheduling.sql for the new implementation.
-- These fields remain in the schema for backward compatibility but should not be used in new code.
-- Reference: docs/SCHEDULING_ARCHITECTURE.md

-- Step 1: Add new enum values (MUST be separate from any usage)
-- PostgreSQL requires enum modifications to be committed before usage

-- Add enum values individually without transaction wrapper
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'quality_check'; 
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'delivered';

-- Step 2: Schema modifications in transaction
BEGIN;

-- Add calendar scheduling columns to existing jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calendar_notes TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', etc.
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS color_code TEXT DEFAULT '#3b82f6'; -- Calendar display color

-- Step 3: Add indexes for calendar performance
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON public.jobs(scheduled_start_time) WHERE scheduled_start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_end ON public.jobs(scheduled_end_time) WHERE scheduled_end_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_calendar_date_range ON public.jobs(scheduled_start_time, scheduled_end_time) WHERE scheduled_start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_vendor_schedule ON public.jobs(vendor_id, scheduled_start_time) WHERE vendor_id IS NOT NULL AND scheduled_start_time IS NOT NULL;

-- Step 4: Create calendar-specific functions
CREATE OR REPLACE FUNCTION public.get_jobs_by_date_range(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    vendor_filter UUID DEFAULT NULL,
    status_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    scheduled_start_time TIMESTAMPTZ,
    scheduled_end_time TIMESTAMPTZ,
    job_status TEXT,
    vendor_name TEXT,
    vendor_id UUID,
    vehicle_info TEXT,
    color_code TEXT,
    priority TEXT,
    estimated_hours INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id,
    j.title,
    j.description,
    j.scheduled_start_time,
    j.scheduled_end_time,
    j.job_status::TEXT,
    v.name as vendor_name,
    j.vendor_id,
    CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model) as vehicle_info,
    COALESCE(j.color_code, '#3b82f6') as color_code,
    j.priority::TEXT,
    j.estimated_hours
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE j.scheduled_start_time IS NOT NULL
AND j.scheduled_start_time >= start_date
AND j.scheduled_end_time <= end_date
AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter)
AND (status_filter IS NULL OR j.job_status::TEXT = status_filter)
ORDER BY j.scheduled_start_time ASC;
$$;

-- Step 5: Create function to check vendor scheduling conflicts
CREATE OR REPLACE FUNCTION public.check_vendor_schedule_conflict(
    vendor_uuid UUID,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    exclude_job_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.vendor_id = vendor_uuid
    AND j.id != COALESCE(exclude_job_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND j.scheduled_start_time IS NOT NULL
    AND j.scheduled_end_time IS NOT NULL
    AND j.job_status::TEXT NOT IN ('completed', 'cancelled')
    AND (
        (j.scheduled_start_time <= start_time AND j.scheduled_end_time > start_time)
        OR (j.scheduled_start_time < end_time AND j.scheduled_end_time >= end_time)
        OR (j.scheduled_start_time >= start_time AND j.scheduled_end_time <= end_time)
    )
);
$$;

-- Step 6: Create function for Kanban status progression validation
CREATE OR REPLACE FUNCTION public.validate_status_progression(
    current_status TEXT,
    new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT CASE
    -- Allow any status to go to cancelled
    WHEN new_status = 'cancelled' THEN true
    -- Normal progression flow
    WHEN current_status = 'pending' AND new_status IN ('scheduled', 'in_progress') THEN true
    WHEN current_status = 'scheduled' AND new_status IN ('in_progress', 'completed') THEN true
    WHEN current_status = 'in_progress' AND new_status IN ('quality_check', 'completed') THEN true
    WHEN current_status = 'quality_check' AND new_status IN ('delivered', 'in_progress') THEN true
    WHEN current_status = 'delivered' AND new_status = 'completed' THEN true
    -- Allow staying in same status (updates)
    WHEN current_status = new_status THEN true
    -- Backwards progression for corrections
    WHEN current_status = 'completed' AND new_status IN ('delivered', 'quality_check') THEN true
    -- Allow rescheduling: in_progress back to scheduled for calendar management
    WHEN current_status = 'in_progress' AND new_status = 'scheduled' THEN true
    ELSE false
END;
$$;

-- Step 7: Add enhanced RLS policies for calendar access
-- Staff can view calendar events for jobs assigned to them
DROP POLICY IF EXISTS "staff_can_view_assigned_calendar_events" ON public.jobs;
CREATE POLICY "staff_can_view_assigned_calendar_events"
ON public.jobs
FOR SELECT
TO authenticated
USING (
    assigned_to = auth.uid() 
    AND scheduled_start_time IS NOT NULL
);

-- Step 8: Create trigger to validate status changes
CREATE OR REPLACE FUNCTION public.validate_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only validate if status is actually changing
    IF OLD.job_status IS DISTINCT FROM NEW.job_status THEN
        IF NOT public.validate_status_progression(OLD.job_status::TEXT, NEW.job_status::TEXT) THEN
            RAISE EXCEPTION 'Invalid status progression from % to %', OLD.job_status, NEW.job_status;
        END IF;
    END IF;
    
    -- Auto-set completed_at when job reaches completed status
    IF NEW.job_status::TEXT = 'completed' AND OLD.job_status::TEXT != 'completed' THEN
        NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS validate_job_status_progression ON public.jobs;
CREATE TRIGGER validate_job_status_progression
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_job_status_change();

-- Step 9: Add utility function to get overdue jobs
CREATE OR REPLACE FUNCTION public.get_overdue_jobs()
RETURNS TABLE(
    id UUID,
    title TEXT,
    due_date TIMESTAMPTZ,
    job_status TEXT,
    vendor_name TEXT,
    vehicle_info TEXT,
    days_overdue INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    j.id,
    j.title,
    j.due_date,
    j.job_status::TEXT,
    v.name as vendor_name,
    CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model) as vehicle_info,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - j.due_date))::INTEGER as days_overdue
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE j.due_date < CURRENT_TIMESTAMP
AND j.job_status::TEXT NOT IN ('completed', 'cancelled')
ORDER BY j.due_date ASC;
$$;

COMMIT;

-- Step 10: Add sample calendar data to existing jobs (SEPARATE TRANSACTION)
-- This must be separate since we're using the new enum values
DO $$
DECLARE
    job_record RECORD;
    start_time TIMESTAMPTZ;
    vendor_count INTEGER := 0;
BEGIN
    -- Update only jobs that can validly transition to 'scheduled' status
    -- Only update pending jobs to avoid status progression violations
    FOR job_record IN 
        SELECT id, vendor_id, estimated_hours, job_status
        FROM public.jobs 
        WHERE scheduled_start_time IS NULL 
        AND job_status = 'pending'  -- Only update pending jobs
        LIMIT 5
    LOOP
        -- Create sample scheduling times (9 AM to 5 PM workday)
        start_time := CURRENT_DATE + INTERVAL '9 hours' + (vendor_count * INTERVAL '2 hours');
        
        UPDATE public.jobs
        SET 
            scheduled_start_time = start_time,
            scheduled_end_time = start_time + INTERVAL '1 hour' * COALESCE(estimated_hours, 2),
            job_status = 'scheduled'::public.job_status,
            color_code = CASE vendor_count % 4
                WHEN 0 THEN '#3b82f6' -- Blue
                WHEN 1 THEN '#10b981' -- Green  
                WHEN 2 THEN '#f59e0b' -- Yellow
                ELSE '#ef4444' -- Red
            END,
            location = 'Service Bay ' || (vendor_count + 1)::TEXT
        WHERE id = job_record.id;
        
        vendor_count := vendor_count + 1;
    END LOOP;
    
    -- Add calendar info to jobs in other statuses without changing their status
    FOR job_record IN 
        SELECT id, vendor_id, estimated_hours, job_status
        FROM public.jobs 
        WHERE scheduled_start_time IS NULL 
        AND job_status != 'pending'  -- Jobs in other statuses
        AND vendor_count < 10  -- Limit total sample data
        LIMIT 5
    LOOP
        -- Create sample scheduling times for display purposes
        start_time := CURRENT_DATE + INTERVAL '9 hours' + (vendor_count * INTERVAL '2 hours');
        
        UPDATE public.jobs
        SET 
            scheduled_start_time = start_time,
            scheduled_end_time = start_time + INTERVAL '1 hour' * COALESCE(estimated_hours, 2),
            color_code = CASE vendor_count % 4
                WHEN 0 THEN '#3b82f6' -- Blue
                WHEN 1 THEN '#10b981' -- Green  
                WHEN 2 THEN '#f59e0b' -- Yellow
                ELSE '#ef4444' -- Red
            END,
            location = 'Service Bay ' || (vendor_count + 1)::TEXT
        WHERE id = job_record.id;
        -- Note: Not changing job_status, keeping existing status
        
        vendor_count := vendor_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Added calendar scheduling to % existing jobs', vendor_count;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_jobs_by_date_range IS 'Retrieves jobs within specified date range for calendar display';
COMMENT ON FUNCTION public.check_vendor_schedule_conflict IS 'Checks if vendor has scheduling conflicts in given time range';
COMMENT ON FUNCTION public.validate_status_progression IS 'Validates Kanban status workflow progression rules';
COMMENT ON FUNCTION public.get_overdue_jobs IS 'Returns jobs that are past their due date';