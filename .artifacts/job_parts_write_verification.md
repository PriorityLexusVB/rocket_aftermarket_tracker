# Job Parts Write Path Verification

## Date: 2024-12-08

## Objective
Re-verify all write paths to `job_parts` table to ensure runtime writes go through `replaceJobPartsForJob()`.

## Findings

### ✅ Already Using `replaceJobPartsForJob`

1. **dealService.js** (line 1606, 2025)
   - `createDeal()` - Uses `replaceJobPartsForJob`
   - `updateDeal()` - Uses `replaceJobPartsForJob`

2. **jobService.js** (line 252)
   - `updateJob()` - Uses `replaceJobPartsForJob`

3. **CreateModal.jsx** (line 588)
   - Calendar appointment creation - Uses `replaceJobPartsForJob`

### ⚠️ Direct INSERT Still Present

1. **jobService.js** (line 98)
   - Function: `insertLineItems()` (internal helper)
   - Usage: Only called from `createJob()` at line 203
   - Issue: Direct `supabase.from('job_parts').insert(payload)`
   - **Action Required**: Refactor to use `replaceJobPartsForJob` instead

### ✅ Read-Only Operations (No Action Needed)

The following files contain `job_parts` references but only for READ operations:
- `src/api/health/capabilities.js` - Health checks
- `src/api/health/deals-rel.js` - Relationship verification
- `src/api/health/job-parts-times.js` - Schema checks
- `src/services/analyticsService.js` - SELECT queries
- `src/services/claimsAnalyticsService.js` - SELECT queries
- `src/pages/currently-active-appointments/components/AppointmentDetailPanel.jsx` - SELECT
- All test files - Test setup/teardown

### ✅ DELETE Operations (Cleanup/Rollback)

The following use DELETE but are part of cleanup/rollback flows:
- `dealService.js` line 1680 - Best-effort rollback on error
- `jobService.js` line 297 - Cascading delete when deleting entire job

These are acceptable as they're not part of normal save flows.

## SQL Migrations

No direct `INSERT INTO job_parts` statements found in migration files.

## Conclusion

**Only 1 direct write path remains:**
- `jobService.js` - `insertLineItems()` function used by `createJob()`

**Refactoring Plan:**
1. Replace `insertLineItems(created?.id, dealData?.lineItems)` with `replaceJobPartsForJob(created?.id, dealData?.lineItems)`
2. Remove the now-unused `insertLineItems()` function
3. Update error handling to match `replaceJobPartsForJob` behavior

This will ensure 100% of runtime writes go through the centralized, dedupe-protected helper.
