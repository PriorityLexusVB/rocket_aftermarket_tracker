# Deployment Guide - Schema Migrations and Cache Management

## Critical: Schema Cache Reload for PostgREST/Supabase

When deploying database migrations that modify table relationships (foreign keys, new tables, RLS policies), the PostgREST schema cache MUST be reloaded for the changes to be accessible via the REST API.

### Problem: Schema Cache Staleness

**Symptoms:**

- Migration applies successfully
- Foreign key exists in database
- SQL queries work fine
- REST API queries fail with: `Could not find a relationship between 'X' and 'Y' in the schema cache`
- Application shows errors even though database is correct

**Root Cause:**
PostgREST caches the database schema in memory for performance. After a migration that changes relationships, the cached schema is stale and doesn't reflect the new structure.

### Solution: Schema Cache Reload

#### Automatic (Recommended)

Include the reload notification at the end of your migration file:

```sql
-- At the end of your migration
NOTIFY pgrst, 'reload schema';
```

This ensures the schema cache is reloaded immediately when the migration is applied.

#### Manual (If migration already applied without reload)

**Option 1: Via Supabase CLI**

```bash
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

**Option 2: Via SQL Client**

```sql
NOTIFY pgrst, 'reload schema';
```

**Option 3: Via Supabase Dashboard**

1. Go to SQL Editor
2. Execute: `NOTIFY pgrst, 'reload schema';`
3. Verify by testing the query that was failing

## Standard Deployment Order

### 1. Pre-Deployment Checks

```bash
# Verify all tests pass
pnpm test

# Verify build succeeds
pnpm build

# Check migration syntax
supabase migration list
```

### 2. Apply Database Migrations

**Local/Staging:**

```bash
supabase db push
```

**Production:**

```bash
# Link to production project first (one-time)
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push

# Verify schema cache reloaded
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

### 3. Verify Schema Changes

**Check foreign keys exist:**

```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts';
```

**Test relationship query:**

```sql
-- This should work after migration and cache reload
SELECT
    jp.id,
    jp.vendor_id,
    v.name as vendor_name
FROM job_parts jp
LEFT JOIN vendors v ON v.id = jp.vendor_id
LIMIT 1;
```

### 4. Deploy Application Code

```bash
# Vercel auto-deploys from main branch
git push origin main

# Or manual deploy
vercel --prod
```

### 5. Post-Deployment Verification

**Test the Deals page:**

- Navigate to Deals page
- Verify no error banner about missing relationships
- Check that vendor column displays correctly
- Create a new deal and verify vendor data saves

**Monitor logs:**

```bash
# Check for PostgREST errors
supabase logs --type postgrest

# Check for API errors
supabase logs --type api
```

## Common Migration Scenarios

### Adding Foreign Key Relationship

**Example: Adding vendor_id to job_parts**

```sql
-- Step 1: Add column
ALTER TABLE public.job_parts
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Step 2: Add index
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);

-- Step 3: Backfill data (if applicable)
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Step 4: Add RLS policies (if needed)
-- ... policy definitions ...

-- Step 5: CRITICAL - Reload schema cache
NOTIFY pgrst, 'reload schema';
```

### Modifying Existing Relationship

```sql
-- Make schema changes
ALTER TABLE ... ;

-- ALWAYS reload cache after relationship changes
NOTIFY pgrst, 'reload schema';
```

### Adding New Table with Relationships

```sql
-- Create table
CREATE TABLE new_table (
    id UUID PRIMARY KEY,
    other_table_id UUID REFERENCES other_table(id)
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY ... ;

-- Reload cache so REST API recognizes the new table
NOTIFY pgrst, 'reload schema';
```

## Rollback Procedures

### If migration fails:

```bash
# Check what migrations are applied
supabase migration list

# Rollback (manual - Supabase doesn't have automatic rollback)
# Create a new migration that reverses the changes
supabase migration new rollback_description

# Example rollback migration:
# ALTER TABLE job_parts DROP COLUMN IF EXISTS vendor_id;
```

### If cache issues persist:

