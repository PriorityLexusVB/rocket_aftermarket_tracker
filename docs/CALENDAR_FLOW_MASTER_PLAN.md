# Calendar Flow Master Plan (SSOT)

## Purpose

This file prevents agent drift. Every loop MUST:

1. Re-read this file
2. Execute only items in “TRACK A — AUTO-RUN” or “TRACK D — SPEC COMPLETION”
3. Update this file after each item (check it off + note commit)

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

- [x] A1 Event title truncation + tooltip (Board/List/Calendar cards)
  - Accept: no overflow; long titles clamp; hover/focus reveals full
  - Notes: 142c09b - Added embedded-only title tooltips for board, calendar, and list cards.

- [x] A2 Sticky date headers in List view
  - Accept: day/group headers remain visible while scrolling
  - Notes: cb99810 - Adjusted sticky header offset for embedded list view.

- [x] A3 Hover/focus detail popover for events
  - Accept: accessible popover (keyboard focus), shows key fields without click
  - Notes: 535acd3 - Added hover/focus detail popovers for board, calendar, and list cards.

- [x] A4 A11y ids/names/labels for List controls
  - Accept: search/select have id+name and label association; tests use label queries
  - Notes: 9b1adc7 - Added id/name + sr-only labels and RTL test for list controls.

- [x] A5 Deterministic color system + legend alignment (contrast-safe)
  - Accept: stable mapping function; legend matches; contrast ok
  - Notes: c9f6cf9 - Aligned board month/chip colors with calendar color mapping in unified shell.

- [x] A6 URL-persisted search/filter state (q=)
  - Accept: query param roundtrip; shareable URL; debounced input; no loops
  - Notes: 9cd3658 - Preserved q in calendar params and debounced embedded list URL sync.

## TRACK B — DEFER (DO NOT AUTO-RUN)

- conflicts/buffers/overlap rules
- vendor/resource view
- perf virtualization unless proven
- audit trail
- RLS smoke/CI guard scripts

## TRACK C — REJECTED

- switching calendar libraries

## Autopilot loop (MANDATORY)

For each unchecked item in TRACK A or TRACK D:

1. Re-read this file
2. Locate relevant code with rg (no guessing)
3. Implement minimal change (prefer unified shell views)
4. Add cheap tests if stable
5. Run pnpm -s guard:client-env && pnpm -s verify
6. Commit: "Calendar UX: A# <short name>" or "Calendar Spec: D# <short name>"
7. Push (same branch/PR)
8. Update this file (check item + add commit hash + short note)
9. Comment PR with what changed + how to test
   Repeat until all items are checked.

## TRACK D — SPEC COMPLETION (E–H + QA/Rollout)

- [x] D0 Remove duplicate chrome when embedded in CalendarShell
  - Accept: when unified shell is ON and embedded=true, embedded views suppress their own header/search/quick-actions so the shell header is the single header.
  - Notes: 1e40166 - Suppressed embedded header/search/quick filters in board/list/calendar views under unified shell.

- [x] D1 Board View (Dispatch / Lanes)
  - Accept: queue sidebar with unscheduled + needs time + overdue (no duplicates); promise items are all-day; drag/click schedule converts promise -> scheduled; vendor lane controls simplified; legend moved to popover.
  - Notes: c279827 - Added unscheduled queue + needs time/overdue toggles; PROMISE badges; simplified lane controls.

- [x] D2 List View (Agenda)
  - Accept: grouped by date with All-day (Promises) and Scheduled (Timed); row click opens drawer when flag ON; link clutter removed in favor of row click + ⋯ menu; reschedule paths avoid bouncing to empty list (prefer drawer when flag ON).
  - Notes: ff453df - Grouped agenda by All-day vs Scheduled; row action menu; focus opens drawer when enabled.

- [x] D3 Calendar View (Overview)
  - Accept: quick actions panel removed; daily counts shown (promises/scheduled/overdue); day click drills down to Board Day by default.
  - Notes: f8aa373 - Removed Quick Actions; added daily counts and board-day drilldown.

- [x] D4 Data Consistency (Deals missing but Calendar has jobs)
  - Accept: Deals and Calendar use consistent tenant/location filters; orphan recovery banner with actions; mismatch banner when deals list is empty but calendar has items in same tenant/range.
  - Notes: ac6c04d - Added location filter parity, orphan/mismatch banners, and consistency diagnostics.

- [ ] D5 Testing / QA
  - Accept: minimal automated coverage (Playwright if available, else Vitest/RTL) for /calendar load, view toggles header stability, old route redirects, drawer open, promise all-day behavior, mismatch banner gating; a11y focus trap + ESC + keyboard nav for toggles/menus.
  - Notes:

- [ ] D6 Rollout Notes (docs only)
  - Accept: flag notes, enable internal/DC tenant first, verify no regressions, note removal of deprecated routes/buttons after adoption.
  - Notes:
