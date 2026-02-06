# Calendar Flow Master Plan (SSOT)

## Purpose
This file prevents agent drift. Every loop MUST:
1) Re-read this file
2) Execute only items in “TRACK A — AUTO-RUN”
3) Update this file after each item (check it off + note commit)

If it’s not in this file, do not implement it unless explicitly instructed.

## Guardrails
- Follow `.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`
- No Supabase in React components. No PII in logs.
- Flags default OFF. `pnpm -s verify` must stay green.

## Shipped foundation (already merged to main)
- /calendar canonical shell (query params view/range/date) behind `calendar_unified_shell`
- Legacy routes exist and redirect when unified flag ON:
  - /calendar/agenda -> /calendar?view=list
  - /calendar/grid -> /calendar?view=calendar
  - /calendar-flow-management-center -> /calendar?view=board
- Central calendar navigation helper exists
- DealDrawer scaffold exists behind `calendar_deal_drawer`, with focus trap/return + tests

### Feature flags (default OFF)
- calendar_unified_shell
  - env: VITE_FF_CALENDAR_UNIFIED_SHELL=true
- calendar_deal_drawer
  - env: VITE_FF_CALENDAR_DEAL_DRAWER=true

## Original plan artifacts (must remain true on main)
- [x] docs/CALENDAR_FLOW_REWORK_TODO.md exists
- [x] docs/CALENDAR_FLOW_REWORK_PHASE0_BASELINE.md exists
- [x] feature flags exist + default OFF
- [x] CalendarShell exists
- [x] DealDrawer exists
- [x] tests exist for drawer and row clicks
- [x] main passes pnpm -s verify

## TRACK A — AUTO-RUN (Issue #281 “ADD NOW”)
Implement these 6 items in order, using ONE branch + ONE PR.
Rules:
- Minimal diffs
- No regressions with flags OFF
- Prefer gating enhancements under calendar_unified_shell (unified shell views first)
- Add cheap stable tests when possible
- After each item: verify, commit, push, update this file, comment on Issue #281

- [ ] A1 Event title truncation + tooltip (Board/List/Calendar cards)
  - Accept: no overflow; long titles clamp; hover/focus reveals full
  - Notes:

- [ ] A2 Sticky date headers in List view
  - Accept: day/group headers remain visible while scrolling
  - Notes:

- [ ] A3 Hover/focus detail popover for events
  - Accept: accessible popover (keyboard focus), shows key fields without click
  - Notes:

- [ ] A4 A11y ids/names/labels for List controls
  - Accept: search/select have id+name and label association; tests use label queries
  - Notes:

- [ ] A5 Deterministic color system + legend alignment (contrast-safe)
  - Accept: stable mapping function; legend matches; contrast ok
  - Notes:

- [ ] A6 URL-persisted search/filter state (q=)
  - Accept: query param roundtrip; shareable URL; debounced input; no loops
  - Notes:

## TRACK B — DEFER (DO NOT AUTO-RUN)
- conflicts/buffers/overlap rules
- vendor/resource view
- perf virtualization unless proven
- audit trail
- RLS smoke/CI guard scripts

## TRACK C — REJECTED
- switching calendar libraries

## Autopilot loop (MANDATORY)
For each unchecked A# item:
1) Re-read this file
2) Locate relevant code with rg (no guessing)
3) Implement minimal change (prefer unified shell views)
4) Add cheap tests if stable
5) Run pnpm -s guard:client-env && pnpm -s verify
6) Commit: "Calendar UX: A# <short name>"
7) Push (same branch/PR)
8) Update this file (check item + add commit hash + short note)
9) Comment Issue #281 with what changed + how to test
Repeat until all A# items are checked.
