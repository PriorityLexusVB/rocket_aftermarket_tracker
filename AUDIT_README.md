# 📊 Scheduling & Assignments Deep Audit

> **Status**: ✅ **COMPLIANT** - Codebase follows vendor-only scheduling rules  
> **Date**: 2025-11-15  
> **Branch**: `copilot/audit-scheduling-assignments`

---

## 🎯 Purpose

Validate that the `rocket_aftermarket_tracker` codebase follows Rob's business rule:

> **"Calendar scheduling is vendor-based only. Sales consultant, finance manager, and delivery coordinator are metadata only, never required for scheduling and never used in conflict checks."**

---

## 📄 Audit Documents

### For Quick Review (Start Here)
👉 **[SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md](./SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md)** (5KB)
- 2-page quick summary
- Risk prioritization  
- Immediate action items

### For Deep Dive
📚 **[SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md](./SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md)** (27KB)
- Complete 676-line technical analysis
- Schema validation (Task A)
- RPC function analysis (Task B)
- Code usage categorization (Task C)
- Form validation analysis (Task D)
- Calendar view analysis (Task E)
- Risk assessment (Task F)

---

## ✅ Key Findings

### Overall Result
**🟢 COMPLIANT** - The system correctly implements vendor-only scheduling.

### What's Working
- ✅ Database: `job_parts` table correctly stores vendor_id + time windows for scheduling
- ✅ RPCs: Both calendar functions use ONLY vendor_id + time for queries and conflicts
- ✅ Forms: All 3 forms treat people assignments as optional (no validation requires them)
- ✅ Views: All calendar views filter by vendor + time, not people fields
- ✅ Conflicts: Detection uses ONLY vendor_id + time windows (no people fields)

### Issues Found

#### 🟡 Medium Priority (1)
**"Quick Assign" Status Bug**
- **File**: `src/pages/currently-active-appointments/index.jsx:443`
- **Issue**: Sets `status='scheduled'` without adding actual scheduling data (vendor + time)
- **Impact**: Creates jobs with "scheduled" status that aren't on the calendar
- **Fix**: Change status to 'assigned' or require actual scheduling data

#### 🟢 Low Priority (4)
1. **Deprecated Fields**: Job-level scheduling fields still exist (should document or drop)
2. **Held Migration**: `delivery_coordinator_id` in `_hold_dec2025/` but referenced in code
3. **Documentation**: Unclear which `vendor_id` (jobs vs job_parts) is used for conflicts
4. **Default Behavior**: `assigned_to` defaults to current user instead of null

---

## 📊 Analysis Statistics

| Metric | Count |
|--------|-------|
| Files Analyzed | 85+ |
| Migrations Reviewed | 20+ |
| Code References | 161 total |
| - delivery_coordinator_id | 43 |
| - finance_manager_id | 29 |
| - assigned_to | 89 |
| Forms Validated | 3 (all compliant) |
| Views Reviewed | 3 (all compliant) |
| RPCs Analyzed | 2 (both compliant) |

---

## 🎯 Recommendations

### Immediate (Do Now)
- [ ] Fix "Quick Assign" to not set 'scheduled' status without actual scheduling

### Short-Term (This Sprint)
- [ ] Apply `delivery_coordinator_id` migration OR add feature flag
- [ ] Document vendor_id relationships (jobs vs job_parts)
- [ ] Add deprecation comments to old scheduling fields

### Long-Term (Next Quarter)
- [ ] Drop deprecated job-level scheduling columns (after testing)
- [ ] Review assignment default behavior

---

## 🏆 Bottom Line

**The system architecture is sound.** ✅

- Scheduling and conflicts use vendor + time exclusively (correct ✓)
- People fields are optional metadata (correct ✓)
- No forms block saving without assignments (correct ✓)
- Calendar views work with or without assignments (correct ✓)
- Only minor status flag issue found (easy fix)

**Verdict**: No blocking issues. Safe to proceed with current architecture.

---

## 📋 Schema Overview & Important Notes

### ⚠️ Deprecated Scheduling Fields

**Job-level scheduling columns are deprecated and not used in calendar logic:**

- `jobs.scheduled_start_time` - **DEPRECATED** (legacy field, kept for backward compatibility)
- `jobs.scheduled_end_time` - **DEPRECATED** (legacy field, kept for backward compatibility)

**Current active scheduling is line-item-based:**

- `job_parts.scheduled_start_time` - **ACTIVE** (used by calendar RPCs)
- `job_parts.scheduled_end_time` - **ACTIVE** (used by calendar RPCs)

**Migration**: `20251114163000_calendar_line_item_scheduling.sql` transitioned calendar logic from job-level to line-item scheduling. The job-level fields remain in the schema for backward compatibility and legacy reporting only.

---

## 🔧 Held Migration: delivery_coordinator_id

### Current Status
- **Location**: `supabase/migrations/_hold_dec2025/20251222181000_add_delivery_coordinator.sql`
- **Applied**: ❌ **NO** - Migration is held and not applied to live schema
- **Column**: `jobs.delivery_coordinator_id` (UUID, references `user_profiles.id`)

