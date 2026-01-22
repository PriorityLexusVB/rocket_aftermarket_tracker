# Error Handling Guide - 400/403 HTTP Errors

## Overview

This application includes comprehensive error handling for PostgREST/Supabase 400 and 403 HTTP errors. The system automatically detects missing database columns, foreign key relationships, and RLS policy issues, then gracefully degrades functionality while tracking telemetry.

## Architecture

### Core Components

#### 1. Schema Error Classifier (`src/utils/schemaErrorClassifier.js`)

Classifies PostgREST/Supabase error messages into specific error codes:

```javascript
import { classifySchemaError, SchemaErrorCode } from '@/utils/schemaErrorClassifier'

// Error classification
const error = new Error('column "vendor_id" does not exist')
const code = classifySchemaError(error)
// Returns: SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_ID
```

**Supported Error Codes:**

- `MISSING_COLUMN` - Generic missing column
- `MISSING_FK` - Generic missing foreign key relationship
- `STALE_CACHE` - PostgREST schema cache needs reload
- `MISSING_JOB_PARTS_SCHEDULED_TIMES` - Missing scheduled_start_time/scheduled_end_time columns
- `MISSING_JOB_PARTS_VENDOR_ID` - Missing vendor_id column on job_parts
- `MISSING_JOB_PARTS_VENDOR_RELATIONSHIP` - Missing FK relationship job_parts → vendors
- `MISSING_PROFILE_NAME` - Missing name column on user_profiles
- `MISSING_PROFILE_FULL_NAME` - Missing full_name column
- `MISSING_PROFILE_DISPLAY_NAME` - Missing display_name column
- `GENERIC` - Other errors (network, permission, etc.)

**Remediation Guidance:**

```javascript
import { getRemediationGuidance } from '@/utils/schemaErrorClassifier'

const error = new Error('column "vendor_id" does not exist')
const guidance = getRemediationGuidance(error)
// Returns:
// {
//   code: 'MISSING_JOB_PARTS_VENDOR_ID',
//   migrationId: '20251106000000',
//   migrationFile: '20251106000000_add_job_parts_vendor_id.sql',
//   description: 'Adds vendor_id column to job_parts with FK to vendors',
//   instructions: [
//     'Apply migration: supabase/migrations/20251106000000_add_job_parts_vendor_id.sql',
//     'Run: NOTIFY pgrst, \'reload schema\';',
//     'Verify: Check health endpoint /api/health/capabilities'
//   ]
// }
```

#### 2. Capability Telemetry (`src/utils/capabilityTelemetry.js`)

Tracks capability fallback events in sessionStorage:

```javascript
import {
  incrementTelemetry,
  getTelemetry,
  getAllTelemetry,
  TelemetryKey,
} from '@/utils/capabilityTelemetry'

// Increment counter
incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)

// Get specific counter
const count = getTelemetry(TelemetryKey.VENDOR_FALLBACK) // Returns: 1

// Get all counters
const telemetry = getAllTelemetry()
// Returns:
// {
//   vendorFallback: 1,
//   vendorIdFallback: 0,
//   vendorRelFallback: 0,
//   scheduledTimesFallback: 0,
//   userProfileNameFallback: 0
// }
```

**Telemetry Keys:**

- `VENDOR_FALLBACK` - Legacy vendor capability fallback
- `VENDOR_ID_FALLBACK` - vendor_id column missing fallback
- `VENDOR_REL_FALLBACK` - Vendor relationship missing fallback
- `SCHEDULED_TIMES_FALLBACK` - Scheduled times columns missing fallback
- `USER_PROFILE_NAME_FALLBACK` - User profile name column missing fallback

### Integration in Services

#### dealService.js

The `dealService` integrates both utilities with automatic retry and graceful degradation:

**Key Features:**

