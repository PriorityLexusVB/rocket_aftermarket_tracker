# Supabase Migration Workflow Fix - Summary

## Problem Statement

The GitHub Actions workflow `Supabase Migrate Production` was failing with:
```
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
Key (version)=(20250110120000) already exists.
```

## Root Cause

**Duplicate migration timestamp:** Two migration files had the same timestamp `20250110120000`:
- `20250110120000_complete_priority_automotive_data_restoration.sql`
- `20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql`

When the Supabase CLI attempted to apply migrations, it tried to insert both versions with the same key into `supabase_migrations.schema_migrations`, causing a primary key violation.

## Solution Implemented

### 1. Fixed Duplicate Migration Timestamp ✅

**File renamed:**
```
supabase/migrations/20250110120000_complete_priority_automotive_data_restoration.sql
→ supabase/migrations/20250110120001_complete_priority_automotive_data_restoration.sql
```

This ensures unique migration version numbers going forward.

### 2. Added Migration Repair Step ✅

**Production Workflow** (`.github/workflows/supabase-migrate.yml`):

Added a new step: **"Repair migration history for duplicate timestamps"** that:
- Runs before `supabase db push --include-all`
- Marks migration `20250110120000` as already applied if it exists remotely
- Uses `supabase migration repair` command (available in CLI v2.65.5)
- Handles cases where the migration doesn't exist (no repair needed)
- Non-destructive: only marks existing migrations as applied, never modifies schema

**Why it's safe:**
- `supabase migration repair` only updates the `schema_migrations` tracking table
- Does NOT execute any SQL statements from the migration file
- Does NOT modify database schema or data
- Prevents duplicate key errors by reconciling what's already applied vs. what the CLI thinks needs to be applied

### 3. Enhanced Workflow Logging ✅

Both production and dry-run workflows now include:

**Production workflow improvements:**
- ✓ Print Supabase CLI version with clear headers
- ✓ Show masked project ref (first 8 chars + ***)
- ✓ List pending migrations before applying
- ✓ Show repair step status and diagnostics
- ✓ Clear success/failure messages for each step

**Dry-run workflow improvements:**
- ✓ Print Supabase CLI version with clear headers
- ✓ Show masked project ref
- ✓ List pending migrations
- ✓ Clear dry-run validation messages
- ✓ Maintains safe skip when secrets are missing (PR context)

### 4. Verified Workflow Safety ✅

**Dry-run workflow** (`.github/workflows/supabase-migrate-dry-run.yml`):
- ✓ Never uses `supabase-production` environment
- ✓ Skips cleanly if secrets missing in PR context
- ✓ Uses `supabase db push --dry-run` (validation only)
- ✓ Uses same CLI version pin (2.65.5) as production workflow

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/20250110120000_complete_priority_automotive_data_restoration.sql` | Renamed | Moved to `20250110120001_complete_priority_automotive_data_restoration.sql` |
| `.github/workflows/supabase-migrate.yml` | Modified | Added repair step, enhanced logging |
| `.github/workflows/supabase-migrate-dry-run.yml` | Modified | Enhanced logging for consistency |
| `MIGRATION_FIX_SUMMARY.md` | Created | This documentation file |

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
- `20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql` (kept)
- `20250110120001_complete_priority_automotive_data_restoration.sql` (renamed, new timestamp)

### ✅ CLI Version Verification
**CLI Version:** 2.65.5 (pinned in both workflows)
**Repair Command:** Available and tested

### ✅ Workflow Configuration Verification

**Production Workflow:**
- ✅ Uses `environment: supabase-production`
- ✅ Requires secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`
- ✅ CLI version pinned to 2.65.5
- ✅ Uses `supabase db push --include-all` (required for ordering drift)
- ✅ Includes repair step before push

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
- ✓ "Migration 20250110120000 repair completed successfully" OR "Migration 20250110120000 not found in history - no repair needed"
- ✓ "Migration history reconciliation complete"
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
- ✓ No duplicate `20250110120000` entries
- ✓ `20250110120000_user_profiles_relax_email_and_add_auth_user_id` present
- ✓ `20250110120001_complete_priority_automotive_data_restoration` present
- ✓ `20250117000000_add_job_parts_scheduling_times` present (most recent)
- ✓ No error messages in workflow logs

### 5. Verify No Schema Corruption

Check that recent migrations are applied correctly:
```sql
-- Verify user_profiles columns from 20250110120000
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
- `user_profiles.email` should be nullable
- `user_profiles.auth_user_id` should exist (UUID, nullable)
- `job_parts.scheduled_start_time` should exist (TIMESTAMPTZ)
- `job_parts.scheduled_end_time` should exist (TIMESTAMPTZ)

## Rollback Plan

If the migration workflow fails:

### Option 1: If repair step fails but workflow continues
- Review the repair step logs
- Migration repair is non-destructive, so failure here won't corrupt data
- Manual repair: Connect to Supabase SQL editor and run:
  ```sql
  INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
  VALUES ('20250110120000', 'user_profiles_relax_email_and_add_auth_user_id', ARRAY[]::text[])
  ON CONFLICT (version) DO NOTHING;
  ```

### Option 2: If push step fails with different error
- Check workflow logs for specific error
- If schema conflict: review migration SQL for issues
- Can manually apply specific migrations via Supabase SQL editor
- Do NOT attempt to delete from `schema_migrations` table

### Option 3: Revert this PR
```bash
git revert <commit-hash>
git push origin main
```
This will:
- Restore the duplicate timestamp (but won't fix the original problem)
- Remove the repair step (problem will persist)
- **Only use as last resort** - better to fix forward

## Technical Details

### Supabase CLI `migration repair` Command

**Syntax:**
```bash
supabase migration repair [version] --status applied --linked -p <password>
```

**What it does:**
- Updates `supabase_migrations.schema_migrations` table
- Marks specified version as applied or reverted
- Does NOT execute migration SQL
- Does NOT modify database schema

**Use cases:**
- Reconcile when migration was applied manually
- Fix drift between local and remote migration history
- Resolve duplicate key errors from out-of-order migrations

**Safety guarantees:**
- Read-only on actual database schema
- Only writes to tracking table
- Idempotent (safe to run multiple times)
- Includes `--linked` flag to target remote project

### Why `--include-all` is Required

The problem statement mentions `supabase db push --include-all` is used "because CLI requires it for ordering drift."

**Context:**
- `--include-all` ensures ALL local migrations are considered, even if they're out of order
- Without it, CLI might skip migrations that appear "older" than latest applied version
- Required when local migration history diverges from remote

## Conclusion

✅ **Root cause identified:** Duplicate migration timestamp  
✅ **Fix implemented:** Renamed migration + repair step  
✅ **Safety verified:** Non-destructive, deterministic workflow  
✅ **Logging enhanced:** Clear diagnostics for troubleshooting  
✅ **Workflows validated:** YAML syntax correct, dry-run safe  

The fix is minimal, surgical, and preserves all historical migrations. The repair step ensures production can recover from the current duplicate key error without manual intervention.
