import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function loadEnv() {
  const root = process.cwd()

  // Prefer an explicit E2E env file; never commit secrets.
  const preferred = path.join(root, '.env.e2e.local')
  if (fs.existsSync(preferred)) {
    dotenv.config({ path: preferred, override: true })
  }

  // Best-effort load of common env files without overriding.
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(root, filename)
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false })
    }
  }
}

function getDbUrl() {
  return (
    process.env.E2E_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL
  )
}

function assertNotProduction(dbUrl) {
  if (!dbUrl) return
  if (dbUrl.includes(PROD_REF)) {
    throw new Error(
      `[bootstrapE2EDb] Refusing to run: DATABASE_URL appears to contain production project ref ${PROD_REF}. ` +
        `Use an E2E database connection string (recommended: put it in .env.e2e.local).`
    )
  }
}

function resolveMigrationsToApply() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const baseline =
    process.env.E2E_BASELINE_MIGRATION || '20250922170950_automotive_aftermarket_system.sql'

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const baselineIdx = files.indexOf(baseline)
  if (baselineIdx === -1) {
    throw new Error(
      `[bootstrapE2EDb] Baseline migration not found: ${baseline}. ` +
        `Set E2E_BASELINE_MIGRATION to one of the filenames in supabase/migrations/.`
    )
  }

  // Apply baseline and everything after it.
  return files.slice(baselineIdx).map((f) => path.join(migrationsDir, f))
}

async function main() {
  loadEnv()

  const dbUrl = getDbUrl()
  if (!dbUrl) {
    throw new Error(
      '[bootstrapE2EDb] Missing DB connection string. Set E2E_DATABASE_URL or DATABASE_URL. ' +
        'Recommended: create .env.e2e.local with E2E_DATABASE_URL=...'
    )
  }

  assertNotProduction(dbUrl)

  const migrations = resolveMigrationsToApply()
  console.log(`[bootstrapE2EDb] Will apply ${migrations.length} migrations (baseline+forward).`)

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    for (const filePath of migrations) {
      const rel = path.relative(process.cwd(), filePath)
      console.log(`[bootstrapE2EDb] Applying ${rel}...`)
      const sql = fs.readFileSync(filePath, 'utf8')
      await client.query(sql)
    }

    console.log('[bootstrapE2EDb] ✅ Schema bootstrap complete.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})
