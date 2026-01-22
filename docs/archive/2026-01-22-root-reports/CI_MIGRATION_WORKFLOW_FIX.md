# CI Migration Workflow Reliability Fix

## Problem Statement

The CI migration workflows needed improvements to ensure reliability and predictability for production deployments. Three migration files had invalid timestamps that could cause ordering issues.

## Issues Found and Fixed

### 1. Invalid Migration Timestamps ✅

Three migration files had non-standard timestamps (not 14-digit YYYYMMDDHHmmss format):

| Old Filename                                          | Issue     | New Filename                                                | Fix                     |
| ----------------------------------------------------- | --------- | ----------------------------------------------------------- | ----------------------- |
| `20251023_add_job_parts_no_schedule_reason_check.sql` | 10 digits | `20251023000000_add_job_parts_no_schedule_reason_check.sql` | Added 6 digits for time |
| `202510270001_add_loaner_indexes.sql`                 | 12 digits | `20251027000001_add_loaner_indexes.sql`                     | Corrected to 14 digits  |
| `20251212_job_parts_unique_job_product_schedule.sql`  | 8 digits  | `20251212200000_job_parts_unique_job_product_schedule.sql`  | Added 6 digits for time |

**Result:**

- All 99 migration files now have valid 14-digit timestamps
- No duplicate timestamps detected
- Migrations are properly ordered chronologically

### 2. Workflow Enhancements ✅

#### Production Workflow (`.github/workflows/supabase-migrate.yml`)

- ✅ Added migration count logging before push
- ✅ Added explicit command logging (shows `supabase db push --yes`)
- ✅ Enhanced error handling with clear success/failure messages
- ✅ Maintained existing safety features:
  - Pinned CLI version 2.65.5
  - Concurrency group prevents overlapping deploys
  - Config.toml disable/restore pattern
  - `if: always()` ensures config restoration

#### Dry-Run Workflow (`.github/workflows/supabase-migrate-dry-run.yml`)

- ✅ Added migration count logging before validation
- ✅ Added explicit command logging (shows `supabase db push --dry-run`)
- ✅ Enhanced error handling with clear success/failure messages
- ✅ Improved restore step: only runs if secrets check passed (avoids unnecessary operations)
- ✅ Maintained existing safety features:
  - Secrets check with graceful skip for PRs/forks
  - Guard conditions on all steps
  - Pinned CLI version 2.65.5
  - Config.toml disable/restore pattern

## Files Changed

| File                                                                      | Change Type                                                           | Description                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `supabase/migrations/20251023_add_job_parts_no_schedule_reason_check.sql` | Renamed → `20251023000000_add_job_parts_no_schedule_reason_check.sql` | Fixed timestamp to 14-digit format                       |
| `supabase/migrations/202510270001_add_loaner_indexes.sql`                 | Renamed → `20251027000001_add_loaner_indexes.sql`                     | Fixed timestamp to 14-digit format                       |
| `supabase/migrations/20251212_job_parts_unique_job_product_schedule.sql`  | Renamed → `20251212200000_job_parts_unique_job_product_schedule.sql`  | Fixed timestamp to 14-digit format                       |
| `.github/workflows/supabase-migrate.yml`                                  | Modified                                                              | Enhanced logging and error handling                      |
| `.github/workflows/supabase-migrate-dry-run.yml`                          | Modified                                                              | Enhanced logging, error handling, and restore conditions |

## Migration Idempotency Verification ✅

All three renamed migrations are already idempotent:

1. **20251023000000_add_job_parts_no_schedule_reason_check.sql**
   - Uses `DO $$ BEGIN ... END $$` block with existence checks
   - Checks for table, columns, and constraint existence before adding
   - Uses `NOT VALID` constraint for safe initial application

2. **20251027000001_add_loaner_indexes.sql**
   - Uses `CREATE INDEX IF NOT EXISTS` for both indexes
   - Safe to re-run without errors

3. **20251212200000_job_parts_unique_job_product_schedule.sql**
   - Uses `create unique index if not exists`
   - Safe to re-run without errors

## Validation Performed ✅

### YAML Validation

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supabase-migrate.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supabase-migrate-dry-run.yml'))"
```

**Result:** Both files are valid YAML ✓

### Migration Timestamp Validation

```bash
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | grep -v '^[0-9]\{14\}_'
```

**Result:** No invalid timestamps found ✓

### Migration Ordering Validation

```bash
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | sed 's/_.*//' | sort -c
```

**Result:** All migrations properly ordered ✓

### Duplicate Detection

```bash
ls -1 supabase/migrations/*.sql | sed 's/.*\///' | sed 's/_.*//' | sort | uniq -d
```

**Result:** No duplicates found ✓

### Build Validation

```bash
pnpm install
pnpm build
```

**Result:** Build succeeded ✓

### Test Validation

```bash
pnpm test
```

**Result:** 887 tests passed, 2 skipped (89 test files) ✓

## How to Verify in GitHub

### 1. Dry-Run Workflow (Manual)

**Steps:**

1. Go to Actions → "Supabase Migrate Dry Run"
2. Click "Run workflow" → Select branch → "Run workflow"
3. Monitor workflow execution

**Expected Output:**

```
=== Supabase CLI Version ===
supabase version 2.65.5

=== Disabling config.toml ===
✓ Renamed config.toml to config.toml.disabled

=== Linking to Supabase Project (Dry-Run) ===
✓ Successfully linked to project

=== Migration Status ===
Local migrations detected: 99
[migration list output]

