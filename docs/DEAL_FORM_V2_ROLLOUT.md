# Deal Form V2 - Unified Create/Edit Flow with Adapters

## Overview

This document describes the V2 implementation of the unified deal form with a clean adapter layer, feature flag, and phased rollout strategy.

## Key Finding

The existing `DealForm.jsx` is **already unified** with:
- ✅ Both create and edit modes via `mode` prop
- ✅ Visible loaner toggle (`customer_needs_loaner` checkbox)
- ✅ Conditional loaner section (shows/hides based on toggle)
- ✅ Complete line items grid
- ✅ Flexible `onSave` callback prop

Therefore, this implementation focused on adding a **clean adapter layer** to normalize data flow.

## Architecture

### Feature Flag

```javascript
const useV2 = import.meta.env.VITE_DEAL_FORM_V2 === 'true'
```

- **Development**: `true` by default (via `.env.development`)
- **Production**: `false` by default (no flag set)
- **Deployment**: Set via environment variable to enable in production

### Adapter Layer (`src/components/deals/formAdapters.js`)

Pure functions with zero dependencies:

#### `entityToDraft(entity)`
Converts database entities to form draft state:
- Normalizes `job_parts` → `lineItems`
- Detects loaner presence from multiple sources
- Preserves all existing fields (IDs, timestamps, etc.)
- Handles both snake_case and camelCase field names

#### `draftToCreatePayload(draft)`
Prepares payloads for `dealService.createDeal`:
- Filters line items (must have `product_id`)
- Normalizes phone numbers to E.164 format
- Omits loaner data when toggle is off or number is blank
- Strips empty strings to avoid DB type errors

#### `draftToUpdatePayload(id, draft)`
Prepares payloads for `dealService.updateDeal`:
- Same as `draftToCreatePayload` plus:
- Includes `id` for the update operation
- Includes `updated_at` for optimistic concurrency

### Integration Points

#### `NewDeal.jsx`
```javascript
const payload = useV2 ? draftToCreatePayload(formState) : formState
const created = await dealService.createDeal(payload)
```

#### `EditDeal.jsx`
```javascript
// On load
const mapped = useV2 
  ? entityToDraft(d) 
  : dealService.mapDbDealToForm?.(d) || d

// On save
const payload = useV2 ? draftToUpdatePayload(id, formState) : formState
await dealService.updateDeal(id, payload)
```

## Testing

### Unit Tests (14/14 passing)

Location: `src/tests/dealService.formAdapters.test.js`

Coverage:
- ✅ Basic entity conversion without loaner
- ✅ Entity with loaner data
- ✅ Database `job_parts` array handling
- ✅ Empty/null entity handling
- ✅ CamelCase to snake_case normalization
- ✅ Create payload generation
- ✅ Loaner toggle behavior (on/off/blank)
- ✅ Line item filtering (no product_id)
- ✅ Phone normalization (E.164)
- ✅ Schedule reason clearing when required
- ✅ Update payload with ID and version

### UI Tests

Location: `src/tests/dealService.loanerToggle.test.jsx`

Coverage:
- ✅ Loaner checkbox renders
- ✅ Loaner section hidden when unchecked
- ✅ Loaner section visible when checked
- ✅ Toggle visibility works
- ✅ Initial state with loaner data
- ✅ Line items grid renders
- ✅ Add line item button works
- ✅ Field order and labels preserved

### Build Tests

- ✅ Build with `VITE_DEAL_FORM_V2=true` succeeds
- ✅ Build with `VITE_DEAL_FORM_V2=false` succeeds
- ✅ No warnings or errors
- ✅ Proper code-splitting maintained

## Security

### CodeQL Analysis
- ✅ 0 vulnerabilities found
- ✅ No security alerts
- ✅ Clean scan

### Safety Measures
- ✅ Pure functions (no mutations)
- ✅ Input validation and normalization
- ✅ No SQL injection vectors (all via Supabase client)
- ✅ Phone number sanitization
- ✅ No sensitive data in adapters

## Rollout Strategy

### Phase 1: Dev Testing (Current)
- Flag is `true` in `.env.development`
- All developers test with V2 by default
- Manual smoke testing required:
  1. Create deal with loaner → save → verify
  2. Edit deal without loaner → add loaner → save → verify
  3. Edit deal with line items → verify no data loss
  4. Toggle loaner off → save → verify loaner cleared

### Phase 2: Production Opt-In
```bash
# In production environment
VITE_DEAL_FORM_V2=true
```
- Enable for subset of users or all users
- Monitor for errors/issues
- Rollback by setting flag to `false`

### Phase 3: Default Path (Future)
Once stable in production:
1. Remove feature flag checks
2. Keep adapters as default path
3. Remove legacy code paths
4. Update tests to use adapters exclusively

## Behavior Guarantees

### No Regressions
- ✅ Legacy paths unchanged when flag is off
- ✅ All existing fields preserved
- ✅ No data loss on save/load
- ✅ Line item ordering maintained

