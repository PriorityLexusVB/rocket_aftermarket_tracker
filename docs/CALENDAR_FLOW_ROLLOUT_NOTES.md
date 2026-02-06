# Calendar Flow Rollout Notes

## Feature Flags

- `VITE_FF_CALENDAR_UNIFIED_SHELL` (default OFF)
- `VITE_FF_CALENDAR_DEAL_DRAWER` (default OFF)

## Rollout Order

1. Keep flags OFF by default in all environments.
2. Enable for the internal/DC test tenant first.
3. Verify:
   - Navigation clarity (Board/Calendar/List toggle stays in sync)
   - No data loss on schedule updates or status actions
   - Deal drawer open/close behavior remains stable
   - Location filter parity across Deals + Calendar
4. Expand to additional tenants after verification.

## Cleanup After Adoption

- Remove deprecated routes/buttons once the unified shell is the default:
  - `/calendar/agenda`
  - `/calendar/grid`
  - `/calendar-flow-management-center`
- Remove legacy nav buttons that duplicate unified shell controls.
