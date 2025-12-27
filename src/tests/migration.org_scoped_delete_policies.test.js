// src/tests/migration.org_scoped_delete_policies.test.js
// Verify the org-scoped DELETE policies migration
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Migration: org-scoped delete policies (20251227090000)', () => {
  const migrationsPath = resolve(__dirname, '../../supabase/migrations')
  const migrationPath = resolve(migrationsPath, '20251227090000_add_org_scoped_delete_policies.sql')

  it('should create org-scoped DELETE policies for deal-related tables', () => {
    const content = readFileSync(migrationPath, 'utf-8')

    expect(content).toContain('CREATE POLICY "org can delete jobs"')
    expect(content).toContain('ON public.jobs')

    expect(content).toContain('CREATE POLICY "org can delete job_parts via jobs"')
    expect(content).toContain('ON public.job_parts')

    expect(content).toContain('CREATE POLICY "org can delete transactions"')
    expect(content).toContain('ON public.transactions')

    expect(content).toContain('CREATE POLICY "org can delete communications via jobs"')
    expect(content).toContain('ON public.communications')
  })

  it('should be tenant-scoped using auth_user_org()', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('public.auth_user_org()')
  })

  it('should notify PostgREST to reload schema', () => {
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain("NOTIFY pgrst, 'reload schema'")
  })
})
