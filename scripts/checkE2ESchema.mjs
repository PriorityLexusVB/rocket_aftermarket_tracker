import { Client } from 'pg'

function getDbUrl() {
  return (
    process.env.E2E_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL
  )
}

function buildClientConfig(dbUrl) {
  const config = { connectionString: dbUrl }

  try {
    const url = new URL(dbUrl)
    const host = url.hostname || ''
    const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase()

    // Supabase hosted Postgres typically requires SSL. The pg driver needs an explicit ssl config.
    // If sslmode=disable is explicitly requested, honor it.
    if (sslmode === 'disable') return config

    const looksLikeSupabase =
      host.endsWith('.supabase.com') ||
      host.includes('pooler.supabase.com') ||
      host.includes('.supabase.co')

    const sslRequested = ['require', 'prefer', 'verify-ca', 'verify-full'].includes(sslmode)

    if (sslRequested || looksLikeSupabase) {
      config.ssl = { rejectUnauthorized: false }
    }
  } catch {
    // If parsing fails (non-URL DSN), fall back to plain connectionString.
  }

  return config
}

async function columnExists(client, { schema, table, column }) {
  const { rows } = await client.query(
    `select 1
     from information_schema.columns
     where table_schema = $1
       and table_name = $2
       and column_name = $3
     limit 1`,
    [schema, table, column]
  )
  return rows.length > 0
}

async function main() {
  const dbUrl = getDbUrl()
  if (!dbUrl) {
    console.log(
      '[checkE2ESchema] Skipping: no DATABASE_URL/E2E_DATABASE_URL/SUPABASE_DB_URL provided.'
    )
    return
  }

  const client = new Client(buildClientConfig(dbUrl))
  await client.connect()
  try {
    const ok = await columnExists(client, {
      schema: 'public',
      table: 'job_parts',
      column: 'requires_scheduling',
    })

    if (!ok) {
      console.error(
        '[checkE2ESchema] ❌ Missing required column: public.job_parts.requires_scheduling'
      )
      console.error(
        '[checkE2ESchema] This repo already has a migration that adds it: supabase/migrations/20250116000000_add_line_item_scheduling_fields.sql'
      )
      console.error(
        '[checkE2ESchema] Action: apply Supabase migrations to your E2E/staging database, then rerun E2E.'
      )
      console.error(
        '[checkE2ESchema] Example: run `npx supabase db push` against the E2E project (or use your existing migration workflow).'
      )
      console.error(
        '[checkE2ESchema] If `db push` is blocked by migration-history drift, you can apply just this one migration with: `node scripts/applyLineItemSchedulingMigration.mjs`'
      )
      process.exit(2)
    }

    console.log('[checkE2ESchema] ✅ Schema OK: public.job_parts.requires_scheduling exists')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[checkE2ESchema] ❌ Failed to verify schema:', message)
  process.exit(1)
})