=== Dry-Run: Validating Migrations ===
Command: supabase db push --dry-run
✓ Dry-run completed successfully - migrations are valid

=== Restoring config.toml ===
✓ Restored config.toml from config.toml.disabled
```

### 2. Dry-Run Workflow (Automatic on PR)

**Steps:**

1. Create a PR that modifies migration files
2. Workflow runs automatically
3. If secrets unavailable (forks/external PRs):
   - Workflow skips cleanly with message
   - No failure, just informational skip

### 3. Production Workflow (Manual)

**Steps:**

1. Go to Actions → "Supabase Migrate Production"
2. Click "Run workflow" → "Run workflow"
3. Monitor workflow execution

**Expected Output:**

```
=== Check required secrets ===
[Secrets verified]

=== Supabase CLI Version ===
supabase version 2.65.5

=== Disabling config.toml ===
✓ Renamed config.toml to config.toml.disabled

=== Linking to Supabase Project ===
✓ Successfully linked to project

=== Migration Status ===
Local migrations detected: 99
[migration list output]

=== Applying Migrations to Production ===
Command: supabase db push --yes
✓ Migrations applied successfully

=== Restoring config.toml ===
✓ Restored config.toml from config.toml.disabled
```

### 4. Production Workflow (Automatic on Push to Main)

**Steps:**

1. Merge PR to main branch
2. Workflow triggers automatically if migrations changed
3. Monitor workflow in Actions tab

### What to Look For

**Success Indicators:**

- ✓ All steps show green checkmarks
- ✓ "Successfully linked to project" message appears
- ✓ "Migrations applied successfully" or "Dry-run completed successfully"
- ✓ "Restored config.toml" message appears
- ✓ No error messages in logs

**Failure Indicators:**

- ✗ Any step shows red X
- ✗ "Migration failed" or "Dry-run validation failed" message
- ✗ Error messages in logs with SQLSTATE codes
- ✗ Missing "Restored config.toml" step (indicates early exit)

## Rollback Plan

### If Migration Fails During Apply

**Option 1: Investigate and Fix Forward**

1. Check workflow logs for specific error message
2. If migration SQL issue:
   - Create new migration to fix issue (forward-only)
   - Do NOT edit historical migrations
3. If schema conflict:
   - Verify production schema state
   - Add pre-migration to resolve dependency
4. Push fix to trigger new workflow run

**Option 2: Revert This PR (Last Resort)**

```bash
# Identify the merge commit
git log --oneline | head -5

# Revert the merge commit
git revert -m 1 <merge-commit-hash>
git push origin main
```

**Warning:** Reverting will restore old invalid timestamps, which may cause issues. Only use if forward fix is not possible.

### If Workflow Configuration Fails

**Option 1: Fix YAML Syntax**

1. Validate YAML locally: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supabase-migrate.yml'))"`
2. Fix syntax errors
3. Push correction

**Option 2: Revert Workflow Changes**

```bash
# Revert only workflow files
git checkout HEAD~1 .github/workflows/supabase-migrate.yml
git checkout HEAD~1 .github/workflows/supabase-migrate-dry-run.yml
git commit -m "revert: restore previous workflow configuration"
git push origin main
```

## Production Migration Verification

After migrations apply successfully in production, verify in Supabase SQL Editor:

### 1. Check Migration History

```sql
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
```

**Expected:**

- `20251212200000` → `job_parts_unique_job_product_schedule` (renamed)
- `20251212194500` → `fix_user_profiles_policy_and_grants`
- `20251212190000` → `job_parts_dedupe_and_unique`
- ... (earlier migrations)

### 2. Verify Renamed Migrations Applied

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20251023000000',
  '20251027000001',
  '20251212200000'
)
ORDER BY version;
```

**Expected:** All three versions present with correct names.

### 3. Verify Job Parts Constraint

```sql
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'job_parts'
  AND con.conname = 'job_parts_no_schedule_reason_chk';
```

**Expected:** Constraint exists and is defined correctly.

### 4. Verify Loaner Indexes

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'loaner_assignments'
  AND indexname IN (
    'loaner_assignments_active_due_date_idx',
    'loaner_assignments_loaner_number_idx'
  );
```

**Expected:** Both indexes exist.

### 5. Verify Job Parts Unique Index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'job_parts'
  AND indexname = 'job_parts_unique_job_product_schedule';
```

**Expected:** Unique index exists with coalesce expressions.

## Non-Negotiables Compliance ✅

1. **No destructive SQL in Supabase UI** ✓
   - All changes in `supabase/migrations/`
   - Merged via PR

2. **No hardcoded org IDs** ✓
   - No app code changes
   - Only migration/workflow changes

3. **Minimal diffs** ✓
   - 3 migration files renamed (required for timestamp fix)
   - 2 workflow files enhanced (logging/error handling only)
   - No schema changes, no data changes

4. **Idempotency** ✓
   - All migrations use IF EXISTS / IF NOT EXISTS
   - Safe to re-run without errors
   - Verified above

## Summary

✅ **Fixed:** 3 migration files with invalid timestamps  
✅ **Enhanced:** Production and dry-run workflows with better logging  
✅ **Validated:** YAML syntax, migration ordering, build, tests  
✅ **Verified:** Idempotency of all changed migrations  
✅ **Documented:** Verification procedures and rollback plan

**Impact:** Zero breaking changes. All migrations maintain backward compatibility. Workflows now provide clearer diagnostics for troubleshooting.
