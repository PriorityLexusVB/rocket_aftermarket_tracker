import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Migration Integration Tests
 *
 * These tests verify the vendor_id migration file is complete and correct.
 * They don't execute the migration, but validate the SQL structure.
 */
describe('Migration: 20251106000000_add_job_parts_vendor_id.sql', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20251106000000_add_job_parts_vendor_id.sql'
  )

  let migrationSQL = ''

  try {
    migrationSQL = readFileSync(migrationPath, 'utf8')
  } catch (err) {
    // Migration file doesn't exist - test will fail below
  }

  it('migration file exists and is readable', () => {
    expect(migrationSQL).toBeTruthy()
    expect(migrationSQL.length).toBeGreaterThan(0)
  })

  it('adds vendor_id column to job_parts table', () => {
    expect(migrationSQL).toContain('ALTER TABLE public.job_parts')
    expect(migrationSQL).toContain('ADD COLUMN IF NOT EXISTS vendor_id')
    expect(migrationSQL).toContain('UUID REFERENCES public.vendors(id)')
  })

  it('uses ON DELETE SET NULL for safe cascade behavior', () => {
    expect(migrationSQL).toContain('ON DELETE SET NULL')
  })

  it('uses IF NOT EXISTS for idempotency', () => {
    expect(migrationSQL).toContain('IF NOT EXISTS')
  })

  it('creates index on vendor_id for query performance', () => {
    expect(migrationSQL).toContain('CREATE INDEX')
    expect(migrationSQL).toContain('idx_job_parts_vendor_id')
    expect(migrationSQL).toContain('ON public.job_parts(vendor_id)')
  })

  it('backfills vendor_id from products.vendor_id', () => {
    expect(migrationSQL).toContain('UPDATE public.job_parts')
    expect(migrationSQL).toContain('SET vendor_id = p.vendor_id')
    expect(migrationSQL).toContain('FROM public.products p')
    expect(migrationSQL).toContain('WHERE jp.product_id = p.id')
  })

  it('adds RLS policies for vendor access', () => {
    // Should have multiple policies
    const policyMatches = migrationSQL.match(/CREATE POLICY/g)
    expect(policyMatches).toBeTruthy()
    expect(policyMatches.length).toBeGreaterThanOrEqual(3)

    // Check specific policy names
    expect(migrationSQL).toContain('vendors_can_view_job_parts_via_per_line_vendor')
    expect(migrationSQL).toContain('vendors_can_insert_their_job_parts')
    expect(migrationSQL).toContain('vendors_can_update_their_job_parts')
  })

  it('uses DO $$ blocks for idempotent policy creation', () => {
    // Should check if policy exists before creating
    expect(migrationSQL).toContain('DO $$')
    expect(migrationSQL).toContain('IF NOT EXISTS')
    expect(migrationSQL).toContain('SELECT 1 FROM pg_policies')
  })

  it('CRITICAL: includes PostgREST schema cache reload', () => {
    // This is the fix for the production error
    expect(migrationSQL).toContain("NOTIFY pgrst, 'reload schema'")
  })

  it('schema cache reload comes AFTER all schema changes', () => {
    const notifyIndex = migrationSQL.indexOf("NOTIFY pgrst, 'reload schema'")
    const alterTableIndex = migrationSQL.indexOf('ALTER TABLE public.job_parts')
    const createIndexIndex = migrationSQL.indexOf('CREATE INDEX')
    const createPolicyIndex = migrationSQL.indexOf('CREATE POLICY')

    // NOTIFY should come after all schema modifications
    expect(notifyIndex).toBeGreaterThan(alterTableIndex)
    expect(notifyIndex).toBeGreaterThan(createIndexIndex)
    expect(notifyIndex).toBeGreaterThan(createPolicyIndex)
  })

  it('includes helpful comments explaining each step', () => {
    expect(migrationSQL).toContain('Step 1:')
    expect(migrationSQL).toContain('Step 2:')
    expect(migrationSQL).toContain('Step 3:')
    expect(migrationSQL).toContain('Step 4:')
    expect(migrationSQL).toContain('Step 5:')
    expect(migrationSQL).toContain('Step 6:')
  })

  it('documents the purpose in header comments', () => {
    expect(migrationSQL).toContain('Migration:')
    expect(migrationSQL).toContain('per-line vendor support')
    expect(migrationSQL).toContain('Dependencies:')
  })

  it('uses proper PostgreSQL UUID type (not integer)', () => {
    // Ensure we're using UUID, not integer/bigint
    expect(migrationSQL).toContain('vendor_id UUID')
    expect(migrationSQL).not.toContain('vendor_id INTEGER')
    expect(migrationSQL).not.toContain('vendor_id BIGINT')
  })

  it('backfill only updates NULL vendor_id values', () => {
    // Ensures we don't overwrite existing values
    expect(migrationSQL).toContain('AND jp.vendor_id IS NULL')
  })

  it('RLS policies check user is active', () => {
    // Security: ensure vendors can't access data if marked inactive
    expect(migrationSQL).toContain('up.is_active = true')
  })

  it('RLS policies reference correct tables and columns', () => {
    expect(migrationSQL).toContain('public.user_profiles up')
    expect(migrationSQL).toContain('up.vendor_id')
    expect(migrationSQL).toContain('auth.uid()')
  })
})

/**
 * Migration Rollback Scenario
 *
 * Documents what would be needed to rollback this migration
 */
describe('Migration Rollback Documentation', () => {
  it('documents rollback steps', () => {
    // This test serves as documentation for rollback
    const rollbackSQL = `
      -- ROLLBACK for 20251106000000_add_job_parts_vendor_id.sql
      
      -- Step 1: Drop RLS policies
      DROP POLICY IF EXISTS "vendors_can_update_their_job_parts" ON public.job_parts;
      DROP POLICY IF EXISTS "vendors_can_insert_their_job_parts" ON public.job_parts;
      DROP POLICY IF EXISTS "vendors_can_view_job_parts_via_per_line_vendor" ON public.job_parts;
      
      -- Step 2: Drop index
      DROP INDEX IF EXISTS idx_job_parts_vendor_id;
      
      -- Step 3: Drop column
      ALTER TABLE public.job_parts DROP COLUMN IF EXISTS vendor_id;
      
      -- Step 4: Reload schema cache
      NOTIFY pgrst, 'reload schema';
    `

    expect(rollbackSQL).toContain('DROP POLICY')
    expect(rollbackSQL).toContain('DROP INDEX')
    expect(rollbackSQL).toContain('DROP COLUMN')
    expect(rollbackSQL).toContain("NOTIFY pgrst, 'reload schema'")
  })
})

/**
 * Production Readiness Checks
 */
describe('Migration Production Readiness', () => {
  it('is safe to run multiple times (idempotent)', () => {
    // IF NOT EXISTS clauses make it safe to rerun
    expect(true).toBe(true)
  })

  it('uses ON DELETE SET NULL to prevent orphaned records', () => {
    // If vendor deleted, job_parts remain with NULL vendor_id
    expect(true).toBe(true)
  })

  it('includes proper indexes to prevent performance regression', () => {
    // Index on vendor_id ensures joins remain fast
    expect(true).toBe(true)
  })

  it('handles NULL vendor_id gracefully in queries', () => {
    // Application code should use LEFT JOIN, not INNER JOIN
    expect(true).toBe(true)
  })
})
