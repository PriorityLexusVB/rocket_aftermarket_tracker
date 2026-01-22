# Dropdowns and Deals Error Handling - Implementation Summary

## Overview

This PR eliminates dropdown and deals list 400 errors, improves error handling, and ensures graceful capability degradation when database schema differs from expectations.

## Changes Made

### 1. Enhanced useTenant Hook (`src/hooks/useTenant.js`)

- **Email Fallback**: Added fallback to lookup org_id by email when user.id lookup returns null
- **Network Retry**: Added short retry (max 1 attempt) for transient "Failed to fetch" network errors
- **RLS Handling**: Treats RLS/permission errors as non-fatal (returns orgId=null instead of crashing)
- **Improved Dependencies**: Hook now depends on both `user?.id` and `user?.email` to trigger re-fetches

### 2. Button Component Prop Warnings Fix (`src/components/ui/Button.jsx`)

- **Prop Destructuring**: Explicitly destructures `iconName` and `iconPosition` props
- **DOM Cleanliness**: Prevents these props from being forwarded to the DOM `<button>` element
- **Eliminates Warnings**: Resolves React warnings about unrecognized DOM properties

### 3. Enhanced safeSelect Utility (`src/lib/supabase/safeSelect.js`)

- **Error Classification**: Categorizes errors into types: `missing_column`, `missing_relationship`, `rls`, `permission`, `unknown`
- **RLS Tolerance**: Returns empty array `[]` for RLS/permission errors instead of throwing (when `allowRLS: true`)
- **Structured Error Info**: Returns detailed error objects with `type` and `details` for capability toggles
- **Detail Extraction**: Extracts column/table names from error messages for debugging

### 4. Production Logging Cleanup (`src/lib/supabase.js`)

- **Dev-Only Logs**: Guards "Supabase Environment Check" with `if (import.meta.env.DEV)`
- **Reduced Noise**: Eliminates console logs in production builds

### 5. Staff Dropdown Enhancements (`src/services/dropdownService.js`)

- **Retry Logic**: Implements max 3 retry attempts in `getStaff` exact query
- **Capability Degradation**: Automatically downgrades vendor_id and name column capabilities on errors
- **Dynamic Recomputation**: Recomputes `nameCol` after each capability downgrade
- **Better Error Messages**: Provides clear console warnings when capabilities are degraded

### 6. Deal Service Relationship Handling (`src/services/dealService.js`)

- **Relationship Fallback**: In `selectJoinedDealById`, detects missing vendor relationships and retries without them
- **Graceful Degradation**: Continues to function even when job_parts→vendors relationship is missing
- **Capability Persistence**: Stores capability flags in sessionStorage to avoid repeated probing

### 7. Database Setup Scripts

#### Migration: `supabase/migrations/20250117000000_add_job_parts_scheduling_times.sql`

- Adds `scheduled_start_time` TIMESTAMPTZ column to job_parts (idempotent)
- Adds `scheduled_end_time` TIMESTAMPTZ column to job_parts (idempotent)
- Creates performance indexes
- Includes verification checks

#### Setup Script: `scripts/setup_dropdowns_and_deals.sql`

Comprehensive idempotent script that:

1. **Organization Setup**:
   - Upserts `Priority Lexus VB` organization
   - Attaches E2E user (`e2e-user@example.com`) to organization
   - Sets user profile as active with department='Sales Consultants' and role='staff'

2. **Optional Schema Remediation**:
   - Adds `job_parts.vendor_id` column if missing
   - Adds `job_parts.scheduled_start_time` column if missing
   - Adds `job_parts.scheduled_end_time` column if missing
   - Creates FK constraint `job_parts_vendor_id_fkey` if missing
   - Creates performance indexes

3. **Verification**:
   - Verifies E2E user has non-null org_id
   - Verifies all schema columns exist
   - Provides clear output with ✓/✗ indicators

## How to Apply Database Changes

### Option 1: Via Supabase SQL Editor (Recommended)

1. Log into your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `scripts/setup_dropdowns_and_deals.sql`
4. Paste into SQL Editor and run
5. Review the console output for verification results

### Option 2: Via Supabase CLI

```bash
# From repository root
npm run db:seed-org

# Or directly with Supabase CLI
npx supabase db query --file ./scripts/setup_dropdowns_and_deals.sql
```

### Option 3: Via Migration (For Production)

1. Copy `supabase/migrations/20250117000000_add_job_parts_scheduling_times.sql` to your migrations folder
2. Run migrations via your deployment pipeline
3. Separately run the organization setup portion of `scripts/setup_dropdowns_and_deals.sql`

## Testing Results

### Unit Tests

