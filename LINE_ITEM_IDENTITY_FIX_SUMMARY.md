# Line Item Identity Fix — Implementation Summary

**Date:** 2024-12-24  
**Goal:** Eliminate line-item resurrection bugs by implementing stable identity and proper sync semantics

---

## Changes Made

### 1. Stable Line-Item Identity (DealFormV2.jsx)

**Problem:** Line items used `Date.now()` as temporary id, making React keys unstable and causing items to lose identity between renders.

**Solution:**
- ✅ Added `clientId: crypto.randomUUID()` for new items (client-side stable identity)
- ✅ Preserved `id` (job_part.id) when hydrating from DB
- ✅ Changed React key from `item?.id` to `item?.id ?? item?.clientId`
- ✅ Default `dateScheduled` to tomorrow (local timezone) instead of empty string

**Files changed:**
- `src/components/deals/DealFormV2.jsx` (4 edits)

**Key code changes:**
```js
// Before: unstable identity
{
  id: Date.now(),
  dateScheduled: '',
}

// After: stable identity + better defaults
{
  id: null,                      // DB id (null for new items)
  clientId: crypto.randomUUID(), // Stable client-side identity
  dateScheduled: tomorrowStr,    // Tomorrow's date (local timezone)
}
```

---

### 2. Identity-Based Sync (jobPartsService.js)

**Problem:** `replaceJobPartsForJob` used "delete all + insert all" pattern, which:
- Changed all ids on every save (breaks caching/hydration)
- Could be silently blocked by RLS (no error surfaced)
- Caused resurrection bugs when payload didn't match DB state

**Solution:** Implemented `syncJobPartsForJob` with proper diff algorithm:

1. **Fetch** existing job_parts ids for this job
2. **Diff:**
   - `toDelete` = existing ids NOT in incoming payload
   - `toUpdate` = existing ids WITH updates in payload
   - `toInsert` = new items (no id)
3. **Execute:**
   - DELETE rows in `toDelete`
   - UPDATE rows in `toUpdate`
   - INSERT rows in `toInsert`
4. **Guard:** If `toDelete.length > 0` but `deletedCount === 0`, throw error (RLS block detected)

**Files changed:**
- `src/services/jobPartsService.js` (new function: 223 lines)
- `src/services/dealService.js` (2 call sites updated)
- `src/services/jobService.js` (2 call sites updated)
- `src/pages/calendar/components/CreateModal.jsx` (1 call site updated)

**Backward compatibility:**
- `replaceJobPartsForJob` kept but marked `@deprecated`
- All usages migrated to `syncJobPartsForJob`

---

### 3. Payload Includes DB Identity (DealFormV2.jsx)

**Problem:** Save payload didn't include job_part.id, so sync function couldn't distinguish updates from inserts.

**Solution:**
- ✅ Added `id: item?.id ?? null` to lineItems.map() in handleSave
- ✅ Hydration preserves `id` from DB when loading existing deals

**Files changed:**
- `src/components/deals/DealFormV2.jsx` (1 edit in handleSave, 1 edit in useEffect)

---

## Safety Guardrails Respected

✅ **Section 1 (Stack Lock):** No dependency changes  
✅ **Section 2 (Data Rules):** Tenant scoping preserved, no direct Supabase imports in components  
✅ **Section 3 (UI Rules):** All inputs remain controlled, debounce/autosave patterns unchanged  
✅ **Section 20 (Schema Canon):** No schema changes (Drizzle types unchanged)  

**Files touched:** 5 (under ≤10 limit)  
**Minimal diffs:** Only changed lines necessary for identity stability  

---

## Verification Commands

### Build
```bash
pnpm run build
# ✅ Result: Built successfully in 35.58s
```

### Tests
```bash
pnpm test
# ✅ Result: 918 passed | 2 skipped (920 tests)
# ✅ All existing tests pass without modification
```

