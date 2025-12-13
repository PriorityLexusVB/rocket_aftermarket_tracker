# Migration State Verification Guide

## Current Repository State (After Fix)

### Statistics
- **Total migration files:** 99
- **Valid 14-digit timestamps:** 99 (100%) ✓
- **Duplicate timestamps:** 0 ✓
- **Out-of-order timestamps:** 0 ✓

### Fixed Migration Files

| Old Timestamp | New Timestamp | Migration Name |
|--------------|---------------|----------------|
| `20251023_` (10 digits) | `20251023000000` (14 digits) | add_job_parts_no_schedule_reason_check |
| `202510270001_` (12 digits) | `20251027000001` (14 digits) | add_loaner_indexes |
| `20251212_` (8 digits) | `20251212200000` (14 digits) | job_parts_unique_job_product_schedule |

### Most Recent Migrations (Last 10)

```
20251129231539 - fix_auth_user_org_auth_user_id_fallback
20251206001000 - rls_safety_net_consolidation
20251210173000 - harden_security_definer_permissions
20251210173100 - fix_cleanup_functions_not_in_patterns
20251210173200 - harden_sequences_and_generators
20251210173300 - fix_function_select_star_and_null_checks
20251212190000 - job_parts_dedupe_and_unique
20251212194500 - fix_user_profiles_policy_and_grants
20251212200000 - job_parts_unique_job_product_schedule (RENAMED)
```

## Production Database Verification

### SQL Query to Check Migration History

Run this in Supabase SQL Editor to see what's applied in production:

```sql
-- Get all applied migrations
SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;
```

### Expected After This PR is Deployed

The three renamed migrations should appear with their new timestamps:

```sql
-- Check for renamed migrations specifically
SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20251023000000',
  '20251027000001',
  '20251212200000'
)
ORDER BY version;
```

**Expected Result:** 3 rows showing the migrations with new timestamps.

### Detect Missing Migrations

Run this query to find migrations in repo but not in production:

```sql
-- Compare against production (manual check)
-- Copy the list of all 99 migrations from repo and verify against this query
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

**What to Check:**
1. Count should be 99 (or more if new migrations added after this PR)
2. No gaps in timestamp sequence (relative to repo list)
3. The three renamed timestamps (`20251023000000`, `20251027000001`, `20251212200000`) are present

### Detect Production Migrations Not in Repo (Drift)

If production has migrations not in the repo, this could indicate manual SQL was run or migrations were created outside the repo:

```sql
-- Find migrations in production that aren't in your repo
-- (Compare manually against repo migration list)
SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
WHERE version NOT LIKE '2025%'  -- Adjust pattern to find outliers
ORDER BY version DESC;
```

**Expected Result:** Empty (no drift) or only very old bootstrap migrations.

## RUNBOOK: How to Compare Repo vs Production

### Step 1: Get Repo Migration List

```bash
cd /path/to/repo
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | sed 's/_.*//' > /tmp/repo_migrations.txt
wc -l /tmp/repo_migrations.txt
# Should show: 99 (or current count)
```

### Step 2: Get Production Migration List

In Supabase SQL Editor:

```sql
COPY (
  SELECT version
  FROM supabase_migrations.schema_migrations
  ORDER BY version
) TO STDOUT;
```

Save output to `/tmp/prod_migrations.txt`

### Step 3: Compare Lists

```bash
# Find migrations in repo but not in production
comm -23 /tmp/repo_migrations.txt /tmp/prod_migrations.txt

# Find migrations in production but not in repo (drift)
comm -13 /tmp/repo_migrations.txt /tmp/prod_migrations.txt
```

**Expected After This PR:**
- **Before deployment:** 3 old timestamps in production that don't match repo
- **After deployment:** Perfect match (or repo has more if newer migrations exist)

## Idempotency Verification

### How to Test Locally (Optional)

If you have a local Supabase instance:

```bash
# Reset database
supabase db reset

