# Quick Fix Instructions for PR #262 E2E Failures

## TL;DR
Your PR branch is behind main. You need to merge main to pick up commit `4294086` which fixes UUID handling in `dealService.js`.

## Fastest Fix (Recommended)

### Method 1: Use GitHub UI
1. Go to PR #262: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/262
2. Click "Update branch" button (if available)
3. Wait for CI to re-run
4. E2E tests should now pass ✅

### Method 2: Command Line Merge
```bash
# Clone and navigate to repo
cd rocket_aftermarket_tracker

# Fetch latest
git fetch origin

# Checkout PR branch
git checkout copilot/add-agents-md-file

# Merge main
git merge origin/main

# If there are no conflicts:
git push origin copilot/add-agents-md-file

# If there ARE conflicts (likely in AGENTS.md or .vscode/settings.json):
# - Keep your versions from PR #262
# - Accept the UUID preservation code from dealService.js
# - Then: git add <resolved-files> && git commit && git push
```

## What Went Wrong

- Your PR branch: Based on commit `71cdcd1`
- Main branch now: At commit `4294086`
- Missing commit: `4294086` - "feat(dealService): preserve UUIDs in mapFormToDb for stable sync updates; add test for UUID handling"
  - This commit added critical UUID preservation logic to prevent job_part duplicates during deal updates
- Result: E2E test `deal-edit.spec.ts` fails when trying to edit deals

## What Gets Fixed

The merge/update will add this critical code to `dealService.js`:

```javascript
// Extracts job_part UUIDs so updates don't create duplicates
const idRaw = li?.id ?? li?.job_part_id ?? li?.jobPartId ?? null
const idNorm = typeof idRaw === 'string' && uuidRegex.test(idRaw) ? idRaw : null
return {
  id: idNorm,  // ← This line was missing
  // ... rest of fields
}
```

## Verification

After applying fix:
```bash
# Run unit tests locally
pnpm test src/tests/unit-dealService.test.js
# Expected: ✅ 17 passed

# Run E2E tests (requires E2E env vars)
# Ensure required env vars (E2E_EMAIL, E2E_PASSWORD, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.)
# are configured as described in Section 16 (E2E Testing with Playwright) or in .env.example
pnpm exec playwright test e2e/deal-edit.spec.ts
# Expected: ✅ Test passes
```

## Questions?

See full analysis: `E2E_FIX_FOR_PR262.md`

## After Fix Applied

Once CI shows green (after merging `main` with commit `4294086` into your PR branch):
1. ✅ All E2E tests should pass
2. ✅ This documentation PR demonstrates the fix exists in main
3. ✅ Deal editing will continue to work correctly with job_parts UUIDs preserved via the existing fix in `dealService.js`
