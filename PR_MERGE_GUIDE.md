# PR Merge Guide: Resolving Failing E2E Tests

## Executive Summary

**Issue**: PR #232 failing E2E tests in CI due to missing authentication credentials  
**Root Cause**: 7 E2E test files missing proper environment variable skip logic  
**Solution**: Added consistent `test.skip()` checks for `E2E_EMAIL` and `E2E_PASSWORD`  
**Status**: ✅ Fixed in PR #237

---

## What Was Failing?

### Failed Workflow Run
- **Run ID**: [20415386523](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20415386523)
- **Job**: E2E Smoke (PR) - Step 8: "Run E2E smoke tests (fast subset)"
- **Tests Run**:
  1. `e2e/profile-name-fallback.spec.ts` ❌ (missing skip logic)
  2. `e2e/deal-form-dropdowns.spec.ts` ❌ (missing skip logic)
  3. `e2e/deal-edit.spec.ts` ✅ (already had skip logic)

### Why Were They Failing?
The E2E workflow checks for required secrets and sets `secrets_available=true/false`. However:
- The workflow still **installs dependencies and Playwright** even when secrets are missing
- Tests then **attempt to run** but fail authentication checks
- **7 test files** were missing the environment variable check that should skip them BEFORE execution

### Files Without Proper Skip Logic (Before Fix)
1. `e2e/calendar-loaner-badge.spec.ts`
2. `e2e/deal-dropdown-persistence.spec.ts`
3. `e2e/deal-form-dropdowns.spec.ts` ⚠️ **Run in CI smoke tests**
4. `e2e/deal-staff-dropdowns.spec.ts`
5. `e2e/loaner-and-reps.spec.ts`
6. `e2e/profile-name-fallback.spec.ts` ⚠️ **Run in CI smoke tests**
7. `e2e/deal-edit.spec.ts` ✅ **Already had skip logic**

---

## What Changed in PR #237?

### Pattern Applied to All 6 Files (+ 1 verified)

**BEFORE** (example from `deal-form-dropdowns.spec.ts`):
```typescript
import { test, expect } from '@playwright/test'

test.describe('Deal Form dropdowns and line items', () => {
  test('dropdowns populate and product auto-fills unit price', async ({ page }) => {
    // ❌ Checking session INSIDE test (too late - already running)
    await page.goto('/debug-auth')
    const hasSession = await page.getByTestId('session-user-id').isVisible().catch(() => false)
    test.skip(!(hasSession && hasOrg), 'No authenticated session')
    // ...
  })
})
```

**AFTER** (consistent pattern):
```typescript
import { test, expect } from '@playwright/test'

// ✅ Check environment variables BEFORE test execution
const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Deal Form dropdowns and line items', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')
  
  test('dropdowns populate and product auto-fills unit price', async ({ page }) => {
    // Test code runs only if env vars are set
    // ...
  })
})
```

### Files Changed
| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `e2e/calendar-loaner-badge.spec.ts` | +3 | Added skip logic |
| `e2e/deal-dropdown-persistence.spec.ts` | +3 | Added skip logic |
| `e2e/deal-form-dropdowns.spec.ts` | +3 | Added skip logic |
| `e2e/deal-staff-dropdowns.spec.ts` | +3 | Added skip logic |
| `e2e/loaner-and-reps.spec.ts` | +3 | Added skip logic |
| `e2e/profile-name-fallback.spec.ts` | +5 -2 | Replaced inline skip |
| `e2e/deal-edit.spec.ts` | ✅ No change | Already correct |

**Total Impact**: 21 lines changed across 6 files (minimal, surgical fix)

---

## Current PR Structure

```
main (production branch)
 ↑
 └── PR #232: copilot/fix-ci-test-duration-issue (failing E2E tests)
      ↑
      └── PR #237: copilot/debug-failing-errors (fixes E2E tests)
```

**Problem**: PR #237 is based on PR #232's branch, which is failing. This creates a dependency chain.

---

## How to Merge: 3 Options

### ✅ **Option 1: Cherry-Pick into PR #232 (RECOMMENDED)**

**Pros**: 
- Cleanest history
- Fixes PR #232 directly
- One PR to review and merge

**Steps**:
```bash
# 1. Switch to PR #232's branch
git checkout copilot/fix-ci-test-duration-issue
git pull origin copilot/fix-ci-test-duration-issue

# 2. Cherry-pick the fix commit from PR #237
git cherry-pick 684a17d

# 3. Push updated PR #232
git push origin copilot/fix-ci-test-duration-issue

# 4. Close PR #237 (changes now in PR #232)
# Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/237
# Click "Close pull request" with comment:
# "Closing in favor of cherry-picking fix into PR #232"

# 5. Wait for PR #232 CI to pass, then merge to main
```

**Expected Result**:
- PR #232 E2E tests will pass (tests properly skipped when secrets missing)
- PR #237 can be closed
- Single merge into `main`

---

### **Option 2: Sequential Merge (Two-Step)**

**Pros**: 
- Keeps both PRs' commit history intact
- Clear separation of concerns

