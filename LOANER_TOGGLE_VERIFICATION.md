# Loaner Toggle Workflow Implementation Verification

## Summary of Findings

The loaner toggle workflow is **substantially implemented** with both UI and data persistence logic. However, there are some important nuances and one potential gap in the delete workflow.

---

## 1. LOANER TOGGLE CHECKBOX ✅

### Location: `/src/components/deals/DealFormV2.jsx` (lines 589-606)

**Implementation:**

```jsx
<section className="flex items-center gap-3">
  <input
    id="needsLoaner"
    data-testid="loaner-checkbox"
    className="h-5 w-5 accent-blue-600 appearance-auto"
    type="checkbox"
    checked={customerData?.needsLoaner}
    onChange={(e) => {
      setCustomerData((prev) => ({ ...prev, needsLoaner: e.target.checked }))
      if (e.target.checked) {
        setTimeout(() => loanerRef?.current?.focus?.(), 0)
      }
    }}
  />
  <label htmlFor="needsLoaner" className="text-sm text-slate-800">
    Customer needs loaner
  </label>
</section>
```

**Key Features:**

- ✅ Checkbox exists and toggles `needsLoaner` state
- ✅ Auto-focuses loaner number input when checked
- ✅ Has proper test ID for testing
- ✅ Centered and visually integrated

---

## 2. CONDITIONAL HIDING OF LOANER FIELDS WHEN TOGGLE IS OFF ✅

### Location: `/src/components/deals/DealFormV2.jsx` (lines 608-625)

**Implementation:**

```jsx
{
  customerData?.needsLoaner && (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Loaner #</label>
        <input
          ref={loanerRef}
          data-testid="loaner-number-input"
          className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
          placeholder="Enter loaner vehicle number"
          value={customerData?.loanerNumber ?? ''}
          onChange={(e) => setCustomerData((prev) => ({ ...prev, loanerNumber: e.target.value }))}
          required
        />
      </div>
    </div>
  )
}
```

**Key Features:**

- ✅ Loaner section ONLY renders when `needsLoaner` is true
- ✅ Properly hidden when toggle is OFF
- ✅ Contains loaner number input with auto-focus
- ⚠️ Currently only shows loaner number (no return date or notes in V2)

---

## 3. LOANER FIELDS APPEARANCE WHEN TOGGLE IS ON ✅

### Location: `/src/components/deals/DealFormV2.jsx` (lines 608-625)

**Current Fields:**

- ✅ Loaner # (vendor/loaner number input)

**Note:** The form only displays `loanerNumber` in V2, though the data structure supports:

- `loanerNumber` (vendor number)
- `eta_return_date` (return date)
- `notes` (loaner notes)

These additional fields exist in formAdapters and dealService but aren't rendered in DealFormV2 UI.

---

## 4. EDIT MODE TOGGLE STATE REFLECTION ✅

### Location: `/src/components/deals/DealFormV2.jsx` (lines 116-134)

**Implementation:**

```jsx
useEffect(() => {
  if (job && mode === 'edit' && job.id && initializedJobId.current !== job.id) {
    initializedJobId.current = job.id

    setCustomerData({
      // ... other fields ...
      needsLoaner: Boolean(job?.customer_needs_loaner),
      loanerNumber: job?.loaner_number || '',
    })
    // ...
  }
}, [job?.id, mode])
```

**Key Features:**

- ✅ Edit mode properly loads `customer_needs_loaner` as boolean
- ✅ Loaner number is loaded from job data
- ✅ Toggle reflects current saved state
- ✅ Data loaded from both camelCase and snake_case fields

**Data Source Flow:**

```
Database → dealService.getDeal() → mapDbDealToForm() →
  { needsLoaner, loanerNumber, loanerForm } → DealFormV2
```

---

## 5. LOANER DATA CLEARING ON TOGGLE OFF ⚠️ PARTIAL

### Clearing in Form State: ✅

