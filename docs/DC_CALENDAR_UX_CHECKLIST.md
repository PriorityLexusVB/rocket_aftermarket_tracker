# DC Calendar UX Checklist

## Definitions (Truth Rules)

- **PROMISE**: Date-only work. `time_tbd=true` or `schedule_state=scheduled_no_time` and **no time window**.
- **BOOKED / SCHEDULED**: Work with a **scheduled time window** (start/end set).

## Screen Purpose

- **Deals list**: Single source for deal status and promised date (including completed).
- **Calendar Grid**: Visual day/week/month schedule, including promise-only items.
- **Calendar Flow Center**: Queue-first scheduling and lane assignment.
- **Calendar Agenda**: List/queue view for quick rescheduling and navigation.
- **Appointments Snapshot** (Today / Next 7 / Promised All-day): Operational view of scheduled + promise-only items.

## Truth Rules (Non‑Negotiables)

- PROMISE items must **never** appear as BOOKED.
- Snapshot **All-day** view = **promise-only** items.
- **Completed jobs are hidden** in Snapshot views (until a future toggle is added).

## Manual Verification (copy/paste)

1. **Grid**: Open /calendar. Create a job with `time_tbd=true` or `schedule_state=scheduled_no_time`.
   - ✅ Status chip shows **PROMISE**, never BOOKED.
   - ✅ Time row shows **Promise: <date>** (not “All day”).
2. **Flow**: Open /calendar-flow-management-center.
   - ✅ Promise-only chips show **PROMISE** (never BOOKED).
   - ✅ Empty state reads “No jobs this week/day.” and action buttons work.
3. **Agenda**: Open /calendar/agenda.
   - ✅ Promise-only items appear as promise/needs scheduling (not BOOKED).
4. **Snapshot**: Open /currently-active-appointments?window=all_day.
   - ✅ Toggle says **Promised (All-day)**.
   - ✅ Empty state says **“No promised all-day items in this range.”**
   - ✅ Microcopy present: **“All-day promised items have a date but no time window yet. Completed jobs are hidden in this view.”**
5. **Navigation**:
   - ✅ Calendar nav goes to **/calendar** (not /calendar/grid).
   - ✅ Grid empty state buttons route to **/calendar/agenda** and **/calendar-flow-management-center**.

## Regression Tests Added

- src/tests/calendarSchedulingCenter.promiseLabel.test.jsx
- src/tests/snapshotView.copy.test.jsx

## Required Gates

- `pnpm -s guard:client-env`
- `pnpm -s verify`
