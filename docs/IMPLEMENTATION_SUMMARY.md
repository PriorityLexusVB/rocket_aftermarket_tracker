# Implementation Summary: Job Parts Scheduling & Vendor Capability Hardening

## Overview

This document summarizes the implementation of comprehensive capability detection and graceful degradation for job parts scheduling time windows and vendor relationships.

## Problem Statement

The application was experiencing 400 errors on initial page load when certain database columns were missing:

- `job_parts.scheduled_start_time` / `scheduled_end_time` (per-line time windows)
- `job_parts.vendor_id` (per-line vendor assignment)
- Missing FK relationship between `job_parts` and `vendors`

These errors occurred in environments where migrations had not been fully applied, causing a poor user experience and preventing the Deals page from loading.

## Solution Architecture

### 1. Schema Preflight Probe

**Location:** `src/services/dealService.js:getAllDeals()`

Before constructing the main query, we probe the `job_parts` table for capability-dependent columns:

```javascript
const { error: probeError } = await supabase
  .from('job_parts')
  .select('scheduled_start_time, scheduled_end_time, vendor_id')
  .limit(1)
```

If columns are missing, we immediately disable the corresponding capabilities and adjust the query.

### 2. Error Classification

**Location:** `src/utils/schemaErrorClassifier.js`

Enhanced error classifier that:

- Detects specific column/relationship errors
- Maps errors to specific migration IDs
- Provides remediation guidance with migration file paths

### 3. Telemetry Tracking

**Location:** `src/utils/capabilityTelemetry.js`

Tracks fallback events in sessionStorage:

- `telemetry_vendorFallback` - Generic vendor fallbacks
- `telemetry_vendorIdFallback` - vendor_id column missing
- `telemetry_vendorRelFallback` - vendor relationship missing
- `telemetry_scheduledTimesFallback` - scheduled\_\* columns missing
- `telemetry_userProfileNameFallback` - user_profiles.name missing

### 4. Health Endpoints

**Locations:**

- `src/api/health/job-parts-times.js` - Checks scheduled\_\* columns
- `src/api/health/deals-rel.js` - Checks vendor_id column and FK
- `src/api/health/capabilities.js` - Reports all capability flags

### 5. Admin Tools

**Location:** `src/api/admin/reload-schema.js`

Admin-only endpoint to trigger PostgREST schema cache reload without database access.

### 6. Conditional UI/Export

**Locations:**

- `src/components/common/ExportButton.jsx` - Conditionally includes scheduled\_\* columns
- `src/utils/dealMappers.js` - Conditionally includes scheduled\_\* fields in form state

## Data Field Transformation Mapping

### Job Parts Scheduling Fields

| UI Field Name            | camelCase              | snake_case (DB)          | Type            | Capability Gate      | Migration ID       |
| ------------------------ | ---------------------- | ------------------------ | --------------- | -------------------- | ------------------ |
| Promised Date            | promisedDate           | promised_date            | DATE            | Always available     | 20250116000000     |
| Requires Scheduling      | requiresScheduling     | requires_scheduling      | BOOLEAN         | Always available     | 20250116000000     |
| No Schedule Reason       | noScheduleReason       | no_schedule_reason       | TEXT            | Always available     | 20250116000000     |
| Is Off-Site              | isOffSite              | is_off_site              | BOOLEAN         | Always available     | 20250116000000     |
| **Scheduled Start Time** | **scheduledStartTime** | **scheduled_start_time** | **TIMESTAMPTZ** | **jobPartsHasTimes** | **20250117000000** |
| **Scheduled End Time**   | **scheduledEndTime**   | **scheduled_end_time**   | **TIMESTAMPTZ** | **jobPartsHasTimes** | **20250117000000** |

### Job Parts Vendor Fields

| UI Field Name | camelCase    | snake_case (DB) | Type     | Capability Gate      | Migration ID       |
| ------------- | ------------ | --------------- | -------- | -------------------- | ------------------ |
| Product ID    | productId    | product_id      | UUID     | Always available     | N/A                |
| **Vendor ID** | **vendorId** | **vendor_id**   | **UUID** | **jobPartsVendorId** | **20251106000000** |
| Unit Price    | unitPrice    | unit_price      | NUMERIC  | Always available     | N/A                |
| Quantity      | quantity     | quantity_used   | INTEGER  | Always available     | N/A                |

### Vendor Relationship Expansion

| Query Pattern                          | Capability Gate   | Migration ID   | Notes                        |
| -------------------------------------- | ----------------- | -------------- | ---------------------------- |
| `vendor:vendors(id,name)` on job_parts | jobPartsVendorRel | 20251107093000 | Requires FK constraint       |
| Fallback to `product.vendor_id`        | Always available  | N/A            | When per-line vendor not set |

### Jobs Table (Always Available)

