# RescheduleModal Line-Item Scheduling - Implementation Summary

**Date:** November 14, 2025  
**Status:** ✅ COMPLETE (Phase 3 Enhancement)  
**Branch:** `copilot/update-reschedule-modal-line-item-scheduling`

## Quick Stats

- **Files Changed:** 2 (1 production, 1 test)
- **Lines Added:** 203
- **Lines Removed:** 0
- **Net Change:** +203 lines
- **Test Status:** 657 passed, 2 skipped (659 total)
- **Build Status:** ✅ Pass (9.46s)
- **Lint Status:** ✅ 0 errors
- **Security Status:** ✅ 0 alerts (CodeQL)

## What Was Done

Enhanced the existing RescheduleModal implementation to also update the `promised_date` field (displayed as "Date Scheduled" in the UI) when rescheduling jobs from the calendar. This was the final missing piece to complete the line-item scheduling redesign.

### Issue Found

The RescheduleModal was already reading from line items and updating `scheduled_start_time` and `scheduled_end_time`, but was NOT updating `promised_date`. This meant the "Date Scheduled" field in the deal form would be out of sync with the calendar times after rescheduling.

### Key Changes

1. **Service Layer (`jobService.js`)** - 5 new lines
   - Enhanced existing `updateLineItemSchedules(jobId, scheduleData)` method
   - Now extracts date from `scheduled_start_time` ISO timestamp
   - Updates `promised_date` field alongside time fields
   - Updates all three fields: `scheduled_start_time`, `scheduled_end_time`, `promised_date`

2. **Tests (`jobService.updateLineItemSchedules.test.js`)** - 197 lines, new file
   - 6 comprehensive unit tests
   - Tests successful updates of all three fields
   - Tests parameter validation and error cases
   - Tests date extraction from various ISO timestamp formats

## How It Works

### Reading Schedules (Already Implemented)

When the RescheduleModal opens:
1. Checks for explicit `initialStart`/`initialEnd` props (preferred)
2. If not provided, looks at `job.job_parts` array
3. Filters to line items with scheduled times
4. Computes: earliest start, latest end
5. Displays aggregated schedule in modal

### Writing Schedules (Enhanced in This PR)

When user saves:
1. Validates new start/end times
2. Calls `jobService.updateLineItemSchedules(jobId, { startTime, endTime })`
3. Service fetches all line items with `requires_scheduling = true`
4. **NEW:** Extracts date from `startTime` (e.g., "2025-11-15" from "2025-11-15T09:00:00Z")
5. Updates each line item with:
   - `scheduled_start_time`: Full ISO timestamp
   - `scheduled_end_time`: Full ISO timestamp
   - **NEW:** `promised_date`: Date portion only (YYYY-MM-DD)
6. Returns refreshed job data
7. Calendar refreshes to show updated schedule

## Edge Cases

✅ Single line item → uses that schedule  
✅ Multiple line items → shows aggregated span  
✅ No scheduled items → shows empty fields  
✅ Mixed scheduled/unscheduled → only considers scheduled  
✅ Explicit props → prefers those over computed  
✅ Backward compatibility → falls back to job-level fields

## User Flow

1. User opens calendar agenda
2. Clicks job → sees schedule chip
3. Clicks "Reschedule" button
4. Modal shows current schedule (aggregated from line items)
5. User adjusts times
6. Clicks "Save"
7. All scheduled line items updated
8. Calendar refreshes
9. Success toast confirms

## Testing Strategy

### New Unit Tests (6 tests)
- ✅ Updates all three fields (start_time, end_time, promised_date)
- ✅ Only updates items with requires_scheduling=true
- ✅ Validates required parameters (jobId, startTime, endTime)
- ✅ Throws error when no scheduled items
- ✅ Extracts date correctly from various ISO timestamps
- ✅ Returns updated job after successful update

### Existing Tests (651 tests)
- ✅ RescheduleModal UI tests (20 tests)
- ✅ All other application tests (631 tests)

### Regression
- ✅ All 657 tests pass (2 skipped)
- ✅ Build successful (9.46s)
- ✅ No lint errors
- ✅ No security alerts (CodeQL)

## Commits

1. `e5e20d2` - Initial plan
2. `7c8c8bc` - Add promised_date update to updateLineItemSchedules method

## Files Modified

```
src/services/jobService.js                           | +6 lines
src/tests/jobService.updateLineItemSchedules.test.js | +197 lines (new file)
```

### Changes in Detail

**src/services/jobService.js:**
```javascript
// Added before the updates mapping
const promisedDate = scheduleData.startTime 
  ? new Date(scheduleData.startTime).toISOString().split('T')[0] 
  : null

// Added to updates object
const updates = scheduledItems.map((item) => ({
  id: item.id,
  scheduled_start_time: scheduleData.startTime,
  scheduled_end_time: scheduleData.endTime,
  promised_date: promisedDate, // NEW
  updated_at: nowIso(),
}))

// Added to Supabase update query
await supabase.from('job_parts').update({
  scheduled_start_time: update.scheduled_start_time,
  scheduled_end_time: update.scheduled_end_time,
  promised_date: update.promised_date, // NEW
  updated_at: update.updated_at,
}).eq('id', update.id)
```

## Guardrails Verification

✅ No stack changes  
✅ No dependency changes  
✅ No direct Supabase in components  
✅ Tenant scoping maintained  
✅ Controlled inputs preserved  
✅ Minimal file changes  
✅ All tests pass  
✅ Build successful  
✅ No security alerts

## Next Steps

- [x] Code complete
- [x] Tests complete and passing
- [x] Build successful
- [x] Security scan clean
- [ ] Code review
- [ ] Manual UI testing
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

## Manual Verification Steps

1. **Single line item reschedule:**
   - Create job with 1 line item (requires_scheduling=true)
   - Set schedule in deal form
   - View in calendar → reschedule
   - Verify: promised_date, start_time, end_time all update

2. **Multiple line items reschedule:**
   - Create job with 2+ line items (all requires_scheduling=true)
   - Set different times for each
   - View in calendar → reschedule (shows aggregated span)
   - Verify: All line items update to new unified schedule

3. **Mixed scheduling requirements:**
   - Create job with mixed line items (some requires_scheduling=true, some false)
   - Reschedule from calendar
   - Verify: Only scheduled items update, others unchanged

## References

- **PR Branch:** `copilot/update-reschedule-modal-line-item-scheduling`
- **Base Branch:** Main (includes PR #127 line-item scheduling)
- **Related PR:** #127 - Line-item scheduling refactor
- **Related Migration:** `20251114163000_calendar_line_item_scheduling.sql`
- **Documentation:** `LINE_ITEM_SCHEDULING_REDESIGN_SUMMARY.md`
- **Problem Statement:** Update RescheduleModal to use line-item scheduling

---

**Review Status:** ✅ Ready for Review  
**Breaking Changes:** None  
**Rollback:** Safe and instant (code-only changes, no migration)  
**Security:** ✅ 0 alerts (CodeQL verified)
