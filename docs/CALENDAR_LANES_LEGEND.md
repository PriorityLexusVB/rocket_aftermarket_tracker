# Calendar Lanes & Legend (Flow Management Center)

This doc explains how the **Calendar Flow Management Center** organizes jobs into lanes, and how to interpret the on-screen **Legend**.

## Where this applies

- Page: Calendar Flow Management Center
- Views: Day / Week (lane view). Month view hides vendor lanes.

## Lane meanings

### On-Site (PLV)

Use this lane for jobs performed **on-site**.

A job is treated as **On-Site** when either:

- it has **no vendor** (`vendor_id` is null), or
- it is explicitly marked **on-site** (`location === 'on_site'`).

### Vendor lanes

Each vendor lane represents work assigned to that **vendor**.

A job appears in a vendor lane when:

- `vendor_id` matches that vendor.

This is primarily intended for **off-site/vendor-performed** work.

## Scheduling gestures (drag & drop)

- Drop onto a **time slot** (Day/Week) to set a timed schedule window (5-minute increments).
- Drop into a **vendor lane** to assign vendor/location (without selecting an explicit time slot).

## Overdue promise

The **Overdue promise** marker indicates the job’s promise date/time is in the past relative to “now”.

Notes:

- Promise dates can be **date-only** or **date + time**. Date-only promises should not be treated as a timed schedule window.
- Timed scheduling is represented by line-item windows (`job_parts.scheduled_start_time` / `scheduled_end_time`).

## Common confusion: “Why did my job move lanes?”

- If you assign a vendor (and/or mark the job off-site), it will begin showing in that vendor lane.
- If you only change a **promise date** (date-only), that should not automatically convert the job into a timed schedule window.

## Related docs

- `docs/SCHEDULING_ARCHITECTURE.md` (canonical scheduling + vendor relationship model)
