# Rocket Aftermarket Tracker — Chat Artifact (2026-01-02)

## Goal of this artifact

A quick “where we are” snapshot so you can resume later without re-reading the whole chat.

---

## What was requested (current focus)

1. Run the real 4-page smoke test:

- /deals
- /currently-active-appointments
- /calendar-flow-management-center
- /calendar/agenda?dateRange=next7days

1. Run full pre-prod gates once:

- pnpm lint
- pnpm typecheck
- pnpm -s vitest run
- pnpm build

---

## Status summary

### ✅ Completed

- Full pre-prod gates: lint, typecheck, vitest stable run, build.

### ⚠️ Blocked

- The 4-page smoke test is blocked on authentication in automated tooling.
  - The Playwright run failed during global setup because login failed (Supabase returned 400 on password grant).

---

## Evidence: gates

All green:

- pnpm lint ✅
- pnpm typecheck ✅
- pnpm -s vitest run ✅ (107 test files passed; 974 passed, 2 skipped)
- pnpm build ✅

---

## Evidence: smoke test attempt (Playwright)

A new Playwright spec was created to mimic the manual 4-page checklist:

- e2e/smoke-4pages-checklist.spec.ts

Attempted command:

- pnpm e2e --project=chromium e2e/smoke-4pages-checklist.spec.ts

Result:

- FAILED before reaching the 4 routes.

Observed failure details:

- Global setup attempted a password login against Supabase.
- Supabase token endpoint returned HTTP 400.
- App console reported: “Invalid login credentials”.
- global.setup.ts threw: “[global.setup] Unable to verify session on /debug-auth after login”.

Implication:

- The app never reached the 4 target pages in an authenticated state, so checklist assertions were not executed.

---

## Automation work done (to support the smoke test)

### e2e/smoke-4pages-checklist.spec.ts

This spec:

- Logs in
- Creates a promise-only deal (promised date set; scheduled date/time cleared)
- Validates Deals list behavior:
  - Created column first (DOM order)
  - Schedule block unified: includes “Promise:” and “Not scheduled”
  - Vehicle slot does NOT contain the deal title
  - Edit action navigates to /deals/:id/edit
- Validates Snapshot behavior:
  - Today / Next 7 Days / Needs Scheduling toggles
  - Needs Scheduling contains the created item
  - Next 7 Days does not contain the created item
- Validates Calendar Flow Center:
  - Page loads
  - “Jump to next scheduled job” is clickable if present
  - Unassigned queue includes the created promise-only item
- Validates Agenda:
  - Page loads at /calendar/agenda?dateRange=next7days
  - Stable regardless of empty vs populated
- Captures browser console errors and fails on unexpected errors.

---

## Root cause hypothesis (for the smoke test block)

Most likely one of:

- The email/password in the local E2E env file does not match the Supabase project configured by VITE_SUPABASE_URL.
- The Supabase auth provider settings disallow password grant for this user.
- The user exists in a different Supabase project than the one configured.

---

## Recommended next step (fastest way to unblock)

Option A (recommended): generate storage state via manual login, then run the smoke spec.

1. Run manual login (headed):

- MANUAL_LOGIN=1 pnpm e2e --project=chromium e2e/manual-login.spec.ts --headed

1. After it saves e2e/storageState.json, rerun:

- pnpm e2e --project=chromium e2e/smoke-4pages-checklist.spec.ts

Option B: fix the E2E credentials so password login succeeds for the configured Supabase project.

---

## Security note

Credentials were shared in chat during the debugging process.

- Strong recommendation: rotate that password and use a dedicated test account for automation.

---

## Files touched/created during this phase

- e2e/smoke-4pages-checklist.spec.ts (created)
- .artifacts/chat/2026-01-02-smoke-and-gates-status.md (this artifact)
