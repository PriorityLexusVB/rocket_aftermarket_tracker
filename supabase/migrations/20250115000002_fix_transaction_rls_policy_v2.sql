-- Fix transaction RLS policy to allow reading transactions tied to visible jobs
-- This ensures customer data is properly accessible when deals are displayed

-- Drop existing policy if it exists and create a new one
DROP POLICY IF EXISTS "txn_select_via_job" ON transactions;

-- Create policy to allow selecting transactions tied to visible jobs
CREATE POLICY "txn_select_via_job" ON transactions 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM jobs j 
    WHERE j.id = transactions.job_id
  )
);

-- Optional: Ensure RLS is enabled on transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;