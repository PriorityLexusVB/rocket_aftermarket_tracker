# Rocket Aftermarket — Calendar Flow Rework (Implementation Spec for VS Code GPT‑5.2 Codex Agent)

## Mission

Fix the confusing Calendar navigation + missing-deals trust issues by making Calendar **one canonical module** with **three consistent views**:

- **Board** (dispatch / lanes)
- **Calendar** (overview)
- **List** (agenda/truth table)

Core rule: **DC’s primary object is a Deal**. Calendar shows Deal appointments/promises.

---

## Non-Negotiable UX Outcomes (Definition of Done)

1. There is **one** Calendar entry point (canonical) and one set of view toggles.
2. “Grid / Flow / Agenda” are renamed to **Board / Calendar / List** (or one consistent equivalent).
3. All Calendar views share the **same header**: view toggle, date nav, search, filters, legend, + New Deal.
4. Clicking a calendar item opens a **Deal Drawer** (side sheet). No more “View” link that bounces to another module.
5. Promises (date-only) are **all-day** and never look “booked”.
6. Deals list and Calendar data are consistent. If data is inconsistent, UI shows a clear recovery path (orphan handling).
7. Old URLs keep working via redirects/wrappers.

---

## Current Known Pain Points (from screenshots)

- Multiple navigation paths to the same destination (Calendar tabs + Quick Actions + “Open Agenda” elsewhere).
- Inconsistent titles (“Calendar Scheduling Center”, “Calendar Flow Management Center”, “Calendar”).
- Duplicate/competing controls (view toggle + day/week/month toggle in separate areas).
- Deals page shows 0 deals while Calendar shows at least one job (trust breaker).

---

## Recommended Implementation Strategy

### Prefer a Canonical Route

Use:

- `/calendar?view=board|calendar|list&range=day|week|month|next7|next30&date=YYYY-MM-DD`

Transitional support:

- `/calendar/agenda` → redirect to `/calendar?view=list`

- `/calendar/grid` → redirect to `/calendar?view=calendar`
- `/calendar-flow-management-center` → redirect to `/calendar?view=board`

If the app is not ready for query-param routing, implement a shared `CalendarShell` first and keep existing routes as wrappers.

---

## Feature Flag (Safety)

>

Create feature flag: `calendar_unified_shell`

- When OFF: keep existing behavior

- When ON: use the new CalendarShell + unified routing (or unified UI wrappers)

---

## Agent Workflow (Use Tools/MCP Effectively)

> NOTE: Use all available VS Code / MCP tools you have (filesystem search, ripgrep, git, terminal, test runner, etc.).

### Step 1 — Repo Recon

Use search tools to locate:

- routes: `calendar/agenda`, `calendar/grid`, `calendar-flow-management-center`

- components: “Calendar Views”, “Calendar Scheduling Center”, “Flow Management Center”, “Agenda”

- “Open Agenda”, “Open Scheduling Board”, “Quick Actions”
- deal fetching services/hooks used by `/deals`
- appointment/job fetching services/hooks used by Calendar

Suggested commands:

- `rg -n "/calendar/agenda|calendar-flow-management-center|Calendar Scheduling Center|Quick Actions|Open Agenda|Open Scheduling Board" .`
- `rg -n "Deals|deals" app src pages components`
- `rg -n "supabase|tenant|location|org_id|dealer_id" .`
- `rg -n "appointment|appointments|job|jobs|promise" .`

### Step 2 — Baseline Tests

Run:

- unit tests (if any)
- lint
- Playwright e2e (if available)

Record baseline failures before changes.

---

## Implementation Tasks (Checklist)

### A) Create Shared CalendarShell

- [ ] Build `CalendarShell` layout component:
  - Title: “Calendar”
  - View toggle: Board | Calendar | List
  - Date nav: prev / Today / next + date label + date picker
  - Search input (stock/customer/phone)
  - Filters popover
  - Legend popover icon
  - Primary CTA: “+ New Deal”
  - Overflow menu: Refresh / Export / Round-Up / Settings

Acceptance:

- Any Calendar view rendered inside CalendarShell looks identical at the top.

### B) Canonical Calendar Routing

Choose one:

**Option 1: Query-param canonical route**

- [ ] Create `/calendar` page reading `view`, `range`, `date` from query params.
- [ ] Render view:
  - `view=board` => BoardView
  - `view=calendar` => CalendarView
  - `view=list` => ListView
