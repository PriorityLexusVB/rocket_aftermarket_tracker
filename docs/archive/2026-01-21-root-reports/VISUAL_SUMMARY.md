# Dropdowns and Deals Error Handling - Visual Summary

## Problem → Solution Flow

### Before This PR ❌

```
User visits /deals page
    ↓
App queries job_parts with vendor relationship
    ↓
Database missing job_parts.vendor_id column
    ↓
PostgREST returns 400: "column vendor_id does not exist"
    ↓
App crashes with error banner
    ↓
User sees broken page
```

### After This PR ✅

```
User visits /deals page
    ↓
App queries job_parts with vendor relationship
    ↓
Database missing job_parts.vendor_id column
    ↓
PostgREST returns 400: "column vendor_id does not exist"
    ↓
dealService detects error, disables vendor_id capability
    ↓
dealService retries WITHOUT vendor_id column
    ↓
Query succeeds, data returned
    ↓
Capability persisted to sessionStorage
    ↓
User sees working page (without per-line vendor info)
```

## Capability Detection System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Component    →    Service Layer    →    Capability Layer   │
│  (UI/Forms)        (API calls)           (Detection)         │
│                                                              │
│  DealForm     →    dealService     →    JOB_PARTS_VENDOR_ID │
│  Dropdowns    →    dropdownService →    USER_PROFILES_NAME   │
│  DebugAuth    →    tenantService   →    (fallback logic)    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Capability Cache                          │
│                    (sessionStorage)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • cap_jobPartsVendorId: true/false                     │ │
│  │ • cap_jobPartsTimes: true/false                        │ │
│  │ • cap_userProfilesName: true/false                     │ │
│  │ • cap_userProfilesVendorId: true/false                 │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                            │
│                    (Supabase/PostgREST)                      │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

### Staff Dropdown Query

```
┌──────────────────────────┐
│  getStaff() called       │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│  Build query with current caps       │
│  • name (or full_name/display_name)  │
│  • vendor_id (if available)          │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────┐
│  Execute query           │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
    Success    Error (400)
       │           │
       ↓           ↓
 Return data   Detect error type
               (column missing)
                     │
                     ↓
              ┌────────────────┐
              │ Downgrade cap: │
              │ vendor_id OFF  │
              └────────┬───────┘
                       │
                       ↓
              ┌────────────────┐
              │ Retry (max 3x) │
              └────────┬───────┘
                       │
                 ┌─────┴─────┐
                 │           │
              Success    Still failing
                 │           │
                 ↓           ↓
           Return data  Try fuzzy query
```

### Deal Service Query with Relationship

```
┌──────────────────────────┐
│  getAllDeals() called    │
└────────────┬─────────────┘
             │
             ↓
┌────────────────────────────────────────┐
│  Build query with job_parts→vendors    │
│  relationship if available             │
└────────────┬───────────────────────────┘
             │
             ↓
┌──────────────────────────┐
│  Execute query           │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
    Success    Error
       │           │
       ↓           ↓
 Return data   ┌──────────────────────┐
               │ Detect error type:   │
               │ - Column missing?    │
               │ - Relationship gone? │
               └─────────┬────────────┘
                         │
                   ┌─────┴──────┐
                   │            │
            Column Missing   Relationship
                   │         Missing
                   ↓            ↓
         ┌──────────────┐  ┌──────────────┐
         │ Disable col  │  │ Disable rel  │
         │ capability   │  │ capability   │
         └──────┬───────┘  └──────┬───────┘
                │                 │
                └────────┬────────┘
                         │
                         ↓
                ┌────────────────┐
                │ Retry query    │
                │ (max 4x)       │
                └────────┬───────┘
                         │
                    ┌────┴────┐
                    │         │
                 Success   Fail
                    │         │
                    ↓         ↓
              Return data  Throw error
                           (with guidance)
```

## Database Setup Flow

### Organization & User Attachment

```
┌─────────────────────────────────────────────┐
│  Run setup_dropdowns_and_deals.sql          │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  1. Upsert Organization                     │
│     INSERT INTO organizations               │
│     ON CONFLICT DO UPDATE                   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  2. Find E2E User in auth.users             │
│     WHERE email = 'rob.brasco@...'          │
└────────────────┬────────────────────────────┘
                 │
            ┌────┴────┐
            │         │
        Found     Not Found
            │         │
            ↓         ↓
┌───────────────────┐  ┌──────────────────┐
│  3. Upsert        │  │  Warning logged  │
│     user_profile  │  │  Skip profile    │
│     with org_id   │  └──────────────────┘
└────────┬──────────┘
         │
         ↓
┌─────────────────────────────────────────────┐
│  4. Add missing columns (if needed)         │
│     • job_parts.vendor_id                   │
│     • job_parts.scheduled_start_time        │
│     • job_parts.scheduled_end_time          │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  5. Add FK constraint (if missing)          │
│     job_parts_vendor_id_fkey                │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  6. Verification Queries                    │
│     • Check org_id populated                │
│     • Check columns exist                   │
│     • Check FK constraint                   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  7. Reload PostgREST Schema Cache           │
│     NOTIFY pgrst, 'reload schema'           │
└─────────────────────────────────────────────┘
```

