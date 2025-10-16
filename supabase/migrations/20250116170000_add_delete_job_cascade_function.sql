-- Create safe cascade delete function for jobs
-- This function ensures proper cleanup of related records when deleting jobs

CREATE OR REPLACE FUNCTION public.delete_job_cascade(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
BEGIN
  -- Delete related records in dependency order
  
  -- 1. Delete job_parts first (they reference jobs)
  DELETE FROM public.job_parts 
  WHERE job_id = p_job_id;
  
  -- 2. Delete transactions (they reference jobs)
  DELETE FROM public.transactions 
  WHERE job_id = p_job_id;
  
  -- 3. Delete communications (they reference jobs)
  DELETE FROM public.communications 
  WHERE job_id = p_job_id;
  
  -- 4. Finally delete the job itself
  DELETE FROM public.jobs 
  WHERE id = p_job_id;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_job_cascade(uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_job_cascade(uuid) IS 'Safely deletes a job and all related records in proper dependency order';