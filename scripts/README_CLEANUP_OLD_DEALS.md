# Cleanup Old Deals Script

## Overview

`cleanupOldDeals.cjs` is a **one-off maintenance script** designed to delete all existing deals (jobs) except for the single newest one for a specific organization in Supabase.

⚠️ **IMPORTANT**: This is a destructive operation intended for data cleanup and maintenance. It should NOT be used in normal application flow.

## What It Does

The script:
1. Finds the newest job for your organization (by `created_at`, with `updated_at` as fallback)
2. **Keeps** that one job and all its related data
3. **Deletes** all other jobs for that organization, including:
   - `job_parts` (parts used in jobs)
   - `loaner_assignments` (loaner vehicle assignments)
   - `transactions` (financial transactions)
   - `jobs` (the jobs themselves)

## Safety Features

- **DRY_RUN mode** (default: `true`) - Preview changes without deleting anything
- **Org-scoped** - Only touches jobs for the specified `ORG_ID`
- **Defensive checks** - Exits gracefully if 0 or 1 jobs exist
- **Error handling** - Stops on any error with clear messages
- **Detailed logging** - Shows exactly what will be (or was) deleted
- **UUID validation** - Ensures `ORG_ID` is a valid UUID

## Prerequisites

You need the following environment variables:

```bash
SUPABASE_URL           # Your Supabase project URL (or VITE_SUPABASE_URL)
SUPABASE_SERVICE_ROLE_KEY  # Service role key (NOT the anon key)
ORG_ID                 # UUID of the organization to clean up
```

## Usage

### Method 1: Using npm/pnpm script

```bash
# DRY RUN (preview only - default)
ORG_ID="your-org-uuid" pnpm run cleanup:old-deals

# LIVE MODE (actually delete data)
DRY_RUN=false ORG_ID="your-org-uuid" pnpm run cleanup:old-deals
```

### Method 2: Direct execution

```bash
# DRY RUN (preview only - default)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export ORG_ID="550e8400-e29b-41d4-a716-446655440000"
node scripts/cleanupOldDeals.cjs

# LIVE MODE (actually delete data)
DRY_RUN=false node scripts/cleanupOldDeals.cjs
```

### Method 3: Using .env.local

Add to your `.env.local` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ORG_ID=550e8400-e29b-41d4-a716-446655440000
```

Then run:

```bash
# DRY RUN
pnpm run cleanup:old-deals

# LIVE MODE
DRY_RUN=false pnpm run cleanup:old-deals
```

## Step-by-Step Workflow

### Step 1: Find Your Organization ID

Query your Supabase database to get your organization's UUID:

```sql
SELECT id, name FROM organizations;
```

### Step 2: Run in DRY_RUN Mode

**ALWAYS** run in dry-run mode first:

```bash
ORG_ID="your-org-uuid" pnpm run cleanup:old-deals
```

Review the output carefully:
- Check which job will be kept
- Verify the list of jobs to be deleted
- Review the count of related records that will be deleted

### Step 3: Backup Your Database

Before running in live mode, **ALWAYS** backup your database:

1. Go to your Supabase project dashboard
2. Navigate to Database → Backups
3. Create a manual backup
4. Wait for backup to complete

### Step 4: Run in LIVE Mode

Only after reviewing the dry-run output and backing up your database:

```bash
DRY_RUN=false ORG_ID="your-org-uuid" pnpm run cleanup:old-deals
```

The script will:
- Show a warning message
- Wait 3 seconds (giving you time to cancel with Ctrl+C)
- Perform the deletions
- Show a summary of deleted records

## Example Output

### Dry-Run Mode

```
═══════════════════════════════════════════════════════════
  Cleanup Old Deals Script
═══════════════════════════════════════════════════════════

Configuration:
  Supabase URL: https://your-project.supabase.co
  Organization ID: 550e8400-e29b-41d4-a716-446655440000
  Mode: 🔍 DRY RUN (preview only)

Step 1: Querying jobs for organization...
   Found 5 job(s) for this organization

═══════════════════════════════════════════════════════════
Step 2: Jobs Summary
═══════════════════════════════════════════════════════════

✅ Job to KEEP:
   ID: abc-123-def-456
   Number: JOB-2025-001
   Title: Customer Vehicle Service
   Created: 2025-12-06T10:30:00.000Z
   Updated: 2025-12-06T15:45:00.000Z

🗑️  Jobs to DELETE: 4
   1. JOB-2025-000 - Test Deal
      Created: 2025-12-05T09:00:00.000Z
   2. JOB-2024-099 - Old Service Request
      Created: 2025-12-04T14:20:00.000Z
   ...

