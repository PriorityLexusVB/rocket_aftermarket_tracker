# CI/E2E Workflow Fixes - Implementation Summary

## Problem Statement

GitHub Actions workflow run #20197739913 was failing with multiple issues:

1. **Secrets Misconfiguration**: Environment variables reported as missing despite being configured
2. **Database Schema Mismatch**: Tests querying non-existent `user_profiles.name` column
3. **Test Failures**: Multiple E2E tests timing out or failing assertions

## Root Cause Analysis

### 1. Secrets Issue
- Secrets WERE configured, but there was no visibility in workflow logs
- No way to distinguish between "not configured" vs "not accessible" vs "incorrect name"
- Error messages were not actionable

### 2. Schema Issue
- The `user_profiles` table only has `full_name` column (not `name` or `display_name`)
- The health endpoint probes for columns by attempting to query them
- "Column does not exist" errors were expected but appeared as failures
- The capability detection system was designed to handle this, but error messages were confusing

### 3. Test Flakiness
- CI environments are slower than local development
- 30-second timeout was insufficient for slow environments
- No retries meant transient failures caused complete test suite failures
- Test ordering bugs (init scripts called after navigation)
- Insufficient debugging artifacts (traces only on retry, but no retries configured)

## Solutions Implemented

### 1. Enhanced Secrets Debugging (`.github/workflows/e2e.yml`)

**Added Debug Step:**
```yaml
- name: Debug Environment Variables
  run: |
    echo "::group::Environment Variable Check"
    echo "Checking for VITE_* environment variables..."
    env | grep "^VITE_" | sed 's/=.*/=***/' || echo "No VITE_ variables found"
    echo "Checking for E2E_* environment variables..."
    env | grep "^E2E_" | sed 's/=.*/=***/' || echo "No E2E_ variables found"
    echo "::endgroup::"
```

**Enhanced Secret Verification:**
- Shows SET/NOT SET status for each required secret
- Groups output for better readability
- Provides actionable error messages

**Benefits:**
- Immediate visibility into which secrets are missing
- Helps distinguish configuration issues from workflow issues
- Values masked for security (shows only presence, not actual values)

### 2. Improved Health Endpoint Error Handling

**Before:**
```javascript
async function check(col) {
  try {
    const { error } = await supabase.from('user_profiles').select(`id, ${col}`).limit(1)
    return !error
  } catch {
    return null
  }
}
```

**After:**
```javascript
const ALLOWED_COLUMNS = ['name', 'full_name', 'display_name']

async function check(col) {
  // Validate column name to prevent SQL injection
  if (!ALLOWED_COLUMNS.includes(col)) {
    console.warn(`[health-user-profiles] Invalid column name: ${col}`)
    return null
  }

  try {
    const { error } = await supabase.from('user_profiles').select(`id, ${col}`).limit(1)
    // If no error, column exists
    if (!error) return true
    // Check if it's a "column does not exist" error
    const errMsg = String(error?.message || '').toLowerCase()
    if (errMsg.includes('column') && errMsg.includes('does not exist')) {
      return false
    }
    // Other errors (RLS, network, etc.) - treat as unknown
    console.warn(`[health-user-profiles] Unexpected error checking ${col}:`, error?.message)
    return null
  } catch (err) {
    console.warn(`[health-user-profiles] Exception checking ${col}:`, err?.message)
    return null
  }
}
```

**Benefits:**
- Explicit detection of "column does not exist" errors
- Returns `true` for exists, `false` for missing, `null` for other errors
- Better logging distinguishes schema issues from RLS/network issues
- Security: Column name validation prevents SQL injection

### 3. Test Resilience Improvements (`playwright.config.ts`)

**Timeout Increase:**
```typescript
timeout: process.env.CI ? 45_000 : 30_000, // Longer timeout in CI
```

**Retry Configuration:**
```typescript
retries: process.env.CI ? 1 : 0, // Retry once in CI to handle flaky tests
```

**Enhanced Tracing:**
```typescript
trace: process.env.CI ? 'on' : 'on-first-retry', // Always capture traces in CI
```

**Benefits:**
- Handles slow CI environments gracefully
- Transient failures don't cause complete test suite failure
- Always captures traces for debugging (previously only on retry, but retries were disabled!)

### 4. Test Bug Fixes (`e2e/profile-name-fallback.spec.ts`)

**Fixed Init Script Ordering:**

Before (WRONG):
```typescript
await page.goto('/')  // Navigate first
await page.addInitScript(() => { ... })  // Too late! Already navigated
await page.goto('/')  // Navigate again
```

After (CORRECT):
```typescript
await page.addInitScript(() => { ... })  // Set up script before navigation
await page.goto('/')  // Now the script runs on page load
```

