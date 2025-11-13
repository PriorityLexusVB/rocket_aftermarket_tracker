# Feature Flag Guide: VITE_DEAL_FORM_V2

## Overview

The `VITE_DEAL_FORM_V2` feature flag enables the unified DealForm V2 with form adapters for safer data handling. This guide explains how to use the flag for safe rollouts and testing.

## Quick Start

### Default Configuration (Recommended)

In `.env.development` (already configured):

```bash
VITE_DEAL_FORM_V2=true
```

This enables V2 behavior for local development and preview environments.

### Production Configuration

For production, you can:

1. **Enable V2** (recommended): Set `VITE_DEAL_FORM_V2=true` in Vercel environment variables
2. **Keep legacy**: Set `VITE_DEAL_FORM_V2=false` or omit the variable

## What the Flag Does

### When `VITE_DEAL_FORM_V2=true` (V2 Enabled)

**Pages affected:**

- `src/pages/deals/NewDeal.jsx`
- `src/pages/deals/EditDeal.jsx`

**Behavior:**

1. **Form adapters are used** to normalize data between UI and services
2. **Phone numbers** are automatically normalized to E.164 format (+1XXXXXXXXXX)
3. **Loaner data** is properly structured with validation
4. **Line items** include both `snake_case` and `camelCase` keys for compatibility
5. **Data integrity** is enforced through adapters

**Adapters used:**

- `entityToDraft()` - Converts DB entity to form state
- `draftToCreatePayload()` - Converts form state to create payload
- `draftToUpdatePayload()` - Converts form state to update payload (with version info)

### When `VITE_DEAL_FORM_V2=false` (Legacy Behavior)

**Behavior:**

1. **No adapters** are used
2. **Form state** is passed directly to `dealService`
3. **Legacy behavior** is preserved for safe rollback
4. **Phone numbers** are not normalized
5. **Loaner data** structure follows legacy format

## How to Toggle the Flag

### For Local Development

1. Edit `.env.development` or create `.env.local`:

   ```bash
   # Enable V2
   VITE_DEAL_FORM_V2=true

   # OR disable V2
   VITE_DEAL_FORM_V2=false
   ```

2. Restart the dev server:

   ```bash
   pnpm dev
   ```

3. Changes take effect immediately - no database migration needed

### For Preview/Staging

Preview deployments automatically use `.env.development` settings. To override:

1. Set environment variable in your preview environment
2. Deploy or redeploy the preview
3. Test the behavior before promoting to production

### For Production

1. Go to Vercel → Project Settings → Environment Variables
2. Add or update `VITE_DEAL_FORM_V2`:
   - Set to `true` to enable V2
   - Set to `false` or remove to use legacy
3. Redeploy the production build
4. Monitor for any issues

## Testing the Flag

### Run Unit Tests

```bash
# Run all tests
pnpm test

# Run specific feature flag tests
pnpm test dealService.featureFlag
pnpm test dealService.featureFlagToggle
```

### Manual Testing Checklist

With `VITE_DEAL_FORM_V2=true`:

- [ ] Create a new deal with phone number - verify E.164 format in DB
- [ ] Toggle loaner checkbox - verify loaner data structure
- [ ] Edit an existing deal - verify data loads correctly
- [ ] Add line items with scheduling - verify all fields preserved
- [ ] Check network requests - verify adapter transformations

With `VITE_DEAL_FORM_V2=false`:

- [ ] Create a new deal - verify legacy behavior
- [ ] Edit an existing deal - verify legacy behavior
- [ ] Compare with V2 behavior to ensure rollback works

## Rollback Procedure

If you encounter issues with V2 in production:

1. **Immediate rollback** (no downtime):
   ```bash
   # In Vercel environment variables
   VITE_DEAL_FORM_V2=false
   ```
2. **Redeploy** the current version (triggers env var reload)

3. **Verify** legacy behavior is restored

4. **No database changes** are needed - the flag only affects client-side transformations

5. **No service changes** are needed - services work with both formats

## Safety Features

### Data Integrity

- Adapters are **pure functions** - no side effects
- Original form state is **never modified**
- Round-trip conversions preserve all data

### Backward Compatibility

- Services accept both V2 and legacy formats
- Database schema unchanged
- No breaking changes to APIs

### Testing Coverage

- 39 unit tests covering all scenarios
- Feature flag toggle tests
- Rollback safety tests
- Data integrity tests

## Troubleshooting

### Issue: Changes not taking effect

**Solution:** Restart the dev server after changing the flag:

```bash
# Stop the server (Ctrl+C)
pnpm dev
```

### Issue: Phone numbers not normalized

**Check:**

1. Flag is set to `true` in environment
2. Dev server was restarted
3. Form is using `NewDeal.jsx` or `EditDeal.jsx` (not modals)

### Issue: Legacy behavior needed

**Solution:** Set flag to `false` and restart:

```bash
VITE_DEAL_FORM_V2=false
pnpm dev
```

## Best Practices

