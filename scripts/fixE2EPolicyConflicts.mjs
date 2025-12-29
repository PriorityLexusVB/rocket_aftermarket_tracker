import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function safeDbInfo(dbUrl) {
  try {
    const u = new URL(dbUrl)
    const host = u.hostname
    const port = u.port
    const user = u.username
    const db = u.pathname

    // Try to extract the 20-char Supabase project ref from username patterns like: postgres.<ref>
    const maybeRef = (user.split('.')[1] || '').trim()
    const projectRefGuess = /^[a-z0-9]{20}$/i.test(maybeRef) ? maybeRef : null

    return { host, port, user, db, projectRefGuess }
  } catch {
    return { host: null, port: null, user: null, db: null, projectRefGuess: null }
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
      '[fixE2EPolicyConflicts] Missing DB connection string. Set E2E_DATABASE_URL or DATABASE_URL (recommended via .env.e2e.local).'
    )
    process.exit(1)
  }

  const info = safeDbInfo(dbUrl)
  console.log('[fixE2EPolicyConflicts] Starting policy conflict cleanup...')
  console.log('[fixE2EPolicyConflicts] Target (non-secret):', info)

  if (dbUrl.includes(PROD_REF)) {
    console.error(
      `[fixE2EPolicyConflicts] Refusing to run: DB URL appears to be production (${PROD_REF}). Use your E2E/staging database URL.`
    )
    process.exit(2)
  }

  const client = new Client(buildClientConfig(dbUrl))
  await client.connect()

  try {
    const drops = [
      // From supabase/migrations/20250101000001_fix_user_management_rls_policies.sql
      { table: 'user_profiles', policy: 'user_profiles_select_policy' },
      { table: 'user_profiles', policy: 'user_profiles_update_policy' },
      { table: 'user_profiles', policy: 'user_profiles_insert_policy' },
      { table: 'user_profiles', policy: 'user_profiles_delete_policy' },
      { table: 'vendors', policy: 'admin_manager_full_vendor_access' },
      { table: 'vendors', policy: 'staff_view_vendors_only' },
      { table: 'products', policy: 'admin_manager_manage_products' },
      { table: 'products', policy: 'staff_view_products' },
    ]

    for (const { table, policy } of drops) {
      const sql = `DROP POLICY IF EXISTS "${policy}" ON public.${table};`
      await client.query(sql)
      console.log(`[fixE2EPolicyConflicts] Dropped (if existed): ${table}.${policy}`)
    }

    console.log('[fixE2EPolicyConflicts] ✅ Done. Re-run `pnpm -s db:push`.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[fixE2EPolicyConflicts] ❌ Failed:', message)
  process.exit(1)
})
