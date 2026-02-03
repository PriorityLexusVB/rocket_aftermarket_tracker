# Rocket Aftermarket — Calendar Flow Rework

## Phase 0 Baseline: Current Routes + Entry Points (as of 2026-02-03)

This doc captures the _current_ Calendar-related routes and the UI links/buttons that navigate to them.

## Feature Flags Affecting Routing

- `VITE_SIMPLE_CALENDAR` (existing)
  - When `true`: `/calendar/agenda` renders the Simple Agenda page.
  - When `false`: `/calendar/agenda` redirects to `/calendar-flow-management-center`.

## Current Protected Routes (Router)

Defined in `src/Routes.jsx`:

| Route                              | Current behavior                                                                       | Component / Notes                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `/calendar`                        | Redirects to `/calendar/agenda` (if `VITE_SIMPLE_CALENDAR=true`) else `/calendar/grid` | Canonical-ish entry today, but routes immediately branch |
| `/calendar/grid`                   | Calendar Scheduling Center (grid/day/week/month)                                       | `src/pages/calendar`                                     |
| `/calendar-flow-management-center` | Flow Management Center (board/scheduler)                                               | `src/pages/calendar-flow-management-center`              |
| `/calendar/agenda`                 | Simple Agenda if enabled; otherwise redirects to Flow                                  | `src/pages/calendar-agenda` (feature-flagged)            |
| `/currently-active-appointments`   | “Currently Active Appointments” module                                                 | `src/pages/currently-active-appointments`                |
| `/deals`                           | Deals list                                                                             | `src/pages/deals`                                        |
| `/deals/new`                       | New deal                                                                               | `src/pages/deals/NewDeal`                                |
| `/deals/:id/edit`                  | Edit deal                                                                              | `src/pages/deals/EditDeal`                               |

Also present:

- Legacy redirect `/calendar-scheduling-center` → `/calendar/grid`

## Entry Points (UI Links/Buttons) By Destination

### Destination: `/calendar` (redirect hub)

- Dashboard: “Open Calendar” button uses `/calendar` when `VITE_SIMPLE_CALENDAR` is off
  - `src/pages/dashboard/index.jsx`

### Destination: `/calendar/agenda` (Simple Agenda / List)

- Calendar Scheduling Center:
  - Empty-state overlay: “Open Agenda” button
  - Quick Actions card: “Open Agenda (List)” button (only if Simple Agenda enabled)
  - `src/pages/calendar/index.jsx`

- Calendar View Tabs:
  - “Agenda” tab links to `/calendar/agenda` (only if Simple Agenda enabled)
  - `src/components/calendar/CalendarViewTabs.jsx`

- Currently Active Appointments:
  - `SnapshotView` header includes “Open Agenda” (only if SIMPLE_CAL_ON)
  - `src/pages/currently-active-appointments/components/SnapshotView.jsx`

- Deals:
  - Schedule chip can navigate to `/calendar/agenda?focus=<jobId>` when `enableAgendaNavigation` is enabled
  - `src/components/deals/ScheduleChip.jsx`
  - Deals list also navigates to `/calendar/agenda?focus=<dealId>` in some flows
  - `src/pages/deals/index.jsx`

- Flow Management Center:
  - `JobDrawer` “Reschedule” uses `/calendar/agenda?focus=<jobId>` when `VITE_SIMPLE_CALENDAR=true`
  - `src/pages/calendar-flow-management-center/components/JobDrawer.jsx`

### Destination: `/calendar/grid` (Calendar Scheduling Center / “Grid”)

- Calendar View Tabs:
  - “Grid” tab links to `/calendar/grid`
  - `src/components/calendar/CalendarViewTabs.jsx`

- Routes:
  - `/calendar` redirects to `/calendar/grid` when `VITE_SIMPLE_CALENDAR=false`
  - `src/Routes.jsx`

### Destination: `/calendar-flow-management-center` (Scheduling Board / “Flow”)