1. **Always test both states** of the flag before deploying
2. **Use V2 in development** to catch issues early
3. **Keep production stable** - only enable V2 after thorough testing
4. **Monitor after enabling** V2 in production
5. **Have rollback plan** ready before enabling in production

## Migration Path

### Phase 1: Development (Current)

- Flag is `true` in `.env.development`
- All developers use V2 locally
- Tests cover both V2 and legacy behavior

### Phase 2: Preview/Staging

- Enable V2 in preview deployments
- Test with real data
- Gather feedback from stakeholders

### Phase 3: Production (Gradual)

- Enable V2 in production with monitoring
- Monitor metrics and error rates
- Keep flag for quick rollback if needed

### Phase 4: Cleanup (Future)

- After V2 is stable in production for 30+ days
- Remove legacy code paths
- Remove feature flag
- Update tests to only test V2 behavior

## Code References

### Flag Usage

```javascript
// src/pages/deals/NewDeal.jsx
const useV2 = import.meta.env.VITE_DEAL_FORM_V2 === 'true'
const payload = useV2 ? draftToCreatePayload(formState) : formState
```

### Adapters

```javascript
// src/components/deals/formAdapters.js
export function entityToDraft(entity) {
  /* ... */
}
export function draftToCreatePayload(draft) {
  /* ... */
}
export function draftToUpdatePayload(id, draft) {
  /* ... */
}
```

### Tests

- `src/tests/dealService.featureFlag.test.js` - Adapter functionality
- `src/tests/dealService.featureFlagToggle.test.js` - Toggle behavior
- `src/tests/dealService.formAdapters.test.js` - Adapter edge cases

## Support

For questions or issues:

1. Check test files for expected behavior
2. Review this guide
3. Test locally with both flag states
4. Consult team before changing production flag

---

**Last Updated:** 2024-10-30
**Flag Status:** Active (safe to use in all environments)
**Recommended Setting:** `true` for development and staging, test thoroughly before enabling in production

---

## VITE_TELEMETRY_CALENDAR_MS

### Overview

Optional feature flag to enable calendar render time telemetry tracking. When enabled, the application records the most recent calendar render duration in milliseconds.

### Default Configuration

By default, this flag is **disabled** (not set or `false`).

```bash
# .env.local or .env.development
VITE_TELEMETRY_CALENDAR_MS=false  # or omit entirely
```

### Enabling Calendar Telemetry

To enable calendar render time tracking:

```bash
# .env.local or .env.development
VITE_TELEMETRY_CALENDAR_MS=true
```

Then restart the dev server:

```bash
pnpm dev
```

### What It Does

When `VITE_TELEMETRY_CALENDAR_MS=true`:

1. **Tracks render time**: Calendar components can record their render duration
2. **Stores in sessionStorage**: Most recent render time is stored (not cumulative)
3. **Export compatible**: Included in telemetry exports via `getAllTelemetry()`
4. **Non-breaking**: New metric is additive and doesn't affect existing telemetry

When `VITE_TELEMETRY_CALENDAR_MS=false` (default):

1. **No-op**: `recordCalendarRenderTime()` is side-effect free
2. **Not exported**: `calendarRenderMs` key is not included in `getAllTelemetry()`
3. **Zero overhead**: No storage operations when disabled

### Usage in Code

```javascript
import { recordCalendarRenderTime, isCalendarTelemetryEnabled } from '../utils/capabilityTelemetry'

// In a calendar component
const startTime = performance.now()
// ... render calendar ...
const duration = performance.now() - startTime

// Safe to call unconditionally - no-op when disabled
recordCalendarRenderTime(duration)

// Check if enabled (optional)
if (isCalendarTelemetryEnabled()) {
  console.log('Calendar telemetry is active')
}
```

### Accessing the Metric

```javascript
import { getAllTelemetry, getTelemetry, TelemetryKey } from '../utils/capabilityTelemetry'

// Get all telemetry (includes calendarRenderMs when flag is true)
const allMetrics = getAllTelemetry()
console.log(allMetrics.calendarRenderMs) // undefined when disabled, number when enabled

// Get specific metric
const renderTime = getTelemetry(TelemetryKey.CALENDAR_RENDER_MS)
console.log(`Last calendar render: ${renderTime}ms`)
```

### Best Practices

1. **Development only**: Enable in development to monitor performance
2. **Disable in production**: Unless you need production performance metrics
3. **Safe to call**: Always safe to call `recordCalendarRenderTime()` regardless of flag state
4. **Not cumulative**: Stores most recent value, not total/average

### Troubleshooting

**Metric not appearing in exports:**
- Ensure `VITE_TELEMETRY_CALENDAR_MS=true` in your `.env` file
- Restart the dev server after changing the flag
- Check `isCalendarTelemetryEnabled()` returns `true`

**Values seem incorrect:**
- The metric stores the most recent render time only
- Negative or invalid values are filtered out
- Decimal values are rounded to nearest integer

---

**Last Updated:** 2025-11-12
**Calendar Telemetry Flag Status:** Optional (disabled by default)
**Recommended Setting:** Enable in development for performance monitoring, disable in production unless needed