# Apply migrations once
supabase db push

# Check migration count
psql postgres://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;"

# Apply migrations again (should be no-op)
supabase db push

# Verify count unchanged
psql postgres://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;"
```

**Expected:** Both counts are identical, no errors on second push.

### Production Safety Note

The renamed migrations are all idempotent:

1. **20251023000000_add_job_parts_no_schedule_reason_check.sql**
   - Uses `DO $$ BEGIN ... END $$` with existence checks
   - Will not error if already applied

2. **20251027000001_add_loaner_indexes.sql**
   - Uses `CREATE INDEX IF NOT EXISTS`
   - Will not error if already applied

3. **20251212200000_job_parts_unique_job_product_schedule.sql**
   - Uses `create unique index if not exists`
   - Will not error if already applied

## Timestamp Validation Commands

### Check for Invalid Timestamps

```bash
# Find any migrations with non-14-digit timestamps
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | grep -v '^[0-9]\{14\}_'
```

**Expected:** Empty output (all timestamps valid)

### Check for Duplicate Timestamps

```bash
# Find any duplicate timestamps
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | sed 's/_.*//' | sort | uniq -d
```

**Expected:** Empty output (no duplicates)

### Check Migration Ordering

```bash
# Verify migrations are in chronological order
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | sed 's/_.*//' | sort -c && echo "✓ All migrations properly ordered"
```

**Expected:** `✓ All migrations properly ordered`

### Count Total Migrations

```bash
ls -1 supabase/migrations/*.sql | wc -l
```

**Expected:** `99` (or current count after new migrations)

## Troubleshooting Production Deployment

### If Migration Fails with "version already exists"

This means the old timestamp is still in production's `schema_migrations` table.

**Fix:**
```sql
-- Check if old timestamp exists
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20251023', '202510270001', '20251212');

-- If old timestamp exists, Supabase CLI will handle the rename automatically
-- The new timestamp will be inserted and the migration will run
-- (This is expected behavior and not an error)
```

### If Migration Fails with "constraint/index already exists"

All three renamed migrations are idempotent and use `IF NOT EXISTS`. This should not happen.

**If it does:**
1. Check that migration file content hasn't been modified
2. Verify production schema state matches expectations
3. Check Supabase CLI version (should be 2.65.5)

### If Config.toml Restore Fails

The workflow uses `if: always()` to ensure restoration. If it still fails:

1. Check workflow logs for the "Restore config.toml" step
2. Manually restore if needed:
   - Go to GitHub web UI
   - Navigate to `supabase/config.toml.disabled`
   - Rename to `supabase/config.toml`
   - Commit via web UI

## Post-Deployment Checklist

After the production workflow completes successfully:

- [ ] Verify migration count in production matches repo (99)
- [ ] Verify the 3 renamed migrations are present:
  - [ ] `20251023000000` - job_parts constraint
  - [ ] `20251027000001` - loaner indexes  
  - [ ] `20251212200000` - job_parts unique index
- [ ] Check that job_parts constraint exists: `job_parts_no_schedule_reason_chk`
- [ ] Check that loaner indexes exist:
  - [ ] `loaner_assignments_active_due_date_idx`
  - [ ] `loaner_assignments_loaner_number_idx`
- [ ] Check that job_parts unique index exists: `job_parts_unique_job_product_schedule`
- [ ] No errors in workflow logs
- [ ] Config.toml restored successfully

Use the SQL queries from the "Production Database Verification" section above to perform these checks.

## Summary

✅ **Repository State:** All 99 migrations have valid 14-digit timestamps  
✅ **Idempotency:** All renamed migrations safe to re-run  
✅ **Workflows:** Enhanced with logging and error handling  
✅ **Verification:** SQL queries and commands provided for validation  

**Next Steps:**
1. Run dry-run workflow to validate migrations
2. Deploy to production via workflow or merge to main
3. Run post-deployment verification queries
4. Confirm all 3 renamed migrations present in production
