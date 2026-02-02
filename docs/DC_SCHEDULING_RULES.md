# DC Scheduling Rules

## Product Rules (Non-Negotiable)

- No assignment/unassigned scheduling workflow exists.
- If a job/deal exists and is visible in Deals, it is considered scheduled.
- Visible jobs require a date; time is optional.
- Vendor defaults to On-Site (no “unassigned” state).
- PROMISE = date-only (no time window).
- BOOKED = scheduled time window (start/end set).
- PROMISE is never labeled BOOKED.
- Reopen from completed must go to quality_check.

## Manual Verification

1. Workflow Management Center:
   - No “Needs assignment” KPI.
   - No “Assign Jobs” CTA or assignment panel.
   - Promised (Date Only) queue is visible when applicable.
2. Flow Center:
   - No assigned/unassigned toggle or CTA.
   - On-site queue is always visible.
3. Calendar/Agenda:
   - Grid tab is clickable from Agenda.
   - PROMISE label appears as date-only (no time window).
4. Deals:
   - Jobs appear as scheduled without any “needs assignment” language.

## Required Gates

- `pnpm -s guard:client-env`
- `pnpm -s verify`