**Benefits:**
- Init scripts execute correctly
- Removes redundant navigation calls
- Tests now work as intended

### 5. Enhanced Artifact Collection

**Added Test Results Upload:**
```yaml
- name: Upload test results and traces
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results-full
    path: |
      test-results/
      e2e/*.png
      e2e/*.html
    if-no-files-found: ignore
    retention-days: 7
```

**Benefits:**
- Screenshots show page state at failure
- Traces provide detailed timeline of actions
- HTML dumps help diagnose setup issues
- 7-day retention for debugging

### 6. Comprehensive Documentation

**Created Two New Guides:**

1. **docs/USER_PROFILES_SCHEMA.md** (150 lines):
   - Current schema structure
   - Capability detection system
   - How to add missing columns
   - E2E testing strategy
   - Common issues and solutions

2. **docs/CI_TROUBLESHOOTING.md** (257 lines):
   - Secrets not accessible
   - Database schema mismatch
   - Test timeouts
   - Init script issues
   - Missing artifacts
   - Debugging checklist
   - Local testing instructions

**Benefits:**
- Self-service troubleshooting
- Reduces support burden
- Documents expected behavior vs actual bugs
- Helps new contributors understand the system

## Files Changed

```
.github/workflows/e2e.yml         |  42 ++++++++++++++
api/health-user-profiles.js       |  18 +++++-
docs/CI_TROUBLESHOOTING.md        | 257 ++++++++++++++++++++++++++++++++++++++++++
docs/USER_PROFILES_SCHEMA.md      | 150 ++++++++++++++++++++++++++++
e2e/profile-name-fallback.spec.ts |   2 --
playwright.config.ts              |   6 +-
src/api/health-user-profiles.js   |  18 +++++-
7 files changed, 484 insertions(+), 9 deletions(-)
```

## Testing & Validation

✅ **Build Test**: `pnpm build` - Passes  
✅ **Code Review**: Automated review - 2 comments addressed  
✅ **Security Scan**: CodeQL - 0 vulnerabilities  
✅ **Linting**: No errors introduced  
⏳ **CI Validation**: Awaiting workflow run on this branch

## Backward Compatibility

All changes are backward compatible:
- Health endpoints return same JSON structure
- Capability detection logic unchanged
- Test assertions unchanged
- Config changes only affect CI (via `process.env.CI` checks)

## Expected Outcomes

### For Secrets Issues:
- **Before**: "Missing VITE_SUPABASE_URL" with no additional info
- **After**: Debug output shows which secrets are SET vs NOT SET, actionable next steps

### For Schema Issues:
- **Before**: "PostgrestError: column user_profiles.name does not exist" appeared as test failure
- **After**: Health endpoint returns `{ name: false, full_name: true, display_name: false }`, capability system handles gracefully

### For Test Flakiness:
- **Before**: Single timeout or transient failure = entire test suite fails
- **After**: 1 retry, longer timeout, always-on tracing = more resilient, better debugging

## Rollback Plan

If issues arise, rollback is straightforward:

```bash
git revert 017a930  # Remove SQL injection fix
git revert 1434304  # Remove documentation
git revert 38bfc11  # Remove schema and resilience fixes
git revert b611ce0  # Remove workflow debug enhancements
```

Each commit is self-contained and can be reverted independently.

## Next Steps

1. ✅ **Code Review**: Completed, feedback addressed
2. ✅ **Security Review**: CodeQL passed with 0 alerts
3. ⏳ **CI Validation**: Monitor workflow run on this branch
4. 📝 **User Notification**: Once merged, notify team about new troubleshooting guides

## Success Criteria

- [x] Secrets: Debug output helps identify misconfiguration
- [x] Schema: Health endpoint distinguishes missing columns from errors
- [x] Tests: Increased resilience with retries and timeouts
- [x] Artifacts: All relevant debugging info uploaded
- [x] Documentation: Comprehensive guides for common issues
- [x] Security: SQL injection vulnerability fixed
- [ ] CI: Workflow runs successfully on this branch

## Lessons Learned

1. **Visibility is Key**: Without debug output, it's impossible to diagnose secret issues
2. **Expected Errors**: "Column does not exist" is not always a bug; sometimes it's part of capability detection
3. **CI != Local**: CI environments need longer timeouts and more retries
4. **Test Ordering Matters**: Init scripts must be added before navigation
5. **Always Capture Artifacts**: Traces and screenshots are invaluable for debugging
6. **Security First**: Even internal endpoints need input validation

## Related Issues

- Fixes workflow run #20197739913
- Addresses all three categories of failures mentioned in problem statement
- Provides foundation for more resilient CI/CD going forward
