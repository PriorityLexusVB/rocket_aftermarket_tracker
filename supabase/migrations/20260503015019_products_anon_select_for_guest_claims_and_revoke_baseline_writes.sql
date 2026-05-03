-- Wave XVII-B: Products anon SELECT for guest claims dropdown + revoke baseline writes
--
-- JUSTIFICATION (Rule 16, anon-grant burden of proof):
-- 1. The guest claims submission form (public route /guest-claims-submission-form)
--    calls claimsService.getProducts() without an authenticated session. Without
--    anon SELECT, the product dropdown returns HTTP 401 permission denied and the
--    form gracefully degrades to "Other (please specify)" only — customers cannot
--    file claims tied to specific products. Confirmed broken via curl + browser
--    console logs. Restored access is column-scoped to the safe catalog subset
--    (id/name/brand/category/description/unit_price); columns considered sensitive
--    (cost, quantity_in_stock, minimum_stock_level, vendor_id, op_code, dealer_id,
--    org_id, created_by, created_at, updated_at) are NOT in the column-level grant.
-- 2. The exposed catalog subset is non-confidential — product names, brands,
--    categories, descriptions, and retail unit_price are already on the dealer's
--    public website and quote pages. No PII, no internal cost, no stock levels,
--    no vendor relationships. Acceptable because the form is a customer-facing
--    claim entry surface and the data is non-confidential catalog information.

-- ---------------------------------------------------------------------------
-- 1. Revoke baseline anon write/DDL grants (Supabase default-baseline grants;
--    not added by any migration, but currently violate Rule 16 burden of proof.
--    Currently no-ops at runtime because no anon RLS policy permits the cmd, but
--    explicit REVOKE closes the door cleanly.)
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Column-level SELECT grant for anon — safe catalog subset only
-- ---------------------------------------------------------------------------
GRANT SELECT (id, name, brand, category, description, unit_price) ON public.products TO anon;

-- ---------------------------------------------------------------------------
-- 3. Add anon RLS SELECT policy: only return active products. is_active IS NOT
--    FALSE includes both true and NULL (legacy products that pre-date the column
--    default). Replayable: DROP IF EXISTS first.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_anon_select_active" ON public.products;

CREATE POLICY "products_anon_select_active"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_active IS NOT FALSE);

-- ---------------------------------------------------------------------------
-- 4. Tell PostgREST to reload its schema cache (anon column grants take effect).
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
