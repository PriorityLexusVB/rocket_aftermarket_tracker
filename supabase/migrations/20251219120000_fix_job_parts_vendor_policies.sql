-- Fix vendor job_parts policies to ensure vendor scoping matches job_parts.vendor_id
-- Maintains existing org-level policies; focuses only on vendor-scoped access

-- Drop old vendor policies if present
DROP POLICY IF EXISTS vendors_can_insert_their_job_parts ON public.job_parts;
DROP POLICY IF EXISTS vendors_can_update_their_job_parts ON public.job_parts;

-- Recreate vendor INSERT policy with proper vendor match
CREATE POLICY vendors_can_insert_their_job_parts
ON public.job_parts
FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.vendor_id = job_parts.vendor_id
      AND up.is_active = TRUE
  )
);

-- Recreate vendor UPDATE policy with proper vendor match
CREATE POLICY vendors_can_update_their_job_parts
ON public.job_parts
FOR UPDATE
TO authenticated
USING (
  vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.vendor_id = job_parts.vendor_id
      AND up.is_active = TRUE
  )
)
WITH CHECK (
  vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.vendor_id = job_parts.vendor_id
      AND up.is_active = TRUE
  )
);
