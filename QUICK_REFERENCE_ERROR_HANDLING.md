# Quick Reference - Error Handling

## 🚨 Common Error Scenarios

### Scenario 1: "column does not exist" Error

**Symptom:** Query fails with `column "vendor_id" does not exist`

**Quick Fix:**
```javascript
// The system will automatically:
// 1. Detect the error
// 2. Classify it as MISSING_COLUMN
// 3. Disable the capability
// 4. Retry without that column
// 5. Track in telemetry
```

**Manual Verification:**
```javascript
// Check capability status
console.log(sessionStorage.getItem('cap_jobPartsVendorId')) // 'false' = disabled

// Check telemetry
import { getTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'
console.log(getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)) // Counter value
```

**Permanent Fix:** Apply the migration:
```bash
# Check which migration is needed
curl /api/health/capabilities

# Apply migration
npx supabase db push

# Reload PostgREST cache
psql -c "NOTIFY pgrst, 'reload schema';"
```

### Scenario 2: "Could not find a relationship" Error

**Symptom:** Query fails with `Could not find a relationship between 'job_parts' and 'vendors'`

**Quick Fix:**
```javascript
// System automatically:
// 1. Detects missing relationship
// 2. Disables vendor relationship capability
// 3. Retries without the join
// 4. Increments telemetry
```

**Health Check:**
```bash
curl /api/health-deals-rel
# Returns:
# {
#   "ok": false,
#   "classification": "missing_fk",
#   "advice": "Add FK & NOTIFY pgrst to reload schema"
# }
```

**Permanent Fix:**
```sql
-- Add FK constraint
ALTER TABLE job_parts 
ADD CONSTRAINT job_parts_vendor_id_fkey 
FOREIGN KEY (vendor_id) REFERENCES vendors(id);

-- Reload cache
NOTIFY pgrst, 'reload schema';
```

### Scenario 3: Stale PostgREST Cache

**Symptom:** Migration applied but queries still fail

**Quick Fix:**
```sql
-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

**Verification:**
```bash
# Check all capabilities
curl /api/health/capabilities

# Check specific relationship
curl /api/health-deals-rel
```

## 📊 Quick Telemetry Check

```javascript
// Browser console
import { getAllTelemetry, getTelemetrySummary } from '@/utils/capabilityTelemetry'

// Get all counters
console.table(getAllTelemetry())

// Get summary with timestamp
console.log(getTelemetrySummary())
```

## 🔍 Quick Capability Check

```javascript
// Check all capability flags
console.log({
  vendorId: sessionStorage.getItem('cap_jobPartsVendorId'),
  vendorRel: sessionStorage.getItem('cap_jobPartsVendorRel'),
  times: sessionStorage.getItem('cap_jobPartsTimes'),
  userNames: sessionStorage.getItem('cap_userProfilesName')
})

// Reset a capability (force re-check)
sessionStorage.removeItem('cap_jobPartsVendorRel')
location.reload()
```

## 🏥 Health Endpoint Quick Reference

| Endpoint | Purpose | Quick Check |
|----------|---------|-------------|
| `/api/health/capabilities` | All capabilities | `curl /api/health/capabilities` |
| `/api/health-deals-rel` | Vendor relationship | `curl /api/health-deals-rel` |
| `/api/health-user-profiles` | Profile columns | `curl /api/health-user-profiles` |
| `/api/health/job-parts-times` | Scheduling columns | `curl /api/health/job-parts-times` |

## 🛠️ Quick Troubleshooting

### Problem: Application slow after upgrade

**Check:** Are preflight probes failing?
```javascript
// Monitor network tab for 400 errors on job_parts
// Check telemetry counters
getAllTelemetry()
```

**Solution:** Apply missing migrations
```bash
npx supabase db push
psql -c "NOTIFY pgrst, 'reload schema';"
```

### Problem: Features missing after deployment

**Check:** Which capabilities are disabled?
```javascript
// In browser console
Object.keys(sessionStorage)
  .filter(k => k.startsWith('cap_'))
  .map(k => ({ [k]: sessionStorage.getItem(k) }))
```

**Solution:** Check health endpoints
```bash
curl /api/health/capabilities | jq
```

### Problem: Errors persisting after fix

**Solution:** Clear capability cache
```javascript
// Clear all capability flags
sessionStorage.clear()
location.reload()
```

## 📝 Quick Error Classification

```javascript
import { classifySchemaError, SchemaErrorCode } from '@/utils/schemaErrorClassifier'

const error = new Error('column "vendor_id" does not exist')
const code = classifySchemaError(error)

// Returns one of:
// - MISSING_COLUMN
// - MISSING_FK
// - STALE_CACHE
// - MISSING_JOB_PARTS_SCHEDULED_TIMES
// - MISSING_JOB_PARTS_VENDOR_ID
// - MISSING_JOB_PARTS_VENDOR_RELATIONSHIP
// - MISSING_PROFILE_NAME
// - MISSING_PROFILE_FULL_NAME
// - MISSING_PROFILE_DISPLAY_NAME
// - GENERIC
```

## 🔧 Quick Remediation

```javascript
import { getRemediationGuidance } from '@/utils/schemaErrorClassifier'

const error = new Error('column "vendor_id" does not exist')
const guidance = getRemediationGuidance(error)

console.log(guidance)
// {
//   code: 'MISSING_JOB_PARTS_VENDOR_ID',
//   migrationId: '20251106000000',
//   migrationFile: '20251106000000_add_job_parts_vendor_id.sql',
//   instructions: ['Apply migration...', 'Run: NOTIFY pgrst...', ...]
// }
```

## 🧪 Quick Test

```bash
# Test error classification
pnpm test src/tests/schemaErrorClassifier.test.js

# Test telemetry
pnpm test src/tests/capabilityTelemetry.test.js

# Test all error handling
pnpm test -- schemaErrorClassifier capabilityTelemetry
```

## 🚀 Quick Reset (Development)

```javascript
// Clear everything
sessionStorage.clear()

// OR clear just error handling state
import { resetAllTelemetry } from '@/utils/capabilityTelemetry'
resetAllTelemetry()
sessionStorage.removeItem('cap_jobPartsVendorId')
sessionStorage.removeItem('cap_jobPartsVendorRel')
sessionStorage.removeItem('cap_jobPartsTimes')
sessionStorage.removeItem('cap_userProfilesName')

// Reload
location.reload()
```

## 📖 Full Documentation

For comprehensive documentation, see: [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md)

## 🆘 Emergency Checklist

When queries are failing in production:

1. ✅ Check health endpoints: `curl /api/health/capabilities`
2. ✅ Reload PostgREST cache: `NOTIFY pgrst, 'reload schema';`
3. ✅ Verify migrations applied: `npx supabase db pull`
4. ✅ Check RLS policies: `select * from pg_policies;`
5. ✅ Clear client cache: `sessionStorage.clear()`
6. ✅ Check telemetry: `getAllTelemetry()`
7. ✅ Review error logs for classification codes
8. ✅ Apply missing migrations as indicated by remediation guidance

## 📱 Mobile/Edge Cases

The error handling system works in environments with:
- ✅ SSR/Server-side rendering (capabilities re-checked)
- ✅ No sessionStorage (gracefully degrades)
- ✅ Offline mode (returns cached errors)
- ✅ Multiple tabs (each tab has independent capability state)

## 🔐 Security Notes

- All health endpoints require valid Supabase credentials
- Telemetry contains no sensitive data
- Capability flags are client-side hints only
- RLS policies still enforce server-side security