1. **Preflight Schema Probe** - Detects missing columns BEFORE main query
2. **Multi-Attempt Retry** - Up to 4 retry attempts with capability downgrade
3. **SessionStorage Caching** - Capabilities cached to prevent repeated errors
4. **Telemetry Tracking** - Increments counters on each fallback

**Example Flow:**

```javascript
// In getAllDeals():
// 1. Preflight probe checks for vendor_id and scheduled_* columns
// 2. If missing, disable capability and increment telemetry
// 3. Main query executes without those columns
// 4. If main query fails, retry with degraded capabilities
// 5. Mark successful capabilities as available
```

**Capability Flags:**

- `JOB_PARTS_HAS_PER_LINE_TIMES` - scheduled_start_time/scheduled_end_time available
- `JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE` - vendor_id column available
- `JOB_PARTS_VENDOR_REL_AVAILABLE` - vendor relationship available
- `USER_PROFILES_NAME_AVAILABLE` - user_profiles.name column available

**Query Construction:**

```javascript
// Conditional query building based on capabilities
const perLineVendorField = JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE ? 'vendor_id, ' : ''
const perLineVendorJoin =
  JOB_PARTS_VENDOR_REL_AVAILABLE && JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE
    ? ', vendor:vendors(id, name)'
    : ''
const jobPartsTimeFields = JOB_PARTS_HAS_PER_LINE_TIMES
  ? ', scheduled_start_time, scheduled_end_time'
  : ''
```

### Health Endpoints

#### 1. `/api/health-deals-rel` (Serverless)

Validates job_parts → vendors relationship health.

**Response:**

```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "fkName": "job_parts_vendor_id_fkey",
  "cacheRecognized": true,
  "restQueryOk": true,
  "rowsChecked": 1,
  "ms": 42
}
```

**Error Response:**

```json
{
  "ok": false,
  "classification": "missing_fk",
  "hasColumn": true,
  "hasFk": false,
  "error": "Could not find a relationship between 'job_parts' and 'vendors'",
  "advice": "Add FK & NOTIFY pgrst to reload schema",
  "ms": 38
}
```

#### 2. `/api/health-user-profiles` (Serverless)

Detects which user profile display columns exist.

**Response:**

```json
{
  "ok": true,
  "classification": "ok",
  "columns": {
    "name": true,
    "full_name": true,
    "display_name": false
  },
  "ms": 23
}
```

#### 3. `/api/health/capabilities` (Server Route)

Comprehensive capability check with all probes.

**Response:**

```json
{
  "capabilities": {
    "jobPartsScheduledTimes": true,
    "jobPartsVendorId": true,
    "jobPartsVendorRel": true,
    "userProfilesName": true
  },
  "probeResults": {
    "checks": [
      { "name": "job_parts_scheduled_times", "status": "ok" },
      { "name": "job_parts_vendor_id", "status": "ok" },
      { "name": "job_parts_vendor_relationship", "status": "ok" },
      { "name": "user_profiles_name", "status": "ok" }
    ],
    "timestamp": "2025-11-09T18:00:00.000Z"
  },
  "telemetryNote": "Telemetry counters are tracked client-side in sessionStorage.",
  "timestamp": "2025-11-09T18:00:00.000Z"
}
```

#### 4. `/api/health/job-parts-times` (Server Route)

Verifies job_parts scheduling time columns with remediation guidance.

**Response:**

```json
{
  "scheduledTimes": "ok",
  "timestamp": "2025-11-09T18:00:00.000Z",
  "details": {
    "checks": [
      { "name": "supabase_connectivity", "status": "ok" },
      { "name": "scheduled_start_time_column", "status": "ok" },
      { "name": "scheduled_end_time_column", "status": "ok" },
      { "name": "performance_indexes", "status": "ok" }
    ],
    "timestamp": "2025-11-09T18:00:00.000Z"
  }
}
```

**Error Response with Remediation:**

