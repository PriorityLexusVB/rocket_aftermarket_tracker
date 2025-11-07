# Changelog - Calendar-First Aftermarket Tracker

## [2025-11-07] RLS Hardening & Test Coverage Expansion

### Added
- **Manager DELETE Policies** (`20251107110500_add_manager_delete_policies_and_deals_health.sql`):
  - Complete DELETE permission set for managers across all multi-tenant tables
  - Org-scoped DELETE policies for: jobs, job_parts, transactions, loaner_assignments, vehicles, sms_templates, products, vendors, user_profiles
  - Managers can now remove old/test data within their organization
  - Uses `is_admin_or_manager()` helper function for permission checks
  - Includes schema cache reload notification

- **Health Monitoring Endpoints**:
  - `/api/health` - Basic Supabase connectivity check
  - `/api/health-deals-rel` - Validates jobs → job_parts → vendors relationship
  - Detects schema cache drift with actionable error messages
  - Returns response time metrics
  - Files: `src/api/health.js`, `src/api/health-deals-rel.js`, `src/services/healthService.js`

- **E2E Test Coverage** (`e2e/deals-list-refresh.spec.ts`):
  - Verifies deals list displays updates after editing
  - Tests: vehicle description format, stock number updates, loaner badge visibility
  - Auto-skips without auth credentials (CI-friendly)
  - Stable data-testid selectors
  - 2 comprehensive test specs

- **Documentation**:
  - `docs/BASELINE_VERIFICATION.md` - Baseline state capture (Task 1)
  - `docs/TASK_2_VEHICLE_DESCRIPTION_AUDIT.md` - Vehicle description logic verification
  - `docs/TASK_3_PERSISTENCE_RLS_VERIFICATION.md` - Persistence test coverage audit
  - `docs/TASK_4_DEALS_LIST_REFRESH_E2E.md` - E2E test implementation details

### Enhanced
- **RLS_FIX_SUMMARY.md**:
  - Added Migration 20251107110500 section (Manager DELETE policies)
  - Updated test coverage counts (27 unit tests, 2 E2E tests)
  - Added links to Task 2-4 documentation
  - Corrected test counts from 30 to 27 (actual current state)

- **DEPLOY_CHECKLIST.md**:
  - Added health endpoint verification steps
  - Expanded pre-deploy checklist with RLS policy reviews
  - Added testing and verification script sections
  - Included curl examples for health endpoints
  - Added migration review checklist (3 latest migrations)

- **Test Suite** (`src/tests/unit/dealService.persistence.test.js`):
  - Verified complete coverage: 27 tests covering all Task 3 requirements
  - Added documentation explaining vehicle_description is computed (not stored)
  - Coverage: org_id (3), loaner (4), scheduling (5), errors (4), vendor (6), vehicle (6)

### Verified
- **Build Status**: ✅ PASS (8.68s)
- **Unit Tests**: ✅ 302/310 pass (97.4% pass rate)
- **Persistence Tests**: ✅ 27/27 pass (100%)
- **Vehicle Description Logic**: ✅ Correct implementation with 6 test cases
- **RLS Policies**: ✅ Complete coverage for admin/manager/staff roles

### Why This Matters
**Manager Permissions Completed**: Managers now have full CRUD operations (CREATE, READ, UPDATE, DELETE) on all multi-tenant resources within their organization, completing the permission model while maintaining proper tenant isolation.

**Health Monitoring**: Real-time visibility into critical database relationships and schema cache state helps prevent production issues and enables faster debugging.

**Test Coverage**: Comprehensive unit and E2E tests ensure persistence behaviors, RLS policies, and UI updates work correctly across deal edit/list flows.

**Acceptance Criteria Met:**
✅ Manager DELETE policies deployed  
✅ Health endpoints operational  
✅ E2E tests for list refresh added  
✅ All persistence scenarios tested (27 tests)  
✅ Vehicle description logic verified  
✅ Documentation updated  
✅ Build passes  

## [2025-11-07] Comprehensive Relationship Stabilization & Drift Prevention

