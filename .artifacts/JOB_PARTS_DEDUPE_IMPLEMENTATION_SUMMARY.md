# Job Parts Duplication Fix - Focused Follow-up Implementation Summary

**Date:** 2024-12-08  
**Issue:** Job parts duplication on repeated saves  
**Solution:** Hard dedupe guardrail + write path consolidation

---

## Problem Statement

User reported that job_parts table was accumulating duplicate entries on repeated deal saves:
- Save once: 1 row
- Save twice: 2 rows
- Save thrice: 3 rows

This indicated that the DELETE + INSERT sequence was either:
1. Not executing the DELETE
2. Executing multiple INSERTs
3. Accumulating duplicates within a single INSERT payload

---

## Root Causes Identified

### 1. Multiple Write Paths (Partially Fixed Previously)

**Before this PR:**
- ✅ `dealService.createDeal` - Already using `replaceJobPartsForJob`
- ✅ `dealService.updateDeal` - Already using `replaceJobPartsForJob`
- ✅ `CreateModal` (calendar) - Already using `replaceJobPartsForJob`
- ❌ `jobService.createJob` - Still using custom `insertLineItems()` function

**After this PR:**
- ✅ All runtime writes now go through `replaceJobPartsForJob`
- ✅ Custom `insertLineItems()` function removed

### 2. No Dedupe Guardrail (Fixed in This PR)

The `toJobPartRows()` function had duplicate detection logging but did NOT prevent duplicates from being inserted. If the same line item appeared multiple times in the payload (e.g., from UI state bugs), it would create multiple DB rows.

---

## Solution Implemented

### 1. Hard Dedupe Guardrail

**Function:** `normalizeAndDedupeJobPartRows(rows, opts)`

**Location:** `src/services/jobPartsService.js` (lines 19-78)

**Composite Key:**
```javascript
compositeKey = [
  product_id,
  vendor_id (if JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE),
  scheduled_start_time (if JOB_PARTS_HAS_PER_LINE_TIMES),
  scheduled_end_time (if JOB_PARTS_HAS_PER_LINE_TIMES)
].join('|')
```

**Merge Strategy:**
- If duplicate key found: sum `quantity_used`, keep first occurrence's other fields
- Else: add to dedupe map

**Example:**
```javascript
// Input: 3 identical line items
[
  { product_id: 'A', vendor_id: 'V1', quantity_used: 2 },
  { product_id: 'A', vendor_id: 'V1', quantity_used: 3 },
  { product_id: 'A', vendor_id: 'V1', quantity_used: 5 }
]

// Output: 1 merged line item
[
  { product_id: 'A', vendor_id: 'V1', quantity_used: 10 } // 2+3+5
]
```

### 2. Integration Points

**Normal Path:**
```javascript
const rawRows = toJobPartRows(jobId, lineItems, opts)
const rows = normalizeAndDedupeJobPartRows(rawRows, opts)  // <-- NEW
await supabase.from('job_parts').insert(rows)
```

**Retry Paths (missing vendor_id or scheduled times):**
```javascript
const retryRawRows = toJobPartRows(jobId, lineItems, opts)
const retryRows = normalizeAndDedupeJobPartRows(retryRawRows, opts)  // <-- NEW
await supabase.from('job_parts').insert(retryRows)
```

### 3. Write Path Consolidation

**Refactored:** `jobService.createJob` (line 200-208)

**Before:**
```javascript
await insertLineItems(created?.id, dealData?.lineItems)
```

**After:**
```javascript
await replaceJobPartsForJob(created?.id, dealData?.lineItems)
```

**Removed:** `insertLineItems()` function (59 lines deleted)

---

## Testing

### New Tests Added (6 tests, 140 lines)

**File:** `src/tests/jobPartsService.test.js`

1. **Merge identical line items by summing quantity**
   - Input: 3 identical items with qty 2, 3, 5
   - Expected: 1 row with qty 10

2. **Don't merge different products**
   - Input: 2 items with different product_id
   - Expected: 2 separate rows

3. **Don't merge different vendors**
   - Input: 2 items with different vendor_id
   - Expected: 2 separate rows

4. **Don't merge different scheduled times**
   - Input: 2 items with different start/end times
   - Expected: 2 separate rows

5. **Prevent accumulation across 3 consecutive saves**
   - Save 1: DELETE(1) + INSERT(1) = 1 row
   - Save 2: DELETE(1) + INSERT(1) = 1 row (not 2)
   - Save 3: DELETE(1) + INSERT(1) = 1 row (not 3)

