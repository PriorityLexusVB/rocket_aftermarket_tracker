-- Location: supabase/migrations/20250117120000_add_loaner_assignments.sql
-- Schema Analysis: jobs table has customer_needs_loaner column, job_parts has scheduling fields
-- Integration Type: addition - adding standalone loaner_assignments table
-- Dependencies: jobs table (existing)

-- Create loaner_assignments table as specified in Part A1
CREATE TABLE public.loaner_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    loaner_number TEXT NOT NULL,
    eta_return_date DATE,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index to prevent duplicate active assignments for same loaner
CREATE UNIQUE INDEX ux_loaner_active
ON public.loaner_assignments (loaner_number)
WHERE returned_at IS NULL;

-- Create indexes for performance
CREATE INDEX idx_loaner_assignments_job_id ON public.loaner_assignments(job_id);
CREATE INDEX idx_loaner_assignments_loaner_number ON public.loaner_assignments(loaner_number);
CREATE INDEX idx_loaner_assignments_returned_at ON public.loaner_assignments(returned_at);

-- Enable RLS
ALTER TABLE public.loaner_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies using Pattern 2 for access via job relationship
CREATE POLICY "users_can_view_loaner_assignments"
ON public.loaner_assignments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = loaner_assignments.job_id
    )
);

CREATE POLICY "managers_manage_loaner_assignments"
ON public.loaner_assignments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND (au.raw_user_meta_data->>'role' IN ('admin', 'manager')
             OR au.raw_app_meta_data->>'role' IN ('admin', 'manager'))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND (au.raw_user_meta_data->>'role' IN ('admin', 'manager')
             OR au.raw_app_meta_data->>'role' IN ('admin', 'manager'))
    )
);

-- Create helper function for loaner operations
CREATE OR REPLACE FUNCTION public.mark_loaner_returned(assignment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.loaner_assignments 
    SET returned_at = CURRENT_TIMESTAMP 
    WHERE id = assignment_id 
    AND returned_at IS NULL;
END;
$$;

-- Add sample loaner assignment data for existing jobs
DO $$
DECLARE
    sample_job_id UUID;
BEGIN
    -- Get an existing job with customer_needs_loaner = true
    SELECT id INTO sample_job_id 
    FROM public.jobs 
    WHERE customer_needs_loaner = true 
    LIMIT 1;
    
    -- If we have a job, create sample loaner assignment
    IF sample_job_id IS NOT NULL THEN
        INSERT INTO public.loaner_assignments (job_id, loaner_number, eta_return_date, notes)
        VALUES 
            (sample_job_id, 'LOANER-001', CURRENT_DATE + INTERVAL '7 days', 'Standard loaner vehicle assignment'),
            (sample_job_id, 'LOANER-002', CURRENT_DATE + INTERVAL '5 days', 'Courtesy car for service completion');
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Silently continue if no existing jobs found
        NULL;
END $$;