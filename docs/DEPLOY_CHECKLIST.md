# Deploy Checklist: Job Parts Vendor Relationship Fix

## Critical Rule for Relationship Migrations

**⚠️ RELATIONSHIP MIGRATIONS MUST INCLUDE `NOTIFY pgrst, 'reload schema'`**

Without this notification:
- ✅ Migration applies successfully in database
- ✅ FK constraint exists and works in SQL
- ❌ REST API doesn't recognize relationship
- ❌ Application queries fail with "relationship not found" error

### Template for Relationship Migrations

```sql
-- Your FK constraint creation
ALTER TABLE public.table_name
ADD CONSTRAINT table_name_foreign_id_fkey
FOREIGN KEY (foreign_id)
REFERENCES public.foreign_table(id);

-- CRITICAL: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

---

## Pre-Deploy Checklist

- [ ] Review migration file: `supabase/migrations/20251107093000_verify_job_parts_vendor_fk.sql`
- [ ] Confirm migration includes `NOTIFY pgrst, 'reload schema';`
- [ ] Review documentation: `docs/job_parts_vendor_relationship_fix.md`
- [ ] Ensure backup of production database is available
- [ ] Confirm which Supabase project is used by production (check VITE_SUPABASE_URL)
- [ ] Schedule deploy during low-traffic period (recommended but not required - migration is non-blocking)

## Deploy Steps

### 1. Link to Production Supabase Project
```bash
supabase link --project-ref <your-project-ref>
```

### 2. Apply Migration
```bash
supabase db push
```

Expected output should include:
```
Applying migration 20251107093000_verify_job_parts_vendor_fk.sql...
✓ Applied migration 20251107093000_verify_job_parts_vendor_fk.sql
```

Note: This migration is idempotent and safe to run multiple times.

### 3. Wait for Schema Cache Reload
The migration includes `NOTIFY pgrst, 'reload schema'` which triggers an automatic reload.
Wait 5-10 seconds for the cache to refresh.

### 4. Verify FK Constraint Exists

#### Option A: Run verification script
```bash
./scripts/verify-schema-cache.sh
```

Expected output:
```
✓ Column vendor_id exists
✓ Foreign key constraint exists (job_parts.vendor_id -> vendors.id)
✓ Schema cache reloaded
✓ Relationship query works via API
```

#### Option B: Manual SQL verification
```sql
-- Check FK constraint exists
SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'job_parts' 
  AND kcu.column_name = 'vendor_id';
```

Expected result: `job_parts_vendor_id_fkey | vendor_id | vendors`

### 5. Test REST API Endpoint
```bash
curl -X GET \
  "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```

**Success response** (relationship works):
```json
[{"id":"...","vendor_id":"...","vendor":{"id":"...","name":"..."}}]
```
or empty array if no data exists:
```json
[]
```

**Failure response** (FK missing - should NOT happen):
```json
{
  "code": "...",
  "message": "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
}
```

### 6. Verify Deals Page

1. Navigate to production Deals page URL
2. Verify page loads without errors
3. Check browser console for no 400 errors
4. Verify vendor column displays correctly:
   - Single vendor name when all off-site items use same vendor
   - "Mixed" when multiple vendors
   - "Unassigned" or fallback when no vendor assigned
5. Test creating a new deal with line items
6. Test editing an existing deal

## Post-Deploy Verification

### Automated Verification (Recommended)
```bash
# Run the comprehensive verification script
./scripts/verify-schema-cache.sh
```

This script checks:
- [ ] Column vendor_id exists in job_parts
- [ ] FK constraint job_parts_vendor_id_fkey exists
- [ ] Index idx_job_parts_vendor_id exists
- [ ] PostgREST schema cache reloaded
- [ ] REST API relationship query returns 200 OK

Exit code 0 = all checks passed, Exit code 1 = verification failed

### Manual Verification
- [ ] Deals page loads without "Missing database relationship" error
- [ ] No 400 errors in browser console
- [ ] Vendor column displays correctly in deals list
- [ ] Can create new deals with line items
- [ ] Can edit existing deals
- [ ] Filtering/sorting works without errors

### CI/CD Integration

Add this pre-e2e step to your CI pipeline:

```yaml
# .github/workflows/ci.yml (example)
- name: Verify Schema Cache
  run: ./scripts/verify-schema-cache.sh
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

Or run the unit test:

```bash
pnpm test tests/unit/db.vendor-relationship.spec.ts
```

## Rollback Procedure (if needed)

If the migration causes issues (unlikely):

```sql
-- Remove FK constraint (non-destructive)
ALTER TABLE public.job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

**Note**: This removes the FK constraint but keeps the vendor_id column and data intact.

## Troubleshooting

### Issue: API still returns "relationship not found" error

**Solution 1**: Manually reload schema cache
```sql
NOTIFY pgrst, 'reload schema';
```

**Solution 2**: Restart Supabase PostgREST service (if using self-hosted)
```bash
# Via Supabase CLI (local)
supabase stop
supabase start

# Via Supabase Cloud
# Schema cache should reload automatically; contact support if issue persists
```

### Issue: Migration fails with "constraint already exists"

**Resolution**: This is expected if the constraint was already created manually. The migration is idempotent and safe to ignore this error. Verify the constraint exists using the verification steps above.

### Issue: Backfill operation takes too long

**Resolution**: The backfill operation updates all job_parts rows where vendor_id is NULL. On large tables (>100k rows), this may take a few seconds. The operation is safe and non-blocking. If it times out:

1. Complete the migration anyway (other steps will succeed)
2. Run the backfill separately during off-peak hours:
```sql
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;
```

## Success Criteria

✅ Migration applied successfully  
✅ FK constraint `job_parts_vendor_id_fkey` exists  
✅ Index `idx_job_parts_vendor_id` exists  
✅ REST API nested select `vendor:vendors(...)` returns 200 OK  
✅ Deals page loads without errors  
✅ Vendor column displays correctly  
✅ No console errors  
✅ Can create and edit deals  

## Related Documentation

- Root cause analysis: `docs/job_parts_vendor_relationship_fix.md`
- Verification procedures: `RUNBOOK.md` (section "Verifying job_parts ↔ vendors Relationship")
- Migration file: `supabase/migrations/20251107000000_fix_job_parts_vendor_fkey.sql`
- Tests: `src/tests/migration.vendor_fkey_fix.test.js`

## Support

If issues persist after following this checklist:
1. Check Supabase logs for errors
2. Verify environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Confirm you're connected to the correct Supabase project
4. Review the full documentation in `docs/job_parts_vendor_relationship_fix.md`