6. **Second save without accumulation** (pre-existing test, verified still passes)

### Test Results

```
✅ All 11 tests passing in jobPartsService.test.js
✅ All 867 unit tests passing across 86 test files
✅ Build successful (vite build --sourcemap)
```

---

## Development Visibility

### Dedupe Logging (Dev Mode Only)

When duplicates are merged:
```javascript
console.warn('[normalizeAndDedupeJobPartRows] Merged duplicate line item:', {
  product_id: 'A',
  vendor_id: 'V1',
  scheduled_start_time: null,
  scheduled_end_time: null,
  old_quantity: 2,
  added_quantity: 3,
  new_quantity: 5  // Merged
})
```

When deduplication reduces row count:
```javascript
console.log('[normalizeAndDedupeJobPartRows] Deduplication: 3 rows → 1 rows (2 duplicates merged)')
```

---

## Files Changed

### Modified (3 files)

1. **src/services/jobPartsService.js** (+90 lines, ~5 lines modified)
   - Added `normalizeAndDedupeJobPartRows()` function
   - Integrated into `replaceJobPartsForJob()` main path and retry paths
   - Removed old duplicate detection warning (replaced by guardrail)

2. **src/services/jobService.js** (-59 lines, +1 line)
   - Replaced `insertLineItems()` call with `replaceJobPartsForJob()`
   - Removed entire `insertLineItems()` function

3. **src/tests/jobPartsService.test.js** (+140 lines)
   - Added 6 new comprehensive dedupe tests

### Created (2 files)

4. **.artifacts/job_parts_write_verification.md** (new)
   - Comprehensive audit of all write paths
   - Documents what was changed and why

5. **docs/DEV_CONSOLE_NOISE.md** (new)
   - Explains safe-to-ignore console errors:
     - Chrome extension errors (no impact on job_parts)
     - Pre-login RLS 401s (expected behavior)

---

## Verification Checklist

### Completed ✅

- [x] All direct writes to job_parts now use `replaceJobPartsForJob`
- [x] Dedupe guardrail implemented with composite key
- [x] Duplicates merged by summing quantity_used
- [x] All capability flags preserved (vendor_id, scheduled times)
- [x] Comprehensive test coverage (11 tests)
- [x] All 867 unit tests passing
- [x] Build successful
- [x] Development logging added
- [x] Console noise documented

### Pending (Requires Live Environment) 🔄

- [ ] Deploy to preview environment
- [ ] Manual SQL verification:
  ```sql
  -- Test procedure:
  -- 1. Create deal with 1 line item
  -- 2. Click "Update Deal" 3 times
  -- 3. Run:
  SELECT count(*) FROM job_parts WHERE job_id = '<test-job-id>';
  -- Expected: 1 (not 3)
  ```
- [ ] E2E test run (requires Supabase env vars)
- [ ] Smoke test in production-like environment

---

## Rollback Plan

If issues arise in production:

1. **Revert this PR** - Previous state had `replaceJobPartsForJob` but no dedupe guardrail
2. **Merge logic issues** - Adjust composite key fields in `normalizeAndDedupeJobPartRows`
3. **Quantity sum issues** - Change merge strategy from sum to first-wins or last-wins

---

## Related Documentation

- `JOB_PARTS_WRITE_CONSOLIDATION.md` - Original write path consolidation
- `DEBUGGING_ACCUMULATION_BUG.md` - Investigation guide
- `DEAL_EDIT_LINE_ITEMS_FIX.md` - Historical fix documentation
- `.artifacts/job_parts_write_verification.md` - This PR's audit
- `docs/DEV_CONSOLE_NOISE.md` - Console error reference

---

## Key Takeaways

1. **Single Source of Truth:** All job_parts writes must go through `replaceJobPartsForJob`
2. **Defense in Depth:** Even if UI state bugs cause duplicate payloads, dedupe guardrail catches them
3. **Atomic Replace:** DELETE once + INSERT once = no accumulation possible
4. **Capability Aware:** Dedupe respects environment capabilities (vendor_id, scheduled times)
5. **Well Tested:** 11 tests prove no accumulation, correct merging, proper separation

---

## Future Enhancements (Optional)

1. Add transaction wrapper for atomicity (BEGIN/COMMIT)
2. Add optimistic locking (check `updated_at` before DELETE)
3. Add telemetry for duplicate merge events (track frequency)
4. Add validation layer (reject suspicious payloads before write)
5. Add batch operations for multiple jobs at once

---

**Status:** ✅ Ready for preview deployment and manual verification
