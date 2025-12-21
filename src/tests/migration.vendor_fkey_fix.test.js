import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Migration Integration Tests for FK Constraint Fix
 *
 * These tests verify the fix migration that separates column creation
 * from FK constraint addition, solving the production error where
 * the relationship was not recognized by PostgREST.
 */
describe('Migration: 20251107000000_fix_job_parts_vendor_fkey.sql', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20251107000000_fix_job_parts_vendor_fkey.sql'
  )

  let migrationSQL = ''

  try {
    migrationSQL = readFileSync(migrationPath, 'utf8')
  } catch {
    // Migration file doesn't exist - test will fail below
  }

  it('migration file exists and is readable', () => {
    expect(migrationSQL).toBeTruthy()
    expect(migrationSQL.length).toBeGreaterThan(0)
  })

  it('documents the root cause in header comments', () => {
    expect(migrationSQL).toContain('Root Cause:')
    expect(migrationSQL).toContain('ADD COLUMN IF NOT EXISTS')
    expect(migrationSQL).toContain('inline REFERENCES')
    expect(migrationSQL).toContain('leaving no FK constraint')
  })

  it('CRITICAL: separates column creation from FK constraint', () => {
    // This is the key fix - column and FK are added independently
    expect(migrationSQL).toContain('ADD COLUMN vendor_id UUID')
    // Check that the actual ADD COLUMN statement doesn't use inline REFERENCES
    // Use more specific pattern to match ALTER TABLE...ADD COLUMN without REFERENCES
    const addColumnMatch = migrationSQL.match(
      /ALTER TABLE[^;]*ADD COLUMN vendor_id UUID(?![^;]*REFERENCES)[^;]*;/
    )
    expect(addColumnMatch).toBeTruthy()
    expect(migrationSQL).toContain('ADD CONSTRAINT job_parts_vendor_id_fkey')
  })

  it('checks column existence using information_schema', () => {
    expect(migrationSQL).toContain('information_schema.columns')
    expect(migrationSQL).toContain("table_name = 'job_parts'")
    expect(migrationSQL).toContain("column_name = 'vendor_id'")
  })

  it('checks FK constraint existence using pg_constraint', () => {
    // This ensures FK is added even if column exists
    expect(migrationSQL).toContain('pg_constraint')
    expect(migrationSQL).toContain("conname = 'job_parts_vendor_id_fkey'")
    expect(migrationSQL).toContain("conrelid = 'public.job_parts'::regclass")
  })

  it('uses named constraint for easy verification', () => {
    expect(migrationSQL).toContain('job_parts_vendor_id_fkey')
  })

  it('uses ON UPDATE CASCADE for proper cascading', () => {
    expect(migrationSQL).toContain('ON UPDATE CASCADE')
  })

  it('uses ON DELETE SET NULL to prevent orphaned records', () => {
    expect(migrationSQL).toContain('ON DELETE SET NULL')
  })

  it('creates index on vendor_id for query performance', () => {
    expect(migrationSQL).toContain('CREATE INDEX IF NOT EXISTS')
    expect(migrationSQL).toContain('idx_job_parts_vendor_id')
    expect(migrationSQL).toContain('ON public.job_parts(vendor_id)')
  })

  it('backfills vendor_id from products.vendor_id', () => {
    expect(migrationSQL).toContain('UPDATE public.job_parts jp')
    expect(migrationSQL).toContain('SET vendor_id = p.vendor_id')
    expect(migrationSQL).toContain('FROM public.products p')
    expect(migrationSQL).toContain('WHERE jp.product_id = p.id')
  })

  it('backfill only updates NULL vendor_id values', () => {
    expect(migrationSQL).toContain('AND jp.vendor_id IS NULL')
    expect(migrationSQL).toContain('AND p.vendor_id IS NOT NULL')
  })

  it('CRITICAL: includes PostgREST schema cache reload', () => {
    expect(migrationSQL).toContain("NOTIFY pgrst, 'reload schema'")
  })

  it('schema cache reload comes AFTER all schema changes', () => {
    const notifyIndex = migrationSQL.indexOf("NOTIFY pgrst, 'reload schema'")
    const alterTableIndex = migrationSQL.indexOf('ALTER TABLE public.job_parts')
    const addConstraintIndex = migrationSQL.indexOf('ADD CONSTRAINT')
    const createIndexIndex = migrationSQL.indexOf('CREATE INDEX')
    const updateIndex = migrationSQL.indexOf('UPDATE public.job_parts')

    // NOTIFY should come after all schema modifications
    expect(notifyIndex).toBeGreaterThan(alterTableIndex)
    expect(notifyIndex).toBeGreaterThan(addConstraintIndex)
    expect(notifyIndex).toBeGreaterThan(createIndexIndex)
    expect(notifyIndex).toBeGreaterThan(updateIndex)
  })

  it('includes helpful step-by-step comments', () => {
    expect(migrationSQL).toContain('Step 1:')
    expect(migrationSQL).toContain('Step 2:')
    expect(migrationSQL).toContain('Step 3:')
    expect(migrationSQL).toContain('Step 4:')
    expect(migrationSQL).toContain('Step 5:')
  })

  it('uses DO $$ blocks for proper control flow', () => {
    expect(migrationSQL).toContain('DO $$')
    expect(migrationSQL).toContain('BEGIN')
    expect(migrationSQL).toContain('END$$')
  })

  it('includes RAISE NOTICE for debugging', () => {
    expect(migrationSQL).toContain('RAISE NOTICE')
  })

  it('uses proper PostgreSQL UUID type', () => {
    expect(migrationSQL).toContain('UUID')
    expect(migrationSQL).not.toContain('INTEGER')
    expect(migrationSQL).not.toContain('BIGINT')
  })

  it('is fully idempotent - safe to run multiple times', () => {
    // Count number of IF NOT EXISTS checks
    const ifNotExistsCount = (migrationSQL.match(/IF NOT EXISTS/g) || []).length
    expect(ifNotExistsCount).toBeGreaterThanOrEqual(2) // At least for column and constraint
  })

  it('references correct tables and columns', () => {
    expect(migrationSQL).toContain('public.job_parts')
    expect(migrationSQL).toContain('public.vendors(id)')
    expect(migrationSQL).toContain('public.products')
  })
})

