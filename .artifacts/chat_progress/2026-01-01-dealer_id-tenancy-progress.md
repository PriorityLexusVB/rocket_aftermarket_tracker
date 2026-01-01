# Chat Progress Snapshot — 2026-01-01

## Purpose

This file captures the key decisions + current state of the **org_id → dealer_id** tenancy migration work so it can be resumed on another machine/session.

Repo: `PriorityLexusVB/rocket_aftermarket_tracker`
Branch at time of note: `main`

## Canon (Locked)

- Tenancy key: **`dealer_id`**
- Auth resolver: **`public.auth_dealer_id()`**
- Goal: runtime code must not rely on `org_id` columns existing on canonical tables.
- Approach: **canon-first + legacy fallback** (read `dealer_id` first, tolerate legacy `org_id` when present; keep JS naming `orgId` only when needed for backwards compatibility).

## What Was Worked On In This Session

High-impact runtime paths were migrated away from `org_id` DB usage.

### Files changed / relevant

- `src/hooks/useTenant.js`
  - Upgraded tenant resolution to be **dealer-aware**.
  - Returns `{ dealerId, orgId, loading, session }`.
  - Prefers AuthContext-derived values; resolves `dealer_id` first; keeps `orgId` as legacy/compat.

- `src/pages/deals/DealForm.jsx`
  - Saves now write `dealer_id` (prefers form value → tenant → undefined).
  - Dropdown scoping uses `tenantId = dealerId || orgId` to keep compatibility.
  - NOTE: If you see lingering log contexts referencing `orgId`, those should be updated to `dealerId` for consistency (non-breaking).

- `src/pages/deals/NewDealModal.jsx`
  - Deal creation payload writes `dealer_id`.

- `src/services/tenantService.js`
  - `list*ByOrg` functions now filter by **`dealer_id`** (function names retained for compatibility).

- `src/services/vendorService.js`
  - Vendor list/search filters now use **`dealer_id`**.
  - Writes now set `dealer_id` while keeping input property name `orgId` (compat layer).

- `src/App.jsx`
  - Realtime dropdown cache scoping uses `tenantId = dealerId || orgId`.

- `src/db/schema.ts`
  - Drizzle schema aligned so tenant columns map to DB `dealer_id` while keeping some property names compatible.

- `src/pages/admin/index.jsx`
  - Migrated key admin flows to **write `dealer_id`** instead of `org_id`:
    - attach profile to my org/dealer
    - bulk-assign org/dealer to users/vendors/products
    - user/staff reassign prompts now operate on `(dealer_id || org_id)` vs `effectiveDealerId`
  - UI display now shows `(dealer_id || org_id)` for legacy compatibility.

## Current Status

- Most runtime code for Deals + Admin no longer relies on `org_id` as a DB column in write/filter paths.
- Some `org_id` _references_ remain in Admin and elsewhere as legacy fallbacks or UI state keys.
- Next step is a systematic sweep across the repo to remove remaining `org_id` DB-column usage (queries/filters/writes), prioritizing service modules.

## Verification Evidence (at the time)

- `pnpm lint` ✅
- `pnpm -s vitest run --silent` ✅
  - 107 test files passed
  - 968 tests passed, 2 skipped

⚠️ Note: some files were edited afterward (per VS Code context). Re-run the verification commands when resuming.

## How To Resume (Exact Commands)

From repo root:

1. Re-verify clean state:

- `pnpm lint`
- `pnpm -s vitest run --silent`

1. Sweep for remaining org_id DB-column usage:

- `rg -n "\\borg_id\\b" src`  
  Focus on Supabase query filters/inserts/updates, not test narratives.

1. Run app locally (optional):

- `pnpm dev`

Suggested manual checks:

- Create a new Deal → confirm payload uses `dealer_id`.
- Admin: attach/reassign user/staff → confirm it updates `dealer_id`.

## Guardrails / Non-negotiables Recap

- Do not delete or rewrite historical migrations.
- Schema changes (if needed) must be new timestamped migrations.
- No direct Supabase client usage inside React components for new CRUD—use service modules.
- Keep changes PR-sized and non-breaking.

## TODO (Near-term)

- Continue repo-wide conversion of remaining runtime `org_id` usage to `dealer_id`.
- Finish any remaining Admin refactor that still updates/filters on `org_id`.
- Update any tests/fixtures that assert `org_id` semantics if they start failing after further conversion.

---

End of snapshot.
