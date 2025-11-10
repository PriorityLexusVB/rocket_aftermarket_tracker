# Supabase Schema Performance Analysis

**Date:** 2025-11-10
**Analysis Type:** Schema Complexity Review and Performance Optimization Plan

## Current State

### Migration Statistics
- **Total Migration Files:** 83
- **Schema Objects:** ~144 (tables, indexes, functions, views)
- **Core Tables:** ~20+ tables

### Key Tables Identified
1. `user_profiles` - User management
2. `vehicles` - Vehicle tracking
3. `vendors` - Vendor management
4. `products` - Product catalog
5. `jobs` - Job/deal management (core)
6. `job_parts` - Line items for jobs (core)
7. `transactions` - Financial transactions
8. `communications` - Communication logs
9. `activity_history` - Audit trail
10. `job_photos` - Photo documentation
11. `sms_templates` - SMS template management
12. `filter_presets` - User filter preferences
13. `notification_preferences` - User notification settings
14. `vehicle_products` - Vehicle-product mapping
15. `claims` - Claims management
16. `claim_attachments` - Claim attachments
17. `service_appointments` - Service scheduling
18. `appointment_reminders` - Appointment reminders
19. `appointment_slots` - Calendar slots
20. `loaner_assignments` - Loaner vehicle tracking

## Performance Concerns

### 1. Migration Sprawl
- **Issue:** 83 migrations create complex dependency chains
- **Impact:** Schema cache reload complexity, difficult to audit
- **Risk:** Performance degradation, hard to troubleshoot

### 2. RLS Policy Complexity
Recent migrations show extensive RLS (Row Level Security) policy additions:
- Multiple policies per table
- Complex org_id based multi-tenancy
- Frequent RLS refinements (see 20251022230000, 20251105000000, 20251106210000)

### 3. Index Proliferation
Multiple index-related migrations:
- 20251022204600_add_helpful_indexes.sql
- 20251022211000_add_targeted_perf_indexes.sql
- 20251022230500_add_org_id_indexes.sql
- 202510270001_add_loaner_indexes.sql

### 4. Function and View Overhead
- Function search_path fixes (20251022213500)
- View security settings (20251022203000)

## Recommendations

### Immediate Actions (Low Risk)

1. **Consolidate Future Migrations**
   - Use squash migrations for cleanup operations
   - Group related changes into single migrations
   - Document migration purposes clearly

2. **Review Index Usage**
   - Run `pg_stat_user_indexes` to identify unused indexes
   - Remove duplicate or overlapping indexes
   - Focus on high-cardinality columns for org_id filtering

3. **Optimize RLS Policies**
   - Audit existing policies for redundancy
   - Ensure policies use indexed columns
   - Consider policy combining where possible

4. **Monitor Query Performance**
   - Enable query logging for slow queries (>100ms)
   - Use `EXPLAIN ANALYZE` on core queries
   - Focus on job_parts and jobs table queries

### Medium-Term Actions (Requires Planning)

1. **Schema Consolidation**
   - Create a "schema snapshot" migration that consolidates all changes
   - Keep historical migrations for reference but mark as deprecated
   - Reduces PostgREST schema cache reload time

2. **Denormalization Opportunities**
   - Consider materialized views for reporting queries
   - Add computed columns where frequently calculated
   - Cache aggregations (e.g., job totals)

3. **Partition Strategy**
   - Consider partitioning large tables (jobs, job_parts) by date or org_id
   - Improves query performance for recent data
   - Better vacuum and maintenance performance

### Long-Term Actions (Architectural)

1. **API Layer Optimization**
   - Move complex business logic from DB functions to application layer
   - Reduces DB processing overhead
   - Easier to test and debug

2. **Caching Strategy**
   - Implement Redis/application-level caching for:
     - Dropdown data (vendors, products)
     - User profile information
     - Org-level configuration
   - Already partially implemented (dropdownService with 5m TTL)

3. **Read Replicas**
   - For reporting and analytics queries
   - Offload read traffic from primary database

## Specific Performance Improvements

### Critical Queries to Optimize

1. **Job List Query with Relationships**
   ```sql
   -- Ensure these are indexed:
   CREATE INDEX IF NOT EXISTS idx_jobs_org_id_created_at 
     ON jobs(org_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_job_parts_job_id_org_id 
     ON job_parts(job_id, org_id);
   ```

2. **Vendor Relationship Join**
   ```sql
   -- Verify FK index exists:
   CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id 
     ON job_parts(vendor_id) WHERE vendor_id IS NOT NULL;
   ```

3. **User Profile Lookups**
   ```sql
   -- Ensure auth.uid() lookups are fast:
   CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id 
     ON user_profiles(auth_user_id);
   ```

### RLS Policy Optimization

Current multi-tenant pattern:
```sql
-- Typical policy:
CREATE POLICY "Users see own org data" ON jobs
  FOR SELECT USING (org_id = get_user_org_id());
```

**Optimization:**
- Ensure `get_user_org_id()` function is marked `STABLE` not `VOLATILE`
- Cache function results per transaction
- Consider session variables for org_id

## Health Check Integration

The health check endpoint (`/api/health/capabilities`) already probes:
- Column existence (scheduled_start_time, scheduled_end_time, vendor_id)
- Relationship health (job_parts -> vendors FK)
- User profile schema (name column)

**Enhancement Needed:**
Add performance metrics to health check:
```javascript
{
  "capabilities": { ... },
  "performance": {
    "schemaObjectCount": 144,
    "migrationCount": 83,
    "avgQueryTime": "TBD",
    "cacheHitRate": "TBD"
  }
}
```

## Action Items for This PR

1. ✅ Document schema complexity
2. ✅ Add performance monitoring guidance
3. ⏭️ Create follow-up issue for schema consolidation
4. ⏭️ Add query performance logging
5. ⏭️ Audit and document all indexes

## Success Metrics

- Schema cache reload time < 500ms
- P95 query time for job list < 200ms
- Index usage ratio > 80%
- RLS policy evaluation time < 50ms per query

## Related Files

- `/supabase/migrations/` - All migration files
- `/src/api/health/capabilities.js` - Health check endpoint
- `/src/services/dealService.js` - Core business logic
- `/src/services/dropdownService.js` - Caching implementation

## Notes

- Schema has evolved organically over time
- Recent focus on RLS hardening and multi-tenancy
- Good: Proper indexing being added incrementally
- Concern: Migration count suggests potential for consolidation
- Recommendation: Plan schema consolidation sprint in Q1 2025
