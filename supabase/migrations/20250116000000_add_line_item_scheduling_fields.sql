-- Location: supabase/migrations/20250116000000_add_line_item_scheduling_fields.sql
-- Schema Analysis: Existing job_parts table with basic fields, adding per-line-item scheduling support
-- Integration Type: Modificative - adding columns to existing table
-- Dependencies: job_parts table (existing)

-- Add new columns to job_parts table for per-line-item scheduling
ALTER TABLE public.job_parts 
ADD COLUMN IF NOT EXISTS promised_date DATE;

ALTER TABLE public.job_parts 
ADD COLUMN IF NOT EXISTS requires_scheduling BOOLEAN;

ALTER TABLE public.job_parts 
ADD COLUMN IF NOT EXISTS no_schedule_reason TEXT;

ALTER TABLE public.job_parts 
ADD COLUMN IF NOT EXISTS is_off_site BOOLEAN DEFAULT false;

-- Update ALL existing records to have consistent data BEFORE setting default values
-- Step 1: For existing records, set requires_scheduling to true and assign promised_date
UPDATE public.job_parts 
SET 
  requires_scheduling = true,
  promised_date = CURRENT_DATE + INTERVAL '1 day'
WHERE requires_scheduling IS NULL;

-- Step 2: Now set the default for future inserts
ALTER TABLE public.job_parts 
ALTER COLUMN requires_scheduling SET DEFAULT true;

-- Step 3: Set no_schedule_reason for any records where requires_scheduling is false
-- This ensures data consistency for the constraint
UPDATE public.job_parts 
SET no_schedule_reason = 'Legacy record - no scheduling required'
WHERE requires_scheduling = false AND (no_schedule_reason IS NULL OR no_schedule_reason = '');

-- Step 4: Add indexes for new columns to improve query performance
CREATE INDEX IF NOT EXISTS idx_job_parts_promised_date ON public.job_parts(promised_date);
CREATE INDEX IF NOT EXISTS idx_job_parts_requires_scheduling ON public.job_parts(requires_scheduling);
CREATE INDEX IF NOT EXISTS idx_job_parts_is_off_site ON public.job_parts(is_off_site);

-- Step 5: Add constraint AFTER all data is consistent
-- Either requires_scheduling is true with promised_date, or false with no_schedule_reason
ALTER TABLE public.job_parts
ADD CONSTRAINT check_scheduling_logic 
CHECK (
  (requires_scheduling = true AND promised_date IS NOT NULL) OR
  (requires_scheduling = false AND no_schedule_reason IS NOT NULL AND no_schedule_reason != '') OR
  (requires_scheduling IS NULL)
);

-- Update RLS policies to handle new columns (using existing pattern)
-- No policy changes needed as existing policies already cover new columns via ALL operations