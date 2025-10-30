# VITE_DEAL_FORM_V2 Feature Flag - Implementation Demo

## Current Configuration

```bash
# .env.development
VITE_DEAL_FORM_V2=true
```

## How It Works

### 1. Flag Declaration (src/pages/deals/NewDeal.jsx)

```javascript
import { draftToCreatePayload } from '../../components/deals/formAdapters'

// Feature flag for V2 unified form with adapters
const useV2 = import.meta.env.VITE_DEAL_FORM_V2 === 'true'
```

### 2. Conditional Logic (src/pages/deals/NewDeal.jsx)

```javascript
async function onSave(formState) {
  setSaving(true)
  try {
    // When V2 flag is on, use adapter to normalize payload
    const payload = useV2 ? draftToCreatePayload(formState) : formState
    const created = await dealService.createDeal(payload)
    // ... rest of the code
  }
}
```

### 3. Edit Flow (src/pages/deals/EditDeal.jsx)

```javascript
// Load: Convert DB entity to form state
const mapped = useV2
  ? entityToDraft(d)
  : dealService.mapDbDealToForm
    ? dealService.mapDbDealToForm(d)
    : d
setInitial(mapped)

// Save: Convert form state to update payload
const payload = useV2 ? draftToUpdatePayload(id, formState) : formState
await dealService?.updateDeal(id, payload)
```

## Example Behavior

### Scenario: Creating a Deal with Phone Number

**Input Form State:**
```javascript
{
  job_number: 'JOB-001',
  customer_mobile: '(555) 123-4567',
  customer_needs_loaner: true,
  loanerForm: {
    loaner_number: 'L-123',
    eta_return_date: '2024-12-01'
  },
  lineItems: [{
    product_id: 'prod-1',
    quantity_used: 1,
    unit_price: 100,
    requires_scheduling: true
  }]
}
```

**With VITE_DEAL_FORM_V2=true (V2 behavior):**
```javascript
// Adapter normalizes the payload
{
  job_number: 'JOB-001',
  customer_mobile: '+15551234567',      // ✅ Normalized to E.164
  customer_phone: '+15551234567',       // ✅ Added for compatibility
  customerPhone: '+15551234567',        // ✅ Added for compatibility
  customer_needs_loaner: true,
  loanerForm: {
    loaner_number: 'L-123',
    eta_return_date: '2024-12-01',
    notes: ''
  },
  lineItems: [{
    product_id: 'prod-1',
    quantity_used: 1,
    unit_price: 100,
    promised_date: null,
    requires_scheduling: true,
    requiresScheduling: true,            // ✅ Added camelCase
    no_schedule_reason: null,
    noScheduleReason: null,              // ✅ Added camelCase
    is_off_site: false,
    isOffSite: false,                    // ✅ Added camelCase
    lineItemPromisedDate: null           // ✅ Added for compatibility
  }]
}
```

**With VITE_DEAL_FORM_V2=false (Legacy behavior):**
```javascript
// Form state passed directly (no transformation)
{
  job_number: 'JOB-001',
  customer_mobile: '(555) 123-4567',    // ❌ Not normalized
  customer_needs_loaner: true,
  loanerForm: {
    loaner_number: 'L-123',
    eta_return_date: '2024-12-01'
  },
  lineItems: [{
    product_id: 'prod-1',
    quantity_used: 1,
    unit_price: 100,
    requires_scheduling: true            // ❌ No camelCase compatibility
  }]
}
```

## Toggle Demo

### Step 1: Current State (V2 Enabled)

```bash
$ cat .env.development
# Feature Flags
VITE_DEAL_FORM_V2=true

$ pnpm dev
# App uses form adapters
# Phone numbers normalized
# Loaner data validated
```

### Step 2: Toggle to Legacy

```bash
# Edit .env.development manually or use sed
$ sed -i 's/VITE_DEAL_FORM_V2=.*/VITE_DEAL_FORM_V2=false/' .env.development
$ pnpm dev
# App uses legacy behavior
# Phone numbers not normalized
# Direct form state passed to services
```

### Step 3: Toggle Back to V2

```bash
# Edit .env.development manually or use sed
$ sed -i 's/VITE_DEAL_FORM_V2=.*/VITE_DEAL_FORM_V2=true/' .env.development
$ pnpm dev
# App uses form adapters again
# All V2 features restored
```

