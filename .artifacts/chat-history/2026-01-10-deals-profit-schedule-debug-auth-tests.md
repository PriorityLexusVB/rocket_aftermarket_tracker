# 2026-01-10 — Deals list + Profit + Schedule wording + Debug-auth + Test isolation

## What we changed (feature/UX)

### Deals list scanability

- Standardized schedule rendering:
  - Date-only schedules render as **"Time TBD"** (hardened against ISO-midnight variants with offsets/Z to avoid timezone day shifts).
  - Legacy wording **"Not scheduled"** was standardized to **"Needs scheduling"** where applicable.
- Vendor display noise reduction:
  - Hide vendor pill/label unless a vendor is actually assigned (avoid “Vendor • Unassigned” style clutter).

### “Products purchased” summary

- Added compact product summaries (abbreviations OK):
  - Desktop: small chips
  - Mobile: “Items” pill
- Quantity display rule: only show quantities when **> 1**.

### Profit per deal

- Added per-deal **Sale / Cost / Profit** display.
- Profit definition is explicit: **profit = sale − cost**.
- Includes fallback behavior when data is missing.

## Shared schedule logic

- Introduced/used a shared schedule display helper and migrated appointment-related components to it.
- Goal: one consistent rule-set for "scheduled window", "date-only" (Time TBD), and "needs scheduling".

## Runtime debugging context (“these all look wrong”)

### What we learned from /debug-auth

- /debug-auth output showed:
  - Supabase configured
  - Valid session
  - orgId resolved
  - Non-zero dropdown counts (vendors/products/users/etc)
- This strongly implies auth + tenant context works; remaining “empty” views likely depend on jobs/job_parts existence or filtering.

### What we added to /debug-auth

- Enhanced `src/pages/debug-auth.jsx` with **operational org-scoped counts** so we can distinguish:
  - “There is no data in these buckets” vs
  - “There is data but UI filter/query mismatch”
- Operational buckets sourced from `src/services/scheduleItemsService.js`:
  - schedule items next 7 days
  - schedule items previous 7 days
  - promise-only / needs-scheduling items
  - unscheduled in-progress in-house/on-site items

## Port conflict

- Another app was running on 5173; this repo was set to run on a different port (5174) to avoid debugging the wrong dev server.

## Current blocker: tests failing in full suite (order-dependent)

### Symptom

- `pnpm -s vitest run` (stable) fails with:
  - **8 failing tests** in `src/tests/dealService.delete.test.js`
  - Most failures look like `deleteDeal()` throws "Deal not found or you do not have access to it."
  - Also saw `supabase.from` spy showing 0 calls in some expectations.

### What’s going on

- Running `src/tests/dealService.delete.test.js` by itself can pass.
- Failing only in the full suite indicates **shared/mock pollution and/or import-order issues**.

### Key underlying structure

- Global test setup provides a big in-memory Supabase mock via `src/tests/setup.ts`:
  - `vi.mock('@/lib/supabase', ...)` returns a shared supabase instance with `auth.getUser()` driven by `currentUser`.
- `dealService.js` imports `supabase` from `@/lib/supabase` at module scope.
- Local overrides inside delete tests must not permanently mutate that shared object in ways that break other suites.

### Attempted mitigations

- `src/tests/dealService.delete.test.js` was modified to patch `supabase.from` and `supabase.auth.getUser` to gain control.
- This created side effects in the full run; additional attempt was to restore methods after each test.
- `src/tests/dealService.getOrgContext.test.js` was updated to re-import dealService after `vi.resetModules()` in `beforeEach` so it doesn’t depend on other suites’ import order.

## Next steps (to pick up later)

1. Fix `src/tests/dealService.delete.test.js` isolation so it’s green in the full suite:
   - Prefer creating fully isolated per-test Supabase stubs via `vi.doMock('@/lib/supabase', ...)` + `vi.resetModules()` + import service after mocking.
   - Or patch/restore carefully without `vi.clearAllMocks()` wiping shared state, and without changing auth behavior used elsewhere.
2. Re-run `pnpm -s vitest run` to confirm 0 failures.
3. Use the enhanced `/debug-auth` operational section to verify whether schedule/jobs data exists for the org.

## Verification commands

- Stable unit tests: `pnpm -s vitest run`
- Single file: `pnpm -s vitest run src/tests/dealService.delete.test.js`
- Lint: `pnpm lint`
