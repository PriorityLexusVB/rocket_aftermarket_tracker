-- Location: supabase/migrations/20251222181000_add_delivery_coordinator.sql
-- Schema Analysis: Existing jobs table with user_profiles relationships
-- Integration Type: Enhancement - Adding delivery coordinator field
-- Dependencies: public.jobs, public.user_profiles

-- Add delivery coordinator column to jobs table
ALTER TABLE public.jobs 
ADD COLUMN delivery_coordinator_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Add index for delivery coordinator lookup
CREATE INDEX idx_jobs_delivery_coordinator_id ON public.jobs(delivery_coordinator_id);

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.delivery_coordinator_id IS 'Staff member responsible for coordinating delivery logistics';