## Verification Commands

### Check Current Flag Value
```bash
cat .env.development | grep VITE_DEAL_FORM_V2
```

### Run Tests
```bash
# Run all tests (39 tests)
pnpm test

# Run feature flag tests only
pnpm test dealService.featureFlag
pnpm test dealService.featureFlagToggle
```

### Build with Flag
```bash
# Build will use flag value from .env files
pnpm build

# Check if build includes adapters
grep -r "draftToCreatePayload" dist/
```

## Safety Guarantees

### 1. No Database Changes
```javascript
// Adapters are pure functions - no DB mutations
export function draftToCreatePayload(draft = {}) {
  // Only transforms data structure
  // Never calls database or APIs
  return { /* transformed data */ }
}
```

### 2. No Service Changes
```javascript
// Services accept both formats
await dealService.createDeal(payload)
// Works whether payload is adapted or not
```

### 3. Instant Rollback
```bash
# Change flag
VITE_DEAL_FORM_V2=false

# Restart server (takes ~5 seconds)
pnpm dev

# Or redeploy in production (takes ~2 minutes)
# No data migration needed
# No service restart needed
```

### 4. Data Integrity
```javascript
// Original data never modified
const original = { job_number: 'JOB-001' }
const adapted = draftToCreatePayload(original)
console.log(original) // Still { job_number: 'JOB-001' }
```

## Test Coverage

### Feature Flag Tests (19 tests total)

1. **dealService.featureFlag.test.js** (11 tests)
   - Adapter availability
   - V2 conversion behavior
   - Data integrity

2. **dealService.featureFlagToggle.test.js** (8 tests)
   - Toggle behavior verification
   - Rollback safety
   - Documentation tests

### Run Tests
```bash
$ pnpm test

✓ src/tests/dealService.formAdapters.test.js (14 tests)
✓ src/tests/dealService.featureFlag.test.js (11 tests)
✓ src/tests/dealService.featureFlagToggle.test.js (8 tests)
✓ src/tests/dealService.validation.test.js (3 tests)
✓ src/tests/dealService.toJobPartRows.test.js (3 tests)

Total: 39 tests passing
```

## Production Rollout Example

### Phase 1: Development (Current)
```bash
# .env.development
VITE_DEAL_FORM_V2=true
```
- All developers use V2 locally
- Tests verify both V2 and legacy behavior
- Confidence in V2 implementation

### Phase 2: Staging
```bash
# Vercel staging environment
VITE_DEAL_FORM_V2=true
```
- Stakeholders test with real data
- Monitor for issues
- Gather feedback

### Phase 3: Production (Gradual)
```bash
# Vercel production environment
VITE_DEAL_FORM_V2=true
```
- Enable with monitoring
- Ready to rollback if needed
- Keep flag for 30+ days

### Phase 4: Cleanup (Future)
```bash
# Remove flag entirely
# Delete legacy code paths
# Update tests
```

## Troubleshooting

### Flag not taking effect?
```bash
# 1. Check flag value
cat .env.development | grep VITE_DEAL_FORM_V2

# 2. Restart dev server
pnpm dev

# 3. Verify in browser console
console.log(import.meta.env.VITE_DEAL_FORM_V2)
```

### Want to test both states?
```bash
# Test V2
VITE_DEAL_FORM_V2=true pnpm dev

# Test Legacy
VITE_DEAL_FORM_V2=false pnpm dev
```

### Need to rollback in production?
```bash
# 1. Set flag in Vercel
VITE_DEAL_FORM_V2=false

# 2. Redeploy current version
# Takes ~2 minutes

# 3. Verify legacy behavior restored
# No data loss or corruption
```

## Summary

✅ **Flag is active** and can be toggled
✅ **V2 is default** in development (true)
✅ **Legacy is preserved** for rollback (false)
✅ **Tests cover both states** (39 passing)
✅ **Documentation is complete** (README + Guide)
✅ **Rollback is instant** (change env var)
✅ **No database changes** required
✅ **No service changes** required

The feature flag provides a safe, reversible way to deploy the V2 DealForm with confidence.

---

**Last Updated:** 2024-10-30
**Status:** ✅ Ready for use in all environments
**Recommendation:** Keep `true` in development, test thoroughly before enabling in production
