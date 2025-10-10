-- Backfill customer data to fix existing deals showing N/A
-- This migration performs safe data synchronization between vehicles and transactions

-- Step 1: Backfill owner info from the newest transaction per vehicle
-- This updates vehicles.owner_* from the latest transaction per vehicle
UPDATE vehicles v 
SET 
  owner_name = t.customer_name,
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
  WHERE nullif(t.customer_name,'') IS NOT NULL
  ORDER BY j.vehicle_id, t.created_at DESC
) t 
WHERE v.id = t.vehicle_id
  AND coalesce(nullif(v.owner_name,''), null) IS NULL;

-- Step 2: Seed missing transactions from vehicle owner data for old jobs
-- This creates minimal transaction records for jobs that don't have any
INSERT INTO transactions (
  job_id, 
  vehicle_id, 
  total_amount, 
  customer_name, 
  customer_phone, 
  customer_email, 
  transaction_status, 
  created_at
)
SELECT 
  j.id, 
  j.vehicle_id, 
  coalesce(j.estimated_cost, 0),
  v.owner_name, 
  v.owner_phone, 
  v.owner_email,
  'pending', 
  now()
FROM jobs j
LEFT JOIN transactions t ON t.job_id = j.id
JOIN vehicles v ON v.id = j.vehicle_id
WHERE t.id IS NULL
  AND v.owner_name IS NOT NULL
  AND v.owner_name != '';

-- Step 3: Add helpful comment for future reference
COMMENT ON TABLE transactions IS 'Customer transaction records - now properly backfilled and synchronized with vehicle owner data';