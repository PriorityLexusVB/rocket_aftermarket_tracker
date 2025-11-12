# RUNBOOK: Migration Repair for Job Parts Scheduling & Vendor Columns

## Overview

This runbook provides step-by-step instructions to diagnose and fix issues related to missing `job_parts` columns for scheduling times and vendor relationships.

## Target Migrations

- `20250116000000_add_line_item_scheduling_fields.sql` - Basic scheduling fields
- `20250117000000_add_job_parts_scheduling_times.sql` - Per-line time windows
- `20251106000000_add_job_parts_vendor_id.sql` - Vendor ID column
- `20251107093000_verify_job_parts_vendor_fk.sql` - FK verification and reload

## Common Issues

### Issue 1: Missing `scheduled_start_time` / `scheduled_end_time` columns

**Symptom:** 400 errors on `/rest/v1/jobs` with message "column scheduled_start_time does not exist"

**Diagnosis:**

```bash
# Check health endpoint
curl https://your-domain.com/api/health/job-parts-times

# Direct database query
psql -d your_database -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'job_parts'
    AND column_name IN ('scheduled_start_time', 'scheduled_end_time');
"
```

**Remediation:**

```bash
# 1. Apply the migration
npx supabase db push --file supabase/migrations/20250117000000_add_job_parts_scheduling_times.sql

# 2. Verify columns exist
psql -d your_database -c "
  SELECT
    column_name,
    data_type,
    is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'job_parts'
    AND column_name LIKE 'scheduled_%';
"

# 3. Verify indexes created
psql -d your_database -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'job_parts'
    AND indexname LIKE '%scheduled%';
"

# 4. Reload PostgREST schema cache
psql -d your_database -c "NOTIFY pgrst, 'reload schema';"

# 5. Verify via REST API
curl https://your-domain.com/rest/v1/job_parts?select=id,scheduled_start_time,scheduled_end_time&limit=1
```

**Expected Result:** Query returns successfully (even if values are null)

---

### Issue 2: Missing `vendor_id` column on job_parts

**Symptom:** 400 errors with message "column vendor_id does not exist" or "Could not find a relationship between job_parts and vendors"

**Diagnosis:**

```bash
# Check health endpoint
curl https://your-domain.com/api/health/deals-rel

# Direct database query
psql -d your_database -c "
  SELECT
    column_name,
    data_type,
    is_nullable
  FROM information_schema.columns
  WHERE table_name = 'job_parts'
    AND column_name = 'vendor_id';
"
```

**Remediation:**

```bash
# 1. Apply vendor_id migration
npx supabase db push --file supabase/migrations/20251106000000_add_job_parts_vendor_id.sql

# 2. Verify column exists
psql -d your_database -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'job_parts' AND column_name = 'vendor_id';
"

# 3. Check FK constraint (may not exist yet)
psql -d your_database -c "
  SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts'
    AND kcu.column_name = 'vendor_id';
"

# 4. Apply FK verification migration
npx supabase db push --file supabase/migrations/20251107093000_verify_job_parts_vendor_fk.sql

# 5. Verify FK constraint now exists
psql -d your_database -c "
  SELECT constraint_name
  FROM pg_constraint
  WHERE conname = 'job_parts_vendor_id_fkey';
"

# 6. Reload PostgREST schema cache
psql -d your_database -c "NOTIFY pgrst, 'reload schema';"

# 7. Verify via REST API with relationship
curl "https://your-domain.com/rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1"
```

**Expected Result:** Query returns successfully with vendor relationship expanded

---

### Issue 3: Stale PostgREST Schema Cache

**Symptom:** Columns/FKs exist in database but REST API returns "not found in schema cache"

**Diagnosis:**

```bash
# Check capabilities endpoint
curl https://your-domain.com/api/health/capabilities

# Verify database has columns but API doesn't recognize them
# Database check (should succeed):
psql -d your_database -c "
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'job_parts' AND column_name = 'vendor_id';
"

# REST API check (may fail):
curl "https://your-domain.com/rest/v1/job_parts?select=vendor_id&limit=1"
```

**Remediation:**

