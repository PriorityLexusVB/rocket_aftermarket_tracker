import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration: 20260929233000_record_successful_login_self_rpc.sql', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260929233000_record_successful_login_self_rpc.sql'
  )

  let migrationSQL = ''

  try {
    migrationSQL = readFileSync(migrationPath, 'utf8')
  } catch {
    // Migration file doesn't exist - assertions below fail.
  }

  it('migration file exists and is readable', () => {
    expect(migrationSQL).toBeTruthy()
    expect(migrationSQL.length).toBeGreaterThan(0)
  })

  it('is idempotent via create or replace', () => {
    expect(migrationSQL).toMatch(/create or replace function public\.record_successful_login_self/)
  })

  it('accepts no caller-selected identity argument', () => {
    expect(migrationSQL).toMatch(
      /create or replace function public\.record_successful_login_self\(\s*\)/
    )
    expect(migrationSQL).not.toMatch(/p_auth_user_id|p_profile_id|p_user_id/)
  })

  it('requires auth.uid() and fails closed when it is null', () => {
    expect(migrationSQL).toContain('auth.uid()')
    expect(migrationSQL).toMatch(/if\s+v_caller\s+is\s+null\s+then\s+return\s+false/i)
  })

  it('requires exactly one active matching profile and fails closed on ambiguity', () => {
    expect(migrationSQL).toContain('array_agg(up.id order by up.id)')
    expect(migrationSQL).toMatch(/is_active is true/)
    expect(migrationSQL).toMatch(
      /if\s+pg_catalog\.coalesce\(pg_catalog\.cardinality\(v_matches\),\s*0\)\s*<>\s*1\s+then\s+return\s+false/i
    )
  })

  it('uses the database server clock, not a client-supplied timestamp', () => {
    expect(migrationSQL).toContain('pg_catalog.now()')
    expect(migrationSQL).not.toMatch(/p_occurred_at|p_timestamp/)
  })

  it('updates only last_login_at on user_profiles', () => {
    const updateMatch = migrationSQL.match(/update public\.user_profiles\s+set ([\s\S]*?)\s+where/i)
    expect(updateMatch).toBeTruthy()
    const setClause = updateMatch[1]
    expect(setClause).toContain('last_login_at')
    expect(setClause.split(',').length).toBe(1)
  })

  it('touches no table other than user_profiles', () => {
    const tableRefs = [...migrationSQL.matchAll(/\b(?:from|update|into)\s+public\.(\w+)/gi)].map(
      (match) => match[1]
    )
    expect(new Set(tableRefs)).toEqual(new Set(['user_profiles']))
  })

  it('runs as security definer with an empty search path and row_security off', () => {
    expect(migrationSQL).toContain('security definer')
    expect(migrationSQL).toContain("set search_path = ''")
    expect(migrationSQL).toContain("set row_security = 'off'")
  })

  it('revokes execute from public and anon', () => {
    expect(migrationSQL).toMatch(
      /revoke all on function public\.record_successful_login_self\(\) from public/
    )
    expect(migrationSQL).toMatch(
      /revoke all on function public\.record_successful_login_self\(\) from anon/
    )
  })

  it('grants execute only to authenticated', () => {
    const grantMatch = migrationSQL.match(
      /grant execute on function public\.record_successful_login_self\(\) to ([^;]+);/
    )
    expect(grantMatch).toBeTruthy()
    expect(grantMatch[1].trim()).toBe('authenticated')
  })
})
