# Chat Summary & Progress (2026-01-12)

## What you reported (current blocker)
- Appointments are **still not displaying consistently**.
- When you set a date to **1/14/2026**, click **Update**, and then navigate away/back, it shows **1/13/2026**.
- This looks like a **date shifting / reversion** issue (often caused by date-only values being treated as timestamps with timezone conversion, or by a default “+1 day” initialization being reapplied).
- You also called out that several pages are **visually “ugly”** and need UX polish.

## What we already completed earlier in this thread
- Agenda UX: added **toast action buttons**, enabling **Undo** for Agenda “Complete”.
- Deep-linking: added Flow Center “Needs Scheduling” deep-link behind a feature flag.
- Backend noise reduction: stopped selecting missing column `jobs.next_promised_iso` via capability gating.
- Delivery coordinator workflow: implemented **view convenience** (e.g., "My Next 3 Days") without restricting access.
- Fixed React hook-order ESLint failures in the Agenda page.
- Agenda behavior change: **day-first display** and include **promised-only** items; show time only when scheduled.
- Verification: lint + focused Vitest + build were run and were green at the time of those changes.

## Current state
- The routing / deep-links to `/calendar/agenda` exist and were previously audited.
- The **date persistence / off-by-one** behavior is still unresolved and is now the primary functional issue.

## Next actions
- See the companion doc for the detailed plan + task list:
  - `.artifacts/chat-history/2026-01-12-appointments-date-revert-plan-and-tasks.md`