```bash
# 1. Reload PostgREST schema cache
psql -d your_database -c "NOTIFY pgrst, 'reload schema';"

# 2. Wait 2-3 seconds for PostgREST to process

# 3. If using Supabase CLI locally:
npx supabase db reset

# 4. If on hosted Supabase, use admin endpoint (requires admin auth):
curl -X POST https://your-domain.com/api/admin/reload-schema \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 5. Verify cache refreshed
curl https://your-domain.com/api/health/capabilities
```

**Expected Result:** All capability checks return "ok" status

---

## Verification Checklist

After applying fixes, verify the following:

### ✅ Database Structure

```sql
-- All required columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'job_parts'
  AND column_name IN (
    'promised_date',
    'requires_scheduling',
    'no_schedule_reason',
    'is_off_site',
    'scheduled_start_time',
    'scheduled_end_time',
    'vendor_id'
  )
ORDER BY column_name;
```

### ✅ Foreign Keys

```sql
-- FK constraint exists and is valid
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'job_parts'
  AND kcu.column_name = 'vendor_id';
```

### ✅ Indexes

```sql
-- Performance indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'job_parts'
  AND (
    indexname LIKE '%scheduled%'
    OR indexname LIKE '%vendor_id%'
  )
ORDER BY indexname;
```

### ✅ REST API Endpoints

```bash
# Health endpoints return ok
curl https://your-domain.com/api/health/job-parts-times
curl https://your-domain.com/api/health/deals-rel
curl https://your-domain.com/api/health/capabilities

# Direct queries work
curl "https://your-domain.com/rest/v1/job_parts?select=id,scheduled_start_time,scheduled_end_time,vendor_id&limit=1"
curl "https://your-domain.com/rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1"
```

### ✅ Application Behavior

```bash
# Deals page loads without 400 errors
# Check browser console for capability detection logs
# Verify telemetry counters are not incrementing unexpectedly

# Access telemetry in browser console:
sessionStorage.getItem('cap_jobPartsTimes')        # should be 'true'
sessionStorage.getItem('cap_jobPartsVendorId')     # should be 'true'
sessionStorage.getItem('cap_jobPartsVendorRel')    # should be 'true'
sessionStorage.getItem('telemetry_scheduledTimesFallback')  # should be '0' or low
```

---

## Rollback Procedures

If migrations cause issues, rollback in reverse order:

```bash
# Rollback FK verification (20251107093000)
psql -d your_database -c "
  ALTER TABLE job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;
"

# Rollback vendor_id column (20251106000000)
psql -d your_database -c "
  DROP INDEX IF EXISTS idx_job_parts_vendor_id;
  ALTER TABLE job_parts DROP COLUMN IF EXISTS vendor_id;
"

# Rollback scheduled_* columns (20250117000000)
psql -d your_database -c "
  DROP INDEX IF EXISTS idx_job_parts_scheduled_start_time;
  DROP INDEX IF EXISTS idx_job_parts_scheduled_end_time;
  ALTER TABLE job_parts DROP COLUMN IF EXISTS scheduled_start_time;
  ALTER TABLE job_parts DROP COLUMN IF EXISTS scheduled_end_time;
"

# Reload schema cache after rollback
psql -d your_database -c "NOTIFY pgrst, 'reload schema';"
```

**Note:** After rollback, the application will automatically detect missing columns and enter degraded mode (no per-line times or vendor assignment).

---

## Support & Troubleshooting

### Contact Information

- GitHub Issues: [PriorityLexusVB/rocket_aftermarket_tracker/issues](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/issues)

### Debug Mode

Enable verbose logging in browser console:

```javascript
// In browser console
sessionStorage.setItem('debug_capabilities', 'true')
// Reload page and check console for detailed capability detection logs
```

### Additional Diagnostics

```sql
-- Check for orphaned job_parts with invalid vendor_id
SELECT jp.id, jp.vendor_id
FROM job_parts jp
LEFT JOIN vendors v ON jp.vendor_id = v.id
WHERE jp.vendor_id IS NOT NULL AND v.id IS NULL
LIMIT 10;

-- Check for job_parts with scheduling requirements but missing dates
SELECT id, requires_scheduling, promised_date, scheduled_start_time, scheduled_end_time
FROM job_parts
WHERE requires_scheduling = true
  AND (promised_date IS NULL OR scheduled_start_time IS NULL)
LIMIT 10;
```

---

## Change Log

- 2025-01-09: Initial runbook created
- 2025-01-09: Added verification checklist and rollback procedures