- Calendar Scheduling Center:
  - Empty-state overlay: “Open Flow” button
  - Quick Actions card: “Open Scheduling Board” button
  - `src/pages/calendar/index.jsx`

- Calendar View Tabs:
  - “Flow” tab links to `/calendar-flow-management-center`
  - `src/components/calendar/CalendarViewTabs.jsx`

- Dashboard:
  - Quick Links includes “Scheduling Board” button
  - Reschedule buttons may navigate to `/calendar-flow-management-center?focus=<jobId>` when Simple Agenda is off
  - `src/pages/dashboard/index.jsx`

### Destination: `/currently-active-appointments`

- Navbar / Sidebar include this as a primary nav item
  - `src/components/ui/Navbar.jsx`
  - `src/components/ui/Sidebar.jsx`

- Flow Management Center also links into this module for certain windows
  - `src/pages/calendar-flow-management-center/index.jsx`

### Destination: `/deals`

- Dashboard:
  - Quick Links includes “Deals”
  - Some schedule widgets include “View” buttons to `/deals/:id/edit`
  - `src/pages/dashboard/index.jsx`

- Multiple modules navigate to `/deals/:id/edit` as the default “View” behavior today
  - Example: Flow Management `JobDrawer` “Open Deal”
  - `src/pages/calendar-flow-management-center/components/JobDrawer.jsx`

## Phase 0 Acceptance Checklist (Baseline)

- [ ] Feature flag `calendar_unified_shell` defined (default OFF prod; ON dev/staging)
- [ ] Old routes still work when flag is OFF
- [x] Current routes listed
- [x] UI entry points identified (where users click to bounce between modules)
- [ ] Lightweight navigation logging added (source → destination) for key Calendar-related actions

## Notes / Observations (Baseline)

- Today, users have multiple ways to reach “Calendar”:
  - `/calendar` (redirect hub)
  - `/calendar/grid` (Scheduling Center)
  - `/calendar-flow-management-center` (Board)
  - `/calendar/agenda` (List) — conditional on `VITE_SIMPLE_CALENDAR`
- Labels are inconsistent (“Grid/Flow/Agenda” vs “Scheduling Board” vs “Calendar Scheduling Center”).
- Several modules still navigate out to `/deals/:id/edit` for “View”, which drives the navigation churn the rework is targeting.

## Phase 0 Instrumentation (Navigation Logging)

Phase‑0 adds lightweight, dev-only, no-PII navigation logging for calendar-related entry points. Destinations and routes remain unchanged.

### Logging Utility

- Logger: `src/lib/navigation/logNavigation.js` (`logCalendarNavigation`)
- Feature flag scaffold: `src/config/featureFlags.js` (`calendar_unified_shell` via `VITE_FF_CALENDAR_UNIFIED_SHELL`)

### Instrumented Sources

- `Header.Breadcrumb.Calendar*` → `src/components/ui/Header.jsx`
- `Dashboard.OpenCalendar` / `Dashboard.OpenAgenda` / `Dashboard.OpenSchedulingBoard` / `Dashboard.Reschedule*` → `src/pages/dashboard/index.jsx`
- `CalendarViewTabs.Grid` / `CalendarViewTabs.Flow` / `CalendarViewTabs.Agenda` → `src/components/calendar/CalendarViewTabs.jsx`
- `CurrentlyActiveAppointments.SnapshotView.OpenAgenda` → `src/pages/currently-active-appointments/components/SnapshotView.jsx`
- `ScheduleChip.OpenAgenda` → `src/components/deals/ScheduleChip.jsx`
- `FlowManagement.JobDrawer.RescheduleToAgenda` → `src/pages/calendar-flow-management-center/components/JobDrawer.jsx`
- `CalendarSchedulingCenter.EmptyState.OpenAgenda` / `CalendarSchedulingCenter.EmptyState.OpenSchedulingBoard` → `src/pages/calendar/index.jsx`
- `CalendarSchedulingCenter.QuickActions.OpenAgenda` / `CalendarSchedulingCenter.QuickActions.OpenSchedulingBoard` → `src/pages/calendar/index.jsx`