- [ ] Add redirects:
  - `/calendar/agenda` → `/calendar?view=list`

  - `/calendar/grid` → `/calendar?view=calendar`
  - `/calendar-flow-management-center` → `/calendar?view=board`

**Option 2: Transitional wrapper pages**

- [ ] Keep old routes but make them render CalendarShell + correct view.
- [ ] Remove internal “Open X” links and keep navigation only via view toggle.
- [ ] Add redirects later.

Acceptance:

- Users always feel like they are “in Calendar” regardless of route.

### C) Rename Views + Remove Redundant Buttons

- [ ] Rename “Grid / Flow / Agenda” labels to Board / Calendar / List.
- [ ] Remove “Quick Actions” navigation buttons:
  - “Open Scheduling Board”
  - “Open Agenda (List)”
- [ ] Replace external “Open Agenda” links with `/calendar?view=list` (or the canonical equivalent).

Acceptance:

- There is one consistent view toggle across all calendar experiences.

### D) Implement Deal Drawer (Side Sheet)

- [ ] Create `DealDrawer` component (accessible dialog):
  - opens from any calendar item (Board/Calendar/List)
  - shows: summary, line items, schedule, history/notes
  - context actions: Set time, Reschedule, Mark In Progress, QC, Complete
- [ ] Replace inline “View / Reschedule / Complete” link cluster with:
  - row click => open drawer
  - `⋯` menu => secondary actions

Acceptance:

- User can complete the entire workflow without leaving Calendar.

### E) Board View (Dispatch / Lanes)

- [ ] Sidebar becomes Queue:
  - Unscheduled (no date) list
  - Needs Time (date-only) as badge + highlight toggle (avoid duplicates)
  - Overdue as badge/filter

- [ ] Promise items appear in All-day band, labeled clearly.
- [ ] Ensure drag/click “Schedule” works and converts promise → scheduled correctly.
- [ ] Vendor lanes controls simplified; legend moved to popover.

Acceptance:

- No duplicated items between sidebar and lanes (unless in a deliberate highlight mode).

### F) List View (Agenda)

- [ ] Group each date:
  - All-day (Promises)
  - Scheduled (Timed)
- [ ] Row click opens drawer.

- [ ] Replace link clutter with `⋯` menu.

Acceptance:

- A DC user can scan the next 7 days without ambiguity.

### G) Calendar View (Overview)

- [ ] Remove right-side “Quick Actions” nav panel.

- [ ] Show daily counts (promises / scheduled / overdue).
- [ ] Click a day → go to Board Day (default) or List Day.

Acceptance:

- Overview is about density + drill-down, not navigation confusion.

### H) Data Consistency: Fix “Deals missing but Calendar has jobs”

- [ ] Identify the “source of truth” relationship:
  - appointment/job record must resolve to a deal record
- [ ] Ensure Deals page and Calendar use consistent tenant/location filters.
- [ ] Add orphan recovery:
  - If a calendar item cannot resolve a deal, show “Unlinked appointment” banner + actions.
- [ ] Add “mismatch banner” on Deals:
  - if 0 deals but calendar returns items in same tenant/range, warn + suggest refresh/check filters.

Acceptance:

- Calendar item always opens a deal, or provides a clear recovery action.

---

## Testing / QA Requirements

### Playwright (or equivalent E2E)

- [ ] `/calendar` loads with default view
- [ ] switching Board/Calendar/List preserves header + updates correct view
- [ ] old routes redirect to canonical view
- [ ] clicking an item opens DealDrawer
- [ ] promise remains all-day; scheduling sets time and moves into scheduled
- [ ] deals page mismatch banner appears only when appropriate

### Accessibility

- [ ] DealDrawer focus trap works
- [ ] ESC closes drawer
- [ ] keyboard nav works for toggle + menus

---

## Rollout Plan

- [ ] Behind feature flag first
- [ ] Enable for internal/DC test tenant
- [ ] Verify:
  - navigation clarity
  - no data loss
  - no regressions
- [ ] Remove deprecated routes/buttons after adoption

---

## Notes for the Agent

- Prefer small commits:
  1. CalendarShell + renamed labels
  2. Remove redundant nav buttons
  3. DealDrawer
  4. Board sidebar queue + promise handling
  5. List grouping + actions cleanup
  6. Data consistency/orphan handling
  7. Tests + docs

- When in doubt, optimize for:
  - fewer paths to the same destination
  - one canonical mental model: Deal → Appointment → Completion
