# Line-Item Scheduling - Deployment Guide

**Version:** 1.0  
**Date:** November 14, 2025  
**Branch:** `copilot/refactor-job-scheduling-functionality`

---

## Overview

This guide covers deploying the line-item scheduling redesign, which removes job-level scheduling and makes all scheduling happen exclusively at the line-item level.

---

## Pre-Deployment Checklist

### 1. Data Assessment

```sql
-- Check how many jobs have job-level scheduling
SELECT COUNT(*) as jobs_with_schedule
FROM jobs
WHERE scheduled_start_time IS NOT NULL;

-- Check how many line items already have scheduling
SELECT COUNT(*) as line_items_with_schedule
FROM job_parts
WHERE scheduled_start_time IS NOT NULL;

-- Identify jobs that need data migration
SELECT j.id, j.job_number, j.scheduled_start_time, j.scheduled_end_time,
       (SELECT COUNT(*) FROM job_parts WHERE job_id = j.id) as line_item_count
FROM jobs j
WHERE j.scheduled_start_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_parts jp
    WHERE jp.job_id = j.id
    AND jp.scheduled_start_time IS NOT NULL
  );
```

### 2. Backup Database

```bash
# Using Supabase CLI
supabase db dump --data-only > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using pg_dump
pg_dump -h your-host -U your-user -d your-db \
  --data-only \
  --table=jobs \
  --table=job_parts \
  > backup_jobs_$(date +%Y%m%d_%H%M%S).sql
```

---

## Data Migration (Optional)

If you have existing jobs with job-level scheduling that you want to preserve:

```sql
-- Migration: Copy job-level schedules to line items
-- This adds scheduling to ALL line items in jobs that have job-level schedules

WITH job_schedules AS (
  SELECT id, scheduled_start_time, scheduled_end_time
  FROM jobs
  WHERE scheduled_start_time IS NOT NULL
    AND scheduled_end_time IS NOT NULL
)
UPDATE job_parts jp
SET
  scheduled_start_time = js.scheduled_start_time,
  scheduled_end_time = js.scheduled_end_time,
  updated_at = NOW()
FROM job_schedules js
WHERE jp.job_id = js.id
  AND jp.scheduled_start_time IS NULL  -- Only update if not already scheduled
  AND jp.requires_scheduling = true;   -- Only if scheduling is needed

-- Verify the migration
SELECT
  COUNT(*) as migrated_line_items,
  MIN(scheduled_start_time) as earliest,
  MAX(scheduled_end_time) as latest
FROM job_parts
WHERE scheduled_start_time IS NOT NULL;
```

---

## Deployment Steps

### Step 1: Deploy Frontend Code

```bash
# Pull latest code
git checkout copilot/refactor-job-scheduling-functionality
git pull origin copilot/refactor-job-scheduling-functionality

# Install dependencies
pnpm install

# Build
pnpm build

# Deploy (adjust for your deployment method)
# e.g., vercel deploy, netlify deploy, etc.
```

### Step 2: Apply Database Migration

```bash
# Using Supabase CLI
cd supabase/migrations
supabase migration up

# Or apply directly via SQL
psql $DATABASE_URL < 20251114163000_calendar_line_item_scheduling.sql
```

**Migration applies:**

- Updates `get_jobs_by_date_range()` function
- Updates `check_vendor_schedule_conflict()` function
- Both functions now read from `job_parts` table

### Step 3: Verify Migration

```sql
-- Test calendar function
SELECT * FROM get_jobs_by_date_range(
  NOW()::timestamp,
  (NOW() + INTERVAL '7 days')::timestamp,
  NULL,
  NULL
);

-- Should return jobs with line-item schedules

-- Test conflict detection
SELECT check_vendor_schedule_conflict(
  'vendor-uuid-here'::uuid,
  '2025-11-15 09:00:00'::timestamp,
  '2025-11-15 11:00:00'::timestamp,
  NULL
);

-- Should return true if conflict exists, false otherwise
```

### Step 4: Clear Cache

```bash
# Reload PostgREST schema cache
psql $DATABASE_URL -c "NOTIFY pgrst, 'reload schema';"

# Clear application cache if applicable
# e.g., Redis, Memcached, etc.
```

---

## Post-Deployment Verification

### 1. Smoke Tests

**Test Calendar Display:**

1. Navigate to calendar view
2. Verify scheduled jobs appear
3. Check that jobs with multiple line items show correct time span

**Test Job Creation:**

1. Create new job with line items
2. Set "Date Scheduled" on line items
3. Save and verify it appears on calendar

**Test Job Editing:**

1. Open existing job for editing
2. Verify "Date Scheduled" field is populated
3. Modify and save

### 2. Monitor Logs

```bash
# Watch for errors
tail -f /var/log/app.log | grep -i "error\|calendar\|schedule"

# Supabase logs
supabase functions logs

# Application logs (adjust for your setup)
pm2 logs
# or
docker logs -f app-container
```

### 3. Performance Check

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM get_jobs_by_date_range(
  NOW()::timestamp,
  (NOW() + INTERVAL '30 days')::timestamp,
  NULL,
  NULL
);