| UI Field Name         | camelCase             | snake_case (DB)         | Type        | Notes                               |
| --------------------- | --------------------- | ----------------------- | ----------- | ----------------------------------- |
| Job Number            | jobNumber             | job_number              | TEXT        | Auto-generated                      |
| Title                 | title                 | title                   | TEXT        | Auto-derived from vehicle           |
| Description           | description           | description             | TEXT        | Mapped from "Notes" UI field        |
| Job Status            | jobStatus             | job_status              | ENUM        | draft/pending/in_progress/completed |
| Service Type          | serviceType           | service_type            | ENUM        | in_house/vendor                     |
| Vehicle ID            | vehicleId             | vehicle_id              | UUID        | FK to vehicles                      |
| Vendor ID             | vendorId              | vendor_id               | UUID        | Job-level vendor (fallback)         |
| Customer Needs Loaner | customerNeedsLoaner   | customer_needs_loaner   | BOOLEAN     | Loaner flag                         |
| Assigned To           | assignedTo            | assigned_to             | UUID        | FK to user_profiles                 |
| Delivery Coordinator  | deliveryCoordinatorId | delivery_coordinator_id | UUID        | FK to user_profiles                 |
| Finance Manager       | financeManagerId      | finance_manager_id      | UUID        | FK to user_profiles                 |
| Scheduled Start       | scheduledStartTime    | scheduled_start_time    | TIMESTAMPTZ | Job-level scheduling                |
| Scheduled End         | scheduledEndTime      | scheduled_end_time      | TIMESTAMPTZ | Job-level scheduling                |

## Capability Flags

### Runtime Detection

Capability flags are stored in `sessionStorage` and checked on module load:

```javascript
// src/services/dealService.js
let JOB_PARTS_HAS_PER_LINE_TIMES = true // Default optimistic
let JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = true
let JOB_PARTS_VENDOR_REL_AVAILABLE = true
```

### Degradation Strategy

When a column/relationship is missing:

1. Preflight probe detects it immediately
2. Capability flag set to `false` in sessionStorage
3. Telemetry counter incremented
4. Query reconstructed without the unavailable fields
5. UI components hide related controls
6. Export excludes unavailable columns

### Graceful Behavior Matrix

| Capability Missing    | Query Impact                       | UI Impact                       | Export Impact                               |
| --------------------- | ---------------------------------- | ------------------------------- | ------------------------------------------- |
| scheduled\_\* columns | Omit from job_parts select         | Hide time window inputs         | Exclude ScheduledStart/ScheduledEnd columns |
| vendor_id column      | Omit from job_parts select         | Hide per-line vendor select     | Use job-level vendor only                   |
| vendor relationship   | Omit `vendor:vendors(...)` join    | Show "Mixed" vendor aggregation | Use vendor_id UUID only                     |
| user_profiles.name    | Use display_name or email fallback | No visual change                | Use fallback name                           |

## Migration Dependencies

### Recommended Application Order

1. `20250116000000_add_line_item_scheduling_fields.sql` - Base scheduling fields
2. `20250117000000_add_job_parts_scheduling_times.sql` - Time windows
3. `20251106000000_add_job_parts_vendor_id.sql` - Vendor ID column
4. `20251107093000_verify_job_parts_vendor_fk.sql` - FK verification & schema reload

### Idempotency

All migrations use `IF NOT EXISTS` checks and can be safely re-run.

## Testing Coverage

### Unit Tests

- `src/tests/migration.verification.test.js` - Verifies migration file contents
- `src/tests/capabilityTelemetry.test.js` - Tests telemetry counter functions
- `src/tests/schemaErrorClassifier.test.js` - Tests error classification

### E2E Tests (Planned)

- `e2e/deals-degraded-modes.spec.ts` - Simulates missing columns
- Vehicle/loaner reliability tests
- Multi-user concurrency tests

## Monitoring & Diagnostics

### Health Check Endpoints

```bash
# Check scheduled_* columns availability
GET /api/health/job-parts-times

# Check vendor_id column and FK relationship
GET /api/health/deals-rel

# Get all capability flags and telemetry
GET /api/health/capabilities
```

### Browser Console Diagnostics

```javascript
// Check capability flags
sessionStorage.getItem('cap_jobPartsTimes') // "true" or "false"
sessionStorage.getItem('cap_jobPartsVendorId') // "true" or "false"
sessionStorage.getItem('cap_jobPartsVendorRel') // "true" or "false"

// Check telemetry counters
sessionStorage.getItem('telemetry_scheduledTimesFallback') // Count
sessionStorage.getItem('telemetry_vendorIdFallback') // Count
sessionStorage.getItem('telemetry_vendorRelFallback') // Count
```

### Admin Tools

```bash
# Reload PostgREST schema cache (requires admin auth)
POST /api/admin/reload-schema
Authorization: Bearer <admin_token>
```

## Rollback Strategy

All changes are backward compatible:

- If migrations are rolled back, app enters degraded mode automatically
- No code changes needed to handle missing columns
- Export and forms adapt automatically based on capability flags

## Performance Impact

- **Preflight probe:** Adds ~10-50ms to first `getAllDeals()` call
- **Cached after first probe:** No repeated preflight on subsequent calls in same session
- **No impact on fully migrated environments:** Probe succeeds immediately, all features enabled

## Security Considerations

- Admin reload-schema endpoint requires authentication and `is_admin` flag
- Health endpoints are public (read-only diagnostics)
- Capability flags stored client-side only (sessionStorage)
- No sensitive data exposed in telemetry

## Related Documentation

- [RUNBOOK_JOB_PARTS_VENDOR_FK.md](./RUNBOOK_JOB_PARTS_VENDOR_FK.md) - Operational runbook
- [docs/TROUBLESHOOTING_SCHEMA_CACHE.md](./TROUBLESHOOTING_SCHEMA_CACHE.md) - Schema cache issues
- [docs/job_parts_vendor_relationship_fix.md](./job_parts_vendor_relationship_fix.md) - Vendor relationship history

## Change Log

- 2025-01-09: Initial implementation of capability hardening
- 2025-01-09: Added preflight probe and telemetry
- 2025-01-09: Created health endpoints and admin tools
- 2025-01-09: Updated ExportButton and dealMappers for conditional fields
