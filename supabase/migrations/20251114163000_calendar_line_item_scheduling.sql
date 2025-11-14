-- Migration: Update calendar functions to read from line-item scheduling
-- Purpose: Support line-item only scheduling model (no more job-level scheduling)
-- Date: 2025-11-14

-- Drop the existing function first (required when changing return type/logic)
DROP FUNCTION IF EXISTS public.get_jobs_by_date_range(timestamp with time zone, timestamp with time zone, uuid, text);

-- Create new function that aggregates line items for calendar display
-- Strategy: Show a job on the calendar if ANY of its line items has scheduling
CREATE OR REPLACE FUNCTION public.get_jobs_by_date_range(
    start_date timestamp with time zone, 
    end_date timestamp with time zone, 
    vendor_filter uuid DEFAULT NULL::uuid, 
    status_filter text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid, 
    title text, 
    description text, 
    scheduled_start_time timestamp with time zone, 
    scheduled_end_time timestamp with time zone, 
    job_status text, 
    vendor_name text, 
    vendor_id uuid, 
    vehicle_info text, 
    color_code text, 
    priority text, 
    estimated_hours integer,
    job_number text,
    location text,
    calendar_notes text
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
WITH job_schedules AS (
  -- Aggregate line item schedules per job
  -- Use the earliest start time and latest end time across all line items
  SELECT 
    jp.job_id,
    MIN(jp.scheduled_start_time) as earliest_start,
    MAX(jp.scheduled_end_time) as latest_end,
    COUNT(*) FILTER (WHERE jp.scheduled_start_time IS NOT NULL) as scheduled_count
  FROM public.job_parts jp
  WHERE jp.scheduled_start_time IS NOT NULL
    AND jp.scheduled_end_time IS NOT NULL
  GROUP BY jp.job_id
)
SELECT 
    j.id,
    j.title,
    j.description,
    js.earliest_start as scheduled_start_time,
    js.latest_end as scheduled_end_time,
    j.job_status::TEXT,
    COALESCE(v.name, 'Unassigned') as vendor_name,
    j.vendor_id,
    CASE 
        WHEN vh.id IS NOT NULL THEN CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model)
        ELSE 'No Vehicle'
    END as vehicle_info,
    COALESCE(j.color_code, '#3b82f6') as color_code,
    j.priority::TEXT,
    j.estimated_hours,
    j.job_number,
    j.location,
    j.calendar_notes
FROM public.jobs j
INNER JOIN job_schedules js ON j.id = js.job_id
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
-- Filter by date range: include jobs where scheduling overlaps with the requested range
WHERE (
    -- Job starts within the range
    (js.earliest_start >= start_date AND js.earliest_start <= end_date)
    OR
    -- Job ends within the range  
    (js.latest_end >= start_date AND js.latest_end <= end_date)
    OR  
    -- Job spans the entire range
    (js.earliest_start <= start_date AND js.latest_end >= end_date)
)
-- Apply filters
AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter)
AND (status_filter IS NULL OR j.job_status::TEXT = status_filter)
ORDER BY js.earliest_start ASC;
$function$;

COMMENT ON FUNCTION public.get_jobs_by_date_range IS 
'Retrieves jobs within specified date range for calendar display. 
Reads from job_parts table and aggregates line item schedules.
Shows earliest start and latest end across all scheduled line items.';

-- Also update the check_vendor_schedule_conflict function to use line items
-- This prevents double-booking vendors
DROP FUNCTION IF EXISTS public.check_vendor_schedule_conflict(uuid, timestamp with time zone, timestamp with time zone, uuid);

CREATE OR REPLACE FUNCTION public.check_vendor_schedule_conflict(
    vendor_uuid uuid,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    exclude_job_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
SELECT EXISTS (
  SELECT 1
  FROM public.job_parts jp
  INNER JOIN public.jobs j ON jp.job_id = j.id
  WHERE j.vendor_id = vendor_uuid
    AND jp.scheduled_start_time IS NOT NULL
    AND jp.scheduled_end_time IS NOT NULL
    -- Check for time overlap
    AND (
      -- New time overlaps with existing start time
      (start_time <= jp.scheduled_start_time AND end_time > jp.scheduled_start_time)
      OR
      -- New time overlaps with existing end time
      (start_time < jp.scheduled_end_time AND end_time >= jp.scheduled_end_time)
      OR
      -- New time is completely within existing time
      (start_time >= jp.scheduled_start_time AND end_time <= jp.scheduled_end_time)
      OR
      -- Existing time is completely within new time
      (jp.scheduled_start_time >= start_time AND jp.scheduled_end_time <= end_time)
    )
    -- Exclude the job being edited (if provided)
    AND (exclude_job_id IS NULL OR j.id != exclude_job_id)
  LIMIT 1
);
$function$;

COMMENT ON FUNCTION public.check_vendor_schedule_conflict IS 
'Checks if a vendor has scheduling conflicts by reading from job_parts table.
Returns true if vendor is already scheduled during the specified time range.';
