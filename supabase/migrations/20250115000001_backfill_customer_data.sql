-- One-time backfill to ensure existing deals have customer data
-- This fills vehicles.owner_* from the latest transaction, then creates minimal transactions for jobs that never got one

-- Step 1: Backfill owner info from the newest transaction per vehicle
UPDATE vehicles v 
SET owner_name = t.customer_name,
    owner_phone = t.customer_phone,
    owner_email = t.customer_email 
FROM (
  SELECT DISTINCT ON (j.vehicle_id)
         j.vehicle_id,
         t.customer_name, 
         t.customer_phone, 
         t.customer_email,
         t.created_at
  FROM jobs j
  JOIN transactions t ON t.job_id = j.id
  WHERE NULLIF(t.customer_name,'') IS NOT NULL
  ORDER BY j.vehicle_id, t.created_at DESC
) t 
WHERE v.id = t.vehicle_id
  AND COALESCE(NULLIF(v.owner_name,''), NULL) IS NULL;

-- Step 2: Seed missing transactions from vehicle owner (for old jobs)
INSERT INTO transactions (job_id, vehicle_id, total_amount, customer_name, customer_phone, customer_email, transaction_status, created_at)
SELECT j.id, 
       j.vehicle_id, 
       COALESCE(j.estimated_cost, 0),
       v.owner_name, 
       v.owner_phone, 
       v.owner_email,
       'pending', 
       NOW()
FROM jobs j
LEFT JOIN transactions t ON t.job_id = j.id
JOIN vehicles v ON v.id = j.vehicle_id
WHERE t.id IS NULL;