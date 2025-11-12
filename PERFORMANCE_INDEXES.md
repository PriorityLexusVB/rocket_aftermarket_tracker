# Performance Indexes Documentation

## Overview

This document describes the comprehensive indexing strategy implemented to reduce Supabase performance errors, optimize ILIKE searches, and accelerate common query patterns.

## Migration File

- **File**: `supabase/migrations/20251110023000_comprehensive_performance_indexes.sql`
- **Date**: 2025-11-10
- **Purpose**: Performance optimization and schema simplification

## Index Categories

### A. Extension Requirements

#### pg_trgm (Trigram Extension)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Purpose**: Enables trigram indexes for efficient ILIKE pattern matching  
**Benefit**: Converts sequential scans to GIN index scans for text searches  
**Use Cases**: Customer search, vehicle lookup, vendor filtering

### B. Foreign Key Indexes

Ensures all foreign key columns are indexed to optimize JOIN operations.

| Table     | Column                  | Index Name               | Purpose                   |
| --------- | ----------------------- | ------------------------ | ------------------------- |
| job_parts | vendor_id               | idx_job_parts_vendor_id  | Vendor relationship joins |
| job_parts | job_id                  | idx_job_parts_job_id     | Job to parts joins        |
| jobs      | vehicle_id              | idx_jobs_vehicle_id      | Vehicle relationship      |
| jobs      | assigned_to             | idx_jobs_assigned_to     | Staff assignment lookup   |
| jobs      | delivery_coordinator_id | idx_jobs_delivery_coord  | Coordinator filtering     |
| jobs      | finance_manager_id      | idx_jobs_finance_manager | Finance manager queries   |

**Expected Improvement**: 10-50x faster JOIN operations

### C. Common Query Pattern Indexes

#### Status + Created Date (Composite)

```sql
CREATE INDEX idx_jobs_status_created ON jobs(job_status, created_at);
```

**Query Pattern**:

```sql
SELECT * FROM jobs
WHERE job_status = 'in_progress'
ORDER BY created_at DESC;
```

**Benefit**: Single index scan instead of separate filter + sort

#### Overdue Parts (Composite)

```sql
CREATE INDEX idx_job_parts_promised_sched ON job_parts(promised_date, requires_scheduling);
```

**Query Pattern**:

```sql
SELECT * FROM job_parts
WHERE requires_scheduling = true
  AND promised_date < NOW()::date;
```

**Benefit**: Accelerates overdue job detection

#### Multi-tenant Org Filtering

```sql
CREATE INDEX idx_jobs_org_id ON jobs(org_id);
```

**Query Pattern**: All org-scoped queries benefit from this index

### D. Trigram Indexes (ILIKE Optimization)

Trigram (pg_trgm) indexes enable efficient pattern matching for user searches.

| Table    | Column     | Index Name               | Use Case          |
| -------- | ---------- | ------------------------ | ----------------- |
| jobs     | title      | idx_jobs_title_trgm      | Job search        |
| jobs     | job_number | idx_jobs_job_number_trgm | Job number lookup |
| vendors  | name       | idx_vendors_name_trgm    | Vendor search     |
| vehicles | make       | idx_vehicles_make_trgm   | Make search       |
| vehicles | model      | idx_vehicles_model_trgm  | Model search      |
| vehicles | vin        | idx_vehicles_vin_trgm    | VIN lookup        |
| products | name       | idx_products_name_trgm   | Product search    |

**Before (Sequential Scan)**:

```
Seq Scan on jobs  (cost=0.00..2500.00 rows=100 width=256)
  Filter: (title ~~* '%civic%'::text)
```

**After (GIN Index Scan)**:

```
Bitmap Heap Scan on jobs  (cost=12.00..116.01 rows=100 width=256)
  Recheck Cond: (title ~~* '%civic%'::text)
  ->  Bitmap Index Scan on idx_jobs_title_trgm  (cost=0.00..11.97 rows=100 width=0)
        Index Cond: (title ~~* '%civic%'::text)
```

**Expected Improvement**: 20-100x faster text searches

### E. Additional Coverage Indexes

| Table              | Column(s)        | Purpose                      |
| ------------------ | ---------------- | ---------------------------- |
| loaner_assignments | customer_phone   | Quick customer loaner lookup |
| user_profiles      | role, department | Dropdown population          |

## Performance Monitoring

### Check Index Usage

```sql
-- List all indexes on public schema
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Verify Index is Being Used

```sql
-- Example: Check if title search uses trigram index
EXPLAIN ANALYZE
SELECT * FROM jobs
WHERE title ILIKE '%civic%'
LIMIT 100;
```

Look for:

- **Good**: `Bitmap Index Scan on idx_jobs_title_trgm`
- **Bad**: `Seq Scan on jobs`

### Check Index Statistics

```sql
-- View index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Table Statistics