1. **Restart PostgREST** (via Supabase dashboard or support)
2. **Verify migration actually applied:**
   ```sql
   \d+ job_parts  -- Shows table structure
   ```
3. **Check PostgREST config:**
   ```sql
   -- Verify search path includes public schema
   SHOW search_path;
   ```

## Testing Schema Changes Locally

### Setup local Supabase:

```bash
supabase start
```

### Apply migration:

```bash
supabase db reset  # Fresh start with all migrations
```

### Test the relationship:

```javascript
// In your app or via Supabase Studio
const { data, error } = await supabase
  .from('job_parts')
  .select('id, vendor_id, vendor:vendors(id, name)')
  .limit(1)

console.log('Data:', data)
console.log('Error:', error) // Should be null
```

### Common test failures:

- **Missing relationship error** → Schema cache not reloaded
- **Column doesn't exist** → Migration not applied
- **Permission denied** → RLS policy too restrictive

## Health Check Verification (NEW)

### Health Endpoint

Use the runtime health check to verify schema relationships:

```bash
# Check vendor relationship status
curl https://your-app.vercel.app/api/health/deals-rel

# Expected response for healthy system:
{
  "vendorRelationship": "ok",
  "timestamp": "2025-11-07T18:00:00.000Z",
  "details": {
    "checks": [
      {"name": "supabase_connectivity", "status": "ok"},
      {"name": "job_parts_vendor_relationship", "status": "ok", "sample": {...}}
    ]
  }
}
```

### Automated Test Verification

Run persistence tests to verify all behaviors:

```bash
# Run all tests
pnpm test

# Run specific persistence tests
pnpm test src/tests/unit/dealService.persistence.test.js
```

Tests cover:

- ✅ org_id inference (3 tests)
- ✅ loaner assignment persistence (5 tests)
- ✅ scheduling fallback (6 tests)
- ✅ error wrapper mapping (4 tests)
- ✅ vendor aggregation logic (6 tests)
- ✅ vehicle description fallback (6 tests)

## Production Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] Migration file includes `NOTIFY pgrst, 'reload schema';`
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Tested locally with `supabase db reset`
- [ ] Tested relationship queries work after migration
- [ ] Rollback plan documented
- [ ] Stakeholders notified of deployment window
- [ ] Monitoring dashboard ready
- [ ] **NEW:** Health endpoint returns "ok" for vendorRelationship

During deployment:

- [ ] Apply migration with `supabase db push`
- [ ] Verify schema cache reloaded (check logs or test query)
- [ ] Deploy application code
- [ ] Verify Deals page loads without errors
- [ ] Check vendor data displays correctly
- [ ] Monitor error logs for 15 minutes
- [ ] **NEW:** Verify `/api/health/deals-rel` returns 200 OK

After deployment:

- [ ] Full smoke test of key features
- [ ] Update CHANGELOG.md
- [ ] Update deployment notes in issue/PR
- [ ] Notify team of successful deployment
- [ ] **NEW:** Run verify-schema-cache.sh to confirm all checks pass

## RLS Policy Verification

### Check Helper Functions

Verify helper functions don't reference auth.users:

```sql
-- Check is_admin_or_manager() function source
SELECT prosrc FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager';

-- Should NOT contain 'auth.users'
-- Should ONLY contain 'public.user_profiles'
```

### Verify Write Policies Exist

```sql
-- Check policy coverage for key tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('loaner_assignments', 'transactions', 'vehicles', 'sms_templates', 'products', 'vendors')
ORDER BY tablename, cmd;
```

Expected results:

- **loaner_assignments**: SELECT, INSERT, UPDATE, DELETE policies
- **transactions**: SELECT, INSERT, UPDATE policies
- **vehicles**: SELECT, INSERT, UPDATE policies
- **sms_templates**: SELECT, INSERT, UPDATE, DELETE policies
- **products**: SELECT, INSERT, UPDATE policies
- **vendors**: SELECT, INSERT, UPDATE policies

## References

- [PostgREST Schema Cache](https://postgrest.org/en/stable/admin.html#schema-cache)
- [Supabase Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
