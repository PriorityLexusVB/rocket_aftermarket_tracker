# PR Merge Execution Checklist

Use this checklist when executing the merge strategy. Check off each item as you complete it.

---

## Pre-Merge Checklist

- [ ] Review all analysis documents
  - [ ] PR_MERGE_STRATEGY.md
  - [ ] FINAL_MERGE_PLAN.md
  - [ ] MERGE_QUICK_REFERENCE.md
  - [ ] PR_MERGE_VISUAL_GUIDE.md (this file)
- [ ] Understand what each PR does
- [ ] Understand why we're combining #235 + env.ts from #233
- [ ] Have main branch checkout access
- [ ] Have test environment ready (pnpm installed)

---

## Step 1: Prepare Environment

```bash
cd /home/runner/work/rocket_aftermarket_tracker/rocket_aftermarket_tracker
```

- [ ] In correct directory
- [ ] pnpm available: `pnpm --version`
- [ ] Node 20 active: `node --version`
- [ ] Git clean state: `git status`

---

## Step 2: Fetch Latest Changes

```bash
git fetch --all
git checkout main
git pull origin main
```

- [ ] All remote branches fetched
- [ ] On main branch
- [ ] Main is up to date with origin

**Current main SHA:** `____________________`

---

## Step 3: Create Integration Branch (Optional but Recommended)

```bash
git checkout -b fix/integrate-e2e-test-fixes
```

- [ ] New branch created
- [ ] Based on latest main

**Alternative:** Work directly on main if you have confidence

---

## Step 4: Merge PR #235

```bash
git merge --no-ff origin/copilot/fix-ci-e2e-test-failures -m "feat: fix E2E test failures with auth guards and dropdown waits"
```

- [ ] Merge completed without conflicts
- [ ] If conflicts: Stop and review, shouldn't have any
- [ ] Check changed files: `git diff HEAD~1 --name-only`

**Expected files changed (11):**
- [ ] api/health-user-profiles.js
- [ ] src/api/health-user-profiles.js
- [ ] e2e/admin-crud.spec.ts
- [ ] e2e/deal-edit.spec.ts
- [ ] e2e/deal-form-dropdowns.spec.ts
- [ ] e2e/deal-unsaved-guard.spec.ts
- [ ] e2e/deals-redirect.spec.ts
- [ ] e2e/nav-smoke.spec.ts
- [ ] e2e/profile-name-fallback.spec.ts
- [ ] global.setup.ts
- [ ] playwright.config.ts

**Post-merge SHA:** `____________________`

---

## Step 5: Cherry-Pick env.ts from PR #233

```bash
git checkout origin/copilot/diag-and-fix-issues -- src/lib/env.ts
git status
```

- [ ] src/lib/env.ts is staged (green in git status)
- [ ] Review the file: `cat src/lib/env.ts`

**Expected content:**
```typescript
// Helper to detect if running in test environment
// Detects both Vitest (unit tests) and Playwright (E2E tests)
export const isTest = !!(
  // Vitest unit tests
  (typeof import.meta !== 'undefined' && import.meta.env?.VITEST) ||
  // Playwright E2E tests (via explicit env var)
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_E2E_TEST) ||
  // Playwright E2E tests (via navigator.webdriver detection)
  (typeof navigator !== 'undefined' && navigator.webdriver === true)
)
```

- [ ] File content matches expected

```bash
git commit -m "feat: enhance isTest helper to detect Playwright E2E tests

- Detects VITE_E2E_TEST env var
- Detects navigator.webdriver
- Prevents Navbar Supabase subscriptions during E2E tests
- Fixes open handles and network call issues

Cherry-picked from PR #233"
```

- [ ] Commit created

**Post-cherry-pick SHA:** `____________________`

---

## Step 6: Add VITE_E2E_TEST Flag to playwright.config.ts

Open `playwright.config.ts` in your editor.

Find the `webServer.env` section (around line 60).