When toggle is OFF in DealFormV2, the fields are simply **hidden** (not cleared from state). This is acceptable because:

- When user saves with toggle OFF, `loanerForm` is explicitly set to null (line 322)
- Form state clearing is not strictly necessary since payload controls persistence

### Clearing in Save Payload: ✅

**Location:** `/src/components/deals/DealFormV2.jsx` (lines 313-322)

```jsx
customer_needs_loaner: Boolean(customerData?.needsLoaner),
// Send loanerForm when needsLoaner is true for proper persistence via loaner_assignments
loanerForm: customerData?.needsLoaner
  ? {
      loaner_number: customerData?.loanerNumber?.trim() || '',
      eta_return_date: null,
      notes: null,
    }
  : null,
```

**Key Features:**

- ✅ When toggle is OFF: `loanerForm: null`
- ✅ When toggle is ON: `loanerForm` has loaner data
- ✅ Explicit null ensures database persistence layer knows toggle is off

### Additional Clearing via formAdapters: ✅

**Location:** `/src/components/deals/formAdapters.js` (lines 54-63)

```javascript
export function stripLoanerWhenOff(draft = {}) {
  const on = !!(draft.customer_needs_loaner ?? draft.customerNeedsLoaner)
  if (on) return { ...draft }
  const clone = { ...draft }
  // Remove all loaner-related keys when toggle is off
  for (const k of Object.keys(clone)) {
    if (k.toLowerCase().includes('loaner')) delete clone[k]
  }
  return clone
}
```

**Application Flow:**

- ✅ Applied in `draftToCreatePayload()` (line 112)
- ✅ Applied in `draftToUpdatePayload()` (calls draftToCreatePayload)
- ✅ Removes ALL loaner-related keys when toggle is OFF
- ⚠️ Only applied when `useV2` flag is enabled and using dealService directly

---

## 6. LOANER DATA DELETION FROM DATABASE ⚠️ MISSING

### Current Behavior:

**Location:** `/src/services/dealService.js` (lines 1418, 1697)

```javascript
// A3: Handle loaner assignment for new deals
if (payload?.customer_needs_loaner && loanerForm) {
  await upsertLoanerAssignment(job?.id, loanerForm)
}

// A3: Handle loaner assignment updates
if (payload?.customer_needs_loaner && loanerForm) {
  await upsertLoanerAssignment(id, loanerForm)
}
```

**Issue Found:**

- ⚠️ When toggle is turned OFF: loaner assignments are **NOT deleted**
- ⚠️ Existing loaner assignment records remain in database (orphaned)
- ⚠️ The condition only handles CREATE/UPDATE, not DELETE

**Impact:**

- If user turns loaner toggle OFF and saves, the loaner_assignments table still has the record
- The deal's `customer_needs_loaner` flag is false, so loaner is ignored
- But database contains ghost loaner assignments

**Missing Implementation:**

```javascript
// NOT IMPLEMENTED - Should delete loaner assignments when toggle is turned OFF
if (!payload?.customer_needs_loaner) {
  // DELETE loaner assignments for this job
  const { error } = await supabase?.from('loaner_assignments')?.delete()?.eq('job_id', id)
  if (error) throw wrapDbError(error, 'delete loaner assignments')
}
```

---

## 7. LOANER DATA PERSISTENCE LOGIC ✅

### Data Flow on Save:

**Create Mode:**

```
DealFormV2.handleSave()
  → Creates payload with customer_needs_loaner & loanerForm
  → dealService.createDeal()
    → mapFormToDb() validates & structures data
    → upsertLoanerAssignment() creates loaner_assignments record
    → Returns deal with loaner data
```

**Update Mode:**

```
DealFormV2.handleSave()
  → Updates payload with customer_needs_loaner & loanerForm
  → dealService.updateDeal()
    → mapFormToDb() validates & structures data
    → upsertLoanerAssignment() updates loaner_assignments record
    → Returns updated deal
```

### Persistence Functions:

**Location:** `/src/services/dealService.js` (lines 601-645)

```javascript
async function upsertLoanerAssignment(jobId, loanerData) {
  if (!loanerData?.loaner_number?.trim()) {
    return // No loaner number provided, skip assignment
  }

  // Check for existing assignment
  const { data: existing } = await supabase
    ?.from('loaner_assignments')
    ?.select('id')
    ?.eq('job_id', jobId)
    ?.is('returned_at', null)
    ?.single()

  if (existing) {
    // Update existing
  } else {
    // Create new
  }
}
```

**Key Features:**

- ✅ Creates loaner_assignments records
- ✅ Updates existing assignments
- ✅ Handles uniqueness constraints
- ✅ Respects returned_at flag
- ⚠️ No deletion logic for toggle OFF scenario

---

## 8. TEST COVERAGE ✅

### Test Files:

**1. `/src/tests/dealForm.loanerToggle.test.jsx`**

- Tests toggle ON/OFF visibility
- Tests field clearing on toggle OFF (expected in V2)
- Tests edit mode with existing loaner data
- Tests legacy behavior when V2 flag is OFF

**2. `/src/tests/dealService.loanerToggle.test.jsx`**

- Tests loaner checkbox rendering
- Tests loaner section visibility toggle
- Tests field population from initial data
- Tests form integration

**3. `/src/tests/dealService.loanerPersistence.test.js`**

- Tests `mapDbDealToForm()` loaner field mapping
- Tests loanerForm structure
- Tests backward compatibility
- Tests missing loaner data handling

**Coverage:** ✅ All core functionality tested

---

## Summary Table

| Requirement                             | Status     | Details                                           |
| --------------------------------------- | ---------- | ------------------------------------------------- |
| 1. Toggle shows/hides loaner fields     | ✅ YES     | Conditional render on `customerData?.needsLoaner` |
| 2. Toggle OFF clears UI fields          | ✅ PARTIAL | Hidden, not cleared (acceptable)                  |
| 3. Toggle OFF clears data in payload    | ✅ YES     | `loanerForm: null` when needsLoaner is false      |
| 4. Toggle OFF clears DB records         | ⚠️ NO      | Existing loaner_assignments not deleted           |
| 5. Toggle ON shows vendor/number inputs | ✅ YES     | Loaner # field visible                            |
| 6. Toggle ON shows return date/notes    | ❌ NO      | Not implemented in V2 UI                          |
| 7. Edit mode reflects toggle state      | ✅ YES     | Loads `customer_needs_loaner` as boolean          |
| 8. Loaner data persists in DB           | ✅ YES     | Via loaner_assignments table                      |
| 9. Data loads on edit                   | ✅ YES     | Via mapDbDealToForm()                             |
| 10. Test coverage                       | ✅ YES     | Comprehensive test suites exist                   |

---

## Recommendations

### Critical

1. **Implement loaner deletion**: Add logic to delete loaner_assignments when toggle is turned OFF
   - Add check: `if (!payload?.customer_needs_loaner)` before updateDeal
   - Delete records from loaner_assignments table
   - Or mark with returned_at flag

### Important

2. **Add return date and notes to V2 UI**: Currently only shows loaner number
   - Add `eta_return_date` field (date picker)
   - Add `notes` field (text input)
   - Would provide full feature parity with form adapters

### Nice to Have

3. **Add visual feedback**: Show loaner status in deals list
4. **Add loaner return workflow**: UI for marking loaner as returned
5. **Add validation**: Validate return date is in future

---

## Files Involved

- `/src/components/deals/DealFormV2.jsx` - Main form component
- `/src/components/deals/formAdapters.js` - Data transformation
- `/src/services/dealService.js` - Database operations
- `/src/tests/dealForm.loanerToggle.test.jsx` - Form tests
- `/src/tests/dealService.loanerToggle.test.jsx` - Service tests
- `/src/tests/dealService.loanerPersistence.test.js` - Persistence tests
