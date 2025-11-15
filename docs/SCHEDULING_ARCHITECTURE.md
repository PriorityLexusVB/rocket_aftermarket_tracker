# Scheduling Architecture & Vendor Relationships

**Date**: 2025-11-15  
**Status**: Documentation of Current Architecture  
**Related**: SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md, SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md

---

## Overview

This document clarifies the scheduling architecture in the Aftermarket Tracker system, with a focus on vendor relationships and the separation between scheduling (vendor + time) and assignments (people metadata).

---

## Core Business Rule

> **Calendar scheduling is vendor-based only. Sales consultant, finance manager, and delivery coordinator are metadata only, never required for scheduling and never used in conflict checks.**

This rule ensures that:
- Scheduling conflicts are based on vendor availability and time windows
- Jobs can be scheduled without assigning staff members
- Staff assignments are optional metadata that don't affect calendar operations

---

## Scheduling Data Model

### Two-Level Vendor Architecture

The system uses a **two-level vendor architecture** to support both primary vendors and per-line-item vendors:

#### 1. Job-Level Vendor (`jobs.vendor_id`)

**Purpose**: Primary vendor for the overall job  
**Usage**: Calendar conflict checks, vendor assignment queries  
**Required**: Yes (for scheduling)

```sql
-- jobs table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY,
    vendor_id UUID REFERENCES vendors(id), -- Primary vendor for conflict checks
    -- ... other fields
);
```

**Use cases**:
- Calendar RPCs use `jobs.vendor_id` to query scheduled work
- Conflict detection checks if vendor is already booked at that time
- Vendor assignment views filter by `jobs.vendor_id`

#### 2. Line-Item Vendor (`job_parts.vendor_id`)

**Purpose**: Per-line-item vendor for off-site work  
**Usage**: Track which vendor handles specific parts/services  
**Required**: No (optional for off-site work)

```sql
-- job_parts table
CREATE TABLE public.job_parts (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    vendor_id UUID REFERENCES vendors(id), -- Optional per-item vendor
    scheduled_start_time TIMESTAMPTZ,      -- Line-item scheduling
    scheduled_end_time TIMESTAMPTZ,        -- Line-item scheduling
    -- ... other fields
);
```

**Use cases**:
- Off-site work where different vendors handle different parts
- Special services that require specific vendor expertise
- Tracking vendor-specific scheduling per line item

### Relationship Summary

| Field | Level | Purpose | Conflict Checks | Required |
|-------|-------|---------|----------------|----------|
| `jobs.vendor_id` | Job | Primary vendor | ✅ YES | YES |
| `job_parts.vendor_id` | Line Item | Per-item vendor | ❌ NO | NO |

**Important**: Calendar conflict checks use **`jobs.vendor_id`** only, not per-line-item vendors. This ensures vendor availability is checked at the job level.

---

## Scheduling vs Assignment

### Scheduling (Required for Calendar)

**Definition**: Vendor + time window assignment  
**Fields**:
- `jobs.vendor_id` (primary vendor)
- `job_parts.scheduled_start_time` (per line item)
- `job_parts.scheduled_end_time` (per line item)

**Status**: A job is "scheduled" when:
1. It has a valid `vendor_id`
2. One or more line items have `scheduled_start_time` and `scheduled_end_time`
3. Job status is `'scheduled'`

### Assignment (Optional Metadata)

**Definition**: Staff member association  
**Fields**:
- `jobs.assigned_to` (Sales Consultant)
- `jobs.finance_manager_id` (Finance Manager)
- `jobs.delivery_coordinator_id` (Delivery Coordinator)

**Status**: A job is "assigned" when:
- It has `assigned_to` set (staff member)
- It may or may not be scheduled yet
- Job status should be `'pending'` or `'in_progress'`

### Status Semantics

| Status | Meaning | Requires |
|--------|---------|----------|
| `draft` | Initial creation | Nothing |
| `pending` | Created, optionally assigned | Job data |
| `scheduled` | On calendar with time windows | vendor_id + time windows |
| `in_progress` | Work started | vendor_id + time windows |
| `quality_check` | Work complete, being reviewed | vendor_id + time windows |
| `delivered` | Delivered to customer | vendor_id + time windows |
| `completed` | Fully complete | vendor_id + time windows |
| `cancelled` | Cancelled | Nothing |