**Current content (from PR #235):**
```typescript
webServer: {
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_ORG_SCOPED_DROPDOWNS: process.env.VITE_ORG_SCOPED_DROPDOWNS || 'true',
    VITE_SIMPLE_CALENDAR: process.env.VITE_SIMPLE_CALENDAR || 'true',
    VITE_DEAL_FORM_V2: process.env.VITE_DEAL_FORM_V2 || 'true',
    // E2E config for global.setup
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
    E2E_EMAIL: process.env.E2E_EMAIL || '',
    E2E_PASSWORD: process.env.E2E_PASSWORD || '',
  },
},
```

**Add this line after `VITE_DEAL_FORM_V2`:**
```typescript
    VITE_E2E_TEST: 'true',
```

**Result should look like:**
```typescript
webServer: {
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_ORG_SCOPED_DROPDOWNS: process.env.VITE_ORG_SCOPED_DROPDOWNS || 'true',
    VITE_SIMPLE_CALENDAR: process.env.VITE_SIMPLE_CALENDAR || 'true',
    VITE_DEAL_FORM_V2: process.env.VITE_DEAL_FORM_V2 || 'true',
    VITE_E2E_TEST: 'true',  // ← This line added
    // E2E config for global.setup
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
    E2E_EMAIL: process.env.E2E_EMAIL || '',
    E2E_PASSWORD: process.env.E2E_PASSWORD || '',
  },
},
```

- [ ] Line added correctly
- [ ] File saved
- [ ] No syntax errors (check commas!)

```bash
git add playwright.config.ts
git commit -m "feat: add VITE_E2E_TEST flag to playwright config

- Explicitly marks E2E test environment
- Used by enhanced isTest helper
- Ensures Navbar skips Supabase during E2E tests"
```

- [ ] Commit created

**Post-manual-edit SHA:** `____________________`

---

## Step 7: Review All Changes

```bash
git log --oneline -5
git diff origin/main --stat
```

- [ ] See 3 new commits (merge + cherry-pick + manual edit)
- [ ] Total files changed: 12

**List changed files:**
```bash
git diff origin/main --name-only
```

**Expected files (12):**
- api/health-user-profiles.js
- src/api/health-user-profiles.js
- src/lib/env.ts
- e2e/admin-crud.spec.ts
- e2e/deal-edit.spec.ts
- e2e/deal-form-dropdowns.spec.ts
- e2e/deal-unsaved-guard.spec.ts
- e2e/deals-redirect.spec.ts
- e2e/nav-smoke.spec.ts
- e2e/profile-name-fallback.spec.ts
- global.setup.ts
- playwright.config.ts

- [ ] All expected files present
- [ ] No unexpected files changed

---

## Step 8: Install Dependencies

```bash
pnpm install
```

- [ ] Installation succeeded
- [ ] No errors
- [ ] Dependencies up to date

---

## Step 9: Run Unit Tests

```bash
pnpm test
```

**Watch for:**
- [ ] All tests start running
- [ ] No hanging (should complete in < 2 minutes)
- [ ] Tests pass
- [ ] No open handle warnings

**Test results:**
- Passed: `_____ / _____`
- Failed: `_____ / _____`
- Duration: `_____ seconds`

- [ ] ✅ All tests pass
- [ ] ❌ Tests failed (STOP, debug before continuing)

---

## Step 10: Run E2E Tests WITHOUT Auth

```bash
# Ensure auth env vars are not set
unset E2E_EMAIL
unset E2E_PASSWORD
echo "E2E_EMAIL: $E2E_EMAIL (should be empty)"
echo "E2E_PASSWORD: $E2E_PASSWORD (should be empty)"

# Run E2E tests
pnpm e2e --project=chromium
```

**Expected behavior:**
- Tests skip with message: "E2E auth env not set"
- No test failures
- No timeout errors

**E2E results (no auth):**
- Passed: `_____ / _____`
- Skipped: `_____ / _____`
- Failed: `_____ / _____`

- [ ] ✅ All auth-required tests skipped cleanly
- [ ] ❌ Tests failed (STOP, debug before continuing)

---

## Step 11: Run E2E Tests WITH Auth

```bash
# Set auth env vars (use real test credentials)
export E2E_EMAIL="your-test-email@example.com"
export E2E_PASSWORD="your-test-password"

# Run E2E tests
pnpm e2e --project=chromium
```

**Watch for:**
- [ ] Tests start running
- [ ] No "E2E auth env not set" skips
- [ ] Product dropdowns wait for options (no timeout)
- [ ] All tests pass

**E2E results (with auth):**
- Passed: `_____ / _____`
- Failed: `_____ / _____`
- Duration: `_____ seconds`

- [ ] ✅ All tests pass
- [ ] ❌ Tests failed (STOP, investigate failures)

**If tests fail, check:**
1. Are products/vendors seeded in test DB?
2. Is storageState.json created properly?
3. Are there any console errors?
4. Did dropdown waits timeout?

---

## Step 12: Run Build

```bash
pnpm build
```

- [ ] Build starts
- [ ] No type errors
- [ ] No module resolution errors
- [ ] Build completes successfully

**Build time:** `_____ seconds`

- [ ] ✅ Build succeeded
- [ ] ❌ Build failed (STOP, fix errors)

---

## Step 13: Run Lint

```bash
pnpm lint
```

- [ ] Linting completes
- [ ] 0 errors
- [ ] 0 warnings (or only pre-existing warnings)

- [ ] ✅ Lint passed
- [ ] ❌ Lint failed (fix linting errors)

---

## Step 14: Final Review

Review the git log and changes one more time:

```bash
git log --oneline origin/main..HEAD
git diff origin/main
```

- [ ] Changes make sense
- [ ] No debug code left behind
- [ ] No unintended file changes
- [ ] Ready to push

---

## Step 15: Push Changes

**If you created a branch:**
```bash
git push origin fix/integrate-e2e-test-fixes
# Then create PR via GitHub UI
```

**If working on main directly:**
```bash
git push origin main
```

- [ ] Push succeeded
- [ ] CI started (check GitHub Actions)

**Pushed to:** `____________________`

---

## Step 16: Monitor CI

Go to GitHub Actions and watch the CI run:

- [ ] CI started
- [ ] Unit tests passing in CI
- [ ] E2E tests passing in CI (with secrets)
- [ ] E2E tests skipping in fork PRs (without secrets)
- [ ] Build passing in CI
- [ ] All checks green

**CI Run URL:** `____________________`

- [ ] ✅ CI passed
- [ ] ❌ CI failed (investigate and fix)

---

## Step 17: Close Related PRs

Once merged and CI passes, close these PRs with appropriate messages:

### PR #235 (copilot/fix-ci-e2e-test-failures)
```
✅ Merged into main via commit [SHA]
All changes incorporated.
```
- [ ] PR #235 closed

### PR #233 (copilot/diag-and-fix-issues)
```
✅ Partially merged: src/lib/env.ts cherry-picked via commit [SHA]
Other changes not needed as PR #235 provided better implementations.
```
- [ ] PR #233 closed

### PR #232 (copilot/fix-ci-test-duration-issue)
```
⏸️ Keeping open for now
Notification tests may be useful in future. Auth guards covered by #235.
```
- [ ] Decision made on PR #232

### PR #236 (copilot/fix-failed-test-issues) - THIS PR
```
✅ Analysis complete
Created comprehensive merge strategy. Changes implemented via main merge.
```
- [ ] PR #236 closed

---

## Step 18: Optionally Merge PR #234 (Documentation)

PR #234 is independent (documentation only). Can be merged anytime:

```bash
git checkout main
git pull origin main
git merge --no-ff origin/copilot/add-agent-skills-pack -m "docs: add agent skills pack documentation"
git push origin main
```

- [ ] Decided whether to merge PR #234 now or later
- [ ] If merging now: PR #234 merged and closed

---

## Post-Merge Verification

### Sanity Checks (Run on main after merge)

```bash
git checkout main
git pull origin main

# Quick checks
pnpm test
pnpm e2e --project=chromium  # Without auth
E2E_EMAIL=test@example.com E2E_PASSWORD=pass pnpm e2e --project=chromium  # With auth
pnpm build
```

- [ ] All checks still pass on main
- [ ] No regressions detected
- [ ] CI shows green on main branch

---

## Rollback Plan (If Needed)

If something goes wrong after push:

```bash
# Option 1: Revert the merge commits
git log --oneline -5
git revert -m 1 <merge-commit-sha>
git revert <cherry-pick-sha>
git revert <manual-edit-sha>
git push origin main

# Option 2: Hard reset (ONLY if no one else pulled)
git reset --hard <commit-before-merge>
# Cannot force push - ask for help

# Option 3: Create a fix-forward PR
# Address the specific issue without reverting everything
```

- [ ] Rollback plan understood
- [ ] Hopefully not needed! 🤞

---

## Success Criteria Summary

✅ All boxes checked above  
✅ Unit tests passing  
✅ E2E tests skipping without auth  
✅ E2E tests passing with auth  
✅ Build succeeds  
✅ Lint passes  
✅ CI green on main  
✅ Related PRs closed  
✅ No regressions detected  

---

## Sign-Off

**Executed by:** `____________________`  
**Date:** `____________________`  
**Final main SHA:** `____________________`  
**CI Status:** ✅ / ❌  

**Notes / Issues Encountered:**
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Celebration! 🎉

If all checks pass, you've successfully:
- Fixed E2E test failures
- Added comprehensive auth skip guards
- Improved health check logging
- Enhanced test detection
- Made the codebase more robust

Great job! 🚀
