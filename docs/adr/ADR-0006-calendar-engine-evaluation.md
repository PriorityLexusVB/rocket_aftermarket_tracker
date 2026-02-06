# ADR-0006: Calendar Engine Evaluation (FullCalendar/DayPilot)

## Status

Accepted (documented decision, no implementation change)

## Context

The calendar experience supports a dispatch flow with:

- Promise-only jobs (all-day) moving to scheduled lanes.
- A queue -> schedule -> monitor workflow.
- Resource lanes (vendor/on-site), drag/drop, resize, and status transitions.
- Strict guardrails: no stack changes, flags default OFF, minimal diffs.

We need to decide whether to continue with the current custom scheduler or plan for a 3rd-party engine.

## Options

A) Keep current stack (Vite + React + Tailwind + custom scheduler)
B) FullCalendar Scheduler
C) DayPilot Scheduler

## Evaluation Matrix

| Criteria | Current stack | FullCalendar Scheduler | DayPilot Scheduler |
| --- | --- | --- | --- |
| Resource lanes | Medium (custom lanes exist) | Strong (native resources) | Strong (native resources) |
| External drag from queue | Medium (custom) | Strong (external drag APIs) | Strong (external drag APIs) |
| Resize/move semantics | Medium (custom) | Strong | Strong |
| Accessibility | Medium (custom) | Medium (needs audit) | Medium (needs audit) |
| Performance at scale | Medium (needs profiling) | Medium (virtualization options) | Medium (virtualization options) |
| Licensing/cost | None | Paid for Scheduler | Paid for Scheduler |
| Migration risk | Low | High | High |

## Decision

Stay on the current stack for now. Do not add FullCalendar/DayPilot dependencies in this track.

## Go/No-Go Criteria (Revisit Triggers)

Re-evaluate a 3rd-party scheduler if any of the following occur:

- Resource lanes become a hard requirement across multiple views and cannot be maintained.
- External drag/drop from queue becomes brittle or inconsistent after multiple iterations.
- Resize/move semantics require complex edge cases we cannot implement safely.
- Performance bottlenecks emerge at scale (ex: 500+ items, multi-vendor lanes).
- A11y audit reveals persistent failures in custom interactions.

## Consequences

- Continue iterating on the current scheduler under feature flags.
- Preserve the ability to add a scheduler engine later via an adapter boundary.

## Related Docs

- docs/calendar-engine-spike-plan.md
- docs/CALENDAR_FLOW_MASTER_PLAN.md
