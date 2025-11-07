# Troubleshooting Schema Cache Issues

## Quick Reference: Relationship Migrations Checklist

**CRITICAL RULE**: Relationship migrations MUST include `NOTIFY pgrst, 'reload schema'`

### Before Deploying Relationship Migrations
- [ ] Migration includes FK constraint creation
- [ ] Migration ends with `NOTIFY pgrst, 'reload schema';`
- [ ] Run verification script: `./scripts/verify-schema-cache.sh`
- [ ] Test REST probe: `/rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1`

### Verification Steps After Deployment
1. Check FK exists in database schema
2. Run `NOTIFY pgrst, 'reload schema';` (if not in migration)
3. Wait 5-10 seconds for cache refresh
4. Test REST API relationship query
5. Verify application loads without "relationship not found" errors

---

## The "Relationship Not Found" Error

### Symptom
```
Failed to load deals: Missing database relationship between job_parts and vendors. 
Please run the migration to add per-line vendor support (vendor_id column to job_parts table). 
Original error: Could not find a relationship between 'job_parts' and 'vendors' in the schema cache
```

### Common Causes

#### 1. Migration Applied But Cache Not Reloaded
**What Happened:**
- Migration file was applied to database
- Foreign key exists in database schema
- PostgREST schema cache still has old schema
- REST API doesn't know about the new relationship

**How to Verify:**
```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_parts' 
  AND column_name = 'vendor_id';

-- Check if foreign key exists
SELECT
    tc.constraint_name,
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts'
    AND kcu.column_name = 'vendor_id';
```

**If Both Queries Return Results:** The column and FK exist. The cache needs reload.

**Solution:**
```sql
NOTIFY pgrst, 'reload schema';
```

Or via Supabase CLI:
```bash
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

#### 2. Migration Not Applied
**What Happened:**
- Code was deployed expecting new schema
- Migration was not run in production
- Database structure is outdated

**How to Verify:**
```sql
-- If this returns no rows, migration wasn't applied
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'job_parts' 
  AND column_name = 'vendor_id';
```

**Solution:**
```bash
# Apply migrations
supabase db push

# Verify cache reloaded (if migration includes NOTIFY, this is automatic)
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"
```

#### 3. Migration Applied But Missing NOTIFY Statement
**What Happened:**
- Old migration file without schema cache reload
- Need to add NOTIFY to migration or run manually

**How to Verify:**
Check migration file for:
```sql
NOTIFY pgrst, 'reload schema';
```

**Solution:**
Either update the migration file to include NOTIFY (for future runs), or run manually now:
```sql
NOTIFY pgrst, 'reload schema';
```

## Understanding PostgREST Schema Cache

### What Is It?
PostgREST loads the database schema into memory on startup to:
- Speed up query planning
- Enable automatic REST endpoint generation
- Support relationship traversal syntax (e.g., `table:foreign_table(...)`)

### When Does It Update?
- On PostgREST restart
- When receiving `NOTIFY pgrst, 'reload schema'`
- NOT automatically when schema changes

### Why This Design?
- Performance: Avoid schema introspection on every request
- Predictability: Schema changes don't affect running API
- Explicit: Operators control when changes take effect

## Quick Diagnosis Checklist

Run through these steps in order:

### Step 1: Verify Database Structure
```sql
-- Does the column exist?
\d+ job_parts

-- Does the foreign key exist?
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'job_parts' AND column_name = 'vendor_id';
```

**If NO:** Apply migration with `supabase db push`

**If YES:** Continue to Step 2

### Step 2: Reload Schema Cache
```sql
NOTIFY pgrst, 'reload schema';
```

Wait 5-10 seconds for cache to reload.

### Step 3: Test the Relationship
Via Supabase Studio or REST client:
```
GET /rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1
```

**Expected:** JSON with nested vendor object

**If Still Failing:** Continue to Step 4

### Step 4: Check PostgREST Logs
```bash
supabase logs --type postgrest --limit 50
```

Look for:
- Schema reload confirmations
- Errors about missing tables/columns
- Configuration issues

### Step 5: Verify Query Syntax
The relationship syntax must match the foreign key:

**Correct:**
```javascript
.select('*, vendor:vendors(id, name)')
```

**Incorrect:**
```javascript
.select('*, vendors(id, name)')  // Missing alias
.select('*, vendor_data:vendors(id, name)')  // Wrong alias
```

The alias before the colon can be anything, but convention is to use the column name without `_id`:
- `vendor_id` → `vendor:vendors(...)`
- `customer_id` → `customer:customers(...)`
- `assigned_user_id` → `assigned_user:user_profiles(...)`

### Step 6: Nuclear Option - Restart PostgREST
If all else fails:
```bash
# Via Supabase dashboard: 
# Settings > Database > Restart Database

