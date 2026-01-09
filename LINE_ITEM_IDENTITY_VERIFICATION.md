# Line Item Identity Fix — Quick Verification Guide

**Commit:** 30cdfdc  
**Branch:** worktree-2025-12-24T18-33-44  
**Date:** 2024-12-24

---

## What This Fix Does

**Problem:** Line items deleted in the UI would "resurrect" after save/reopen.

**Root causes:**

1. Unstable React keys (Date.now() changed on every render)
2. No DB id in save payload (sync couldn't distinguish UPDATE from INSERT)
3. "Delete all + insert all" pattern (changed all ids, broke hydration)
4. Silent RLS blocks (no error when deletes failed)

**Solution:**

1. ✅ Stable identity: `id` (DB) + `clientId` (client-side UUID)
2. ✅ Sync by ids: fetch existing → diff → delete/update/insert
3. ✅ RLS guard: throw error if expected deletes but none executed
4. ✅ Better defaults: new items default to tomorrow's date

---

## Manual Verification Steps

### Test 1: Delete + Add Scenario (The Classic Resurrection Bug)

**Before this fix:**

1. Create deal with items A, B, C
2. Save
3. Reopen in edit mode
4. Delete item B
5. Add items D, E
6. Save
7. Reopen → **BUG:** See A, B, C, D, E (B resurrected! 5 items instead of 4)

**After this fix:**

1. Create deal with items A, B, C
2. Save
3. Reopen in edit mode
4. Delete item B
5. Add items D, E
6. Save
7. Reopen → **FIXED:** See A, C, D, E (B stays deleted! 4 items)

### Test 2: Edit Existing Item

**Expected behavior:**

1. Create deal with item A (price $100)
2. Save
3. Reopen in edit mode
4. Change item A price to $200
5. Save
6. Reopen → Item A still has same id, only price changed

**Verification:**

- Check console logs: `[syncJobPartsForJob] Updated 1 rows`
- NOT: `Deleted 1 rows` + `Inserted 1 rows`

### Test 3: RLS Block Detection

**Setup:** (Requires admin access to test)

1. Temporarily remove DELETE permission for job_parts
2. Create deal with items A, B
3. Save
4. Reopen, delete item B
5. Save

**Expected result:**

- ❌ Error: "Failed to delete 1 job_parts (RLS policy may be blocking)"
- NOT: Silent failure with B resurrecting later

### Test 4: Default Date Behavior

**Expected behavior:**

1. Open "New Deal" form
2. Navigate to "Line Items" step
3. Click "Add Item"

**Verification:**

- "Date Scheduled" field should default to **tomorrow's date** (local timezone)
- NOT: Empty string or "invalid date"

---

## Console Logging to Verify

### Development Mode (import.meta.env.MODE === 'development')

When saving a deal, you should see logs like:

```
[syncJobPartsForJob] Starting sync: { jobId: '12345678...', lineItemsCount: 4 }
[syncJobPartsForJob] Diff computed: { existing: 3, incoming: 4, toDelete: 1, toUpdate: 2, toInsert: 1 }
[syncJobPartsForJob] Deleted 1 rows
[syncJobPartsForJob] Updated 2 rows
[syncJobPartsForJob] Inserted 1 rows
[syncJobPartsForJob] Sync completed successfully
```

**Key indicators:**

- `toDelete: 1` → One item was removed in UI
- `toUpdate: 2` → Two items were modified
- `toInsert: 1` → One new item was added
- `Deleted 1 rows` → Confirms delete executed (not blocked)

---

## Database Verification Queries

### Check for Duplicate Line Items (Should be 0)

```sql
-- For a specific job_id, find duplicates by full signature
SELECT
  job_id,
  product_id,
  promised_date,
  scheduled_start_time,
  scheduled_end_time,
  unit_price,
  vendor_id,
  COUNT(*) as count
FROM job_parts
WHERE job_id = '<your-job-id-here>'
GROUP BY job_id, product_id, promised_date, scheduled_start_time, scheduled_end_time, unit_price, vendor_id
HAVING COUNT(*) > 1;
```

**Expected result:** No rows (0 duplicates)

### Check Line Item Identity Stability

```sql
-- For a job_id you've edited multiple times, check if ids changed
SELECT id, product_id, unit_price, created_at, updated_at
FROM job_parts
WHERE job_id = '<your-job-id-here>'
ORDER BY created_at;
```

**Expected behavior:**

- Items you didn't delete should keep the same `id` across saves
- `updated_at` timestamp changes on edits, but `id` stays the same
- Only newly added items get fresh ids

---

## Rollback Instructions (If Issues Arise)

If you encounter problems after this fix:

```bash
# Revert the commit
git revert 30cdfdc

# Or, reset to previous commit (CAUTION: loses uncommitted changes)
git reset --hard HEAD~1

# Then rebuild
pnpm run build
```

**Safe to rollback because:**

- No schema changes (Drizzle types unchanged)
- Old function `replaceJobPartsForJob` still exists (just deprecated)
- clientId addition is backward-compatible (ignored by DB)

---

## Success Criteria

✅ **Test 1 passed:** Deleted items stay deleted (no resurrection)  
✅ **Test 2 passed:** Edited items keep same id (no id churn)  
✅ **Test 3 passed:** RLS blocks surface as errors (not silent failures)  
✅ **Test 4 passed:** New items default to tomorrow's date  
✅ **Build passed:** `pnpm run build` succeeds  
✅ **Tests passed:** `pnpm test` shows 918 passed | 2 skipped

---

## Debugging Tips

### If items still resurrect:

1. **Check payload includes id:**

   ```js
   console.log('Line items payload:', payload.lineItems)
   // Should show: [{ id: '...', product_id: '...', ... }, ...]
   // NOT: [{ product_id: '...', ... }] (missing id)
   ```

2. **Check sync logs:**

   ```js
   // Look for: [syncJobPartsForJob] Diff computed: { toDelete: N, ... }
   // If toDelete is 0 when you deleted items → payload missing ids
   ```

3. **Check RLS policies:**
   ```sql
   -- Verify user can DELETE job_parts
   SELECT * FROM pg_policies WHERE tablename = 'job_parts' AND cmd = 'DELETE';
   ```

### If items duplicate:

1. **Check dedupe logic:**

   ```js
   // buildJobPartsPayload should log merged duplicates in dev mode
   console.warn('[buildJobPartsPayload] Merged duplicate line item:', ...)
   ```

2. **Check for manual inserts:**
   ```js
   // Search codebase for: supabase.from('job_parts').insert
   // All inserts should go through syncJobPartsForJob or replaceJobPartsForJob
   ```

---

## Next Steps After Verification

1. **Monitor production:** Watch for "Failed to delete" errors in logs
2. **User feedback:** Ask users to report if deleted items come back
3. **Optional enhancement:** Implement Supabase RPC for transactional sync (see LINE_ITEM_IDENTITY_FIX_SUMMARY.md, TODO #1)

---

**End of Verification Guide**
