# Job Parts ↔ Vendors Relationship Fix

## Problem Statement

Production Deals page showed a blocking error:
```
Failed to load deals: Missing database relationship between job_parts and vendors. 
Please run the migration to add per-line vendor support (vendor_id column to job_parts table). 
Original error: Could not find a relationship between 'job_parts' and 'vendors' in the schema cache
```

HTTP 400 error from: `GET .../rest/v1/jobs?select=..., job_parts(..., vendor:vendors(...))`

## Root Cause Analysis

### The Bug

Migration `20251106000000_add_job_parts_vendor_id.sql` line 10 has a critical flaw:

```sql
ALTER TABLE public.job_parts
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
```

**The Issue**: When `IF NOT EXISTS` skips column creation (because the column already exists from a prior migration attempt or manual addition), the `REFERENCES` clause is **never executed**, leaving no foreign key constraint.

PostgREST requires a **named foreign key constraint** in the database catalog to recognize relationships for nested selects like `vendor:vendors(...)`. Without this constraint:
- The column may exist
- The index may exist
- But PostgREST cannot recognize the relationship
- Queries fail with "Could not find a relationship...in the schema cache"

### Why This Happened

1. Initial schema (`20250922170950_automotive_aftermarket_system.sql`) created `job_parts` **without** `vendor_id` column
2. Migration `20251106000000` attempted to add it with inline FK constraint
3. If column was added manually or partially before the migration ran, the `IF NOT EXISTS` would skip, leaving no FK
4. Schema cache reload (`NOTIFY pgrst, 'reload schema'`) was present but had nothing to reload (no FK exists)

## The Fix

### Migration: `20251107000000_fix_job_parts_vendor_fkey.sql`

**Key Improvements**:
1. **Separates column creation from FK constraint** - ensures FK is added even if column exists
2. **Uses catalog checks** - queries `pg_constraint` to detect existing FK before attempting to create
3. **Fully idempotent** - safe to run multiple times
4. **Named constraint** - `job_parts_vendor_id_fkey` for easy verification
5. **Includes index** - `idx_job_parts_vendor_id` for query performance
6. **Backfills data** - copies `vendor_id` from `products.vendor_id` for existing rows
7. **Reloads schema cache** - ensures PostgREST recognizes the new FK immediately

### Key Code Blocks

```sql
-- Step 1: Add column if missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_parts' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN vendor_id UUID;
    RAISE NOTICE 'Added vendor_id column to job_parts';
  END IF;
END$$;

-- Step 2: Add FK constraint separately (THE CRITICAL FIX)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_parts_vendor_id_fkey' AND conrelid = 'public.job_parts'::regclass
  ) THEN
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
    RAISE NOTICE 'Added foreign key constraint job_parts_vendor_id_fkey';
  END IF;
END$$;

-- Step 3: Create index (performance)
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);

-- Step 4: Backfill existing data
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id AND jp.vendor_id IS NULL AND p.vendor_id IS NOT NULL;

-- Step 5: Reload schema cache (CRITICAL)
NOTIFY pgrst, 'reload schema';
```

## Verification

### Quick Check
```bash
./scripts/verify-schema-cache.sh
```

### Manual SQL Verification
```sql
-- 1. Check column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'job_parts' AND column_name = 'vendor_id';

-- 2. Check FK constraint exists (MOST IMPORTANT)
SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'job_parts' 
  AND kcu.column_name = 'vendor_id';
-- Expected: job_parts_vendor_id_fkey | vendor_id | vendors

-- 3. Check index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'job_parts' AND indexname = 'idx_job_parts_vendor_id';

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
```

### REST API Verification
```bash
curl -X GET \
  "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```

**Success**: `[{"id":"...","vendor_id":"...","vendor":{"id":"...","name":"..."}}]` or `[]`  
**Failure**: `{"message":"Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"}`

## Testing

- ✅ **Unit tests**: `src/tests/dealService.relationshipError.test.js` - covers error detection and guidance
- ✅ **Integration tests**: `src/tests/dealService.perLineVendor.test.js` - tests per-line vendor support
- ✅ **Build**: `pnpm run build` succeeds
- ⚠️ Some UI tests failing (unrelated to this change - looking for "Enter job number" placeholder)

## Service Code Impact

No changes required to `dealService.js`:
- ✅ Already uses `vendor:vendors(id,name)` syntax in queries (lines 174, 211, 602, 631)
- ✅ Already handles relationship errors with actionable messages
- ✅ Already tolerates NULL `vendor_id` values
- ✅ Already falls back to `product.vendor_id` via business logic

## RLS/Security

No changes required:
- ✅ Existing policies in migration `20251106000000` remain valid
- ✅ SELECT policies allow authenticated users to read nested vendor data
- ✅ Vendor-specific policies allow vendors to access their own job_parts

## Deploy Procedure

1. **Apply migration**:
   ```bash
   supabase db push
   ```

2. **Verify FK exists** (critical):
   ```sql
   SELECT constraint_name FROM pg_constraint 
   WHERE conname = 'job_parts_vendor_id_fkey';
   ```

3. **Reload schema cache**:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
   
4. **Wait 5 seconds** for cache to refresh

5. **Test API endpoint**:
   ```bash
   curl "${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor:vendors(name)&limit=1" \
     -H "apikey: ${VITE_SUPABASE_ANON_KEY}"
   ```

6. **Verify Deals page** loads without errors

## Rollback

If needed:
```sql
-- Remove FK constraint (non-destructive)
ALTER TABLE public.job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;

-- Optionally remove column (DESTRUCTIVE - loses data)
-- ALTER TABLE public.job_parts DROP COLUMN IF EXISTS vendor_id;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## Prevention

**Lesson learned**: Never use inline `REFERENCES` with `ADD COLUMN IF NOT EXISTS`.

**Best practice**:
```sql
-- Step 1: Add column (may be skipped if exists)
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS col_name UUID;

-- Step 2: Add FK separately with catalog check (always runs if FK missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name'
  ) THEN
    ALTER TABLE table_name ADD CONSTRAINT constraint_name 
    FOREIGN KEY (col_name) REFERENCES other_table(id);
  END IF;
END$$;

-- Step 3: Always reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
```

## Related Files

- Migration: `supabase/migrations/20251107000000_fix_job_parts_vendor_fkey.sql`
- Verification: `scripts/verify-schema-cache.sh`
- Service: `src/services/dealService.js`
- Tests: 
  - `src/tests/dealService.relationshipError.test.js`
  - `src/tests/dealService.perLineVendor.test.js`
- Docs: 
  - `RUNBOOK.md` (updated with verification section)
  - `docs/job_parts_vendor_relationship_fix.md` (this file)