**Important**: Setting status to `'scheduled'` without actual scheduling data (vendor + time) creates confusion. Always ensure vendor and time windows exist before using `'scheduled'` status.

---

## Calendar RPCs

### `get_jobs_by_date_range`

**Purpose**: Retrieve jobs scheduled within a date range  
**Filters by**: 
- `job_parts.scheduled_start_time` / `scheduled_end_time` (time windows)
- `jobs.vendor_id` (vendor filter, optional)
- `jobs.job_status` (status filter, optional)

**Does NOT filter by**:
- `jobs.assigned_to` (staff assignment)
- `jobs.finance_manager_id` (staff assignment)
- `jobs.delivery_coordinator_id` (staff assignment)

```sql
-- Simplified logic
SELECT 
    j.*,
    v.name as vendor_name,
    MIN(jp.scheduled_start_time) as scheduled_start_time,
    MAX(jp.scheduled_end_time) as scheduled_end_time
FROM jobs j
LEFT JOIN vendors v ON v.id = j.vendor_id
LEFT JOIN job_parts jp ON jp.job_id = j.id
WHERE 
    jp.scheduled_start_time IS NOT NULL
    AND jp.scheduled_start_time >= start_date
    AND jp.scheduled_end_time <= end_date
    AND (vendor_filter IS NULL OR j.vendor_id = vendor_filter)
GROUP BY j.id;
```

### `check_vendor_schedule_conflict`

**Purpose**: Detect scheduling conflicts for a vendor  
**Checks**:
- Same `jobs.vendor_id`
- Overlapping time windows in `job_parts`

**Does NOT check**:
- Staff assignments (any people fields)

```sql
-- Simplified logic
SELECT COUNT(*) > 0 as has_conflict
FROM jobs j
INNER JOIN job_parts jp ON jp.job_id = j.id
WHERE 
    j.vendor_id = vendor_uuid
    AND j.id != exclude_job_id
    AND (
        -- Time overlap conditions
        (jp.scheduled_start_time, jp.scheduled_end_time) OVERLAPS (start_time, end_time)
    );
```

---

## Deprecated Fields

### Job-Level Scheduling Fields (DEPRECATED)

**Fields**:
- `jobs.scheduled_start_time`
- `jobs.scheduled_end_time`

**Status**: ⚠️ DEPRECATED as of migration `20251114163000`  
**Reason**: Calendar system migrated to line-item scheduling via `job_parts`

**Migration**: `20251114163000_calendar_line_item_scheduling.sql`  
- Updated `get_jobs_by_date_range` to read from `job_parts` instead
- Updated `check_vendor_schedule_conflict` to read from `job_parts` instead

**Current State**:
- Columns still exist in schema for backward compatibility
- No application code writes to them
- Calendar RPCs read from `job_parts` only

**Recommendation**:
- Document as deprecated in schema comments
- Consider dropping in future major version
- Add application-level checks to prevent accidental writes

---

## Form Validation

All deal/job creation forms treat people assignments as **optional**:

### DealFormV2.jsx

**Validation (Step 1)**:
```javascript
const validateStep1 = () => {
  return (
    customerData?.customerName?.trim()?.length > 0 && 
    customerData?.jobNumber?.trim()?.length > 0
  )
}
```

✅ Does NOT require: `assigned_to`, `delivery_coordinator_id`, `finance_manager_id`

**Validation (Step 2)**:
```javascript
const validateStep2 = () => {
  if (lineItems?.length === 0) return false
  
  return lineItems?.every((item) => {
    if (!item?.productId || !item?.unitPrice) return false
    if (item?.requiresScheduling && !item?.dateScheduled) return false
    if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) return false
    return true
  })
}
```

✅ Does NOT require people fields  
✅ Requires scheduling data IF `requiresScheduling` is true

### CreateModal.jsx (Calendar)

**Validation**:
- ✅ Validates: stock_number, customer name, vehicle, promised_date, line items
- ❌ Does NOT validate: sales_person, delivery_coordinator, finance_manager

---

## Assignment Operations

