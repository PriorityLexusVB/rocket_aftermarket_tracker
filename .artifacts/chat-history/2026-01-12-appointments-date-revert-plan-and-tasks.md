# Plan + Meticulous Task List — Appointments Date Revert & UI Polish (2026-01-12)

Context: Vite + React + Tailwind + Supabase (PostgREST). Node 20, pnpm.
Guardrails: no stack changes, no `process.env` in `src/**`, tenant scoping preserved, minimal diffs.

---

## Goal
1) Fix the **1-day date shift / revert** (set 1/14/2026, later shows 1/13/2026).
2) Fix the **appointments not displaying** symptom if it’s caused by the same date bug or a filter/query mismatch.
3) Make the Calendar/Agenda/Appointments pages **cleaner and more user-friendly** with small, non-breaking UI improvements.

---

## Hypotheses (what we will prove/disprove)
- H1: A **date-only** field is being stored or parsed as a timestamp (midnight UTC vs local), causing an off-by-one when rendered.
- H2: The UI stores a JS `Date` and then serializes it with timezone conversion (e.g., `toISOString()`), shifting the day.
- H3: After update, a refetch rehydrates state from a different source-of-truth, and the UI applies an initialization/default (possibly “+1 day”) instead of persisted value.
- H4: The appointments list query or grouping uses a timezone conversion inconsistent with the form’s date picker.

---

## Evidence-first plan (no guessing)

### Phase A — Reproduce & capture evidence
1. Reproduce the exact flow: set scheduled/promised date to `2026-01-14` → Update → navigate away/back → observe `2026-01-13`.
2. Capture browser console errors/warnings (especially date parsing, invalid date, hydration, query params).
3. Capture network requests for the update and subsequent reload:
   - request payload sent on Update
   - response body
   - next GET/refetch payload/query params
   - confirm what the API returns for the date fields
4. Identify the exact field(s) involved:
   - promised date vs scheduled date vs scheduled window start/end
   - where each is read/written in the UI and service layer

### Phase B — Locate the source-of-truth and conversion points
5. Find all places in code that:
   - parse date strings into `Date`
   - format `Date` into API payload
   - create “+1 day” defaults
   - convert to/from timezone
6. Confirm if the DB column is a `date` type or `timestamptz`.

### Phase C — Implement minimal fix (likely date-only handling)
7. Ensure date-only values stay date-only end-to-end:
   - store as `YYYY-MM-DD` (string) where appropriate
   - never call `toISOString()` for date-only fields
   - when a JS `Date` is required for UI widgets, construct it in a timezone-safe way (or keep it as string and only adapt at the edge)
8. Add/adjust tests to lock behavior:
   - round-trip: input `2026-01-14` → payload → service → returned value → UI shows `2026-01-14`
   - ensure no off-by-one in common timezones

### Phase D — UI polish (non-breaking)
9. Small visual improvements with Tailwind only (no redesign):
   - consistent header spacing and typography
   - unify filter bar layout
   - empty-states: helpful and consistent
   - button styling: primary/secondary consistency
10. Ensure accessibility basics:
   - focus states
   - readable contrast
   - clickable target sizes

### Phase E — Verify
11. Run:
   - `pnpm lint`
   - `pnpm -s vitest run`
   - `pnpm build`
12. Manual verification:
   - set date to 1/14/2026, Update, navigate away/back, still shows 1/14/2026
   - appointments appear on correct day across Calendar/Agenda/Snapshot

---

## Meticulous task list (line-by-line)

### Repro / evidence
- [ ] Confirm which page is used to set the date (Deal Edit modal vs Calendar Flow vs Agenda Reschedule).
- [ ] Capture the exact field label changed ("Date Scheduled" / "Promise" / "Promised" / scheduled window).
- [ ] Record the pre-update value and post-update value shown in UI.
- [ ] Record the value immediately returned by the update response.
- [ ] Record the value returned by the subsequent refetch.
- [ ] Save screenshots of the UI before/after navigation.

### Network inspection
- [ ] Identify the update endpoint (`PATCH/POST`) and payload field name(s).
- [ ] Confirm whether payload uses `YYYY-MM-DD`, ISO timestamp, or locale string.
- [ ] Confirm whether response returns `YYYY-MM-DD` or timestamp.
- [ ] Identify any client-side transformation between response and display.

### Code audit
- [ ] Search for `toISOString()` usage in scheduling/deal update paths.
- [ ] Search for `new Date(yyyy-mm-dd)` usage (can shift depending on browser parsing rules).
- [ ] Search for `addDays(1)` or any “+1 day” initialization logic for date fields.
- [ ] Audit date helper utilities used by:
  - [ ] Deal form scheduling section
  - [ ] Calendar flow scheduling drawer/modal
  - [ ] Agenda grouping/filtering
  - [ ] Snapshot "Next 7 Days" list

### Implement fix
- [ ] Normalize date-only values to `YYYY-MM-DD` at the boundary (form submit / service call).
- [ ] Ensure UI reads date-only values as date-only (avoid timezone shifts).
- [ ] Ensure display formatting uses the same timezone rules consistently.
- [ ] Ensure defaults do not override persisted values after reload.

### Tests
- [ ] Add/extend a unit test for date-only round-trip (1/14 stays 1/14).
- [ ] Add/extend a test that verifies Agenda/Snapshot day-bucketing uses the same date key.

### UI polish
- [ ] Standardize top nav page title + subtitle spacing across:
  - [ ] Calendar Flow Management Center
  - [ ] Active Appointments (Snapshot)
  - [ ] Agenda
- [ ] Make filter controls aligned and visually consistent.
- [ ] Improve empty states with actionable copy and optional next steps.

### Verify / ship confidence
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm -s vitest run`.
- [ ] Run `pnpm build`.
- [ ] Manual: set 1/14/2026 → Update → back/forward → stays 1/14/2026.

---

## Notes / expected root cause
Most commonly this is caused by treating a date-only value as midnight UTC (or local) and then rendering in a different timezone. The fix is usually to keep date-only values as `YYYY-MM-DD` strings and only convert to `Date` objects at UI edges in a controlled way.