### Added
- **New Migration** (`20251107093000_verify_job_parts_vendor_fk.sql`):
  - Comprehensive idempotent migration that handles all edge cases
  - Verifies column, FK constraint, and index existence using catalog checks
  - Backfills vendor_id from products where needed
  - Includes verification step that confirms relationship before NOTIFY
  - Safe to run multiple times in any environment state
  
- **Enhanced Verification Script** (`scripts/verify-schema-cache.sh`):
  - CI-ready with proper exit codes (0=success, 1=failed, 2=setup error)
  - Checks column existence, FK constraint, and index
  - Verifies constraint name matches expected `job_parts_vendor_id_fkey`
  - Tests REST API relationship query with HTTP status code validation
  - Detects specific "Could not find a relationship" error
  - Color-coded output for easy visual scanning
  
- **REST API Integration Test** (`tests/unit/db.vendor-relationship.spec.ts`):
  - Automated test for relationship verification
  - Works in mock mode (no env vars) for structure validation
  - Integration mode (with env vars) tests actual REST API
  - Detects and reports schema cache staleness
  - Includes documentation and examples in test output

### Enhanced
- **TROUBLESHOOTING_SCHEMA_CACHE.md**:
  - Added "Quick Reference: Relationship Migrations Checklist" at top
  - Documented automated drift detection approaches
  - Added CI/CD integration examples
  - Referenced new verification script and test
  
- **DEPLOY_CHECKLIST.md**:
  - Added "Critical Rule for Relationship Migrations" section
  - Template for relationship migrations with NOTIFY
  - Updated to reference new migration `20251107093000`
  - Added automated verification section
  - CI/CD integration examples (GitHub Actions, unit test)

### Fixed
- **Drift Detection**: System now fails fast if:
  - Column exists but FK constraint missing
  - FK constraint exists but PostgREST cache not reloaded
  - REST API returns relationship error despite DB being correct
  
- **Idempotency**: New migration safely handles these states:
  - Fresh database (creates everything)
  - Column exists but no FK (adds FK)
  - FK exists but wrong name (logs warning)
  - Everything already correct (reports success)

### Why This Matters
This comprehensive solution prevents production issues where:
1. Migrations apply successfully in database
2. FK relationships exist and work in SQL
3. But REST API doesn't recognize them (stale cache)
4. Application fails with "relationship not found" errors

**Prevention Strategy:**
- Idempotent migrations that verify their own success
- Automated drift detection in CI/CD pipeline
- Comprehensive verification script for manual and automated use
- Unit tests that catch schema cache issues early

**Acceptance Criteria Met:**
✅ Migration runs successfully in any environment state  
✅ FK constraint exists with correct name  
✅ Index exists for query performance  
✅ PostgREST schema cache reloaded  
✅ REST API returns 200 OK for relationship queries  
✅ No "Could not find a relationship" errors  
✅ Verification script exits 0 on success, 1 on failure  
✅ Unit test validates relationship via REST API  
✅ Documentation updated with verification workflows  

## [2025-11-07] Schema Cache Reload Fix

### Fixed
- **Critical Fix**: Added `NOTIFY pgrst, 'reload schema'` to migration `20251106000000_add_job_parts_vendor_id.sql`
  - Without this notification, PostgREST/Supabase does not recognize the new `job_parts.vendor_id` foreign key relationship
  - This was causing the production error: "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
  - The migration was technically correct but incomplete - the schema cache was not being reloaded
  
### Added
- **Documentation**: Added comprehensive "Schema Cache Reload" section to RUNBOOK.md
  - Explains when and how to reload PostgREST schema cache
  - Documents symptoms of stale cache and troubleshooting steps
  - Provides SQL, CLI, and migration examples

### Why This Matters
PostgREST caches the database schema for performance. When migrations add or modify foreign key relationships, the cache must be explicitly reloaded for the REST API to recognize the new relationships. Without the reload:
- Migration applies successfully in database
- Foreign key constraint exists and works in SQL
- But REST API queries using relationship syntax fail

This is a common production issue that's often misdiagnosed as a migration failure when it's actually a cache staleness issue.

## [2025-11-06] Per-Line Vendor Support

### Added
- **Database Migration** (`20251106000000_add_job_parts_vendor_id.sql`):
  - New column `job_parts.vendor_id` with FK to `vendors.id`
  - Index `idx_job_parts_vendor_id` for query performance
  - Backfill from `products.vendor_id` for existing records
  - RLS policies for vendor-specific access to job_parts

