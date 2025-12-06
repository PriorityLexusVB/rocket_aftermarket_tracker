# Debugging Line Items Accumulation Bug

## Problem Statement

When editing a deal multiple times in production, `job_parts` rows accumulate in the database:
- Start with 1 row
- Edit and save → 2 rows in DB
- Edit and save again → 3 rows in DB
- Pattern continues: 1 → 2 → 3 → 4 → ...

Despite the DELETE + INSERT pattern working correctly, extra rows keep getting added.

## Investigation Commits

1. **44e8359** - Added extensive debug logging throughout save pipeline
2. **411aaad** - Added comprehensive test simulating full edit cycle
3. **77bad28** - Added duplicate detection warning in toJobPartRows

## How to Debug in Production

### Step 1: Enable Console Logging

1. Open your browser's DevTools (F12)
2. Go to the Console tab
3. Clear the console
4. Keep it open while testing

### Step 2: Perform Test Scenario

1. **Find a job with known line item count**
   - In Supabase, run:
   ```sql
   SELECT job_id, product_id, unit_price 
   FROM job_parts 
   WHERE job_id = 'your-job-id';
   ```
   - Note the count (e.g., 1 row)

2. **Edit the deal**
   - Navigate to Deals → Edit the job
   - Watch console for: `[DealFormV2] Loading line items into state:`
   - **Verify**: `fromJobProp` and `mappedCount` match DB count

3. **Make a change**
   - Change the price or any field
   - Click "Update Deal"
   - Watch console for these logs in order:

### Step 3: Analyze Console Logs

Look for these specific log messages:

#### A. Loading Phase
```
[DealFormV2] Loading line items into state: {
  jobId: "...",
  fromJobProp: 1,      ← Should match DB count
  mappedCount: 1,      ← Should equal fromJobProp
  sample: { ... }
}
```

**What to check:**
- Are `fromJobProp` and `mappedCount` equal?
- Do they match the DB row count?
- If not, **duplicates entered during load**

#### B. Save Phase - Form Payload
```
[DealFormV2] Saving deal with payload: {
  mode: "edit",
  lineItemsCount: 1,          ← Should match state
  lineItemsStateCount: 1,     ← Should equal lineItemsCount
  lineItemsSample: { ... }
}
```

**What to check:**
- Are `lineItemsCount` and `lineItemsStateCount` equal?
- Do they match the loaded count from step A?
- If `lineItemsCount` > `lineItemsStateCount`, **duplication during payload build**

#### C. Save Phase - Service Entry
```
[dealService:updateDeal] ENTRY: {
  jobId: "...",
  formStateKeys: [...],
  lineItemsCount: 1,      ← Should match form payload
  line_itemsCount: 0
}
```

**What to check:**
- Does `lineItemsCount` match the payload from step B?
- Is `line_itemsCount` (snake_case) non-zero? (should be 0)
- If count increased, **duplication in service call**

#### D. Save Phase - After Normalization
```
[dealService:updateDeal] AFTER mapFormToDb: {
  normalizedLineItemsCount: 1,  ← Should match ENTRY count
  normalizedLineItemsSample: { ... }
}
```

**What to check:**
- Does `normalizedLineItemsCount` match ENTRY count?
- If it increased, **duplication in mapFormToDb**

#### E. Save Phase - Before INSERT
```
[dealService:updateDeal] BEFORE INSERT: {
  normalizedLineItemsCount: 1,
  rowsCount: 1,              ← Should equal normalizedLineItemsCount
  rowsSample: { ... }
}
```

**What to check:**
- Does `rowsCount` match `normalizedLineItemsCount`?
- If it increased, **duplication in toJobPartRows**

#### F. Duplicate Detection Warning
```
[toJobPartRows] ⚠️ DUPLICATE DETECTION: Multiple rows have the same product_id! {
  totalRows: 2,
  uniqueProducts: 1,
  productIds: ["prod-1", "prod-1"]
}
```

**If you see this:**
- **SMOKING GUN!** Duplicates are in the rows being inserted
- The duplication happened in one of the earlier steps
- Go back through logs A-E to find where count first increased

### Step 4: Check Database After Save

```sql
SELECT * FROM job_parts WHERE job_id = 'your-job-id';
```

**Expected:** Same count as `rowsCount` from log E
**If more rows:** Bug is in database layer or concurrent saves

### Step 5: Reopen and Verify

1. Close the edit modal
2. Reopen the same deal
3. Check log A again: `fromJobProp` should match DB count
4. **If `fromJobProp` > expected:** DB has accumulated rows, cycle repeats

## Common Patterns and Root Causes

### Pattern 1: Accumulation During Load
```
Log A shows: fromJobProp: 2 (but DB has 1 row)
```
**Root cause:** `getDeal()` or `mapDbDealToForm()` creating duplicates

### Pattern 2: Accumulation During Payload Build
```
Log A: lineItemsStateCount: 1
Log B: lineItemsCount: 2
```
**Root cause:** DealFormV2.handleSave doubling the items

### Pattern 3: Accumulation During Normalization
```
Log C: lineItemsCount: 1
Log D: normalizedLineItemsCount: 2
```
**Root cause:** `mapFormToDb()` processing items twice

### Pattern 4: Accumulation During Row Conversion
```
Log D: normalizedLineItemsCount: 1
Log E: rowsCount: 2
```
**Root cause:** `toJobPartRows()` creating duplicate rows

### Pattern 5: DB Already Has Duplicates
```
All logs show count: 1
DB query shows: 2 rows
```
**Root cause:** Previous bug instance left orphaned rows

## Reporting Findings

Please copy all console logs and paste them in the PR comment along with:

1. **Initial DB state:** Row count before edit
2. **Final DB state:** Row count after edit
3. **All console logs:** From steps A-E above
4. **Which pattern** (1-5) matches your logs

This will help pinpoint the exact location of the bug for a targeted fix.

## Quick Fixes to Try

If you need an immediate workaround:

### Workaround 1: Manual DB Cleanup
```sql
-- Find duplicates
SELECT job_id, product_id, COUNT(*)
FROM job_parts
GROUP BY job_id, product_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keeps newest based on ID)
DELETE FROM job_parts a
USING job_parts b
WHERE a.job_id = b.job_id
  AND a.product_id = b.product_id
  AND a.id < b.id;
```

### Workaround 2: Hard Refresh
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```
Clears any stale cached state.

## Next Steps

Once you provide the console logs, I will:
1. Identify the exact location where duplication occurs
2. Implement a targeted fix
3. Add a test that reproduces and prevents the issue
4. Verify the fix doesn't break existing functionality
5. Document the root cause and prevention strategy
