# Appointments + Calendar Review Report

Date: 2025-12-27

## Scope

Routes/pages reviewed:

- `/calendar-flow-management-center`
- `/currently-active-appointments`
- `/calendar/agenda` (feature-gated)

Primary goals:

- Prevent “page didn’t load” / blank-screen behavior.
- Add minimal guardrails (tenant scoping + clear empty/error states).
- Keep repo patterns: Supabase access via service modules (no direct Supabase CRUD inside React pages).

## Findings (Root Causes)

1. **Runtime crash risk from hook ordering (TDZ-style issues)**
   - Effects depended on callbacks declared later in the component in a way that can cause runtime failures in some refactors/loads.
   - Fix: declare callbacks before effects that reference them.

2. **Calendar Flow vendors loader called a non-existent method**
   - The calendar page called `vendorService.getVendors(...)`, but the service exposes `getAllVendors(...)`/`getAll(...)`/`listVendorsByOrg(...)`.
   - Symptom: errors in console and degraded UX (vendor lanes empty / inconsistent).

3. **Guardrail gap: direct Supabase writes in a page**
   - The active appointments page had (briefly) reintroduced `supabase.from('jobs').update(...)` inside UI handlers.
   - Fix: route all writes through `appointmentsService`.

4. **Tenant scoping gap in the calendar RPC call**
   - Calendar data comes from a Supabase RPC `get_jobs_by_date_range`.
   - Fix: best-effort pass `org_id` when available; fallback to legacy signature if the DB function doesn’t accept the extra argument.

## Changes Implemented

### Reliability + Guardrails

- `/calendar/agenda` route now always exists; when `VITE_SIMPLE_CALENDAR` is off it **redirects** to `/calendar-flow-management-center`.
- Both calendar + active appointments now **wait for tenant resolution** before loading data:
  - While tenant is loading: show a small “Loading…” state.
  - If signed in but org is missing: show a “No organization found” state and link to `/debug-auth`.

### Service-layer consolidation

- Created/extended a centralized appointments service to keep Supabase calls out of the page:
  - Reads: active appointments, unassigned jobs, vendors, staff, metrics
  - Writes: status updates, bulk status updates, bulk assignments, quick assign

### Tenant scoping

- Calendar Flow passes `orgId` down into `calendarService.getJobsByDateRange`.
- `calendarService.getJobsByDateRange` attempts to include `org_id` in the RPC payload and retries without if unsupported.

## Files Touched

- `src/pages/currently-active-appointments/index.jsx`
- `src/pages/calendar-flow-management-center/index.jsx`
- `src/Routes.jsx`
- `src/services/appointmentsService.js`
- `src/services/calendarService.js`
- `src/tests/pages.currently-active-appointments.smoke.test.jsx`
- `src/tests/pages.calendar-flow-management-center.smoke.test.jsx`

## Verification

Automated:

- Run unit tests: `pnpm -s vitest run`

Manual (logged-in) checklist:

1. Visit `/calendar-flow-management-center`
   - Expected: page renders; vendors list populates; no blank screen.
2. Visit `/currently-active-appointments`
   - Expected: page renders; shows jobs or empty state; bulk actions don’t crash.
3. Visit `/calendar/agenda` with `VITE_SIMPLE_CALENDAR` off
   - Expected: redirect to `/calendar-flow-management-center`.
4. Visit `/debug-auth` if any “No organization found” message appears
   - Expected: debug page helps confirm session + org assignment.

## Notes / Known Limitations

- The RPC-based calendar query can only be fully tenant-scoped if the underlying DB function supports an `org_id` argument. The client now tries it safely and falls back.

## Rollback

- Revert the above file changes; no migration or schema changes were made as part of this review.
