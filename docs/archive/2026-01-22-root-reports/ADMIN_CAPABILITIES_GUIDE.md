# Admin Capabilities & Diagnostics - User Guide

## Overview

The Rocket Aftermarket Tracker includes comprehensive admin tools for monitoring and managing capability fallbacks, telemetry, and system diagnostics.

## Admin Capabilities Dashboard

**Access**: `/admin/capabilities` (requires admin privileges)

### Features

#### 1. Telemetry Counters

View real-time counts of capability fallback events:

- **Vendor Fallback**: Legacy vendor capability fallbacks
- **Vendor ID Fallback**: Missing vendor_id column fallbacks
- **Vendor Rel Fallback**: Missing vendor relationship fallbacks
- **Scheduled Times Fallback**: Missing scheduled_start_time/scheduled_end_time fallbacks
- **User Profile Name Fallback**: Missing user profile name column fallbacks

**Actions**:

- **Export**: Download telemetry data as JSON
- **Import**: Restore telemetry from a JSON file
- **Reset All**: Clear all telemetry counters

#### 2. Capability Flags

Monitor and reset capability flags:

- `jobPartsVendorRel`: Vendor relationship availability
- `jobPartsScheduledTimes`: Per-line scheduling times availability
- `jobPartsVendorId`: Vendor ID column availability
- `userProfilesName`: User profiles name column availability

**Status Indicators**:

- 🟢 Green: Capability enabled
- 🔴 Red: Capability disabled
- ⚪ Gray: Not set

**Actions**:

- **Reset**: Remove capability flag to allow re-detection

#### 3. Schema Cache Management

Reload the PostgREST schema cache after database migrations:

```bash
# Via Admin UI
1. Navigate to /admin/capabilities
2. Click "Reload Schema Cache"
3. Wait for confirmation (1-2 seconds)
```

**Rate Limiting**: Maximum 5 requests per minute per user

#### 4. Structured Logs

View and export diagnostic logs:

- **Total Logs**: Count of logs in buffer (max 100)
- **Errors**: Critical and error-level logs
- **Warnings**: Warning-level logs
- **Info**: Informational logs

**Log Categories**:

- `capability_fallback`: Capability degradation events
- `schema_error`: Database schema issues
- `database_error`: Database operation failures
- `authentication`: Auth-related events
- `performance`: Performance metrics
- `user_action`: User-initiated actions

**Actions**:

- **Export Logs**: Download all logs as JSON (includes critical logs from localStorage)
- **Clear Logs**: Remove all logs from buffer

## Diagnostics Banner

**Location**: Top of page (visible in development mode when fallbacks occur)

### What It Shows

- **Fallback Count**: Total number of active capability fallbacks
- **Telemetry Counters**: Breakdown by fallback type
- **Capability Flags**: Current status of each capability
- **Health Check**: Link to comprehensive health check endpoint
- **Export**: Download telemetry snapshot

### When It Appears

- **Development Mode**: Always visible
- **Production Mode**: Only when `showInProd={true}` prop is set

## Health Endpoints

### 1. Basic Health Check

```bash
GET /api/health
```

**Response**:

```json
{
  "ok": true,
  "db": true
}
```

### 2. Deals Relationship Health

```bash
GET /api/health-deals-rel
```

**Response**:

```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "cacheRecognized": true,
  "restQueryOk": true,
  "rowsChecked": 1,
  "ms": 45
}
```

**Classifications**:

- `ok`: All checks passed
- `missing_column`: vendor_id column not found
- `missing_fk`: Foreign key constraint missing
- `stale_cache`: PostgREST cache needs reload
- `other`: Unknown error

### 3. User Profiles Health

```bash
GET /api/health-user-profiles
```

**Response**:

```json
{
  "ok": true,
  "columns": {
    "name": true,
    "full_name": true,
    "display_name": true
  },
  "ms": 23
}
```

### 4. Comprehensive Capabilities Check

```bash
GET /api/health/capabilities
```

**Response**:

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
    "timestamp": "2025-11-09T22:00:00.000Z"
  },
  "timestamp": "2025-11-09T22:00:00.000Z"
}
```

## Verification Scripts

### verify-capabilities.js

Enhanced verification script with comprehensive checks:

```bash
# Run locally
VERIFY_BASE_URL=http://localhost:5173 node scripts/verify-capabilities.js

# Run against deployed environment
VERIFY_BASE_URL=https://your-app.vercel.app node scripts/verify-capabilities.js

