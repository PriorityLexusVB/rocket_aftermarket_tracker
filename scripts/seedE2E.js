// Node-based seed runner for E2E data without relying on Supabase CLI `db query`.
// Requires a Postgres connection string in one of:
//   - DATABASE_URL
//   - SUPABASE_DB_URL (fallback)
// Reads SQL from ./scripts/sql/seed_e2e.sql and executes it as a single batch.

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

;(async () => {
  const root = process.cwd()
  const sqlPath = path.join(root, 'scripts', 'sql', 'seed_e2e.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!connStr) {
    console.error('[seedE2E] Missing DATABASE_URL or SUPABASE_DB_URL environment variable.')
    console.error('Set a Postgres connection string, e.g. postgres://user:pass@host:5432/dbname')
    process.exit(1)
  }

  const e2eEmail = process.env.E2E_EMAIL
  if (!e2eEmail) {
    console.error('[seedE2E] Missing E2E_EMAIL environment variable.')
    console.error('Set E2E_EMAIL to associate the test user with the E2E organization.')
    process.exit(1)
  }

  // Replace $E2E_EMAIL$ placeholder with actual email (using parameterized query)
  const sqlWithParams = sql.replace(/\$E2E_EMAIL\$/g, `'${e2eEmail.replace(/'/g, "''")}'`)

  const client = new Client({ connectionString: connStr })
  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query(sqlWithParams)
    await client.query('COMMIT')
    console.log(`[seedE2E] Seed applied successfully. Test user (${e2eEmail}) associated with E2E org.`)
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    console.error('[seedE2E] Seed failed:', err?.message || err)
    process.exit(1)
  } finally {
    await client.end()
  }
})()