```json
{
  "scheduledTimes": "missing",
  "timestamp": "2025-11-09T18:00:00.000Z",
  "details": {
    "checks": [
      { "name": "supabase_connectivity", "status": "ok" },
      {
        "name": "scheduled_start_time_column",
        "status": "fail",
        "error": "column \"scheduled_start_time\" does not exist",
        "isMissingColumn": true,
        "remediation": {
          "code": "MISSING_JOB_PARTS_SCHEDULED_TIMES",
          "migrationId": "20250117000000",
          "migrationFile": "20250117000000_add_job_parts_scheduling_times.sql",
          "description": "Adds scheduled_start_time and scheduled_end_time columns",
          "instructions": [
            "Apply migration: supabase/migrations/20250117000000_add_job_parts_scheduling_times.sql",
            "Run: NOTIFY pgrst, 'reload schema';",
            "Verify: Check health endpoint /api/health/capabilities"
          ]
        }
      }
    ]
  }
}
```

## Error Handling Flows

### Flow 1: Missing Column Detection

```
1. User loads page → dealService.getAllDeals() called
2. Preflight probe checks job_parts columns
3. Column missing detected (400 error)
4. classifySchemaError() → MISSING_JOB_PARTS_VENDOR_ID
5. Disable capability flag in sessionStorage
6. Increment telemetry counter
7. Retry query without vendor_id column
8. Query succeeds with degraded functionality
```

### Flow 2: Missing Relationship Detection

```
1. Query includes: job_parts(vendor:vendors(id, name))
2. PostgREST returns: "Could not find a relationship..."
3. classifySchemaError() → MISSING_JOB_PARTS_VENDOR_RELATIONSHIP
4. Disable vendor relationship capability
5. Increment telemetry counter
6. Retry query without vendor join
7. Query succeeds, vendor data fetched separately if needed
```

### Flow 3: Stale Cache Detection

```
1. Query fails with cache-related error
2. classifySchemaError() → STALE_CACHE
3. Return remediation guidance:
   - "Execute NOTIFY pgrst, 'reload schema'"
4. Administrator runs SQL command
5. PostgREST reloads schema cache
6. Subsequent queries succeed
```

## Monitoring & Debugging

### Check Telemetry Counters

```javascript
// In browser console
const telemetry = getAllTelemetry()
console.log(telemetry)
// {
//   vendorFallback: 3,
//   vendorIdFallback: 1,
//   vendorRelFallback: 2,
//   scheduledTimesFallback: 0,
//   userProfileNameFallback: 0
// }
```

### Check Capability Flags

```javascript
// In browser console
console.log({
  jobPartsVendorId: sessionStorage.getItem('cap_jobPartsVendorId'),
  jobPartsVendorRel: sessionStorage.getItem('cap_jobPartsVendorRel'),
  jobPartsTimes: sessionStorage.getItem('cap_jobPartsTimes'),
  userProfilesName: sessionStorage.getItem('cap_userProfilesName'),
})
```

### Force Capability Reset

```javascript
// Reset specific capability
sessionStorage.removeItem('cap_jobPartsVendorRel')

// Reset all capabilities
sessionStorage.removeItem('cap_jobPartsVendorId')
sessionStorage.removeItem('cap_jobPartsVendorRel')
sessionStorage.removeItem('cap_jobPartsTimes')
sessionStorage.removeItem('cap_userProfilesName')

// Reset all telemetry
import { resetAllTelemetry } from '@/utils/capabilityTelemetry'
resetAllTelemetry()
```

## Testing

### Unit Tests

```bash
# Run schema error classifier tests
pnpm test src/tests/schemaErrorClassifier.test.js

# Run capability telemetry tests
pnpm test src/tests/capabilityTelemetry.test.js
```

### Manual Testing

1. **Test Missing Column:**
   - Temporarily rename database column
   - Load application
   - Verify graceful degradation
   - Check telemetry counters
   - Restore column

2. **Test Missing Relationship:**
   - Drop FK constraint
   - Load deals page
   - Verify error classification
   - Check health endpoint
   - Restore FK