# Or contact support to restart PostgREST service
```

## Prevention

### In Migration Files
Always include at the end:
```sql
-- Your schema changes here
ALTER TABLE ...;
CREATE INDEX ...;

-- CRITICAL: Reload cache
NOTIFY pgrst, 'reload schema';
```

### In Deployment Process
1. Apply migrations
2. Verify schema cache reloaded
3. Test key relationship queries
4. Deploy application code

### In CI/CD
Include a post-migration verification step:
```bash
#!/bin/bash
# verify-schema-cache.sh

echo "Applying migrations..."
supabase db push

echo "Reloading schema cache..."
supabase db execute --sql "NOTIFY pgrst, 'reload schema';"

echo "Waiting for cache reload..."
sleep 5

echo "Testing relationship query..."
curl -X GET "${SUPABASE_URL}/rest/v1/job_parts?select=id,vendor:vendors(name)&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

if [ $? -eq 0 ]; then
  echo "✅ Schema cache verified"
else
  echo "❌ Schema cache verification failed"
  exit 1
fi
```

**Better Approach:** Use the provided verification script:
```bash
./scripts/verify-schema-cache.sh
```

This script is CI-ready and includes:
- Column existence check
- FK constraint verification
- Index verification
- Schema cache reload
- REST API relationship probe
- Proper exit codes for automation

## Historical Context

This issue occurred because:
1. Migration `20251106000000_add_job_parts_vendor_id.sql` was created
2. Application code was updated to use `vendor:vendors(...)` syntax
3. Migration was applied to database
4. But migration didn't include `NOTIFY pgrst, 'reload schema'`
5. PostgREST still had old schema cache without the FK
6. API queries failed even though database was correct

**The Fix:**
- Added `NOTIFY pgrst, 'reload schema'` to migration files
- Created idempotent migration `20251107093000_verify_job_parts_vendor_fk.sql`
- Enhanced verification script for automated drift detection
- Added test `tests/unit/db.vendor-relationship.spec.ts` for CI validation

## Automated Drift Detection

Run these checks in CI/CD:

### Pre-E2E Test Hook
```bash
# In CI pipeline, before running E2E tests
./scripts/verify-schema-cache.sh
if [ $? -ne 0 ]; then
  echo "Schema drift detected! Relationship verification failed."
  exit 1
fi
```

### Unit Test
```bash
# Run the relationship verification test
pnpm test tests/unit/db.vendor-relationship.spec.ts
```

This test checks:
- REST API returns 200 OK for nested vendor query
- No "Could not find a relationship" error in response
- Response is valid JSON (array or object)

## References

- [PostgREST Schema Cache](https://postgrest.org/en/stable/admin.html#schema-cache)
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [Supabase Foreign Data Relationships](https://supabase.com/docs/guides/api/joins-and-nested-tables)

## Still Having Issues?

If none of the above solves your problem:

1. Collect diagnostic info:
   ```sql
   -- Database version
   SELECT version();
   
   -- PostgREST schema cache age
   SELECT pg_postmaster_start_time();
   
   -- Recent schema changes
   SELECT schemaname, tablename, tableowner
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

2. Check these files:
   - Migration file: `supabase/migrations/20251106000000_add_job_parts_vendor_id.sql`
   - Query code: `src/services/dealService.js` (lines with `vendor:vendors`)
   - Error logs: Application console and Supabase logs

3. Create an issue with:
   - Full error message
   - Migration file content
   - Query that's failing
   - Results of diagnostic SQL queries above
