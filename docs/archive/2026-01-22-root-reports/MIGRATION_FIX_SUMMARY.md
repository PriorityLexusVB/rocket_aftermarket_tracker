# Supabase Migration Workflow Fix - Summary

## Problem Statement

The GitHub Actions workflow `Supabase Migrate Production` was failing with:

```
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
Key (version)=(20250110120000) already exists.
```

## Root Cause

**Duplicate migration timestamp:** Two migration files had the same timestamp `20250110120000`:

- `20250110120000_complete_priority_automotive_data_restoration.sql` (data migration)
- `20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql` (schema migration)

**Critical Context:** Production database already has version `20250110120000` recorded as `complete_priority_automotive_data_restoration` and fully applied. The `user_profiles_relax_email_and_add_auth_user_id` migration was never applied due to the duplicate timestamp conflict.

When the Supabase CLI attempted to apply migrations, it tried to insert both versions with the same key into `supabase_migrations.schema_migrations`, causing a primary key violation.

## Solution Implemented

### 1. Fixed Duplicate Migration Timestamp ✅

**File renamed (CORRECTED):**

```
supabase/migrations/20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql
→ supabase/migrations/20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql
```

**IMPORTANT:** We renamed the `user_profiles_relax_email_and_add_auth_user_id` migration (NOT the `complete_priority_automotive_data_restoration` one) because:

- Production already has `20250110120000` recorded as `complete_priority_automotive_data_restoration`
- Renaming the data restoration migration would cause it to attempt re-running in production
- The user profiles migration was never applied, so it can safely be assigned a new timestamp

This ensures unique migration version numbers and prevents re-running already-applied data restoration SQL.

### 2. Enhanced Workflow Logging ✅

Both production and dry-run workflows now include:

**Production workflow improvements:**

- ✓ Print Supabase CLI version with clear headers
- ✓ List pending migrations before applying (visibility into what will be applied)
- ✓ Clear success/failure messages for each step
- ✓ GitHub Actions automatically masks secrets in logs (no manual masking needed)

**Dry-run workflow improvements:**

- ✓ Print Supabase CLI version with clear headers
- ✓ List pending migrations
- ✓ Clear dry-run validation messages
- ✓ Maintains safe skip when secrets are missing (PR context)

### 3. Verified Workflow Safety ✅

**Dry-run workflow** (`.github/workflows/supabase-migrate-dry-run.yml`):

- ✓ Never uses `supabase-production` environment
- ✓ Skips cleanly if secrets missing in PR context
- ✓ Uses `supabase db push --dry-run` (validation only)
- ✓ Uses same CLI version pin (2.65.5) as production workflow

## Files Changed

| File                                                                                    | Change Type    | Description                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql` | Renamed        | Moved to `20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql` (the OTHER file, not the data restoration) |
| `supabase/migrations/20250110120000_complete_priority_automotive_data_restoration.sql`  | Kept unchanged | Remains at timestamp 20250110120000 as it's already applied in production                                               |
| `.github/workflows/supabase-migrate.yml`                                                | Modified       | Removed unnecessary repair step, enhanced logging, removed manual secret masking                                        |
| `.github/workflows/supabase-migrate-dry-run.yml`                                        | Modified       | Enhanced logging, removed manual secret masking                                                                         |
| `MIGRATION_FIX_SUMMARY.md`                                                              | Modified       | Updated to reflect correct solution                                                                                     |

## Verification Performed

### ✅ YAML Validation

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supabase-migrate.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supabase-migrate-dry-run.yml'))"
```

**Result:** Both files are valid YAML

### ✅ Migration File Rename Verification

```bash
ls -la supabase/migrations/202501101*
```

**Result:**

- `20250110120000_complete_priority_automotive_data_restoration.sql` (kept - already applied in production)
- `20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql` (renamed - never applied, safe to use new timestamp)

### ✅ CLI Version Verification

**CLI Version:** 2.65.5 (pinned in both workflows)
**Repair Command:** Available and tested

### ✅ Workflow Configuration Verification

**Production Workflow:**