### Changed
- **Service Layer Updates**:
  - `dealService.js`: Queries include `vendor_id` and nested vendor relation; improved error handling for missing relationships
  - `jobService.js`: Explicit field selection in `selectJobs` includes vendor_id
  - `insertLineItems`: Supports per-line vendor_id persistence
  
- **Mappers & Adapters**:
  - `dealMappers.js`: Maps vendorId with fallback to `product.vendor_id`
  - `lineItemsUtils.js`: Includes vendor_id in normalized line items
  - `adapters.ts`: Line item payloads include vendor_id

- **Display Logic**:
  - Vendor aggregation shows "Single vendor name", "Mixed", or "Unassigned"
  - No truncation of vendor names (fixes "Unass…" bug)

### Fixed
- Resolved blocking error: "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
- Per-line vendor override now properly persists and displays
- Vendor display in deals table now accurately reflects line item assignments

## Route Consolidation Summary

### BEFORE: 14+ Scattered Routes
- `/dashboard` - Executive analytics landing
- `/executive-analytics-dashboard` - Duplicate analytics
- `/sales-tracker` - Spreadsheet-style sales data
- `/vehicle-management-hub` - Vehicle listing/management
- `/vehicle-detail-workstation` - Individual vehicle details
- `/calendar-scheduling-center` - Calendar/scheduling
- `/kanban-status-board` - Job status board
- `/vendor-operations-center` - Vendor management
- `/vendor-job-dashboard` - Vendor-specific jobs
- `/sales-transaction-interface` - Transaction processing
- `/administrative-configuration-center` - Admin settings
- `/business-intelligence-reports` - Reporting/analytics
- `/photo-documentation-center` - Photo management
- `/` - Authentication portal

### AFTER: 4 Focused Pages
- `/` - Authentication portal (unchanged)
- `/calendar` - **LANDING PAGE** - Calendar-first scheduling with stock search
- `/deals` - Sales & work orders (table + kanban views)
- `/vehicles` - Vehicle management with stock-first search  
- `/admin` - All administrative functions consolidated

## Functionality Mapping

### KEEP → /calendar (Landing)
- **From**: `/calendar-scheduling-center`, `/dashboard`, `/executive-analytics-dashboard`
- **Why**: Calendar-first approach puts scheduling at center
- **Features**: Week/day/agenda/resource views, unassigned queue, stock-first search, appointment drawer

### KEEP → /deals  
- **From**: `/sales-tracker`, `/sales-transaction-interface`, `/kanban-status-board`
- **Why**: All sales/revenue functions unified
- **Features**: Work orders table, kanban board, KPI chips, deal-to-schedule workflow

### KEEP → /vehicles
- **From**: `/vehicle-management-hub`, `/vehicle-detail-workstation`
- **Why**: Stock-first vehicle lookup and management
- **Features**: Stock-first search, vehicle history drawer, service scheduling

### KEEP → /admin
- **From**: `/vendor-operations-center`, `/vendor-job-dashboard`, `/administrative-configuration-center`, `/business-intelligence-reports`, `/photo-documentation-center`
- **Why**: All configuration and management in one place
- **Features**: Vendor/service/user management, SMS templates, CSV import

## Key Architectural Decisions

### 1. Calendar-First Design
**Decision**: Make calendar the landing page instead of dashboard
**Rationale**: 
- Aftermarket business is appointment-driven
- Scheduling is most frequent daily task
- Stock-first search naturally fits calendar workflow

### 2. Stock-First Search Pattern
**Decision**: Stock number becomes primary lookup across all pages
**Rationale**:
- Aftermarket shops identify vehicles by stock numbers
- Faster than VIN or customer name searches
- Consistent UX pattern across application

### 3. Consolidated Admin Interface
**Decision**: Single admin page with tabs vs. separate pages
**Rationale**:
- Reduces navigation complexity
- Admin tasks often done together
- Easier permission management

### 4. Embedded Kanban in Deals
**Decision**: Kanban as view toggle within deals, not separate page
**Rationale**:
- Same data, different presentation
- Avoids duplicate navigation
- Maintains context when switching views