### Manual UI Check (Recommended)
1. Navigate to `/deals/new` (or open existing deal in edit mode)
2. Add 3 line items: A, B, C
3. Save the deal
4. Reopen the deal in edit mode
5. Delete item B
6. Add items D, E (with different products/dates)
7. Save again
8. Reopen and verify: should see A, C, D, E (4 items)
   - ❌ **Before this fix:** Would see A, B, C, D, E (5 items, B resurrected)
   - ✅ **After this fix:** B stays deleted, only A, C, D, E appear

---

## Technical Details

### Sync Algorithm Complexity

**Before (replaceJobPartsForJob):**
- DELETE all (N rows)
- INSERT all (M rows)
- **Complexity:** O(N + M)
- **Problem:** Changes all ids, no granular control

**After (syncJobPartsForJob):**
- FETCH existing ids (1 query)
- DELETE only removed items (K rows where K ≤ N)
- UPDATE only changed items (U rows where U ≤ M)
- INSERT only new items (I rows where I ≤ M)
- **Complexity:** O(N + K + U + I) but with stable ids
- **Benefit:** Existing items keep their ids, better for caching/hydration

### RLS Block Detection

If user has INSERT but not DELETE permission on job_parts:
- **Before:** Silent failure (duplicate key violations on next save)
- **After:** Explicit error: "Failed to delete N job_parts (RLS policy may be blocking)"

---

## Rollback Strategy

If issues arise, revert to `replaceJobPartsForJob`:

```bash
# Revert all 5 files
git revert <commit-hash>
```

**Safe to rollback because:**
- clientId addition is backward-compatible (ignored by DB)
- replaceJobPartsForJob still exists (just deprecated)
- No schema changes (Drizzle types unchanged)

---

## Follow-up TODOs (Optional Enhancements)

### 1. Supabase RPC for Transactional Sync (Recommended)

Wrap the sync algorithm in a Postgres function for atomicity:

**Benefits:**
- All ops (DELETE + UPDATE + INSERT) in single transaction
- Consistent results (no partial writes)
- Can return canonical DB state in one roundtrip
- Easier RLS handling (SECURITY DEFINER with explicit org checks)

**Migration template:**
```sql
-- supabase/migrations/[timestamp]_sync_job_parts_rpc.sql
CREATE OR REPLACE FUNCTION sync_job_parts_for_job(
  p_job_id UUID,
  p_incoming_parts JSONB
) RETURNS JSONB AS $$
DECLARE
  v_existing_ids UUID[];
  v_incoming_ids UUID[];
  v_to_delete UUID[];
  v_deleted_count INT;
BEGIN
  -- 1. Fetch existing ids
  SELECT ARRAY_AGG(id) INTO v_existing_ids
  FROM job_parts WHERE job_id = p_job_id;
  
  -- 2. Extract incoming ids
  SELECT ARRAY_AGG((value->>'id')::UUID)
  INTO v_incoming_ids
  FROM JSONB_ARRAY_ELEMENTS(p_incoming_parts)
  WHERE value->>'id' IS NOT NULL;
  
  -- 3. Compute deletes
  v_to_delete := ARRAY(
    SELECT UNNEST(v_existing_ids) EXCEPT SELECT UNNEST(v_incoming_ids)
  );
  
  -- 4. DELETE
  IF ARRAY_LENGTH(v_to_delete, 1) > 0 THEN
    DELETE FROM job_parts WHERE id = ANY(v_to_delete);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Guard: if expected deletes but none happened
    IF v_deleted_count = 0 THEN
      RAISE EXCEPTION 'Failed to delete % job_parts (RLS blocked)', ARRAY_LENGTH(v_to_delete, 1);
    END IF;
  END IF;
  
  -- 5. UPDATE + INSERT (upsert pattern)
  -- ... (implementation details)
  
  -- 6. Return canonical state
  RETURN (SELECT JSONB_AGG(row_to_json(jp)) FROM job_parts jp WHERE jp.job_id = p_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Report Tools for Validation

**Report 1 — DB truth vs UI truth**
```sql
-- For job_id = '<job-id>', find duplicates by full signature
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
WHERE job_id = '<job-id>'
GROUP BY job_id, product_id, promised_date, scheduled_start_time, scheduled_end_time, unit_price, vendor_id
HAVING COUNT(*) > 1;
```

**Report 2 — Delete effectiveness**
```js
// Before save:
console.log('Existing parts:', existingParts.length)