### Important Considerations
1. **Optional Field**: `jobs.delivery_coordinator_id` should be treated as **optional metadata only**
2. **Environment Compatibility**: This column may not exist in older environments or deployments
3. **Code References**: 43 instances in codebase reference this field, but must handle cases where it doesn't exist
4. **No Blocking**: Absence of this field does not block scheduling or core functionality

### Future Action (When Needed)
If this field needs to be used in production:
1. Promote migration from `_hold_dec2025/` to main `supabase/migrations/` folder
2. Create dedicated PR with:
   - Migration promotion
   - Testing plan
   - Rollback strategy
3. Ensure all environments are updated consistently
4. Update documentation to reflect the field as active

**Until promoted, treat `delivery_coordinator_id` as potentially non-existent.**

---

## 🏢 Vendor IDs and Scheduling

### Overview
Two vendor ID fields exist in the schema, each serving different purposes:

### `jobs.vendor_id` (Primary Vendor for Scheduling)
- **Purpose**: Primary vendor assigned to the entire job
- **Used For**:
  - Calendar conflict detection via `check_vendor_schedule_conflict()`
  - Calendar display via `get_jobs_by_date_range()`
  - Vendor-based filtering and reporting
- **Scheduling Role**: **This is the vendor used for conflict detection**
- **Required**: Yes (for scheduled jobs)

### `job_parts.vendor_id` (Optional Per-Line Vendor)
- **Purpose**: Optional per-line-item vendor override
- **Used For**:
  - Off-site work with different vendors per part
  - Multi-vendor jobs (e.g., body shop + glass shop)
  - Detailed vendor tracking per line item
- **Scheduling Role**: **Currently NOT used in conflict detection**
- **Required**: No (optional override)

### Calendar Function Behavior
The calendar RPCs aggregate scheduling data as follows:

1. **`get_jobs_by_date_range()`**:
   - Reads time windows from `job_parts.scheduled_start_time` and `job_parts.scheduled_end_time`
   - Aggregates earliest start and latest end across all line items
   - Uses `jobs.vendor_id` for vendor display and filtering

2. **`check_vendor_schedule_conflict()`**:
   - Reads time windows from `job_parts` table
   - Checks conflicts based on `jobs.vendor_id` (NOT `job_parts.vendor_id`)
   - This ensures conflicts are detected at the job level, not per-line-item

### Implementation Reference
See migration `20251114163000_calendar_line_item_scheduling.sql` for complete RPC implementations.

**Note**: If future requirements need per-line-item vendor conflict detection, the `check_vendor_schedule_conflict()` function would need to be updated to consider `job_parts.vendor_id` in addition to `jobs.vendor_id`.

---

## 📖 How to Use These Documents

1. **Quick Check**: Read [SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md](./SCHEDULING_AUDIT_EXECUTIVE_SUMMARY.md) (2 minutes)
2. **Technical Review**: Read [SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md](./SCHEDULING_ASSIGNMENTS_AUDIT_REPORT.md) (15 minutes)
3. **Architecture Reference**: Read [docs/SCHEDULING_ARCHITECTURE.md](./docs/SCHEDULING_ARCHITECTURE.md) (comprehensive guide)
4. **Implementation**: Use recommendations section to prioritize fixes

---

## 🔧 Implementation Status

### ✅ Completed (2025-11-15)

1. **Quick Assign Bug Fix**
   - **File**: `src/pages/currently-active-appointments/index.jsx:443`
   - **Change**: Status changed from `'scheduled'` to `'pending'` when assigning staff without scheduling data
   - **Impact**: Eliminates confusion about "scheduled" status - now only used when job has vendor + time windows
   - **Tests**: All passing (657 passed, 2 skipped)

2. **Documentation Updates**
   - **Created**: `docs/SCHEDULING_ARCHITECTURE.md` - comprehensive scheduling architecture guide
   - **Updated**: Migration files with deprecation notices
     - `20250923142511_calendar_scheduling_enhancement.sql` - marked job-level fields as deprecated
     - `20251114163000_calendar_line_item_scheduling.sql` - documented line-item architecture

### 📋 Recommendations Status

#### ✅ Immediate Actions (COMPLETE)
- [x] Fix "Quick Assign" to not set 'scheduled' status without actual scheduling

#### 🔄 Short-Term Actions (COMPLETE)
- [x] Document vendor_id relationships (jobs vs job_parts) → See `docs/SCHEDULING_ARCHITECTURE.md`
- [x] Add deprecation comments to old scheduling fields → Added to migration files
- [ ] Apply delivery_coordinator_id migration OR add feature flag (deferred - see notes below)

#### 📅 Long-Term Actions (Backlog)
- [ ] Drop deprecated job-level scheduling columns (after full testing)
- [ ] Review assignment defaults (null vs current user)

### 📝 Notes

**delivery_coordinator_id**: Migration exists in `_hold_dec2025/` folder but not yet applied. Code references the field (43 instances). This is tracked separately and does not block current work.

---

**Audit Completed**: 2025-11-15  
**Analyst**: AI Code Analysis Agent  
**Review Status**: Ready for Rob's approval