- ✅ Uses `environment: supabase-production`
- ✅ Requires secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`
- ✅ CLI version pinned to 2.65.5
- ✅ Uses `supabase db push --include-all` (required for ordering drift)
- ✅ No repair step needed (unique timestamps eliminate conflict)

**Dry-Run Workflow:**

- ✅ Never uses production environment
- ✅ Safely skips when secrets unavailable
- ✅ Uses `--dry-run` flag (validation only)
- ✅ Same CLI version as production (2.65.5)

## Manual Verification Checklist

After merging this PR, follow these steps:

### 1. Merge the PR

```bash
# In GitHub UI, merge this PR to main
```

### 2. Run the Production Migration Workflow

```bash
# In GitHub UI:
# 1. Go to Actions → "Supabase Migrate Production"
# 2. Click "Run workflow" → "Run workflow"
# 3. Monitor the workflow execution
```

### 3. Verify Workflow Steps Succeed

Watch for these log messages:

- ✓ "Successfully linked to project"
- ✓ "Migrations applied successfully"

### 4. Verify in Supabase SQL Editor

Connect to your Supabase project and run:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;
```

**Expected results:**

- ✓ `20250117000000` → `add_job_parts_scheduling_times` (most recent)
- ✓ `20250110120001` → `user_profiles_relax_email_and_add_auth_user_id` (newly applied with new timestamp)
- ✓ `20250110120000` → `complete_priority_automotive_data_restoration` (already existed, unchanged)
- ✓ No duplicate entries for any version
- ✓ No error messages in workflow logs

### 5. Verify New Migration Applied Correctly

Check that the user_profiles migration (now at 20250110120001) was applied:

```sql
-- Verify user_profiles columns from 20250110120001 (renamed migration)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('email', 'auth_user_id')
ORDER BY column_name;

-- Verify job_parts columns from 20250117000000
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'job_parts'
  AND column_name IN ('scheduled_start_time', 'scheduled_end_time')
ORDER BY column_name;
```

**Expected results:**

- `user_profiles.email` should be nullable (from 20250110120001)
- `user_profiles.auth_user_id` should exist (UUID, nullable) (from 20250110120001)
- `job_parts.scheduled_start_time` should exist (TIMESTAMPTZ)
- `job_parts.scheduled_end_time` should exist (TIMESTAMPTZ)

## Rollback Plan

If the migration workflow fails:

### Option 1: If push step fails with migration error

- Check workflow logs for specific error
- If schema conflict: review migration SQL for issues
- Can manually apply the `20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql` migration via Supabase SQL editor
- Do NOT attempt to delete from `schema_migrations` table

### Option 2: Revert this PR

```bash
git revert <commit-hash>
git push origin main
```

This will:

- Restore the duplicate timestamp (original problem returns)
- **Only use as last resort** - better to fix forward

## Technical Details

### Why `--include-all` is Required

The problem statement mentions `supabase db push --include-all` is used "because CLI requires it for ordering drift."

**Context:**

- `--include-all` ensures ALL local migrations are considered, even if they're out of order
- Without it, CLI might skip migrations that appear "older" than latest applied version
- Required when local migration history diverges from remote

### Why No Repair Step is Needed

Since we renamed the correct migration file (the one that was never applied), there is no conflict with production:

- Production has: `20250110120000` → `complete_priority_automotive_data_restoration` (already applied)
- Local now has: `20250110120000` → `complete_priority_automotive_data_restoration` (matches production)
- Local also has: `20250110120001` → `user_profiles_relax_email_and_add_auth_user_id` (new, will be applied)

No repair/reconciliation is needed because:

1. The timestamps are now unique
2. The already-applied migration remains at its original timestamp
3. The never-applied migration gets a new unique timestamp and will be applied normally

## Conclusion

✅ **Root cause identified:** Duplicate migration timestamp  
✅ **Fix implemented:** Renamed the CORRECT migration (user_profiles, not data_restoration)  
✅ **Safety verified:** Preserves already-applied migrations, prevents re-running data restoration  
✅ **Logging enhanced:** Clear diagnostics for troubleshooting  
✅ **Workflows validated:** YAML syntax correct, dry-run safe

The fix is minimal, surgical, and preserves all historical migrations. By renaming the never-applied migration instead of the already-applied one, we prevent re-running data restoration SQL in production.