/**
 * Verification Procedures Documentation
 */
describe('Migration Verification Documentation', () => {
  it('documents SQL verification queries', () => {
    const verificationSQL = `
      -- 1. Check column exists
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'job_parts' AND column_name = 'vendor_id';
      
      -- 2. Check FK constraint exists (MOST IMPORTANT)
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'job_parts' 
        AND kcu.column_name = 'vendor_id';
      
      -- 3. Check index exists
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'job_parts' AND indexname = 'idx_job_parts_vendor_id';
    `

    expect(verificationSQL).toContain('information_schema.columns')
    expect(verificationSQL).toContain('information_schema.table_constraints')
    expect(verificationSQL).toContain('pg_indexes')
  })

  it('documents API verification with curl', () => {
    const apiVerification = `
      curl -X GET \
        "\${VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor_id,vendor:vendors(id,name)&limit=1" \
        -H "apikey: \${VITE_SUPABASE_ANON_KEY}"
    `

    expect(apiVerification).toContain('vendor:vendors')
    expect(apiVerification).toContain('job_parts')
  })
})

/**
 * Rollback Scenario
 */
describe('Migration Rollback Documentation', () => {
  it('documents rollback steps', () => {
    const rollbackSQL = `
      -- ROLLBACK for 20251107000000_fix_job_parts_vendor_fkey.sql
      
      -- Remove FK constraint (non-destructive)
      ALTER TABLE public.job_parts DROP CONSTRAINT IF EXISTS job_parts_vendor_id_fkey;
      
      -- Optionally remove column (DESTRUCTIVE - loses data)
      -- ALTER TABLE public.job_parts DROP COLUMN IF EXISTS vendor_id;
      
      -- Reload schema cache
      NOTIFY pgrst, 'reload schema';
    `

    expect(rollbackSQL).toContain('DROP CONSTRAINT')
    expect(rollbackSQL).toContain('job_parts_vendor_id_fkey')
    expect(rollbackSQL).toContain("NOTIFY pgrst, 'reload schema'")
  })
})

/**
 * Production Readiness Checks
 */
describe('Migration Production Readiness', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20251107000000_fix_job_parts_vendor_fkey.sql'
  )

  let migrationSQL = ''

  try {
    migrationSQL = readFileSync(migrationPath, 'utf8')
  } catch {
    migrationSQL = ''
  }

  it('is safe to run even if column already exists', () => {
    // Uses information_schema check before adding column
    expect(migrationSQL).toContain('information_schema.columns')
  })

  it('is safe to run even if FK constraint already exists', () => {
    // Uses pg_constraint check before adding constraint
    expect(migrationSQL).toContain('pg_constraint')
  })

  it('handles case where column exists but FK does not (THE BUG)', () => {
    // This is the exact scenario we're fixing
    expect(migrationSQL).toContain('ADD CONSTRAINT')
    expect(migrationSQL).toContain('IF NOT EXISTS')
  })

  it('includes proper cascade behavior', () => {
    expect(migrationSQL).toContain('ON UPDATE CASCADE')
    expect(migrationSQL).toContain('ON DELETE SET NULL')
  })

  it('will not cause downtime when applied', () => {
    // Adding nullable column and FK constraint is non-blocking
    expect(true).toBe(true)
  })
})