```sql
-- View table statistics (auto-updated by ANALYZE)
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

## Post-Migration Steps

1. **Schema Cache Reload** (if using PostgREST):

   ```bash
   # Via Admin UI
   Navigate to Admin > Capabilities > Reload Schema Cache

   # Or via API
   POST /api/admin/reload-schema

   # Or via SQL
   NOTIFY pgrst, 'reload schema';
   ```

2. **Update Statistics**:

   ```sql
   ANALYZE;  -- All tables
   -- Or specific tables:
   ANALYZE jobs;
   ANALYZE job_parts;
   ANALYZE vendors;
   ```

3. **Verify Health Endpoint**:
   ```bash
   curl /api/health/capabilities
   ```

## Query Optimization Guidelines

### Use Explicit Column Lists

❌ **Avoid**:

```sql
SELECT * FROM jobs WHERE ...
```

✅ **Prefer**:

```sql
SELECT id, job_number, title, job_status, created_at
FROM jobs WHERE ...
```

**Benefit**: Reduces payload size and allows covering indexes

### Add Defensive Limits

❌ **Avoid**:

```sql
SELECT * FROM jobs WHERE job_status = 'pending';
```

✅ **Prefer**:

```sql
SELECT * FROM jobs
WHERE job_status = 'pending'
ORDER BY created_at DESC
LIMIT 200;
```

**Benefit**: Prevents excessive result sets

### Use Composite Indexes

When filtering and sorting by multiple columns, use composite indexes:

```sql
-- Index supports both WHERE and ORDER BY
CREATE INDEX idx_jobs_status_created ON jobs(job_status, created_at);

-- Query benefits from single index
SELECT * FROM jobs
WHERE job_status = 'in_progress'
ORDER BY created_at DESC;
```

## Materialized View Strategy (Optional)

For complex aggregations like `get_overdue_jobs_enhanced`, consider materialized views:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW mv_overdue_jobs AS
SELECT
  j.id,
  j.job_number,
  j.job_status,
  p.promised_date
FROM jobs j
JOIN job_parts p ON p.job_id = j.id
WHERE p.requires_scheduling
  AND p.promised_date < NOW()::date;

-- Create index on MV
CREATE INDEX idx_mv_overdue_jobs_promised
ON mv_overdue_jobs(promised_date);

-- Refresh strategy (scheduled or on-demand)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overdue_jobs;
```

**When to Use**:

- Query is expensive (>1 second)
- Data changes infrequently
- Staleness is acceptable (minutes to hours)

**Refresh Options**:

- **Manual**: Admin trigger or API endpoint
- **Scheduled**: cron job or pg_cron extension
- **Event-driven**: AFTER INSERT/UPDATE/DELETE trigger

## Rollback Procedures

If indexes cause issues (unlikely):

```sql
-- Drop specific index
DROP INDEX IF EXISTS idx_jobs_title_trgm;

-- Drop extension (removes all trigram indexes)
DROP EXTENSION IF EXISTS pg_trgm CASCADE;

-- Revert to sequential scans (automatic if indexes dropped)
```

## Performance Testing

### Before Migration

```bash
# Capture baseline
psql -c "EXPLAIN ANALYZE SELECT * FROM jobs WHERE title ILIKE '%civic%';" > before.txt
```

### After Migration

```bash
# Compare performance
psql -c "EXPLAIN ANALYZE SELECT * FROM jobs WHERE title ILIKE '%civic%';" > after.txt
diff before.txt after.txt
```

### Load Testing

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 https://your-app.com/api/jobs?search=civic
```

## Troubleshooting

### Index Not Being Used

**Problem**: Query still uses Seq Scan after creating index

**Solutions**:

1. Run `ANALYZE` to update statistics
2. Check query pattern matches index definition
3. Verify table size justifies index (small tables may not use indexes)
4. Check if query planner cost estimation needs tuning

### High Lock Contention

**Problem**: Index creation blocks writes

**Solution**: Use `CONCURRENTLY` for large tables:

```sql
CREATE INDEX CONCURRENTLY idx_large_table_column ON large_table(column);
```

### Disk Space Issues

**Problem**: Indexes consume significant disk space

**Solution**:

1. Monitor index size: `SELECT pg_size_pretty(pg_relation_size('idx_name'));`
2. Drop unused indexes (check pg_stat_user_indexes)
3. Consider partial indexes for filtered queries

## References

- [PostgreSQL Indexes Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [pg_trgm Extension](https://www.postgresql.org/docs/current/pgtrgm.html)
- [PostgREST Performance Tuning](https://postgrest.org/en/stable/references/performance_tuning.html)
- [Supabase Database Best Practices](https://supabase.com/docs/guides/database/performance)

## Maintenance Schedule

- **Weekly**: Review slow query logs
- **Monthly**: Run VACUUM and ANALYZE
- **Quarterly**: Review index usage statistics and drop unused indexes
- **Annually**: Review and update indexing strategy based on query patterns
