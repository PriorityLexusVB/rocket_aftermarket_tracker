# Scheduling & Assignments Audit - Executive Summary

**Date**: 2025-11-15  
**Status**: ✅ **COMPLIANT** - Codebase follows vendor-only scheduling rule  
**Full Report**: See `SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md`

---

## Quick Answer: Does the code follow the rules?

**YES** ✅ with minor documentation improvements needed.

### The Rule
"Calendar scheduling is vendor-based only. Sales consultant, finance manager, and delivery coordinator are metadata only, never required for scheduling and never used in conflict checks."

### What We Found

#### ✅ **WORKING CORRECTLY**

1. **Database Schema**
   - `job_parts` table has `vendor_id`, `scheduled_start_time`, `scheduled_end_time` ✅
   - NO people fields in `job_parts` ✅
   - People fields in `jobs` table are metadata only ✅

2. **Calendar RPCs**
   - `get_jobs_by_date_range`: Uses ONLY vendor_id + time windows ✅
   - `check_vendor_schedule_conflict`: Uses ONLY vendor_id + time windows ✅
   - NO assignment fields in conflict logic ✅

3. **Forms**
   - DealFormV2: Sales/Finance/DC fields are optional (not validated) ✅
   - CreateModal: Staff fields are optional (not validated) ✅
   - All forms allow saving with null people assignments ✅

4. **Calendar Views**
   - Flow Management Center: Filters by vendor + time only ✅
   - Active Appointments: Displays assignments but doesn't require them ✅
   - SnapshotView: Conflict detection uses vendor_id only ✅
   - Jobs with null assignments are fully visible and usable ✅

---

## Deprecated Scheduling Fields

**⚠️ IMPORTANT**: The following fields still exist in the schema but are **no longer used** by calendar logic:

- `jobs.scheduled_start_time`
- `jobs.scheduled_end_time`

### Current State
- Migration `20251114163000_calendar_line_item_scheduling.sql` moved all calendar scheduling logic to `job_parts` table
- Calendar RPCs (`get_jobs_by_date_range`, `check_vendor_schedule_conflict`) read from `job_parts.scheduled_start_time` and `job_parts.scheduled_end_time`
- The job-level scheduling columns are kept only for **backward compatibility** and **legacy reporting**

### For New Features
**DO NOT** rely on `jobs.scheduled_start_time` or `jobs.scheduled_end_time` for:
- Calendar display logic
- Conflict detection
- Scheduling queries
- Time-based filtering

Instead, use the line-item scheduling fields:
- `job_parts.scheduled_start_time`
- `job_parts.scheduled_end_time`

These fields enable per-line-item scheduling for off-site work and complex jobs.

---

## Issues Found (1 Medium, 4 Low)

### 🟡 MEDIUM Priority

**Issue**: "Quick Assign" sets status='scheduled' without actual scheduling  
**Location**: `src/pages/currently-active-appointments/index.jsx:443`  
**Problem**: When a job is assigned to staff, it sets `job_status='scheduled'` but doesn't add vendor or time windows. This creates jobs with "scheduled" status that aren't actually scheduled on the calendar.

**Fix**: Change status to 'assigned' or 'pending' instead, OR require actual scheduling data before allowing 'scheduled' status.

**Impact**: Creates confusion about what "scheduled" means (status flag vs actual calendar scheduling).

---

### 🟢 LOW Priority Issues

#### 1. Deprecated Job-Level Scheduling Fields
**Problem**: `jobs.scheduled_start_time` and `jobs.scheduled_end_time` exist but are no longer used (calendar switched to reading from `job_parts`).  
**Fix**: Add migration comment documenting deprecation, or drop the columns.  
**Impact**: Potential developer confusion.

#### 2. delivery_coordinator_id Not Yet Applied
**Problem**: Migration exists in `_hold_dec2025/` folder but hasn't been applied. Code references the field (43 times).  
**Fix**: Apply the migration or add feature flag.  
**Impact**: Could cause errors if code tries to write to non-existent column.

#### 3. Vendor ID Confusion
**Problem**: Both `jobs.vendor_id` and `job_parts.vendor_id` exist. Unclear which is used for conflicts.  
**Fix**: Document: jobs.vendor_id = primary vendor for conflicts, job_parts.vendor_id = per-line-item vendor for off-site work.  
**Impact**: Developer confusion.

#### 4. assigned_to Auto-Default
**Problem**: If the Sales field is left blank, `assigned_to` defaults to current user instead of null.  
**Fix**: Change to null or make opt-in.  
**Impact**: Minor UX inconsistency.  
**Note**: Only delivery coordinators use this system, so default is to a delivery coordinator.

---

## Summary by Business Rule

| Rule Component | Compliance | Evidence |
|----------------|-----------|----------|
| Scheduling is vendor-based | ✅ YES | All calendar RPCs use vendor_id only |
| People fields are metadata | ✅ YES | No forms require them, all default to null |
| Never required for scheduling | ✅ YES | No validation enforces them |
| Never used in conflict checks | ✅ YES | check_vendor_schedule_conflict uses vendor_id only |

---

## Deferred / Future Items

### Held Migration: delivery_coordinator_id
- **Status**: Migration exists in `supabase/migrations/_hold_dec2025/20251222181000_add_delivery_coordinator.sql` but is **NOT applied** to live schema
- **Current State**: `jobs.delivery_coordinator_id` should be treated as **optional metadata only** and may not exist in older environments
- **Code References**: 43 instances in codebase reference this field
- **Future Action Required**:
  - If/when this field is needed in production, promote the migration from `_hold_dec2025/` into the main migrations folder
  - Must be done in a dedicated migration/PR with proper testing
  - Until then, treat this field as potentially non-existent

---

## Assignment Defaults

### Current Behavior
When creating a new job in `DealFormV2.jsx`:
- If the **Sales** field is left blank, `assigned_to` defaults to the **current user's ID** (line 267: `assigned_to: customerData?.assignedTo || user?.id`)
- **Important Context**: Only delivery coordinators have access to this system, so the default is effectively to a delivery coordinator, not a sales person

### Why This Is Acceptable
- Assignments are **metadata only** and do not affect scheduling or constraints
- Jobs can still be scheduled with vendor + time even if assignment fields are null or auto-defaulted
- **No validation requires** `assigned_to`, `finance_manager_id`, or `delivery_coordinator_id` for saving or scheduling
- The system rule: "Nothing should force assignments as a precondition for scheduling" remains intact

---

## Recommendations

### Do Immediately
1. Fix the "Quick Assign" status issue (change 'scheduled' to 'assigned' or require actual scheduling)

### Do Soon
1. Apply the delivery_coordinator_id migration or remove code references
2. Document which vendor_id is used for conflicts (jobs vs job_parts)

### Do Eventually
1. Drop deprecated job-level scheduling columns (after full testing)
2. Clarify assignment defaults (null vs current user)

---

## Code Statistics

- **Files Analyzed**: 85+
- **Migrations Reviewed**: 20+
- **Code References**: 161 (43 delivery_coordinator_id, 29 finance_manager_id, 89 assigned_to)
- **Forms Validated**: 3 (all compliant)
- **Calendar Views**: 3 (all compliant)
- **RPC Functions**: 2 (both compliant)

---

## Bottom Line

The system is architecturally sound. Scheduling and conflicts are correctly based on vendor + time only. The people assignment fields are properly treated as optional metadata. The only real issue is a status flag that gets set without corresponding scheduling data, which is an easy fix.

**No blocking issues. Safe to proceed with current architecture.**

---

For detailed analysis including file-by-file breakdown, schema validation, and line-by-line code examination, see:  
📄 **SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md**
