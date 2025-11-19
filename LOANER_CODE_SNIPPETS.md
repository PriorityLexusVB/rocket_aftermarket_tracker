# Loaner Toggle - Code Snippets Reference

## 1. Toggle Checkbox Implementation

**File:** `/src/components/deals/DealFormV2.jsx` (lines 589-606)

```jsx
{/* Loaner checkbox */}
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

## 2. Conditional Loaner Fields Rendering

**File:** `/src/components/deals/DealFormV2.jsx` (lines 608-625)

```jsx
{customerData?.needsLoaner && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-slate-700">Loaner #</label>
      <input
        ref={loanerRef}
        data-testid="loaner-number-input"
        className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
        placeholder="Enter loaner vehicle number"
        value={customerData?.loanerNumber ?? ''}
        onChange={(e) =>
          setCustomerData((prev) => ({ ...prev, loanerNumber: e.target.value }))
        }
        required
      />
    </div>
  </div>
)}
```

## 3. Edit Mode Loaner State Loading

**File:** `/src/components/deals/DealFormV2.jsx` (lines 116-134)

```jsx
// ✅ FIX: Reload customer data and line items from job prop when it changes in edit mode
useEffect(() => {
  if (job && mode === 'edit' && job.id && initializedJobId.current !== job.id) {
    initializedJobId.current = job.id
    
    setCustomerData({
      customerName: job?.customer_name || job?.customerName || '',
      dealDate: job?.deal_date || new Date().toISOString().slice(0, 10),
      jobNumber: job?.job_number || '',
      stockNumber: job?.stock_number || job?.stockNumber || '',
      customerMobile: job?.customer_mobile || job?.customerMobile || '',
      vendorId: job?.vendor_id || null,
      notes: job?.notes || job?.description || '',
      vehicleDescription: job?.vehicle_description || job?.vehicleDescription || '',
      assignedTo: job?.assigned_to || null,
      deliveryCoordinator: job?.delivery_coordinator_id || null,
      financeManager: job?.finance_manager_id || null,
      needsLoaner: Boolean(job?.customer_needs_loaner),
      loanerNumber: job?.loaner_number || job?.loanerNumber || '',
    })
    // ...
  }
}, [job?.id, mode])
```

## 4. Payload Creation with Loaner Data

**File:** `/src/components/deals/DealFormV2.jsx` (lines 301-335)

```jsx
const payload = {
  customer_name: customerData?.customerName?.trim(),
  deal_date: customerData?.dealDate,
  job_number: customerData?.jobNumber?.trim(),
  stock_number: customerData?.stockNumber?.trim() || null,
  customer_mobile: customerData?.customerMobile?.trim() || null,
  vendor_id: customerData?.vendorId || null,
  notes: customerData?.notes?.trim() || null,
  vehicle_description: customerData?.vehicleDescription?.trim() || null,
  assigned_to: customerData?.assignedTo || user?.id,
  delivery_coordinator_id: customerData?.deliveryCoordinator || null,
  finance_manager_id: customerData?.financeManager || null,
  customer_needs_loaner: Boolean(customerData?.needsLoaner),
  org_id: orgId || null,
  // Send loanerForm when needsLoaner is true for proper persistence via loaner_assignments
  loanerForm: customerData?.needsLoaner
    ? {
        loaner_number: customerData?.loanerNumber?.trim() || '',
        eta_return_date: null,
        notes: null,
      }
    : null,
  lineItems: lineItems.map((item) => ({
    product_id: item?.productId,
    quantity_used: 1,
    unit_price: parseFloat(item?.unitPrice || 0),
    promised_date: item?.requiresScheduling ? item?.dateScheduled : null,
    scheduled_start_time: item?.requiresScheduling ? item?.scheduledStartTime || null : null,
    scheduled_end_time: item?.requiresScheduling ? item?.scheduledEndTime || null : null,
    requires_scheduling: Boolean(item?.requiresScheduling),
    no_schedule_reason: !item?.requiresScheduling ? item?.noScheduleReason : null,
    is_off_site: Boolean(item?.isOffSite),
    vendor_id: item?.vendorId || null,
  })),
}
```

## 5. Strip Loaner When Off Function

**File:** `/src/components/deals/formAdapters.js` (lines 54-63)

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

## 6. Draft to Create Payload with Loaner Stripping

**File:** `/src/components/deals/formAdapters.js` (lines 110-147)

```javascript
export function draftToCreatePayload(draft = {}) {
  // Strip loaner fields first if toggle is off
  const stripped = stripLoanerWhenOff(draft)

  const payload = {
    ...stripped,
    job_number: stripped.job_number ?? '',
    description: stripped.description ?? '',
    vendor_id: stripped.vendor_id ?? '',
    assigned_to: stripped.assigned_to ?? stripped.sales_consultant_id ?? '',
    finance_manager_id: stripped.finance_manager_id ?? '',
    delivery_coordinator_id: stripped.delivery_coordinator_id ?? '',
    customer_needs_loaner: !!stripped.customer_needs_loaner,
    scheduled_start_time: stripped.scheduled_start_time || null,
    scheduled_end_time: stripped.scheduled_end_time || null,
    scheduling_location: stripped.scheduling_location || null,
    scheduling_notes: stripped.scheduling_notes || null,
    color_code: stripped.color_code || null,
  }

  // Normalize phone if customer_mobile is present
  if (stripped.customer_mobile) {
    payload.customer_phone = normalizePhone(stripped.customer_mobile)
  }

  // Handle loanerForm: null if toggle is off, object if on
  if (stripped.customer_needs_loaner && stripped.loanerForm) {
    payload.loanerForm = { ...stripped.loanerForm }
  } else {
    payload.loanerForm = null
  }

  // Normalize lineItems
  payload.lineItems = normalizeLineItems(stripped)
  payload.items = payload.lineItems

  return payload
}
```

## 7. Upsert Loaner Assignment Function

**File:** `/src/services/dealService.js` (lines 601-645)

```javascript
async function upsertLoanerAssignment(jobId, loanerData) {
  if (!loanerData?.loaner_number?.trim()) {
    return // No loaner number provided, skip assignment
  }

  try {
    // Check for existing active assignment for this job
    const { data: existing } = await supabase
      ?.from('loaner_assignments')
      ?.select('id')
      ?.eq('job_id', jobId)
      ?.is('returned_at', null)
      ?.single()

    const assignmentData = {
      job_id: jobId,
      loaner_number: loanerData?.loaner_number?.trim(),
      eta_return_date: loanerData?.eta_return_date || null,
      notes: loanerData?.notes?.trim() || null,
    }

    if (existing) {
      // Update existing assignment
      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.update(assignmentData)
        ?.eq('id', existing?.id)

      if (error) throw error
    } else {
      // Create new assignment
      const { error } = await supabase?.from('loaner_assignments')?.insert([assignmentData])

      if (error) throw error
    }
  } catch (error) {
    // Handle uniqueness constraint error gracefully
    if (error?.code === '23505') {
      throw new Error(
        `Loaner ${loanerData?.loaner_number} is already assigned to another active job`
      )
    }
    throw error
  }
}
```

## 8. Create Deal - Loaner Assignment Handling

**File:** `/src/services/dealService.js` (lines 1418-1420)

```javascript
// A3: Handle loaner assignment for new deals
if (payload?.customer_needs_loaner && loanerForm) {
  await upsertLoanerAssignment(job?.id, loanerForm)
}
```

## 9. Update Deal - Loaner Assignment Handling

**File:** `/src/services/dealService.js` (lines 1697-1699)

```javascript
// A3: Handle loaner assignment updates
if (payload?.customer_needs_loaner && loanerForm) {
  await upsertLoanerAssignment(id, loanerForm)
}
```

## 10. Map DB Deal to Form - Loaner Data Mapping

**File:** `/src/services/dealService.js` (lines 1851-1858)

```javascript
// Loaner data - include both flat fields (legacy) and nested loanerForm (current)
loaner_number: normalized?.loaner_number || '',
loanerNumber: normalized?.loaner_number || '',
loanerForm: {
  loaner_number: normalized?.loaner_number || '',
  eta_return_date: normalized?.loaner_eta_return_date || '',
  notes: normalized?.loaner_notes || '',
},
```

## 11. Test: Toggle Visibility and Clearing

**File:** `/src/tests/dealForm.loanerToggle.test.jsx` (lines 58-128)

```javascript
it('Create mode: toggle on shows loaner section, toggle off hides and clears fields', async () => {
  // Wait for component to load
  await waitFor(
    () => {
      expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
    },
    { timeout: 2000 }
  )

  // Initially, loaner checkbox should be unchecked
  const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')
  expect(loanerCheckbox.checked).toBe(false)

  // Loaner section should not be visible
  expect(container.querySelector('[data-testid="loaner-section"]')).toBeNull()

  // Toggle loaner checkbox ON
  fireEvent.click(loanerCheckbox)
  expect(loanerCheckbox.checked).toBe(true)

  // Loaner section should now be visible
  await waitFor(() => {
    expect(container.querySelector('[data-testid="loaner-section"]')).toBeTruthy()
  })

  // Fill in some loaner data
  const loanerNumberInput = container.querySelector('[data-testid="loaner-number-input"]')
  fireEvent.change(loanerNumberInput, { target: { value: 'L-1024' } })
  expect(loanerNumberInput.value).toBe('L-1024')

  // Toggle loaner checkbox OFF
  fireEvent.click(loanerCheckbox)
  expect(loanerCheckbox.checked).toBe(false)

  // Loaner section should be hidden
  await waitFor(() => {
    expect(container.querySelector('[data-testid="loaner-section"]')).toBeNull()
  })
})
```

## 12. Test: Loaner Persistence in Edit Mode

**File:** `/src/tests/dealService.loanerPersistence.test.js` (lines 7-25)

```javascript
it('should map loaner data to nested loanerForm structure', () => {
  const dbDeal = {
    id: 'deal-123',
    job_number: 'JOB-001',
    customer_needs_loaner: true,
    loaner_number: 'L-2025-001',
    loaner_eta_return_date: '2025-12-01',
    loaner_notes: 'Test loaner notes',
    job_parts: [],
  }

  const formDeal = mapDbDealToForm(dbDeal)

  // Verify loanerForm is properly structured
  expect(formDeal.loanerForm).toBeDefined()
  expect(formDeal.loanerForm.loaner_number).toBe('L-2025-001')
  expect(formDeal.loanerForm.eta_return_date).toBe('2025-12-01')
  expect(formDeal.loanerForm.notes).toBe('Test loaner notes')
})
```

---

## Critical Issue: Missing Loaner Deletion Logic

**Location:** `/src/services/dealService.js` around line 1697

**Current Code:**
```javascript
if (payload?.customer_needs_loaner && loanerForm) {
  await upsertLoanerAssignment(id, loanerForm)
}
```

**Missing Code (Should be added):**
```javascript
// MISSING: Handle loaner deletion when toggle is turned OFF
if (!payload?.customer_needs_loaner) {
  // Delete existing loaner assignments when toggle is turned off
  const { error } = await supabase
    ?.from('loaner_assignments')
    ?.delete()
    ?.eq('job_id', id)
  if (error) throw wrapDbError(error, 'delete loaner assignments')
}
```

This should be added right after the upsertLoanerAssignment call to properly clean up loaner_assignments records when the toggle is turned OFF.
