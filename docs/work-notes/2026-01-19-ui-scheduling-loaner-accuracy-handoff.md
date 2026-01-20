# 2026-01-19 — UI Scheduling + Loaner Date Accuracy Handoff

Date: 2026-01-19 (ET)
Repo: `PriorityLexusVB/rocket_aftermarket_tracker`
Branch at time of writing: `main`

## Why this doc exists
You flagged 4 production UX/correctness problems (screenshots):
1) "Overdue" is wrong when today is the 19th.
2) Board cards are not informative and the copy "Drag to assign" is unclear.
3) Weekly calendar lacks actionable info; legend placement is questionable; behavior with multiple jobs on same day/hour is unclear.
4) Loaner expected return date shows as 1/18 + overdue in loaner drawer while Deal form shows 1/19.

This document captures:
- Root causes (high-confidence)
- The exact code locations involved
- An execution plan (sequenced)
- Verification steps (unit + manual + optional e2e)
- Current local working tree state so you can resume cleanly

---

## Key root causes (high-confidence)

### A) Date-only strings are being parsed as UTC midnight (day-shift bug)
JavaScript parses `new Date("YYYY-MM-DD")` as **UTC midnight**. When rendered/computed in ET, that can become the **previous calendar day**.

Symptoms you saw:
- “Expected return 1/19” becomes “1/18” in some screens
- “Due today” incorrectly shows as “Overdue”

Concrete culprit:
- Loaner drawer uses `new Date(assignment?.eta_return_date)` for comparison and display.

### B) Overdue logic differs across the app (instant vs day-bucket)
There are multiple overdue implementations:
- `src/lib/time.js` → `isOverdue()` currently compares `promise < now` after parsing with `new Date(...)`.
- `src/services/scheduleItemsService.js` → `classifyScheduleState()` uses UTC day keys for promised-date-only logic.
- Snapshot/Board/Calendar UIs mix these, and they don’t consistently match ET day labels.

### C) Weekly grid can’t safely represent “real scheduling” yet
- `renderWeekView()` buckets by `jobStart.getHours() === hour`, which can misplace jobs starting at `:15/:30`.
- Time-slot cells are fixed-height (`h-12`), so multiple jobs in the same hour will overlap or be clipped.

---

## Where the issues live (file map)

### “Overdue” / Active Appointments Snapshot
- `src/pages/currently-active-appointments/components/SnapshotView.jsx`
  - Splitting/bucketing logic: `splitSnapshotItems()`, `splitNeedsSchedulingItems()`
  - Load logic merges multiple sources and dedupes by `id`

### Scheduling Board (“Drag to assign”, cards, week grid)
- `src/pages/calendar-flow-management-center/index.jsx`
  - Week grid: `renderWeekView()`
  - Shared chip renderer: `renderEventChip()`
  - Uses `isOverdue()` from `src/lib/time.js`
  - Uses `formatEtDateLabel()` from `src/utils/scheduleDisplay.js`
- `src/pages/calendar-flow-management-center/components/UnassignedQueue.jsx`
  - Contains the “Drag to assign” text and explanatory help text
- `src/pages/calendar-flow-management-center/components/VendorLaneView.jsx`
  - Event chip content used in vendor lane view

### Loaner expected return date display + overdue
- `src/pages/loaner-management-drawer/index.jsx`
  - Uses `new Date(assignment?.eta_return_date)` for overdue and display
- `src/pages/deals/index.jsx`
  - Loaner due date formatting uses `new Date(deal.loaner_eta_return_date)` in places

### Date-only safe helpers
- `src/utils/scheduleDisplay.js`
  - `toSafeDateForTimeZone()` (anchors date-only values at noon UTC)
  - `isDateOnlyValue()`
  - `formatEtDateLabel()`

### Overdue helper used by board UI
- `src/lib/time.js`
  - `isOverdue()`

---

## Current local working tree status (important)
As of this handoff, local modifications exist:
- `scripts/guard-instructions.mjs`
- `src/tests/dealService.loanerRlsDegradation.test.js`

These are **not part of this doc** and should be treated separately when you resume.

To confirm what’s modified:
```bash
git status --porcelain=v1
```

To view diffs:
```bash
git diff
```

If you want to temporarily discard local changes and sync with remote `main`, DO NOT run destructive commands automatically. Use safe approaches like:
```bash
git restore --worktree --staged scripts/guard-instructions.mjs src/tests/dealService.loanerRlsDegradation.test.js
```

---

## Execution plan (sequenced, minimal-risk)

### Phase 1 — Fix correctness first (date-only + overdue)

#### 1) Make `isOverdue()` date-only aware (ET day-key based)
Goal: If promise is date-only (or “midnight ISO”), overdue is computed by **ET calendar day**, not full timestamp.

- Update: `src/lib/time.js`
  - Detect date-only inputs via `isDateOnlyValue()` and parse using `toSafeDateForTimeZone()`.
  - Compare ET day keys (America/New_York) rather than `promise < now` for date-only.
  - Keep current behavior for real timestamps.

Acceptance criteria:
- On 2026-01-19 ET, promise “2026-01-19” is **not** overdue.
- Promise “2026-01-18” is overdue.

