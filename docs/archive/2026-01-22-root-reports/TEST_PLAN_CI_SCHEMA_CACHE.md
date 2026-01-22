# Test Plan: CI Schema Cache Reload Migration

**Migration**: `20251222040813_notify_pgrst_reload_schema.sql`  
**Purpose**: Verify PostgREST schema cache reload resolves CI workflow failure  
**Related Issue**: [GitHub Actions Run #20421300544](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20421300544/job/58673597481)

---

## Pre-Deployment Testing ✅ COMPLETE

### 1. Migration Syntax Validation ✅

**Test**: Verify migration file is syntactically correct

```bash
node /tmp/test_migration_syntax.js
```

**Result**: ✅ PASSED

- Contains `NOTIFY pgrst` command
- Proper syntax: `NOTIFY pgrst, 'reload schema'`
- No dangerous commands
- Comprehensive documentation

### 2. Build Verification ✅

**Test**: Ensure codebase builds successfully

```bash
pnpm run build
```

**Result**: ✅ PASSED (10.38s, 0 errors)

- All 3157 modules transformed
- No build errors
- Source maps generated

### 3. Lint Verification ✅

**Test**: Check for code quality issues

```bash
pnpm run lint
```

**Result**: ✅ PASSED (0 errors)

- No linting errors
- Code style consistent

---

## Post-Deployment Testing (When Migration is Applied)

### 1. Migration Application Test

**Objective**: Verify migration applies successfully to Supabase

**Steps**:

1. Ensure Supabase project is linked:

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

2. Apply migrations:
   ```bash
   supabase db push
   ```

**Expected Output**:

```
Applying migration 20251222040813_notify_pgrst_reload_schema.sql...
✓ Applied migration 20251222040813_notify_pgrst_reload_schema.sql
```

**Success Criteria**:

- [ ] Migration applies without errors
- [ ] NOTICE messages logged showing success
- [ ] No rollback or constraint violations

---

### 2. Schema Cache Verification Test

**Objective**: Confirm PostgREST recognizes schema changes

**Method A: Automated Script** (Recommended)

```bash
bash scripts/verify-schema-cache.sh
```

**Expected Output**:

```
✅ All Verification Checks Passed
  ✓ Column vendor_id exists in job_parts table
  ✓ Foreign key constraint exists (job_parts -> vendors)
  ✓ Index exists (idx_job_parts_vendor_id)
  ✓ Schema cache reloaded
  ✓ REST API relationship query works (200 OK)
```

**Method B: Manual SQL Verification**

```sql
-- Check if NOTIFY was successful (no direct way, verify by testing relationship)
SELECT
  tc.constraint_name,
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
```

**Expected Result**: 1 row showing `job_parts_vendor_id_fkey`

**Success Criteria**:

- [ ] Script exits with code 0
- [ ] All verification checks pass
- [ ] No relationship errors

---

### 3. Health Endpoint Test

**Objective**: Verify health endpoints return success after cache reload

**Test Command**:

```bash
curl -s "${VITE_SUPABASE_URL}/api/health-deals-rel" | jq .
```

**Expected Response** (Success):

```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "fkName": "job_parts_vendor_id_fkey",
  "cacheRecognized": true,
  "restQueryOk": true,
  "rowsChecked": 1,
  "ms": 150
}
```

**Failure Indicators** (Should NOT occur):

```json
{
  "ok": false,
  "classification": "stale_cache",
  "error": "Could not find relationship...",
  "advice": "NOTIFY pgrst, 'reload schema'"
}
```

**Success Criteria**:

- [ ] Response has `"ok": true`
- [ ] `classification` is `"ok"`
- [ ] `cacheRecognized` is `true`
- [ ] `restQueryOk` is `true`

---

### 4. REST API Relationship Query Test

**Objective**: Verify FK relationships work via REST API

**Test Command**:

```bash
curl -X GET \
  "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```

**Expected Response** (Success):

```json
[
  {
    "id": "...",
    "vendor_id": "...",
    "vendor": {
      "id": "...",
      "name": "Vendor Name"
    }
  }
]
```

Or empty array if no data: `[]`

**Failure Response** (Should NOT occur):

```json
{
  "code": "PGRST201",
  "message": "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
}
```

**Success Criteria**:

- [ ] HTTP status 200
- [ ] Response is valid JSON array
- [ ] No error messages about relationships
- [ ] Nested `vendor` object present (if data exists)

---

### 5. CI Workflow Test

**Objective**: Verify nightly workflow passes after fix

**Method A: Manual Trigger**

1. Navigate to: [Actions → Nightly RLS Drift & Health Check](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/workflows/rls-drift-nightly.yml)
2. Click "Run workflow" button
3. Select branch: `main`
4. Click "Run workflow"

**Method B: Wait for Nightly Run**

- Workflow runs automatically at 3 AM UTC daily
- Check results next morning

**Expected Results**:

- [ ] Step 6 "Run Schema Drift Script": ✅ PASS
- [ ] Step 9 "Check Health Endpoint": ✅ PASS
- [ ] Step 10 "Check Deals Relationship Health Endpoint": ✅ PASS
- [ ] Step 14 "Fail Workflow on Issues": ✅ SKIPPED (no issues)
- [ ] Overall workflow status: ✅ SUCCESS

**Workflow Summary Should Show**:

```
✅ PASS - No schema drift detected
✅ PASS - Basic health check OK
✅ PASS - Deals relationship OK
✅ All Checks Passed - System healthy
```

**Success Criteria**:

- [ ] Workflow completes with success status
- [ ] No schema drift detected
- [ ] All health checks pass
- [ ] No issues created

---

### 6. Deals Page Integration Test

**Objective**: Verify Deals page functionality after fix

**Manual Testing**:

1. **Navigate to Deals page**:
   - URL: `${APP_URL}/deals`
   - Verify page loads without errors

2. **Check browser console**:
   - Open DevTools → Console
   - Should see NO errors about:
     - "Missing database relationship"
     - "Could not find relationship"
     - 400/500 errors

3. **Verify vendor column displays**:
   - In deals list, check "Vendor" column
   - Should show vendor names (not "Unknown" or errors)

4. **Create new deal**:
   - Click "New Deal"
   - Fill out form with line items
   - Assign vendors to line items
   - Save deal
   - Verify no errors during save

5. **Edit existing deal**:
   - Open an existing deal
   - Modify line items or vendors
   - Save changes
   - Verify updates persist correctly

**Success Criteria**:

- [ ] Deals page loads without errors
- [ ] Vendor column displays correctly
- [ ] Can create new deals with line items
- [ ] Can edit existing deals
- [ ] No console errors related to relationships

---

## Rollback Testing (If Issues Occur)

### Emergency Rollback

**If migration causes unexpected issues**:

```sql
-- This is safe as NOTIFY has no persistent effect
-- No rollback needed - just reload again
NOTIFY pgrst, 'reload schema';
```

**Note**: This migration only triggers a cache reload. It makes no schema changes, so there's nothing to rollback. If issues persist, they're likely from the original migrations (Dec 18-19), not this fix.

**Success Criteria**:

- [ ] System returns to previous state
- [ ] No data loss
- [ ] Original issue may return (stale cache)

---

## Test Results Summary

### Pre-Deployment ✅

| Test               | Status    | Date         | Notes                 |
| ------------------ | --------- | ------------ | --------------------- |
| Migration Syntax   | ✅ PASSED | Dec 22, 2025 | Proper NOTIFY command |
| Build Verification | ✅ PASSED | Dec 22, 2025 | 10.38s, 0 errors      |
| Lint Verification  | ✅ PASSED | Dec 22, 2025 | 0 errors              |

### Post-Deployment ⏳

| Test                      | Status     | Date | Notes                       |
| ------------------------- | ---------- | ---- | --------------------------- |
| Migration Application     | ⏳ PENDING | -    | Awaiting deployment         |
| Schema Cache Verification | ⏳ PENDING | -    | Run after deployment        |
| Health Endpoint           | ⏳ PENDING | -    | Check /api/health-deals-rel |
| REST API Relationship     | ⏳ PENDING | -    | Verify FK queries work      |
| CI Workflow               | ⏳ PENDING | -    | Next nightly run            |
| Deals Page Integration    | ⏳ PENDING | -    | Manual verification         |

---

## Test Execution Checklist

### Immediate (After Deployment)

- [ ] Apply migration via `supabase db push`
- [ ] Run `bash scripts/verify-schema-cache.sh`
- [ ] Check health endpoint: `curl .../api/health-deals-rel`
- [ ] Verify REST API: `curl .../rest/v1/job_parts?select=...`

### Within 24 Hours

- [ ] Trigger CI workflow manually OR wait for nightly run
- [ ] Verify workflow passes all steps
- [ ] Check workflow summary for success message

### Ongoing Monitoring

- [ ] Monitor Deals page for errors (DevTools console)
- [ ] Check Sentry/logs for relationship errors (if applicable)
- [ ] Verify no new issues reported by users

---

## Related Documentation

- **Fix Summary**: `FIX_SUMMARY_CI_SCHEMA_CACHE.md`
- **Detailed Analysis**: `docs/CI_FIX_SCHEMA_CACHE_RELOAD_20251222.md`
- **Deploy Checklist**: `docs/DEPLOY_CHECKLIST.md`
- **Verification Script**: `scripts/verify-schema-cache.sh`
- **Workflow File**: `.github/workflows/rls-drift-nightly.yml`

---

**Test Plan Status**: ✅ Pre-deployment complete | ⏳ Post-deployment pending
