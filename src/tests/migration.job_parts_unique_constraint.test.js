// src/tests/migration.job_parts_unique_constraint.test.js
// Verify the job_parts unique constraint migration
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Migration: job_parts unique constraint (20251218042008)', () => {
  const migrationsPath = resolve(__dirname, '../../supabase/migrations')
  const migrationPath = resolve(
    migrationsPath,
    '20251218042008_job_parts_unique_constraint_vendor_time.sql'
  )

  it('should contain deduplication logic with ROW_NUMBER', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('ROW_NUMBER')
    expect(content).toContain('PARTITION BY')
    expect(content).toContain('created_at DESC')
    expect(content).toContain('id ASC')
  })

  it('should create unique index with exact name', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('job_parts_unique_job_product_vendor_time')
    expect(content).toContain('CREATE UNIQUE INDEX')
  })

  it('should include all logical key columns', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('job_id')
    expect(content).toContain('product_id')
    expect(content).toContain('vendor_id')
    expect(content).toContain('promised_date')
    expect(content).toContain('scheduled_start_time')
    expect(content).toContain('scheduled_end_time')
  })

  it('should handle NULL vendor_id safely', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    // Should use either NULLS NOT DISTINCT or COALESCE
    expect(
      content.includes('NULLS NOT DISTINCT') ||
        content.includes("COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'")
    ).toBe(true)
  })

  it('should include PostgreSQL version detection', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('server_version_num')
    expect(content).toContain('150000')
  })

  it('should be idempotent with IF EXISTS checks', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('IF EXISTS')
    expect(content.toLowerCase()).toContain('drop index')
  })

  it('should include verification step', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('VERIFICATION')
    expect(content).toContain('MIGRATION COMPLETE')
  })

  it('should check for duplicates after cleanup', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('duplicate_count')
    expect(content).toContain('HAVING COUNT(*) > 1')
  })

  it('should reference PR #225 in comments', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('PR #225')
  })

  it('should include created_at column check', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('created_at')
    expect(content).toContain('information_schema.columns')
  })
})