#### 2) Fix Loaner drawer overdue + display to use date-safe parsing
Goal: The loaner drawer must show the same expected return date as the Deal form and must not mark “today” overdue.

- Update: `src/pages/loaner-management-drawer/index.jsx`
  - Replace `new Date(assignment?.eta_return_date)` usage.
  - Use `toSafeDateForTimeZone()` and compare ET day keys for overdue.
  - Render dates with ET timezone formatting.

Acceptance criteria:
- If `eta_return_date` is `2026-01-19`, drawer displays “Jan 19, 2026” and status is not overdue (on Jan 19 ET).

#### 3) Align Snapshot overdue buckets with ET day-key logic
Goal: Active Appointments should not mis-bucket “today” into overdue sections.

- Update: `src/pages/currently-active-appointments/components/SnapshotView.jsx`
  - Ensure date-only comparisons align with the same ET day-key logic.
- Consider aligning `classifyScheduleState()` in `src/services/scheduleItemsService.js` (currently uses UTC day keys) if it conflicts with snapshot’s ET display.

Acceptance criteria:
- An item with promised date = today appears in upcoming (or scheduled/all-day), not overdue.

---

### Phase 2 — Fix understanding & usability (board cards + drag)

#### 4) Update “Drag to assign” copy to explain the action
- Update: `src/pages/calendar-flow-management-center/components/UnassignedQueue.jsx`
  - Replace footer copy with something like:
    - “Drag to a time slot (On-site) or vendor lane (Off-site) to assign schedule.”

Acceptance criteria:
- A new user can answer “drag what where?” by reading the card.

#### 5) Add drag drop-zone affordances
- Update: `src/pages/calendar-flow-management-center/index.jsx` (+ optional lane components)
  - When dragging starts, visually highlight valid drop targets.

Acceptance criteria:
- Dragging a card shows clear drop targets; the highlight disappears on drop/end.

---

### Phase 3 — Improve weekly grid behavior (stacking + non-hour times)

#### 6) Handle multiple jobs in a single hour without clipping
- Update: `src/pages/calendar-flow-management-center/index.jsx` (`renderWeekView()`)
  - Replace `h-12` with `min-h-12` + render a vertical stack with `space-y-1`.
  - Optionally cap to N items and show “+x more” popover/list.

Acceptance criteria:
- Two jobs at 9 AM both appear (or one appears + “+1 more” and the other is accessible).

#### 7) Fix non-hour start times
- Update: `renderWeekView()` job filtering
  - Replace `jobStart.getHours() === hour` with `jobStart.getHours() === hour` OR “within that hour”, and display minutes.

Acceptance criteria:
- A job starting at 8:30 renders in the 8 AM slot (or is positioned appropriately).

---

### Phase 4 — Improve info density + legend placement

#### 8) Add “what’s going on” fields to chips/cards
- Update: `renderEventChip()` (board/week/day/month)
- Ensure you show at least:
  - customer name (or short), stock #, service type, promise date (if all-day), loaner badge

Acceptance criteria:
- At iPad width, you can identify the customer + vehicle context from the chip.

#### 9) Make legend collapsible / move it
Goal: reduce wasted space, improve scan-ability.

- Locate legend component responsible for screenshot #3 and make it collapsible.

Acceptance criteria:
- Legend is accessible but not always occupying major space.

---

## Verification checklist (don’t skip)

### Local verification commands
Run from repo root:
```bash
pnpm -s verify
```

If you are iterating quickly:
```bash
pnpm test
pnpm lint
pnpm typecheck
```

### Targeted unit tests to add/extend
Add deterministic tests for:
- date-only “today” is not overdue
- date-only “yesterday” is overdue
- loaner expected return renders correct day
- snapshot bucketing doesn’t misclassify “today” as overdue

Suggested locations:
- Add a new unit test for `src/lib/time.js` overdue logic (recommended)
- Extend `src/tests/snapshotView.filtering.test.js` for snapshot bucketing

### Manual reproduction steps (production)
1) **Active Appointments**: open `/currently-active-appointments` on Jan 19
   - Ensure items due today are not in an overdue section.
2) **Board**: open `/calendar-flow-management-center`
   - Drag an all-day item onto a time slot or vendor lane
   - Confirm drop targets are obvious and copy makes sense
3) **Weekly schedule**:
   - Validate multiple jobs same hour are visible
   - Validate job starting at 8:30 is visible
4) **Loaner drawer**: open `/loaner-management-drawer`
   - Confirm expected return date matches Deal form value
   - Confirm overdue status is correct

---

## Definition of done (for this workstream)
- No “today is overdue” anywhere for date-only values.
- Loaner expected return date is consistent across Deal form, Deals list, and Loaner drawer.
- Snapshot overdue sections reflect ET calendar day.
- Board cards explain drag targets clearly.
- Weekly grid displays multiple jobs and non-hour times without hiding data.
- `pnpm -s verify` passes.

---

## Quick resume commands
```bash
cd /mnt/c/Users/ROB.BRASCO/GITHUB_ON_C/rocket_aftermarket_tracker

git status --porcelain=v1

# Run full verification before/after changes
pnpm -s verify
```