**Steps**:
```bash
# 1. Change PR #237's base branch from PR #232's branch to main
# Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/237
# Click "Edit" next to title
# Change base branch from "copilot/fix-ci-test-duration-issue" to "main"

# 2. Merge PR #237 into main first
# This adds the E2E skip logic to main

# 3. Rebase PR #232 on updated main
git checkout copilot/fix-ci-test-duration-issue
git pull origin main
git rebase main
# Resolve any conflicts (likely none)
git push --force-with-lease origin copilot/fix-ci-test-duration-issue

# 4. Merge PR #232 into main
```

**Expected Result**:
- Two separate merges into `main`
- PR #232 will already include PR #237's changes after rebase

---

### **Option 3: New Combined PR (Cleanest GitHub History)**

**Pros**: 
- Single PR with all changes
- Clean, linear commit history
- Easy to review as one unit

**Steps**:
```bash
# 1. Create new branch from main
git checkout main
git pull origin main
git checkout -b fix/e2e-auth-and-notifications-combined

# 2. Merge PR #232's branch (includes PR #237 changes)
git merge --no-ff origin/copilot/fix-ci-test-duration-issue

# 3. Push new branch
git push origin fix/e2e-auth-and-notifications-combined

# 4. Create new PR from GitHub UI
# Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/compare/main...fix/e2e-auth-and-notifications-combined
# Title: "Fix E2E test auth handling and notification subscriptions"
# Body: Combine descriptions from PR #232 and PR #237

# 5. Close PR #232 and PR #237
# Comment: "Superseded by PR #XXX (combined fix)"
```

**Expected Result**:
- One new PR with all changes
- PR #232 and PR #237 closed
- Cleaner GitHub PR list

---

## Verification Steps

### 1. Verify Tests Skip When Auth Missing
```bash
cd /path/to/rocket_aftermarket_tracker

# Unset auth environment variables
unset E2E_EMAIL
unset E2E_PASSWORD

# Run smoke tests (should skip, not fail)
pnpm exec playwright test \
  e2e/profile-name-fallback.spec.ts \
  e2e/deal-form-dropdowns.spec.ts \
  e2e/deal-edit.spec.ts

# Expected output:
# 3 skipped (E2E auth env not set)
```

### 2. Verify Tests Run When Auth Present
```bash
# Set auth environment variables (use your test credentials)
export E2E_EMAIL="your-test-email@example.com"
export E2E_PASSWORD="your-test-password"
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Run smoke tests (should execute and pass)
pnpm exec playwright test \
  e2e/profile-name-fallback.spec.ts \
  e2e/deal-form-dropdowns.spec.ts \
  e2e/deal-edit.spec.ts

# Expected output:
# 3 passed (or specific test counts)
```

### 3. Check CI Logs
After merging, check the workflow run:
- Go to: [Actions tab](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/workflows/e2e.yml)
- Look for the "E2E Smoke (PR)" job
- Step 8 "Run E2E smoke tests" should show:
  ```
  3 passed
  ```
  (if secrets are available) or skipped if not

---

## Summary of Changes by File

### `e2e/calendar-loaner-badge.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Deal edit page: loaner badge and calendar button', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
```

### `e2e/deal-dropdown-persistence.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Deal form dropdown persistence', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
```

### `e2e/deal-form-dropdowns.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Deal Form dropdowns and line items', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
-   // Removed inline session check (now redundant)
```

### `e2e/deal-staff-dropdowns.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Deal form staff dropdowns', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
```

### `e2e/loaner-and-reps.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Deal form: loaner need and sales rep assignment', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
```

### `e2e/profile-name-fallback.spec.ts`
```diff
+ const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
+
  test.describe('Profile name capability fallback', () => {
+   test.skip(missingAuthEnv, 'E2E auth env not set')
-   // Removed per-test inline skip checks
```

### `e2e/deal-edit.spec.ts`
✅ **No changes needed** - already had proper skip logic:
```typescript
const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Deal create + edit flow', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')
  // ...
})
```

---

## Rollback Plan (If Needed)

If issues arise after merging, you can quickly revert:

```bash
# 1. Find the merge commit SHA
git log --oneline -10

# 2. Revert the merge commit
git revert -m 1 <merge-commit-sha>

# 3. Push the revert
git push origin main
```

Or create a quick fix PR:
```bash
# Remove the skip logic from the 6 files
# Push to a new branch
# Create PR to revert changes
```

---

## Questions?

- **Why not fix the workflow instead?** The workflow already conditionally runs steps based on secret availability, but Playwright still attempts to execute tests. The skip logic is the proper pattern (used by other auth-dependent tests like `deal-edit.spec.ts`).

- **Will this break existing tests?** No. When `E2E_EMAIL` and `E2E_PASSWORD` are set (production/local with credentials), tests run normally. When missing (forked PRs, environments without secrets), tests are gracefully skipped.

- **Do we need to update the workflow?** No. The workflow's secret check is still useful for early warning. The test-level skip logic is a defense-in-depth approach.

---

## Next Steps

1. **Choose a merge strategy** (Option 1 recommended)
2. **Execute the merge steps** from your chosen option
3. **Verify CI passes** on the merged PR
4. **Monitor the first few workflow runs** after merge to ensure stability

---

**Created**: 2025-12-22  
**Author**: GitHub Copilot Agent  
**PRs Referenced**: #232, #237  
**Failing Workflow Run**: [20415386523](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20415386523/job/58667137325)
