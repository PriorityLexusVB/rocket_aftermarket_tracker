#!/usr/bin/env node
/**
 * Upsert organization "Priority Lexus VB" and attach a user profile by email to it.
 * Usage:
 *   E2E_DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require node scripts/attachOrg.js rob.brasco@priorityautomotive.com
 *
 * The script:
 *  - Creates org if missing
 *  - Updates user_profiles.org_id for the provided email
 *  - Prints resulting org id and confirmation
 */
const { Client } = require('pg')

async function run() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node scripts/attachOrg.js <user-email>')
    process.exit(1)
  }
  const conn = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!conn) {
    console.error('[attachOrg] Missing E2E_DATABASE_URL/DATABASE_URL/SUPABASE_DB_URL env variable')
    process.exit(1)
  }
  // Ensure sslmode=require is present (Supabase Postgres requires SSL)
  let finalConn = conn
  if (!/[?&]sslmode=/.test(finalConn)) {
    finalConn += finalConn.includes('?') ? '&sslmode=require' : '?sslmode=require'
  }
  const client = new Client({
    connectionString: finalConn,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    const orgRes = await client.query(
      `insert into public.organizations (name) values ($1)
       on conflict (name) do update set name = excluded.name
       returning id`,
      ['Priority Lexus VB']
    )
    const orgId = orgRes.rows[0].id
    // Ensure a user_profiles row exists for this email; if not, create a minimal one
    const findRes = await client.query(
      `select id from public.user_profiles where email = $1 limit 1`,
      [email]
    )
    if (!findRes.rowCount) {
      const fullName = email
        .split('@')[0]
        .replace(/\./g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase())
      await client.query(
        `insert into public.user_profiles (id, email, full_name, department, role, is_active)
         values (gen_random_uuid(), $1, $2, 'Sales Consultants', 'staff', true)`,
        [email, fullName]
      )
    }
    const upRes = await client.query(
      `update public.user_profiles
         set org_id = $1, is_active = true
       where email = $2
       returning id, org_id`,
      [orgId, email]
    )
    if (!upRes.rowCount) {
      console.error(`[attachOrg] Failed to update user_profiles for email: ${email}`)
      await client.query('ROLLBACK')
      process.exit(1)
    }
    await client.query('COMMIT')
    console.log('[attachOrg] Attached', email, 'to org', orgId)
  } catch (e) {
    console.error('[attachOrg] Failed:', e.message)
    try {
      await client.query('ROLLBACK')
    } catch {}
    process.exit(1)
  } finally {
    await client.end()
  }
}
run()