- ✅ **376 tests passed** (2 skipped)
- ✅ All dealService tests pass
- ✅ All dropdown service tests pass
- ✅ All regression guards pass

### Build

- ✅ Production build successful
- ✅ No build errors or warnings

### Linting

- ✅ Passes with 0 errors
- ⚠️ 309 warnings (pre-existing, not introduced by this PR)

### Type Checking

- ✅ TypeScript compilation successful
- ✅ No type errors

## Verification Checklist

After applying the database script, verify the following:

### 1. E2E User Org Attachment

```sql
SELECT id, email, org_id, department, role, is_active
FROM public.user_profiles
WHERE email = 'e2e-user@example.com';
```

Expected: `org_id` should be a valid UUID (not NULL)

### 2. Schema Columns

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'job_parts'
  AND column_name IN ('vendor_id', 'scheduled_start_time', 'scheduled_end_time');
```

Expected: All three columns should be present

### 3. Foreign Key Constraint

```sql
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_name = 'job_parts_vendor_id_fkey';
```

Expected: Constraint should exist

### 4. UI Verification

1. Navigate to `/debug-auth`
2. Verify:
   - Session User ID is visible (data-testid="session-user-id")
   - Profile Org ID is visible and NOT "null" (data-testid="profile-org-id")
   - All four org counts show numbers (vendors, products, users, sms_templates)

3. Navigate to `/deals`
4. Verify:
   - No 400 errors in browser console
   - Deals list loads successfully
   - No "column does not exist" errors
   - No "relationship missing" errors

5. Create/Edit a deal
6. Verify:
   - Staff dropdowns populate (Sales Consultant, Delivery Coordinator, Finance Manager)
   - Product dropdown populates
   - Vendor dropdown populates
   - No React prop warnings in console

## Capability Flags

The application uses sessionStorage to cache capability detection:

### User Profiles

- `cap_userProfilesName` - Whether `name` column exists
- `cap_userProfilesFullName` - Whether `full_name` column exists
- `cap_userProfilesDisplayName` - Whether `display_name` column exists
- `cap_userProfilesVendorId` - Whether `vendor_id` column exists

### Job Parts

- `cap_jobPartsTimes` - Whether `scheduled_start_time`/`scheduled_end_time` columns exist
- `cap_jobPartsVendorId` - Whether `vendor_id` column exists
- `cap_jobPartsVendorRel` - Whether `job_parts→vendors` relationship exists

### Clearing Capability Cache

If you apply database changes and want the app to re-detect capabilities:

```javascript
// In browser console
sessionStorage.clear()
location.reload()
```

## Error Handling Flow

### Missing Columns

1. Initial query includes all possible columns
2. PostgREST returns 400 with "column X does not exist"
3. Service detects error, disables capability flag
4. Service retries query without the missing column
5. Capability flag persisted to sessionStorage

### Missing Relationships

1. Initial query includes nested relationship (e.g., `vendor:vendors(id,name)`)
2. PostgREST returns "Could not find relationship between X and Y"
3. Service detects error, disables relationship capability flag
4. Service retries query without the relationship
5. Data returned without nested vendor info

### RLS/Permission Errors

1. Query encounters RLS or permission denied error
2. `safeSelect` recognizes error type
3. Returns empty array `[]` instead of throwing
4. UI gracefully handles empty results
5. Warning logged to console (once)

## Backwards Compatibility

All changes are backwards compatible:

- ✅ Apps with full schema continue to work (all features available)
- ✅ Apps with partial schema gracefully degrade (missing features hidden/fallback)
- ✅ No breaking changes to existing APIs
- ✅ Existing tests pass without modification

## Security Considerations

- ✅ No new security vulnerabilities introduced
- ✅ RLS errors handled gracefully (no information leakage)
- ✅ SQL scripts use idempotent patterns (safe to run multiple times)
- ✅ FK constraints use appropriate CASCADE/SET NULL behaviors
- ✅ No hardcoded credentials or secrets

## Future Improvements

1. **Health Endpoint**: Consider adding a serverless function that probes schema and returns capability flags to avoid client-side detection
2. **Migration Tracking**: Add migration version tracking to skip capability detection when schema is known
3. **Error Monitoring**: Integrate with error tracking service (e.g., Sentry) to monitor capability downgrades in production
4. **Admin UI**: Create admin page to view/reset capability flags per environment

## Questions or Issues?

If you encounter issues:

1. Check browser console for capability downgrade warnings
2. Verify database setup script ran successfully
3. Clear sessionStorage and reload
4. Check `/debug-auth` for org_id status
5. Review Supabase logs for RLS/permission errors
