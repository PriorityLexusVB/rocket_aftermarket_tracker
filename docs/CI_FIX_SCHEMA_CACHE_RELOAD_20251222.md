# CI Fix: Schema Cache Reload (Dec 22, 2025)

## Issue
- **Workflow**: Nightly RLS Drift & Health Check
- **Run**: [#20421300544](https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20421300544)
- **Failure**: Step 14 "Fail Workflow on Issues" failed
- **Root Cause**: PostgREST schema cache not reloaded after recent migrations

## Root Cause Analysis

### Recent Migrations Without NOTIFY pgrst
Two recent migrations modified `job_parts` schema but did not include the required `NOTIFY pgrst, 'reload schema';` command:

1. **20251218042008_job_parts_unique_constraint_vendor_time.sql**
   - Created unique index on job_parts
   - Removed duplicate rows
   - ❌ Missing: `NOTIFY pgrst, 'reload schema';`

2. **20251219120000_fix_job_parts_vendor_policies.sql**
   - Updated RLS policies for vendor access
   - ❌ Missing: `NOTIFY pgrst, 'reload schema';`

### Impact
Without the NOTIFY command, PostgREST's schema cache becomes stale:
- Health endpoint `/api/health-deals-rel` may fail to recognize relationships
- Queries with FK relationships may fail
- CI workflow detects this as schema drift

### Why NOTIFY pgrst is Required
PostgREST caches the database schema for performance. When schema changes occur (new constraints, policies, FK relationships), PostgREST must be notified to refresh its cache:

```sql
NOTIFY pgrst, 'reload schema';
```

## Solution

### Immediate Fix
Created new migration to reload schema cache:
- **Migration**: `20251222040813_notify_pgrst_reload_schema.sql`
- **Action**: Executes `NOTIFY pgrst, 'reload schema';`
- **Safe**: No schema changes, just cache refresh

### Future Prevention
1. **All migrations that modify schema** (constraints, indexes, FK, RLS policies) **MUST** include:
   ```sql
   -- At end of migration
   NOTIFY pgrst, 'reload schema';
   ```

2. **Code review checklist**: Verify NOTIFY command is present in schema-modifying migrations

3. **Documentation**: Updated this guide and reference existing docs:
   - `docs/SCHEMA_CACHE_DIAGRAM.md`
   - `docs/CI_TROUBLESHOOTING.md`
   - `docs/SCHEMA_DRIFT_FIX.md`

## Verification

### Local Testing
```bash
# Run schema verification script
bash scripts/verify-schema-cache.sh

# Should output:
# ✅ All Verification Checks Passed
```

### CI Workflow
After applying the migration:
1. CI workflow should pass on next run
2. Health endpoints should return `ok: true`
3. No schema drift detected

## Related Documentation
- [Schema Cache Diagram](./SCHEMA_CACHE_DIAGRAM.md) - Visual explanation of PostgREST cache
- [CI Troubleshooting](./CI_TROUBLESHOOTING.md) - Common CI issues
- [Deploy Checklist](./DEPLOY_CHECKLIST.md) - Pre-deployment verification

## Lessons Learned
1. **ALWAYS include `NOTIFY pgrst, 'reload schema';` in migrations** that modify:
   - Constraints (UNIQUE, FK, CHECK)
   - Indexes
   - RLS policies
   - Table/column structure

2. **CI workflow is effective** at catching stale schema cache issues

3. **Never edit historical migrations** - Create new migration to fix issues (per workspace guardrails)

## Timeline
- **Dec 18-19, 2025**: Migrations applied without NOTIFY command
- **Dec 22, 2025**: CI detected stale schema cache
- **Dec 22, 2025**: Fix applied via new migration

## Status
✅ **FIXED** - Migration `20251222040813_notify_pgrst_reload_schema.sql` reloads schema cache