### Data Integrity
- ✅ IDs and timestamps preserved
- ✅ Quantities and prices accurate (no rounding errors)
- ✅ Dates in correct format (YYYY-MM-DD)
- ✅ Loaner toggle state persisted correctly

### Performance
- ✅ Adapters are pure functions (no async)
- ✅ No additional network calls
- ✅ Minimal overhead (< 1ms per call)
- ✅ Code-split in separate chunk (4.8 KB gzipped)

## Monitoring

### Success Metrics
- Deal creation success rate
- Deal update success rate
- Loaner assignment accuracy
- Line item data preservation
- User error reports

### Error Tracking
Monitor for:
- `Failed to create deal` errors
- `Failed to save deal` errors
- Missing field values after save
- Loaner data not persisting

## Troubleshooting

### Issue: Loaner not saving
**Check**: Is `customer_needs_loaner` true AND `loaner_number` not blank?
**Solution**: Adapters omit loaner when toggle is off or number is empty.

### Issue: Phone format incorrect
**Check**: Is input 10 or 11 digits?
**Solution**: Adapter normalizes to E.164 (`+1XXXXXXXXXX` for US).

## Per-Line Vendor Support

### Overview
As of migration `20251106000000_add_job_parts_vendor_id.sql`, the `job_parts` table supports per-line vendor assignment through a new `vendor_id` column. This allows each line item to specify its own vendor, independent of the job-level vendor or the product's default vendor.

### Database Schema
```sql
ALTER TABLE public.job_parts
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
```

### Vendor Assignment Precedence
1. **Per-line vendor** (`job_parts.vendor_id`) - highest priority
2. **Product vendor** (`products.vendor_id`) - fallback when line vendor is null
3. **Job vendor** (`jobs.vendor_id`) - legacy job-level assignment

### Data Flow

#### Line Item Creation
Line items can now include `vendor_id`/`vendorId`:
```javascript
lineItems: [
  {
    product_id: '...',
    vendor_id: '...', // Optional per-line vendor override
    quantity_used: 1,
    unit_price: 100.00
  }
]
```

#### Backfill Strategy
Existing `job_parts` rows were backfilled during migration:
```sql
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL;
```

### UI Implications
- Line item rows can display vendor dropdown (optional)
- When `vendor_id` is null, UI should show product vendor with "(derived)" indicator
- Vendor aggregation logic in deals list now uses per-line vendors for off-site items

### Adapter Changes
**entityToDraft**: Maps `vendor_id` from `job_parts`:
```javascript
vendorId: part?.vendor_id || null
```

**draftToCreatePayload/draftToUpdatePayload**: Includes `vendor_id` in line items:
```javascript
vendor_id: item?.vendor_id ?? item?.vendorId ?? null
```

### RLS Policies
New policies allow vendors to view/manage `job_parts` associated with their `vendor_id`:
- `vendors_can_view_job_parts_via_per_line_vendor`
- `vendors_can_manage_their_job_parts`
- `vendors_can_update_their_job_parts`

### Error Handling
Missing relationship errors now provide specific guidance:
```javascript
if (isMissingRelationshipError(error)) {
  throw new Error(
    'Failed to load deals: Missing database relationship. Run migration 20251106000000_add_job_parts_vendor_id.sql...'
  )
}
```

### Issue: Line items missing after save
**Check**: Does each line item have a `product_id`?
**Solution**: Adapter filters out items without product_id.

### Issue: Fields cleared on edit
**Check**: Is V2 flag enabled in environment?
**Solution**: If flag is on, `entityToDraft` should preserve all fields. Check adapter tests.

## Files Modified

```
src/
├── components/
│   └── deals/
│       └── formAdapters.js          (NEW: 6.5 KB)
├── pages/
│   └── deals/
│       ├── NewDeal.jsx              (MODIFIED: +5 lines)
│       └── EditDeal.jsx             (MODIFIED: +14 lines)
└── tests/
    ├── dealService.formAdapters.test.js   (NEW: 9.8 KB, 14 tests)
    └── dealService.loanerToggle.test.jsx  (NEW: 7.5 KB, 9 tests)

.env.development                     (NEW: feature flag)
.gitignore                           (MODIFIED: track .env.development)
```

## Capability Fallback

### Per-Line Time Windows

The application supports per-line time windows (`scheduled_start_time`, `scheduled_end_time`) on `job_parts` when the database schema includes these columns. When these columns are not present:

**Automatic Detection:**
- On first save attempt, if columns are missing, the service detects the error and retries without those fields
- Capability status is cached in `sessionStorage` (`cap_jobPartsTimes=false`) to avoid re-probing
- Future saves within the same session automatically exclude these fields

**Job-Level Fallback:**
- When per-line times are unsupported, the service sets `jobs.scheduled_start_time` and `jobs.scheduled_end_time` to the earliest line item's time window
- This ensures the deals list can still display appointment windows even when per-line columns don't exist
- The fallback uses the earliest scheduled line item (sorted by start time) to represent the overall deal window

