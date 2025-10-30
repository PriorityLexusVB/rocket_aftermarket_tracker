-- Migration: Add vehicle overlap check function for calendar guardrails
-- Timestamp: 2025-01-02 22:20:00

-- Function to check if vehicle has overlapping appointments (guardrail #3)
CREATE OR REPLACE FUNCTION public.check_vehicle_overlap(
    vehicle_id UUID,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 
    FROM public.jobs j
    WHERE j.vehicle_id = check_vehicle_overlap.vehicle_id
    AND j.job_status IN ('pending', 'scheduled', 'in_progress', 'quality_check')
    AND (exclude_id IS NULL OR j.id != exclude_id)
    AND (
        (j.scheduled_start_time < end_time AND j.scheduled_end_time > start_time)
        OR
        (j.scheduled_start_time IS NOT NULL AND j.scheduled_end_time IS NULL 
         AND j.scheduled_start_time < end_time 
         AND (j.scheduled_start_time + INTERVAL '1 hour') > start_time)
    )
);
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_vehicle_overlap TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.check_vehicle_overlap IS 
'Calendar guardrail: Check if vehicle has conflicting appointments for given time range. Used in drag/drop validation.';