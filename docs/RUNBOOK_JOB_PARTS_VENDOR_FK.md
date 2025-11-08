# RUNBOOK: Job Parts Vendor Relationship Repair

## Quick Reference

**Problem**: Deals page fails to load with error about missing database relationship  
**Root Cause**: `job_parts.vendor_id` foreign key missing or PostgREST schema cache stale  
**Solution**: Run repair script and reload cache  
**Est. Time**: 2-5 minutes

---

## Symptoms

### End User Impact

- Deals list page shows error message or fails to load
- Error in console: "Could not find a relationship between 'job_parts' and 'vendors'"
- Red error banner in UI

### Technical Indicators

- Health endpoint `/api/health-deals-rel` returns `ok: false`
- Classification shows `missing_fk`, `missing_column`, or `stale_cache`
- PostgREST logs show relationship errors

---

## Diagnosis Steps

### Step 1: Check Health Endpoint

```bash
curl ${SUPABASE_URL}/api/health-deals-rel \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

**Expected Output (Healthy)**:

```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "fkName": "job_parts_vendor_id_fkey",
  "cacheRecognized": true,
  "restQueryOk": true,
  "ms": 45
}
```

**Problem Output**:

```json
{
  "ok": false,
  "classification": "missing_fk",
  "hasColumn": true,
  "hasFk": false,
  "cacheRecognized": false,
  "restQueryOk": false,
  "error": "Could not find a relationship...",
  "advice": "Run verify-schema-cache.sh then apply vendor_id FK migration...",
  "ms": 120
}
```

### Step 2: Run Verification Script

```bash
cd /path/to/project
./scripts/verify-schema-cache.sh
```

This will check:

- ✅ Column `vendor_id` exists in `job_parts`
- ✅ Foreign key constraint exists
- ✅ Index exists
- ✅ REST API relationship query works

---

## Repair Procedures

### Option A: Idempotent Repair Script (Recommended)

**When to use**: Missing column, FK, or index

```bash
# Run idempotent repair script
supabase db execute --file scripts/repair-job-parts-vendor-fk.sql
```

**What it does**:

1. Checks if `vendor_id` column exists, adds if missing
2. Checks if FK constraint exists, adds if missing
3. Checks if index exists, creates if missing
4. Backfills `vendor_id` from `products.vendor_id` where possible
5. Reloads PostgREST schema cache

**Safe to run multiple times**: ✅ Yes

### Option B: Cache Reload Only

**When to use**: Column and FK exist but cache is stale

```bash
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

Wait 5-10 seconds, then verify.

### Option C: Full Migration

**When to use**: Fresh environment or initial setup

```bash
supabase db push
```

This applies all pending migrations including the vendor relationship fix.

---

## Verification

After running repair, verify in this order:

### 1. Database Schema

```sql
-- Check column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'job_parts' AND column_name = 'vendor_id';

-- Check FK
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'job_parts' AND column_name = 'vendor_id';

-- Check index
SELECT indexname FROM pg_indexes
WHERE tablename = 'job_parts' AND indexname = 'idx_job_parts_vendor_id';
```

**Expected**: All queries return rows

### 2. REST API

```bash
curl "${SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

**Expected**: 200 OK with JSON array (may be empty)

### 3. Health Endpoint

```bash
curl ${SUPABASE_URL}/api/health-deals-rel \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

**Expected**: `"ok": true, "classification": "ok"`

### 4. Application

- Navigate to deals list page
- Verify no red errors
- Verify vendor column populates

---

## Troubleshooting

### Issue: Repair script fails with "permission denied"

**Solution**: Check database role permissions

```sql
-- Grant necessary permissions
GRANT ALL ON TABLE job_parts TO authenticated;
GRANT ALL ON TABLE vendors TO authenticated;
```

### Issue: Cache reload doesn't take effect

**Symptoms**: DB checks pass but REST API still fails

**Solution**: Restart PostgREST service

```bash
# Via Supabase dashboard:
# Settings > Database > Restart Database
```

Wait 30-60 seconds for service to restart.

### Issue: Backfill fails

**Symptoms**: Script completes but `vendor_id` still NULL

**Solution**: Check if products have `vendor_id`

```sql
SELECT COUNT(*) FROM products WHERE vendor_id IS NOT NULL;
```

If count is 0, products need vendor assignment first.

---

## Rollback

This change is non-destructive. To revert:

### Remove FK (not recommended, breaks app)

```sql
ALTER TABLE job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;
```

### Remove column (not recommended, data loss)

```sql
ALTER TABLE job_parts DROP COLUMN IF EXISTS vendor_id;
```

**Note**: Rolling back will break the deals page. Only do this during emergency recovery.

---

## Prevention

### In CI/CD Pipeline

Add schema verification step:

```yaml
- name: Verify Schema
  run: |
    ./scripts/verify-schema-cache.sh
    if [ $? -ne 0 ]; then
      echo "Schema drift detected!"
      exit 1
    fi
```

### Regular Health Checks

Set up monitoring alert:

```bash
# Cron job to check health every 5 minutes
*/5 * * * * curl -sf ${SUPABASE_URL}/api/health-deals-rel || echo "Health check failed"
```

### Deployment Checklist

Before deploying code changes:

1. ✅ Run `supabase db push` to apply migrations
2. ✅ Run `verify-schema-cache.sh` to confirm
3. ✅ Check health endpoint returns `ok: true`
4. ✅ Test one deal list page load
5. ✅ Deploy application code

---

## Related Documentation

- **Detailed Troubleshooting**: `docs/TROUBLESHOOTING_SCHEMA_CACHE.md`
- **Schema Fingerprint**: `docs/schema-fingerprint.json`
- **Migration File**: `supabase/migrations/20251107093000_verify_job_parts_vendor_fk.sql`
- **Repair Script**: `scripts/repair-job-parts-vendor-fk.sql`

---

## Contact

For urgent issues:

- Check application logs for fallback mode indicators
- Review sessionStorage `cap_jobPartsVendorRel` flag (should be `'true'`)
- Check telemetry counter `telemetry_vendorFallback` (should be 0 in healthy state)

**Degraded Mode**: If relationship is broken, app falls back gracefully:

- Vendor column shows "Unassigned" or job-level vendor
- No red errors shown to end users
- sessionStorage flag `cap_jobPartsVendorRel='false'` indicates degraded mode