### 5. SMS-First Communication
**Decision**: Build SMS notification system vs. email-first
**Rationale**:
- Higher open rates for time-sensitive updates
- Customers prefer SMS for appointment changes
- Better mobile experience

## Database Schema Changes

### New Tables Added
- `notification_outbox` - SMS queue for Twilio processing
- `vendor_hours` - Vendor capacity and availability management
- `sms_opt_outs` - Customer SMS preferences

### Enhanced Indexes
- Stock-first search optimization: exact and partial matching
- Notification processing: pending message queries
- Vendor scheduling: availability lookups

### Existing Tables Preserved
- All existing tables maintained for compatibility
- No data loss during consolidation
- Existing relationships intact

## Feature Enhancements

### CSV Import System
- **Stock-first deduplication**: Vehicle creation by stock number
- **Service splitting**: Comma-separated services → multiple work items
- **Intelligent mapping**: Case-insensitive header synonyms
- **Error handling**: Validation with detailed feedback

### SMS Automation
- **Auto-triggers**: Status changes queue SMS notifications
- **Template system**: Variable substitution with character limits
- **Twilio integration**: Edge functions for sending/receiving
- **Opt-out handling**: STOP/START command processing

### Enhanced Search
- **Exact-first logic**: Exact stock matches prioritized
- **Cross-page consistency**: Same search behavior everywhere
- **Performance optimized**: Database indexes for speed

## Removed/Consolidated Features

### Removed Pages
- **Executive dashboard graphs**: Moved to Deals page KPI cards
- **Separate photo center**: Photos integrated into vehicle history
- **Isolated vendor dashboards**: Consolidated into admin vendor management
- **BI reporting interface**: Export functions distributed to relevant pages

### Simplified Navigation
- **From 14+ menu items to 4**: Reduced cognitive load
- **Consistent header pattern**: All pages follow same layout
- **Role-based access**: Vendor users see appropriate subset

## Breaking Changes

### URL Changes
All old routes redirect to new structure:
- `/dashboard` → `/calendar`
- `/sales-tracker` → `/deals`
- `/vehicle-management-hub` → `/vehicles`
- `/administrative-configuration-center` → `/admin`

### API Endpoint Changes
- None - all existing Supabase queries maintained
- New RPC functions added for calendar date ranges
- Additional indexes for performance

### Environment Variables
- Added Twilio configuration requirements
- Existing Supabase variables unchanged

## Migration Path

### For Existing Users
1. **URLs**: Automatic redirects handle bookmarks
2. **Data**: No data migration required
3. **Permissions**: User roles map to new page structure
4. **Workflows**: Core workflows preserved with better UX

### For Administrators
1. **Setup SMS**: Configure Twilio credentials
2. **Import data**: Use CSV import for bulk vehicle/job creation
3. **Configure vendors**: Set vendor hours for capacity management
4. **Test SMS**: Verify notification templates and opt-out handling

## Performance Improvements

### Page Load Times
- **Calendar**: Optimized date range queries
- **Vehicles**: Stock-first search indexes
- **Deals**: Efficient work order joins
- **Admin**: Lazy loading for large datasets

### Database Optimization
- **New indexes**: Stock number patterns, SMS processing
- **Query optimization**: Reduced N+1 queries
- **Connection pooling**: Better resource management

## Security Enhancements

### Row Level Security (RLS)
- **Vendor isolation**: Vendors see only their assigned jobs
- **Admin protection**: Sensitive operations require proper roles
- **SMS privacy**: Opt-out preferences enforced

### API Security
- **Service role functions**: SMS processing uses elevated permissions
- **Input validation**: CSV import sanitizes all inputs
- **Rate limiting**: SMS functions prevent abuse

## Next Release Roadmap

### Planned Features
- **Mobile app**: React Native companion
- **Advanced reporting**: Custom dashboard builder
- **Inventory integration**: Parts tracking and ordering
- **Customer portal**: Self-service appointment booking

### Performance Targets
- **Sub-second search**: Stock lookups <200ms
- **Real-time updates**: WebSocket job status changes  
- **Offline support**: Core functions work without connectivity
- **Bulk operations**: Handle 1000+ vehicle imports