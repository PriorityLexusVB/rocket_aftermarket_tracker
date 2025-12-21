# PR Merge Quick Reference

## TL;DR: What to Do

### Merge Order & Commands

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Merge PR #235 (E2E test fixes)
git merge --no-ff origin/copilot/fix-ci-e2e-test-failures

# 3. Cherry-pick enhanced test detection from PR #233
git checkout origin/copilot/diag-and-fix-issues -- src/lib/env.ts
git commit -m "feat: enhance isTest to detect Playwright E2E tests"

# 4. Manually add VITE_E2E_TEST: 'true' to playwright.config.ts webServer.env section

# 5. Test everything
pnpm test && pnpm e2e --project=chromium

# 6. If all pass, push to main
git push origin main

# 7. Optionally merge PR #234 (docs only)
git merge --no-ff origin/copilot/add-agent-skills-pack
git push origin main
```

---

## Why This Works

| PR | Status | Action | Files | Why |
|----|--------|--------|-------|-----|
| **#235** | ✅ Merge | Complete merge | 11 files | Comprehensive E2E fixes: auth guards, dropdown waits, health logging |
| **#233** | ⚠️ Cherry-pick | Only `src/lib/env.ts` | 1 file | Navbar needs to detect E2E tests to skip Supabase |
| **#232** | ❌ Skip | Too many commits | 75+ commits | Contains unrelated refactorings |
| **#234** | ✅ Merge | Independent | 8 doc files | Documentation only, no conflicts |
| **#236** | ✅ Close | Analysis complete | N/A | This is the current analysis PR |

---

## What Each PR Fixes

### PR #235 ✅ (THE MAIN FIX)
1. E2E tests skip when `E2E_EMAIL`/`E2E_PASSWORD` missing
2. Product dropdowns wait for options before selecting
3. Health checks log errors once (not spam)
4. Empty storageState created when auth missing
5. Playwright config has safe type defaults

### PR #233 🔧 (ONE CRITICAL PIECE)
- `src/lib/env.ts`: Makes `isTest` detect Playwright E2E tests
- **Why needed:** Navbar uses `isTest` to skip Supabase subscriptions during tests

### PR #232 ⏸️ (SKIP FOR NOW)
- Has notification test coverage
- But 75+ commits with many unrelated changes
- Auth guards duplicate what's in #235

### PR #234 📝 (INDEPENDENT)
- Just documentation files
- Can merge anytime without conflicts

---

## Critical Files

### Must merge from PR #235:
```
api/health-user-profiles.js
src/api/health-user-profiles.js
e2e/admin-crud.spec.ts
e2e/deal-edit.spec.ts
e2e/deal-form-dropdowns.spec.ts
e2e/deal-unsaved-guard.spec.ts
e2e/deals-redirect.spec.ts
e2e/nav-smoke.spec.ts
e2e/profile-name-fallback.spec.ts
global.setup.ts
playwright.config.ts
```

### Must cherry-pick from PR #233:
```
src/lib/env.ts
```

### Must manually add:
```
playwright.config.ts: Add VITE_E2E_TEST: 'true' to webServer.env
```

---

## Test Scenarios

### ✅ AFTER MERGE (Expected Results)

```bash
# Scenario 1: E2E without auth credentials
unset E2E_EMAIL E2E_PASSWORD
pnpm e2e --project=chromium
# Expected: Tests skip cleanly with message "E2E auth env not set"

# Scenario 2: E2E with auth credentials
export E2E_EMAIL="test@example.com"
export E2E_PASSWORD="password"
pnpm e2e --project=chromium
# Expected: All tests pass

# Scenario 3: Unit tests
pnpm test
# Expected: All tests pass, no hanging

# Scenario 4: Build
pnpm build
# Expected: Build succeeds
```

---

## One-Line Summary by PR

| PR | One-Line Summary |
|----|------------------|
| #235 | Fixes E2E test failures with auth guards and dropdown waits |
| #233 | Enhances test detection so Navbar skips Supabase during E2E |
| #232 | Notification cleanup but has too many unrelated commits |
| #234 | Adds agent skills documentation |
| #236 | Analysis PR (this one) - provides merge strategy |

---

## Conflicts Summary

| File | Conflict Between | Resolution |
|------|------------------|------------|
| `playwright.config.ts` | #233 vs #235 | Use #235 base + add `VITE_E2E_TEST: 'true'` manually |
| `api/health-user-profiles.js` | #233 vs #235 | Use #235 (has logOnce + sendJson) |
| `src/api/health-user-profiles.js` | #233 vs #235 | Use #235 (has logOnce + sendJson) |
| `src/lib/env.ts` | Not in #235 | Cherry-pick from #233 (critical!) |
| E2E specs | #232 vs #235 | Use #235 (more complete) |

---

## If Something Goes Wrong

### Tests still fail after merge?

1. **Check VITE_E2E_TEST flag:** Did you add it to `playwright.config.ts`?
2. **Check env.ts:** Did you cherry-pick it from PR #233?
3. **Check storageState:** Does `e2e/storageState.json` exist?
4. **Check logs:** Are there still Supabase connection attempts during tests?

### Need to rollback?

```bash
git log --oneline -5
git revert -m 1 <merge-commit-sha>
git push origin main
```

---

## Post-Merge Checklist

- [ ] All unit tests pass: `pnpm test`
- [ ] E2E without auth skips cleanly
- [ ] E2E with auth passes all specs
- [ ] Build succeeds: `pnpm build`
- [ ] Lint passes: `pnpm lint`
- [ ] Close PR #235 (fully merged)
- [ ] Close PR #233 (env.ts cherry-picked)
- [ ] Keep PR #232 open (maybe useful later)
- [ ] Merge PR #234 (docs only)
- [ ] Close PR #236 (analysis complete)

---

## Files to Update Manually

### playwright.config.ts

Around line 60, in the `webServer.env` section, add:

```typescript
webServer: {
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_ORG_SCOPED_DROPDOWNS: process.env.VITE_ORG_SCOPED_DROPDOWNS || 'true',
    VITE_SIMPLE_CALENDAR: process.env.VITE_SIMPLE_CALENDAR || 'true',
    VITE_DEAL_FORM_V2: process.env.VITE_DEAL_FORM_V2 || 'true',
    VITE_E2E_TEST: 'true',  // ← ADD THIS LINE
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
    E2E_EMAIL: process.env.E2E_EMAIL || '',
    E2E_PASSWORD: process.env.E2E_PASSWORD || '',
  },
},
```

---

## Confidence Level

✅ **HIGH** - This plan combines the best fixes from multiple PRs while avoiding conflicts and unnecessary complexity.

---

## Questions?

See full analysis in:
- `PR_MERGE_STRATEGY.md` (detailed analysis)
- `FINAL_MERGE_PLAN.md` (step-by-step guide)
- This file (quick reference)