### Quick Assign (Fixed in v1.0.1)

**Function**: `handleQuickAssignJob` in `src/pages/currently-active-appointments/index.jsx`

**Previous Behavior** (BUG):
```javascript
// INCORRECT - sets 'scheduled' without scheduling data
{
  assigned_to: staffId,
  job_status: 'scheduled',  // ❌ Wrong
}
```

**Current Behavior** (FIXED):
```javascript
// CORRECT - sets 'pending' for assignment without scheduling
{
  assigned_to: staffId,
  job_status: 'pending',  // ✅ Correct
}
```

**Rationale**: 
- Assignment doesn't add vendor or time windows
- Status 'scheduled' should only be used when job is on calendar
- Status 'pending' correctly indicates assigned but not yet scheduled

### Bulk Assignment

**Function**: `handleBulkAssignment`

**Behavior**:
```javascript
{
  assigned_to: staffId,
  // Does NOT change job_status
}
```

✅ Correct - only updates assignment, doesn't imply scheduling

---

## Best Practices

### Creating a Job

1. **Minimal** (no scheduling):
   ```javascript
   {
     job_number: "JOB-001",
     customer_name: "John Doe",
     job_status: "pending",
     // assigned_to: optional
   }
   ```

2. **With Assignment** (no scheduling):
   ```javascript
   {
     job_number: "JOB-001",
     customer_name: "John Doe",
     assigned_to: staff_uuid,
     job_status: "pending",  // Still pending, not scheduled
   }
   ```

3. **With Scheduling** (on calendar):
   ```javascript
   {
     job_number: "JOB-001",
     customer_name: "John Doe",
     vendor_id: vendor_uuid,
     job_status: "scheduled",
     // Line items with scheduled_start_time and scheduled_end_time
   }
   ```

### Status Transitions

```
draft → pending → scheduled → in_progress → quality_check → delivered → completed
                     ↓
                  cancelled
```

**Rules**:
- `draft` → `pending`: When job data is complete
- `pending` → `scheduled`: When vendor + time windows are added
- `scheduled` → `in_progress`: When work starts
- `in_progress` → `quality_check`: When work is done
- `quality_check` → `delivered`: When approved and delivered
- `delivered` → `completed`: When fully complete

**Never**:
- ❌ `pending` → `scheduled` without vendor + time windows
- ❌ `assigned_to` changing affects status automatically

---

## Conflict Detection

### Vendor Conflicts (IMPLEMENTED)

**Check**: Same vendor, overlapping time windows  
**Logic**: Uses `jobs.vendor_id` and `job_parts` time windows  
**RPC**: `check_vendor_schedule_conflict`

```javascript
// Example usage
const hasConflict = await calendarService.checkVendorScheduleConflict({
  vendorId: vendor_uuid,
  startTime: "2025-01-15T09:00:00Z",
  endTime: "2025-01-15T11:00:00Z",
  excludeJobId: current_job_uuid  // Optional, for edits
});
```

### Staff Conflicts (NOT IMPLEMENTED)

**Status**: ❌ Not implemented (by design)  
**Reason**: Staff assignments are metadata only, not used for scheduling

---

## Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| `20250922170950` | 2025-09-22 | Initial jobs table with vendor_id |
| `20250923142511` | 2025-09-23 | Added job-level scheduling fields |
| `20250116000000` | 2025-01-16 | Added requires_scheduling to job_parts |
| `20250117000000` | 2025-01-17 | Added line-item scheduling to job_parts |
| `20251106000000` | 2025-11-06 | Added vendor_id to job_parts |
| `20251114163000` | 2025-11-14 | Migrated calendar to line-item scheduling |

**Current State**: Line-item scheduling is active, job-level fields deprecated

---

## References

- **Audit Report**: SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md
- **Executive Summary**: SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md
- **Audit README**: AUDIT_README.md
- **Calendar Migration**: `supabase/migrations/20251114163000_calendar_line_item_scheduling.sql`
- **Vendor Relationship**: `docs/IMPLEMENTATION_SUMMARY_VENDOR_RELATIONSHIP.md`

---

**Document Maintained By**: Development Team  
**Last Updated**: 2025-11-15  
**Version**: 1.0
