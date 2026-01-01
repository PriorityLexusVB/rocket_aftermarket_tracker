import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg

function usageAndExit(msg) {
  if (msg) console.error(msg)
  console.error('Usage: DATABASE_URL=... node scripts/db/rlsCheck.mjs')
  process.exit(1)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!databaseUrl) usageAndExit('Missing DATABASE_URL (or SUPABASE_DB_URL)')

  const sqlPath = path.resolve(process.cwd(), 'scripts/db/rls_guardrail.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log('[db:rls-check] OK')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      // ignore
    }
    console.error('[db:rls-check] FAILED:', e?.message || e)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[db:rls-check] FAILED:', e?.message || e)
  process.exit(1)
})
