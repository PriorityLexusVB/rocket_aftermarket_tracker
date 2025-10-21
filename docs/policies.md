# RLS Policies (inspection + templates)

This document shows inspection queries and example RLS policies for org-scoped tables.

## Inspect existing policies

-- List policies for a table
SELECT \* FROM pg_policies WHERE tablename = 'vendors';

-- Show functions used by policies
SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%is_admin%';

## Example: org-scoped SELECT policy for `vendors`

-- Allow users to select vendors belonging to their org_id stored in user_profiles
CREATE POLICY "select_vendors_by_org" ON public.vendors
FOR SELECT
USING (
EXISTS (
SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.org_id = vendors.org_id
)
);

-- Example insert/update policy (requires `org_id` in payload to match user's org)
CREATE POLICY "insert_vendors_by_org" ON public.vendors
FOR INSERT
WITH CHECK (
EXISTS (
SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.org_id = NEW.org_id
)
);

## Notes

- These policies are examples only. Test in Supabase Studio before applying.
- Some tables may use different patterns: ownership via created_by, role-based policies, or public reads for vendor records. Adjust accordingly.
- If you get "permission denied" errors, copy the exact table name and the error message; use the pattern above to craft a minimal policy.