# Output JSON for CI/CD
JSON_OUTPUT=true node scripts/verify-capabilities.js
```

**Exit Codes**:

- `0`: All critical checks passed
- `1`: One or more critical checks failed

**Output**:

- Basic health check status
- Deals relationship health
- User profiles health
- Comprehensive capabilities check
- Job parts scheduling times
- Remediation guidance (if failures)

### verify-schema-cache.sh

Database-level verification:

```bash
./scripts/verify-schema-cache.sh
```

**Checks**:

- vendor_id column existence
- Foreign key constraint presence
- Index presence
- Schema cache reload
- REST API relationship query

## Telemetry API

### JavaScript API

```javascript
import {
  incrementTelemetry,
  getTelemetry,
  getAllTelemetry,
  resetTelemetry,
  resetAllTelemetry,
  exportTelemetry,
  importTelemetry,
  persistToLocalStorage,
  restoreFromLocalStorage,
  getTelemetrySummary,
} from '@/utils/capabilityTelemetry'

// Increment a counter
incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)

// Get current value
const count = getTelemetry(TelemetryKey.VENDOR_FALLBACK)

// Get all counters
const all = getAllTelemetry()

// Export to JSON
const json = exportTelemetry()

// Save to localStorage
persistToLocalStorage()

// Restore from localStorage
restoreFromLocalStorage()
```

### Storage Locations

- **Primary**: sessionStorage (cleared on browser close)
- **Fallback**: localStorage (persists across sessions)
- **Critical Logs**: localStorage (max 50 entries)

## Structured Logging API

### JavaScript API

```javascript
import {
  LogLevel,
  LogCategory,
  log,
  logCapabilityFallback,
  logSchemaError,
  getLogs,
  exportLogs,
  getLogStats,
} from '@/utils/structuredLogger'

// Log a capability fallback
logCapabilityFallback('vendorRelationship', 'Missing FK', {
  table: 'job_parts',
  column: 'vendor_id',
})

// Log a schema error
logSchemaError('MISSING_COLUMN', 'Column not found', {
  column: 'vendor_id',
  table: 'job_parts',
})

// Get logs with filters
const errorLogs = getLogs({ level: LogLevel.ERROR })
const recentLogs = getLogs({ since: '2025-11-09T00:00:00.000Z' })

// Export logs
const json = exportLogs(true) // Include critical logs

// Get statistics
const stats = getLogStats()
// { total: 45, byLevel: {...}, byCategory: {...}, criticalCount: 3 }
```

### Log Levels

- `DEBUG`: Detailed debugging information
- `INFO`: Informational messages
- `WARN`: Warning messages (e.g., fallbacks)
- `ERROR`: Error messages
- `CRITICAL`: Critical errors (auto-persisted to localStorage)

### Log Categories

- `capability_fallback`: Capability degradation events
- `schema_error`: Database schema issues
- `database_error`: Database operation failures
- `authentication`: Authentication events
- `performance`: Performance metrics
- `user_action`: User-initiated actions

## Troubleshooting

### Capability Flags Not Updating

1. Check browser console for errors
2. Verify sessionStorage is not blocked
3. Clear browser cache and reload
4. Navigate to `/admin/capabilities` and reset flags

### Telemetry Counters Not Incrementing

1. Verify capability fallbacks are actually occurring
2. Check browser console for errors
3. Verify sessionStorage/localStorage access
4. Review structured logs for diagnostics

### Schema Cache Not Reloading

1. Verify admin privileges
2. Check rate limiting (5 req/min)
3. Review `/api/admin/reload-schema` response
4. Run `scripts/verify-schema-cache.sh` for database-level verification

### Health Endpoints Returning Errors

1. Verify Supabase connection
2. Check RLS policies
3. Review migration status
4. Run `scripts/verify-capabilities.js` for comprehensive diagnostics

## Best Practices

### For Administrators

1. **Monitor Daily**: Check telemetry counters and logs
2. **Export Regularly**: Download logs and telemetry for long-term analysis
3. **Reset After Fixes**: Clear telemetry counters after resolving issues
4. **Verify Deploys**: Run health checks after database migrations

### For Developers

1. **Use Structured Logging**: Log capability fallbacks with context
2. **Test Degraded Modes**: Verify UI handles missing capabilities
3. **Document Changes**: Update capability flags when modifying schema
4. **Run Verification**: Execute verification scripts before deploying

### For DevOps

1. **CI/CD Integration**: Use `verify-capabilities.js` in deployment pipelines
2. **Monitor Rate Limits**: Track schema reload requests
3. **Alert on Failures**: Set up alerts for health endpoint failures
4. **Backup Logs**: Export and archive diagnostic logs regularly

## Related Documentation

- **CAPABILITY_GATING_IMPLEMENTATION_REPORT.md**: Detailed capability gating implementation
- **ERROR_HANDLING_GUIDE.md**: Error handling patterns
- **RUNBOOK.md**: Operational procedures
- **DATABASE_FIX_SUMMARY.md**: Database schema and RLS policies