// During save (in syncJobPartsForJob):
console.log('Expected deletes:', toDelete.length)
console.log('Actual deletes:', deletedCount)

// If toDelete.length > 0 && deletedCount === 0 → RLS or filter mismatch
```

**Report 3 — Hydration correctness**
```js
// On opening Edit Deal:
console.log('Hydrated line items:', lineItems.length, lineItems.map(i => i.id))

// On closing and re-opening:
// Verify state starts clean (no residual lineItems from last open)
```

### 3. Enhanced Signature for Duplicate Detection

Currently, `buildJobPartsPayload` dedupes by composite key:
- `job_id + product_id + vendor_id + scheduled_start_time + scheduled_end_time`

**Recommendation:** Add to signature:
- `unit_price` (prevent merging items with different prices)
- `promised_date` (prevent merging items with different dates)

---

## Why This Fix Works

### 1. Stable Identity End-to-End
- **UI:** React keys never change (`id ?? clientId`)
- **Payload:** Includes DB id for existing items
- **Sync:** Uses id for diff (UPDATE vs INSERT)
- **Result:** No identity confusion at any layer

### 2. Explicit Delete Verification
- **Before:** Silent RLS blocks → resurrection bugs
- **After:** Guard throws error if deletes expected but not executed
- **Result:** RLS issues surface immediately, no silent data corruption

### 3. Granular Updates
- **Before:** All ids change on every save
- **After:** Only modified/new items get touched
- **Result:** Caching/hydration work correctly, no stale data merges

---

## Edge Cases Handled

### Case 1: User deletes item B, adds new item D
- **Payload:** `[{id: A_id, ...}, {id: C_id, ...}, {id: null, ...}]` (D has no id)
- **Sync:** DELETE B_id, UPDATE A_id and C_id, INSERT D
- **Result:** B stays deleted, D gets new DB id

### Case 2: User edits existing item (changes price)
- **Payload:** `[{id: A_id, unit_price: 200}]`
- **Sync:** UPDATE A_id SET unit_price = 200
- **Result:** A keeps same id, only price changes

### Case 3: RLS blocks DELETE
- **Sync:** toDelete.length > 0, deletedCount = 0
- **Error:** "Failed to delete N job_parts (RLS policy may be blocking)"
- **Result:** User sees explicit error, can contact admin

### Case 4: Duplicate items in UI (same product, same time)
- **buildJobPartsPayload:** Dedupes by composite key, sums quantities
- **Result:** Only one row inserted, no DB unique constraint violation

---

## Summary of Benefits

✅ **No more resurrection bugs** — Deleted items stay deleted  
✅ **Stable identity** — React keys + DB ids never change for existing items  
✅ **RLS visibility** — Blocked deletes surface as errors, not silent failures  
✅ **Better defaults** — New items default to tomorrow's date (local timezone)  
✅ **Backward compatible** — Old function kept, all call sites migrated  
✅ **Zero test changes** — 918 tests pass without modification  
✅ **Minimal diff** — 5 files, 242 additions, 20 deletions  

---

## Next Steps

1. **Merge to main:** Stage changes, commit, push
2. **Manual validation:** Follow UI check steps above
3. **Monitor production:** Watch for "Failed to delete" errors (indicates RLS issues)
4. **Optional:** Implement Supabase RPC for transactional sync (see TODO #1)

---

**End of Summary**