## Component Interaction Map

```
┌──────────────────────────────────────────────────────────────┐
│                         User Interface                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  /debug-auth  →  Shows org_id, session, dropdown counts      │
│  /deals       →  Lists deals with staff/vendor info          │
│  /deal/new    →  Form with staff/product/vendor dropdowns    │
│  /deal/:id    →  Edit form with populated dropdowns          │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                         React Hooks                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  useTenant       →  Fetches org_id (by id OR email)          │
│  useDropdownData →  Calls dropdown services                  │
│  useDealForm     →  Manages deal form state                  │
│  useAutosave     →  Debounced save (600ms)                   │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                         Services                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  dropdownService  →  getStaff, getVendors, getProducts       │
│  dealService      →  getAllDeals, getDeal, createDeal        │
│  tenantService    →  listStaffByOrg, listVendorsByOrg        │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                         Utilities                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  safeSelect           →  Error classification, RLS handling  │
│  userProfileName      →  Capability management (name cols)   │
│  Capability Flags     →  Runtime feature detection           │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                    Supabase Client                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  supabase.from()     →  Query builder                        │
│  .select()           →  Column/relationship selection        │
│  .throwOnError()     →  Error propagation                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Capability States

### Full Schema (All Features Available)

```
✅ job_parts.vendor_id          → Per-line vendor assignment
✅ job_parts.scheduled_*        → Per-line time windows
✅ user_profiles.name           → Best display name
✅ user_profiles.vendor_id      → Vendor-scoped staff queries
✅ job_parts→vendors FK         → Nested vendor data
```

### Partial Schema (Graceful Degradation)

```
❌ job_parts.vendor_id          → Use product.vendor_id fallback
❌ job_parts.scheduled_*        → Use job-level times instead
✅ user_profiles.full_name      → Second-best display name
❌ user_profiles.vendor_id      → Omit vendor scoping
❌ job_parts→vendors FK         → Aggregate from product vendors
```

### Minimal Schema (Core Functions Only)

```
❌ job_parts.vendor_id          → Vendor from product only
❌ job_parts.scheduled_*        → Job-level scheduling only
✅ user_profiles.email          → Email as fallback display
❌ user_profiles.vendor_id      → No vendor filtering
❌ job_parts→vendors FK         → No nested vendor queries
```

## Testing Coverage

```
┌────────────────────────────────────────────┐
│  Unit Tests (376 passing)                  │
├────────────────────────────────────────────┤
│  ✅ dealService capability detection       │
│  ✅ dropdownService retry logic            │
│  ✅ userProfileName fallback cascade       │
│  ✅ safeSelect error classification        │
│  ✅ useTenant email fallback               │
│  ✅ Form adapters (mapFormToDb)            │
│  ✅ Vehicle description derivation         │
│  ✅ Vendor aggregation logic               │
│  ✅ Line item normalization                │
│  ✅ Loaner assignment                      │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Integration Tests (E2E ready)             │
├────────────────────────────────────────────┤
│  🔜 debug-auth page (org_id visible)       │
│  🔜 deal-form dropdowns (populated)        │
│  🔜 deal-staff-dropdowns (persistence)     │
└────────────────────────────────────────────┘
```

## Deployment Checklist

```
Pre-Deployment
  ✅ All unit tests passing (376/376)
  ✅ Build successful
  ✅ Lint passing (0 errors)
  ✅ TypeCheck passing
  ✅ Security scan clean (CodeQL)
  ✅ Documentation complete

Database Setup
  ☐ Run setup_dropdowns_and_deals.sql
  ☐ Verify organization created
  ☐ Verify E2E user attached (org_id populated)
  ☐ Verify columns added (vendor_id, scheduled_*)
  ☐ Verify FK constraint added

Post-Deployment Verification
  ☐ Visit /debug-auth
  ☐ Confirm session.user.id visible
  ☐ Confirm profile.org_id NOT null
  ☐ Confirm 4 org counts showing numbers
  ☐ Visit /deals
  ☐ Confirm no 400 errors in console
  ☐ Confirm deals list loads
  ☐ Create new deal
  ☐ Confirm staff dropdowns populate
  ☐ Confirm no React prop warnings

Rollback Plan (if needed)
  ☐ Revert branch merge
  ☐ Clear sessionStorage on client
  ☐ Database changes are idempotent (safe to leave)
```
