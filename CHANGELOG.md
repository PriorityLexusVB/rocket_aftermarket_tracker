# Changelog - Calendar-First Aftermarket Tracker

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