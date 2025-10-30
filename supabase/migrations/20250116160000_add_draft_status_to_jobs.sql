-- Location: supabase/migrations/20250116160000_add_draft_status_to_jobs.sql
-- Schema Analysis: Existing jobs table with job_status enum missing 'draft' value
-- Integration Type: Modificative - Adding enum value to existing type
-- Dependencies: public.jobs table, job_status enum type

-- Add 'draft' to the existing job_status enum
ALTER TYPE public.job_status ADD VALUE 'draft';

-- Update job_status column comment to reflect new value
COMMENT ON COLUMN public.jobs.job_status IS 'Job status: draft, pending, in_progress, completed, cancelled, scheduled, quality_check, delivered';

-- No additional RLS policies needed as existing policies already cover job_status column
-- No additional indexes needed as existing status index covers draft value