═══════════════════════════════════════════════════════════
Step 3: Related Records Summary
═══════════════════════════════════════════════════════════

   job_parts: 12 records
   loaner_assignments: 3 records
   transactions: 8 records
   jobs: 4 records

═══════════════════════════════════════════════════════════
🔍 DRY RUN MODE - No data was deleted
═══════════════════════════════════════════════════════════

To actually perform the deletion, run:
  DRY_RUN=false node scripts/cleanupOldDeals.cjs

⚠️  Make sure to backup your database first!
```

### Live Mode

After successful deletion:

```
═══════════════════════════════════════════════════════════
✅ Cleanup Complete
═══════════════════════════════════════════════════════════

Records deleted:
   job_parts: 12
   loaner_assignments: 3
   transactions: 8
   jobs: 4

Remaining job:
   JOB-2025-001 - Customer Vehicle Service
   Created: 2025-12-06T10:30:00.000Z
```

## Error Scenarios

### No Jobs Found

```
ℹ️  No jobs found for this organization. Nothing to delete.
```

### Only One Job Found

```
ℹ️  Only one job found for this organization. Nothing to delete.
   Existing job: JOB-2025-001 - Customer Vehicle Service
   Created: 2025-12-06T10:30:00.000Z
```

### Missing Environment Variables

```
❌ Configuration errors:
   Missing SUPABASE_URL or VITE_SUPABASE_URL in environment
   Missing SUPABASE_SERVICE_ROLE_KEY in environment
   Missing ORG_ID in environment
```

### Database Error

```
❌ Error querying jobs: [error message]
```

## SQL Alternative

If you prefer to run SQL directly in the Supabase SQL editor, the script includes a complete SQL version at the bottom of the file. See the comments in `cleanupOldDeals.cjs` for the full SQL script.

### Quick SQL Version

```sql
-- Step 1: Find the newest job
SELECT id, job_number, title, created_at
FROM jobs
WHERE org_id = 'your-org-uuid'
ORDER BY created_at DESC NULLS LAST
LIMIT 1;

-- Step 2: Delete old jobs and related data (replace :KEEP_JOB_ID)
BEGIN;

DELETE FROM job_parts
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = 'your-org-uuid' AND id != ':KEEP_JOB_ID'
);

DELETE FROM loaner_assignments
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = 'your-org-uuid' AND id != ':KEEP_JOB_ID'
);

DELETE FROM transactions
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = 'your-org-uuid' AND id != ':KEEP_JOB_ID'
);

DELETE FROM jobs
WHERE org_id = 'your-org-uuid' AND id != ':KEEP_JOB_ID';

-- Review before committing!
COMMIT;
```

## When to Use This Script

✅ **Appropriate use cases:**
- Cleaning up after development/testing
- Removing accidentally created duplicate jobs
- Resetting a test environment
- One-time data maintenance

❌ **DO NOT use for:**
- Normal application flow
- Automated processes or cron jobs
- Production data without thorough review
- Any scenario where you haven't reviewed the dry-run output

## Troubleshooting

### Issue: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution**: Make sure you're using the SERVICE ROLE key, not the anon key. Find it in:
- Supabase Dashboard → Settings → API → service_role key (secret)

### Issue: "ORG_ID must be a valid UUID"

**Solution**: Ensure your ORG_ID is in UUID format:
```
550e8400-e29b-41d4-a716-446655440000
```

Not:
```
priority-lexus-vb  ❌
550e8400e29b41d4a716446655440000  ❌ (missing hyphens)
```

### Issue: Script says "No jobs found" but I have jobs

**Solution**: 
- Verify the ORG_ID is correct
- Check if your jobs have `org_id` set:
  ```sql
  SELECT id, job_number, org_id FROM jobs LIMIT 10;
  ```

### Issue: Permission denied errors

**Solution**: Ensure you're using the SERVICE_ROLE_KEY which bypasses RLS policies, not the anon key.

## Security Notes

1. **Never commit** the `.env.local` file with real credentials
2. **Use service role key** only in secure, server-side contexts
3. **The service role key** bypasses Row Level Security - use with caution
4. **Always backup** before running destructive operations
5. **Review dry-run output** carefully before proceeding

## Related Files

- `scripts/cleanupOldDeals.cjs` - The main Node.js script
- `scripts/sql/cleanup_old_deals.sql` - Standalone SQL version for Supabase SQL Editor
- `scripts/QUICK_REFERENCE_CLEANUP.md` - Quick reference card
- `scripts/bootstrapTestUser.js` - Example of using service role key

## Support

For issues or questions:
1. Review this README
2. Check the script comments in `cleanupOldDeals.cjs`
3. Review error messages carefully
4. Consult the Supabase documentation

---

**Remember**: This is a maintenance tool. Use it responsibly!
