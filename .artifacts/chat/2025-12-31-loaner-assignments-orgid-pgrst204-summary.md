# Chat Summary — 2025-12-31 — loaner_assignments org_id (PGRST204)

## What happened

- A Supabase/PostgREST request to `POST /rest/v1/loaner_assignments` was failing with:
  - `PGRST204`: "Could not find the 'org_id' column of 'loaner_assignments' in the schema cache"
- DevTools Network evidence showed the app sending:
  - `columns="job_id","org_id","loaner_number","eta_return_date","notes"&select=id`
  - JSON body including `org_id`
- In this repo’s intended RLS model, `loaner_assignments` is typically scoped via `jobs.org_id` (policy join), and many environments do **not** have `loaner_assignments.org_id`.

## Root cause

- The client/service layer was including `org_id` by default when inserting/updating `loaner_assignments`.
- In environments where `loaner_assignments.org_id` does not exist (or the schema cache is stale), PostgREST rejects the request.

## Fixes applied

### 1) Avoid emitting the failing request shape

- Change: loaner assignment insert/update now **omits `org_id` by default**.
- `org_id` is only included when there is **positive capability evidence** (`cap_loanerAssignmentsOrgId === true`).
- A small heuristic allows a retry **with** `org_id` only when it looks required (e.g., RLS denial patterns or explicit NOT NULL/org_id constraint signals).
- Capability is persisted in `sessionStorage` via `cap_loanerAssignmentsOrgId`.

Where:

- `src/services/dealService.js`
  - `upsertLoanerAssignment(...)`
  - `saveLoanerAssignment(...)`

### 2) Better remediation guidance for this specific error

- Change: schema error guidance now special-cases missing-column errors for `loaner_assignments` + `org_id`.
- Guidance explains:
  - Don’t reference `loaner_assignments.org_id` in REST `columns=` or payload
  - Tenant scoping is via `jobs.org_id`
  - If the column was recently added, run `NOTIFY pgrst, 'reload schema';`

Where:

- `src/utils/schemaErrorClassifier.js`

## Tests updated/added

- `src/tests/schemaErrorClassifier.test.js`
  - Added unit test for loaner/org_id remediation guidance.
- `src/tests/unit-dealService.test.js`
  - Updated/added test verifying `saveLoanerAssignment(...)` omits `org_id` by default.

## Verification results

- Stable Vitest suite (task: `pnpm -s vitest run`):
  - 107/107 files passed
  - 967 passed, 2 skipped
- Targeted run:
  - `pnpm -s exec vitest run src/tests/unit-dealService.test.js src/tests/schemaErrorClassifier.test.js`
  - 2 files passed

## Known follow-up

- Runtime verification: confirm DevTools Network shows loaner POST no longer includes `org_id` in `columns=` or request JSON by default.
- ESLint previously reported 2 unrelated warnings (unused imports) in `src/pages/deals/index.jsx`.
