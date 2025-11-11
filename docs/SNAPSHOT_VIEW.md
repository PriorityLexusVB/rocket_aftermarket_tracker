# Currently Active Appointments - Snapshot View

## Overview
The "Currently Active Appointments" page now supports a simplified **Snapshot View** mode that can be enabled via a feature flag. This mode provides a vendor-centric, minimal interface for quickly viewing and managing scheduled appointments.

## Feature Flag

```bash
VITE_ACTIVE_SNAPSHOT=true  # Enable snapshot view
VITE_ACTIVE_SNAPSHOT=false # Use legacy workflow management center (default)
```

Add this to your `.env.local` or deployment environment variables.

## Snapshot View Features

When enabled, the snapshot view provides:

### Display
- **Filtered List**: Shows only `scheduled` and `in_progress` jobs with non-null `scheduled_start_time`
- **Sorted**: Ascending by scheduled start time
- **Columns**:
  - Time (start → end range)
  - Customer name
  - Vehicle (year/make/model)
  - Vendor name
  - Status badge
  - Actions

### Actions
1. **View Deal**: Navigate to full deal edit page (`/deals/:id/edit`)
2. **Complete**: Mark job as completed with `completed_at` timestamp
   - Shows success toast notification
   - Provides 10-second undo window
3. **Reschedule** (optional): Only shown when `VITE_SIMPLE_CALENDAR=true`
   - Links to `/calendar/agenda?focus=:id`

### Architecture
- **Component**: `src/pages/currently-active-appointments/components/SnapshotView.jsx`
- **Service**: Uses `jobService.getAllJobs()` and `jobService.updateStatus()`
- **Tenant Scoping**: Uses `useTenant()` hook to filter by `orgId`
- **No Direct Supabase**: All data operations via service layer

### Accessibility
- ARIA labels on table and action buttons
- Role attributes for status notifications
- Semantic HTML table structure

## Legacy Workflow Management Center

When the flag is disabled (default), the full workflow management center is rendered with:
- Assignment workflows
- Bulk operations
- Performance metrics
- Staff management
- Detailed filtering and search

## Testing

Unit tests for snapshot filtering and sorting logic:
```bash
pnpm test snapshotView.filtering
```

## Rollback

To disable the snapshot view:
1. Set `VITE_ACTIVE_SNAPSHOT=false` or unset the variable
2. Restart the application
3. The legacy workflow management center will be restored immediately

No database changes are required; this is purely a frontend toggle.

## Implementation Notes

- Feature-flagged at component mount time
- No runtime overhead when disabled
- Preserves all legacy functionality
- Minimal code changes to existing workflow center
- Follows workspace guardrails (no direct Supabase in components, uses services)
