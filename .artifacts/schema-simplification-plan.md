# Schema Simplification and Consolidation Plan

**Status:** PROPOSED
**Priority:** Medium
**Estimated Effort:** 2-3 days
**Risk Level:** Medium (requires careful migration testing)

## Problem Statement

The current Supabase schema has grown to **83 migration files** creating:

- Complex dependency chains
- Slow schema cache reloads
- Difficult troubleshooting and auditing
- Potential performance degradation from policy/index complexity

## Goals

1. **Reduce complexity** while maintaining all functionality
2. **Improve performance** through optimized indexes and policies
3. **Enhance maintainability** with clearer schema structure
4. **Preserve data integrity** through careful migration process

## Proposed Approach

### Phase 1: Audit and Document (1 day)

1. **Generate Current Schema Snapshot**

   ```bash
   npx supabase db dump --schema public > schema_snapshot_$(date +%Y%m%d).sql
   ```

2. **Index Analysis**
   - Run queries against `pg_stat_user_indexes`
   - Identify unused indexes (0 or low usage)
   - Document all indexes with their purpose

3. **RLS Policy Audit**
   - List all policies per table
   - Identify redundant or overlapping policies
   - Document the purpose of each policy

4. **Function and View Inventory**
   - Catalog all custom functions
   - Review security definer vs invoker settings
   - Check for unnecessary complexity

### Phase 2: Create Consolidation Migration (1 day)

1. **Generate Squashed Migration**
   Create a new migration that represents the complete, optimized schema:

   ```sql
   -- 20251110000000_schema_consolidation_v1.sql

   -- Drop old objects if starting fresh
   -- (Only for new environments, not production)

   -- Create tables with optimized structure
   CREATE TABLE IF NOT EXISTS public.jobs (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id uuid NOT NULL REFERENCES organizations(id),
     -- ... all current columns with proper constraints
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );

   -- Add optimized indexes
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_org_created
     ON jobs(org_id, created_at DESC);

   -- Add consolidated RLS policies
   CREATE POLICY "org_isolation" ON jobs
     FOR ALL USING (org_id = get_user_org_id());
   ```

2. **Optimization Opportunities**
   - Combine multiple single-column indexes into composite indexes where beneficial
   - Merge similar RLS policies using OR conditions
   - Remove redundant constraints and checks
   - Consolidate update triggers

### Phase 3: Testing (0.5 day)

1. **Test in Development Environment**

   ```bash
   # Apply to fresh DB
   npx supabase db reset

   # Apply consolidation migration
   npx supabase db push

   # Run full test suite
   npm test
   ```

2. **Performance Benchmarking**
   - Measure query execution times before/after
   - Check schema cache reload time
   - Monitor RLS policy evaluation overhead

3. **Data Migration Test**
   - Export sample production data
   - Apply to test environment
   - Verify data integrity post-migration

### Phase 4: Production Rollout (0.5 day)

1. **Create Rollback Plan**
   - Document exact rollback steps
   - Prepare backup migration to revert if needed
   - Test rollback procedure in staging

2. **Deploy with Monitoring**

   ```bash
   # Maintenance window recommended
   # Apply migration
   npx supabase db push --db-url $PRODUCTION_URL

   # Monitor logs
   npx supabase logs --db-url $PRODUCTION_URL
   ```

3. **Post-Deployment Validation**
   - Run health checks
   - Monitor error rates
   - Check query performance metrics

## Specific Optimizations to Implement

### 1. Index Consolidation

**Current (Example):**

```sql
CREATE INDEX idx_jobs_org_id ON jobs(org_id);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
```

**Optimized:**

```sql
-- Single composite index serves both queries
CREATE INDEX idx_jobs_org_created ON jobs(org_id, created_at DESC);
```

### 2. RLS Policy Simplification

**Current (Example):**

```sql
CREATE POLICY "select_own_org" ON jobs FOR SELECT
  USING (org_id = get_user_org_id());
CREATE POLICY "insert_own_org" ON jobs FOR INSERT
  WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "update_own_org" ON jobs FOR UPDATE
  USING (org_id = get_user_org_id());
```

**Simplified:**

```sql
-- Single policy covers all operations
CREATE POLICY "org_isolation" ON jobs FOR ALL
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());
```

### 3. Function Optimization

**Review and optimize these patterns:**

```sql
-- Mark functions as STABLE when appropriate
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE  -- Not VOLATILE - result doesn't change within transaction
SECURITY DEFINER
AS $$
  SELECT org_id FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;
```

### 4. Materialized View for Reporting

**Add for expensive aggregations:**

```sql
CREATE MATERIALIZED VIEW job_summary_by_org AS
SELECT
  org_id,
  COUNT(*) as total_jobs,
  SUM(total_amount) as total_revenue,
  DATE_TRUNC('day', created_at) as day
FROM jobs
GROUP BY org_id, DATE_TRUNC('day', created_at);

-- Refresh periodically
CREATE INDEX ON job_summary_by_org(org_id, day DESC);
```

## Risk Mitigation

### High-Risk Changes

- Altering primary keys or foreign keys
- Changing data types
- Removing columns still in use

**Mitigation:** Avoid these entirely in consolidation; handle separately with proper deprecation

### Medium-Risk Changes

- Removing unused indexes
- Consolidating RLS policies
- Optimizing function definitions

**Mitigation:**

- Test thoroughly in staging
- Deploy during maintenance window
- Monitor closely post-deployment

### Low-Risk Changes

- Adding comments and documentation
- Renaming internal functions
- Optimizing query plans

**Mitigation:** Standard deployment process

## Success Criteria

- ✅ All existing tests pass
- ✅ No data loss or corruption
- ✅ Query performance improved or maintained
- ✅ Schema cache reload time < 500ms
- ✅ Zero downtime during deployment
- ✅ Rollback plan tested and ready

## Alternative Approaches

### Option A: Gradual Cleanup (Recommended for Production)

- Keep all existing migrations
- Add cleanup migrations incrementally
- Mark old migrations as "consolidated" in comments
- Lower risk, easier rollback

### Option B: Complete Rebuild (Only for New Environments)

- Create entirely new schema from scratch
- Migrate data with custom scripts
- Highest risk, most thorough cleanup
- Only recommended for new deployments

### Option C: Hybrid Approach (Current Recommendation)

- Document current schema thoroughly
- Add new "cleanup" migrations for obviously redundant items
- Create snapshot migration for reference but don't force rebuild
- Safest for production systems

## Implementation Timeline

1. **Week 1:** Audit and documentation
2. **Week 2:** Create and test consolidation migrations in dev
3. **Week 3:** Apply to staging, performance testing
4. **Week 4:** Production deployment during maintenance window

## Responsible Parties

- **Database Admin:** Schema changes, migration creation
- **Backend Dev:** Function optimization, API testing
- **QA:** Test suite validation, regression testing
- **DevOps:** Deployment orchestration, monitoring

## Related Documents

- [Schema Performance Analysis](./.artifacts/schema-performance-analysis.md)
- [Health Capabilities Baseline](./.artifacts/health-capabilities.json)
- [RLS Audit Guide](../IMPLEMENTATION_SUMMARY_RLS_AUDIT.md)

## Next Steps

1. Get stakeholder approval for consolidation effort
2. Schedule maintenance window
3. Begin Phase 1 audit
4. Create GitHub issue to track progress

---

**Note:** This is a planning document. Actual implementation should be done by a database specialist with full understanding of production workload patterns and business requirements.
