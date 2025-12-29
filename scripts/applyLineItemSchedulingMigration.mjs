import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function getDbUrl() {
  return (
    process.env.E2E_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL
  )
}

function safeDbInfo(dbUrl) {
  try {
    const u = new URL(dbUrl)
    const host = u.hostname
    const port = u.port
    const user = u.username
    const db = u.pathname

    const maybeRef = (user.split('.')[1] || '').trim()
    const projectRefGuess = /^[a-z0-9]{20}$/i.test(maybeRef) ? maybeRef : null

    return { host, port, user, db, projectRefGuess }
  } catch {
    return { host: null, port: null, user: null, db: null, projectRefGuess: null }
  }
}

function buildClientConfig(dbUrl) {
  const config = { connectionString: dbUrl }

  try {
    const url = new URL(dbUrl)
    const host = url.hostname || ''
    const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase()

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
    // ignore
  }

  return config
}

async function main() {
  const dbUrl = getDbUrl()
  if (!dbUrl) {
    console.error(
      '[applyLineItemSchedulingMigration] Missing DB connection string. Set E2E_DATABASE_URL or DATABASE_URL (recommended via .env.e2e.local).'
    )
    process.exit(1)
  }

  const info = safeDbInfo(dbUrl)
  console.log('[applyLineItemSchedulingMigration] Starting...')
  console.log('[applyLineItemSchedulingMigration] Target (non-secret):', info)

  if (dbUrl.includes(PROD_REF)) {
    console.error(
      `[applyLineItemSchedulingMigration] Refusing to run: DB URL appears to be production (${PROD_REF}). Use your E2E/staging database URL.`
    )
    process.exit(2)
  }

  const client = new Client(buildClientConfig(dbUrl))
  await client.connect()

  try {
    const statements = [
      `ALTER TABLE public.job_parts ADD COLUMN IF NOT EXISTS promised_date DATE;`,
      `ALTER TABLE public.job_parts ADD COLUMN IF NOT EXISTS requires_scheduling BOOLEAN;`,
      `ALTER TABLE public.job_parts ADD COLUMN IF NOT EXISTS no_schedule_reason TEXT;`,
      `ALTER TABLE public.job_parts ADD COLUMN IF NOT EXISTS is_off_site BOOLEAN DEFAULT false;`,
      `UPDATE public.job_parts
       SET requires_scheduling = true,
           promised_date = CURRENT_DATE + INTERVAL '1 day'
       WHERE requires_scheduling IS NULL;`,
      `ALTER TABLE public.job_parts ALTER COLUMN requires_scheduling SET DEFAULT true;`,
      `UPDATE public.job_parts
       SET no_schedule_reason = 'Legacy record - no scheduling required'
       WHERE requires_scheduling = false
         AND (no_schedule_reason IS NULL OR no_schedule_reason = '');`,
      `CREATE INDEX IF NOT EXISTS idx_job_parts_promised_date ON public.job_parts(promised_date);`,
      `CREATE INDEX IF NOT EXISTS idx_job_parts_requires_scheduling ON public.job_parts(requires_scheduling);`,
      `CREATE INDEX IF NOT EXISTS idx_job_parts_is_off_site ON public.job_parts(is_off_site);`,
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           WHERE c.conname = 'check_scheduling_logic'
             AND n.nspname = 'public'
             AND t.relname = 'job_parts'
         ) THEN
           ALTER TABLE public.job_parts
           ADD CONSTRAINT check_scheduling_logic
           CHECK (
             (requires_scheduling = true AND promised_date IS NOT NULL) OR
             (requires_scheduling = false AND no_schedule_reason IS NOT NULL AND no_schedule_reason != '') OR
             (requires_scheduling IS NULL)
           );
         END IF;
       END $$;`,
      `NOTIFY pgrst, 'reload schema';`,
    ]

    for (const sql of statements) {
      await client.query(sql)
    }

    console.log(
      '[applyLineItemSchedulingMigration] ✅ Applied scheduling columns/indexes/constraint and requested PostgREST schema reload.'
    )
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[applyLineItemSchedulingMigration] ❌ Failed:', message)
  process.exit(1)
})