-- Should use indexes on job_parts.scheduled_start_time
```

---

## Rollback Procedure

If issues occur:

### Step 1: Revert Frontend

```bash
# Redeploy previous version
git checkout main  # or previous stable branch
pnpm build
# deploy
```

### Step 2: Revert Database

```sql
-- Restore old calendar functions
-- Drop new functions
DROP FUNCTION IF EXISTS public.get_jobs_by_date_range(timestamp with time zone, timestamp with time zone, uuid, text);
DROP FUNCTION IF EXISTS public.check_vendor_schedule_conflict(uuid, timestamp with time zone, timestamp with time zone, uuid);

-- Recreate old functions from 20250923162000_fix_calendar_date_range_function.sql
-- (Copy the old function definitions here)
```

### Step 3: Restore from Backup (if needed)

```bash
# Restore data
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

---

## Known Issues & Workarounds

### Issue 1: RescheduleModal Doesn't Work

**Problem:** RescheduleModal component still tries to read/write job-level schedules.

**Workaround:**

- Edit jobs directly from the deals list
- Update line items individually
- Or apply the RescheduleModal fix (separate PR)

**Long-term Fix:**
Update RescheduleModal to work with line items (tracked in separate issue).

### Issue 2: Jobs Don't Appear on Calendar

**Symptom:** Jobs with old job-level schedules don't show on calendar.

**Cause:** Calendar now only reads from line items.

**Solution:** Run the data migration script to copy job-level schedules to line items.

---

## Monitoring

### Key Metrics to Watch

1. **Calendar Load Time**
   - Should be similar or faster than before
   - Monitor `get_jobs_by_date_range()` execution time

2. **Job Creation Success Rate**
   - Ensure jobs with line-item schedules save correctly

3. **Error Rates**
   - Watch for scheduling-related errors
   - Monitor API endpoints: `/api/jobs`, `/api/calendar`

4. **User Feedback**
   - Pay attention to reports of missing scheduled jobs
   - Check for confusion about new "Date Scheduled" terminology

### Dashboards

```sql
-- Daily scheduled jobs count
SELECT
  DATE(scheduled_start_time) as schedule_date,
  COUNT(DISTINCT job_id) as jobs_count,
  COUNT(*) as line_items_count
FROM job_parts
WHERE scheduled_start_time IS NOT NULL
  AND scheduled_start_time >= NOW() - INTERVAL '7 days'
GROUP BY DATE(scheduled_start_time)
ORDER BY schedule_date DESC;

-- Scheduling adoption
SELECT
  COUNT(DISTINCT job_id) as total_jobs,
  COUNT(DISTINCT CASE WHEN scheduled_start_time IS NOT NULL THEN job_id END) as scheduled_jobs,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN scheduled_start_time IS NOT NULL THEN job_id END) /
        COUNT(DISTINCT job_id), 2) as scheduled_percentage
FROM job_parts;
```

---

## User Communication

### Announcement Template

```
📅 Scheduling System Update

We've improved our scheduling system! Here's what's new:

✅ Clearer Terminology: "Promised Date" is now "Date Scheduled"
✅ Line-Item Scheduling: Schedule each service item individually
✅ Multi-Day Support: New checkbox for jobs spanning multiple days

What You Need to Know:
- All scheduling now happens on line items (not at the job level)
- The calendar shows the combined time span of all scheduled items
- Edit line item schedules directly in the deal form

Questions? Contact support or check the updated user guide.
```

---

## Support Preparation

### FAQs for Support Team

**Q: Why can't I see job-level scheduling fields anymore?**  
A: We've moved to line-item only scheduling for better flexibility and accuracy.

**Q: What happens to my existing scheduled jobs?**  
A: Existing schedules were migrated to line items automatically [if migration was run].

**Q: How do I schedule a multi-day job?**  
A: Check the "Multi-Day Scheduling" checkbox on the line item.

**Q: Can I still reschedule from the calendar?**  
A: Currently, reschedule from the deals list. Calendar rescheduling will be updated soon.

**Q: Why does the calendar show a wider time range than expected?**  
A: When a job has multiple line items, the calendar shows from the earliest start to the latest end.

---

## Success Criteria

Deployment is successful when:

- [ ] Calendar displays scheduled jobs correctly
- [ ] New jobs can be created with line-item schedules
- [ ] Existing jobs can be edited without data loss
- [ ] Vendor conflict detection works
- [ ] No increase in error rates
- [ ] Build/deploy completes without issues
- [ ] Users can complete their daily workflows

---

## Appendix: File Locations

**Frontend Files:**

- `src/components/deals/DealFormV2.jsx` - Main deal form
- `src/pages/deals/DealForm.jsx` - Legacy form
- `src/pages/calendar/components/CreateModal.jsx` - Calendar create
- `src/services/calendarService.js` - Calendar API

**Database Files:**

- `supabase/migrations/20251114163000_calendar_line_item_scheduling.sql` - Migration

**Documentation:**

- `LINE_ITEM_SCHEDULING_REDESIGN_SUMMARY.md` - Technical summary
- `DEPLOYMENT_GUIDE.md` - This file

---

**Prepared by:** Copilot Coding Agent  
**Last Updated:** November 14, 2025  
**Version:** 1.0