**User Experience:**
- A small info banner appears in the Line Items section: "Note: This environment doesn't store per-line time windows yet. Promised dates will save; time windows are ignored."
- Users can still enter time values in the UI, but they won't be persisted to `job_parts` where unsupported
- All other line item fields (promised dates, scheduling flags, etc.) save normally
- The deals list displays the job-level appointment window when per-line times are unavailable

**Technical Details:**
- Read operations already have built-in fallbacks and use job-level times when per-line times are unavailable
- Write operations now match this resilience with automatic retry logic plus job-level fallback
- Service exposes `getCapabilities()` for UI components to check feature availability
- Unit tests verify both fallback paths and error propagation

**Files Modified:**
- `src/services/dealService.js`: Capability detection, retry logic, job-level fallback in createDeal/updateDeal
- `src/components/deals/DealFormV2.jsx`: Optional capability banner
- `tests/unit/dealService.jobPartsTimesFallback.test.js`: Fallback tests

### Loaner Number Persistence

Loaner assignments are stored in the `loaner_assignments` table, not directly on the `jobs` table:

**Contract:**
- The form sends `loanerForm: { loaner_number, eta_return_date, notes }` when `customer_needs_loaner` is true
- The service accepts both the new `loanerForm` shape and legacy `loaner_number` field for backward compatibility
- After job save, `upsertLoanerAssignment()` is called to persist the loaner data

**Behavior:**
- If an active loaner assignment already exists for the job, it's updated
- Otherwise, a new loaner assignment record is created
- The saved deal returned by `getDeal()` includes joined loaner data (`loaner_number`, `loaner_id`)
- The deals list displays the loaner badge and number when an active assignment exists

**Files Modified:**
- `src/components/deals/DealFormV2.jsx`: Sends `loanerForm` when loaner is needed
- `src/services/dealService.js`: Accepts both `loanerForm` and legacy `loaner_number`, calls `upsertLoanerAssignment()`
- `tests/unit/dealService.vehicleAttachAndLoaner.test.js`: Loaner persistence tests

### Vehicle Attachment by Stock Number

When a deal is saved without a `vehicle_id` but with a `stock_number`, the service automatically attaches or creates the vehicle:

**Lookup:**
- Before saving the job, the service queries `vehicles` by `stock_number` (scoped by `org_id` if available)
- If found, the vehicle's ID is set on `payload.vehicle_id`

**Creation:**
- If not found, a minimal vehicle record is created with `stock_number` and `owner_phone`
- The new vehicle's ID is set on `payload.vehicle_id`
- This ensures the job has a linked vehicle immediately after save

**Behavior:**
- The saved deal returned by `getDeal()` includes joined vehicle data
- The deals list displays vehicle information and stock number
- Vehicle creation is best-effort; failures are logged but don't fail the deal save

**Files Modified:**
- `src/services/dealService.js`: `attachOrCreateVehicleByStockNumber()` helper, called in createDeal/updateDeal
- `tests/unit/dealService.vehicleAttachAndLoaner.test.js`: Vehicle attach tests

## Per-Line Vendor Support (Migration 20251106)

### Overview
Each line item (job_part) can now have its own vendor assignment, independent of the product's default vendor or the job's overall vendor.

### Database Schema
- **Column Added**: `job_parts.vendor_id` (UUID, FK to vendors.id, nullable)
- **Index Added**: `idx_job_parts_vendor_id` for query performance
- **Backfill**: Existing rows populated from `products.vendor_id` where available

### Vendor Resolution Priority
1. **Per-line vendor**: If `job_parts.vendor_id` is set, use that vendor
2. **Product default**: If `vendor_id` is null, fall back to `products.vendor_id`
3. **Unassigned**: If neither is set, the line item has no vendor

### Display Logic
- **Single Vendor**: When all off-site line items share the same vendor, display that vendor's name
- **Mixed**: When line items have different vendors, display "Mixed"
- **Unassigned**: When no vendor is assigned to any line item, display "Unassigned"

### Service Layer Updates
- **dealService.js**: Queries include `vendor_id` and nested `vendor:vendors(id,name)` relation
- **jobService.js**: `selectJobs` and `insertLineItems` support per-line vendor_id
- **Mappers**: `dealMappers.js` maps vendorId with fallback to product.vendor_id
- **Adapters**: `adapters.ts` includes vendor_id in line item payloads

### RLS Policies
New policies allow vendors to view and manage job_parts where `vendor_id` matches their profile:
- `vendors_can_view_job_parts_via_per_line_vendor`
- `vendors_can_manage_job_parts_via_per_line_vendor`

### Migration
- **File**: `supabase/migrations/20251106_add_job_parts_vendor_id.sql`
- **Safety**: Uses conditional DDL to avoid conflicts if column exists
- **Rollback**: Drop the column if needed (note: per-line vendor overrides will be lost)

## Support

For questions or issues, contact the development team or refer to:
- Adapter implementation: `src/components/deals/formAdapters.js`
- Unit tests: `src/tests/dealService.formAdapters.test.js`
- Integration: `src/pages/deals/{NewDeal,EditDeal}.jsx`
- Capability fallback tests: `tests/unit/dealService.jobPartsTimesFallback.test.js`
