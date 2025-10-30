-- RLS Policy to allow reading transaction fields tied to visible jobs
-- This ensures transactions come back in queries instead of returning empty

-- Drop existing policy if it exists, then recreate
DROP POLICY IF EXISTS "txn_select_via_job" ON transactions;

-- Allow selects on transactions tied to visible jobs
CREATE POLICY "txn_select_via_job" 
ON transactions 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM jobs j 
    WHERE j.id = transactions.job_id
  )
);