3. **Test Stale Cache:**
   - Add new column
   - Check if PostgREST recognizes it
   - Run: `NOTIFY pgrst, 'reload schema';`
   - Verify updated behavior

## Best Practices

### When Adding New Columns

1. Add migration file to `supabase/migrations/`
2. Update `SchemaErrorCode` enum if specific classification needed
3. Add migration mapping to `MigrationMapping`
4. Update capability detection in `dealService.js`
5. Add telemetry key if tracking fallback behavior
6. Update health endpoints if needed
7. Add tests for new error scenarios

### When Handling Errors

```javascript
import { classifySchemaError, getRemediationGuidance } from '@/utils/schemaErrorClassifier'
import { incrementTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'

try {
  const { data, error } = await supabase.from('table').select('column')
  if (error) throw error
} catch (error) {
  const code = classifySchemaError(error)

  if (code === SchemaErrorCode.MISSING_COLUMN) {
    // Disable capability and increment telemetry
    incrementTelemetry(TelemetryKey.RELEVANT_FALLBACK)
    // Retry with degraded query
  } else {
    // Get remediation guidance
    const guidance = getRemediationGuidance(error)
    console.error('Error classification:', guidance)
  }
}
```

## Troubleshooting

### Problem: Queries still failing after migration

**Solution:** Reload PostgREST schema cache

```sql
NOTIFY pgrst, 'reload schema';
```

### Problem: Capability not detected after fix

**Solution:** Clear sessionStorage flags

```javascript
sessionStorage.clear()
// OR target specific flags
sessionStorage.removeItem('cap_jobPartsVendorRel')
```

### Problem: Telemetry counters not incrementing

**Solution:** Check sessionStorage availability

```javascript
console.log(typeof sessionStorage !== 'undefined') // Should be true
```

### Problem: Health endpoint returns stale results

**Solution:** Check PostgREST cache and RLS policies

1. Verify migrations applied: `supabase db pull`
2. Reload schema cache: `NOTIFY pgrst, 'reload schema';`
3. Check RLS policies allow SELECT on checked tables

## Migration Mappings

| Error Code                            | Migration ID   | Migration File                                    | Description                                      |
| ------------------------------------- | -------------- | ------------------------------------------------- | ------------------------------------------------ |
| MISSING_JOB_PARTS_SCHEDULED_TIMES     | 20250117000000 | 20250117000000_add_job_parts_scheduling_times.sql | Adds scheduled_start_time and scheduled_end_time |
| MISSING_JOB_PARTS_VENDOR_ID           | 20251106000000 | 20251106000000_add_job_parts_vendor_id.sql        | Adds vendor_id column to job_parts               |
| MISSING_JOB_PARTS_VENDOR_RELATIONSHIP | 20251107093000 | 20251107093000_verify_job_parts_vendor_fk.sql     | Verifies FK relationship                         |

## Performance Considerations

- **Preflight Probes:** Add ~10-50ms latency but prevent main query failures
- **Retry Logic:** Up to 4 attempts with capability downgrade adds latency on first error
- **SessionStorage Caching:** Eliminates repeated error checks after first detection
- **Health Endpoints:** Lightweight probes suitable for monitoring dashboards

## Security Notes

- Health endpoints require valid Supabase credentials
- RLS policies must allow SELECT on probed tables
- Telemetry is client-side only (sessionStorage)
- No sensitive data stored in telemetry counters

## Related Documentation

- [Database Schema](docs/schema-fingerprint.json)
- [Local Dev Supabase (env + migrations)](docs/LOCAL_DEV_SUPABASE.md)
- [Schema Cache Troubleshooting](docs/TROUBLESHOOTING_SCHEMA_CACHE.md)
- [Testing Guide](README.md#testing)
- [Supabase RLS Policies](docs/RLS_FIX_SUMMARY.md)
