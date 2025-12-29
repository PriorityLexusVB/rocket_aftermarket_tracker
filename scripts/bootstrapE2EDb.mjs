import fs from 'node:fs'
import dns from 'node:dns/promises'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function splitSqlStatements(sqlText) {
  const statements = []
  let current = ''

  let inSingleQuote = false
  let inDoubleQuote = false
  let dollarTag = null
  let inLineComment = false
  let inBlockComment = false

  const isValidDollarTag = (tagBody) =>
    tagBody.length === 0 || /^[A-Za-z_][A-Za-z0-9_]*$/.test(tagBody)

  for (let i = 0; i < sqlText.length; ) {
    const ch = sqlText[i]
    const next = i + 1 < sqlText.length ? sqlText[i + 1] : ''

    if (inLineComment) {
      current += ch
      i += 1
      if (ch === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      current += ch
      i += 1
      if (ch === '*' && next === '/') {
        current += next
        i += 1
        inBlockComment = false
      }
      continue
    }

    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      current += ch
      i += 1
      continue
    }

    if (inSingleQuote) {
      if (ch === "'") {
        if (next === "'") {
          current += "''"
          i += 2
          continue
        }
        inSingleQuote = false
      }
      current += ch
      i += 1
      continue
    }

    if (inDoubleQuote) {
      if (ch === '"') {
        if (next === '"') {
          current += '""'
          i += 2
          continue
        }
        inDoubleQuote = false
      }
      current += ch
      i += 1
      continue
    }

    // Start of comments
    if (ch === '-' && next === '-') {
      inLineComment = true
      current += '--'
      i += 2
      continue
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true
      current += '/*'
      i += 2
      continue
    }

    // Start of quotes
    if (ch === "'") {
      inSingleQuote = true
      current += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inDoubleQuote = true
      current += ch
      i += 1
      continue
    }

    // Start of dollar-quoted block: $$...$$ or $tag$...$tag$
    if (ch === '$') {
      const j = sqlText.indexOf('$', i + 1)
      if (j !== -1) {
        const tagBody = sqlText.slice(i + 1, j)
        if (isValidDollarTag(tagBody)) {
          dollarTag = sqlText.slice(i, j + 1)
          current += dollarTag
          i = j + 1
          continue
        }
      }
    }

    // Statement boundary
    if (ch === ';') {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ''
      i += 1
      continue
    }

    current += ch
    i += 1
  }

  const trimmed = current.trim()
  if (trimmed) statements.push(trimmed)
  return statements
}

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

function shouldWipePublicSchema() {
  const raw = process.env.E2E_BOOTSTRAP_WIPE_PUBLIC
  if (raw == null) return true
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase())
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

function derivePoolerConnectionString(connectionString) {
  // `supabase link` writes a pooler URL (without password) here.
  // Example: postgresql://postgres.<ref>@aws-0-us-west-2.pooler.supabase.com:5432/postgres
  const poolerPath = path.join(process.cwd(), 'supabase', '.temp', 'pooler-url')
  if (!fs.existsSync(poolerPath)) return null

  let base
  let pooler
  try {
    base = new URL(connectionString)
    pooler = new URL(fs.readFileSync(poolerPath, 'utf8').trim())
  } catch {
    return null
  }

  if (!base.password) return null
  if (!pooler.username) return null

  // Reuse DB password from the provided connection string.
  pooler.password = base.password
  return pooler.toString()
}

function buildClientConfig(connectionString) {
  const url = new URL(connectionString)

  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  const requiresSsl =
    sslmode === 'require' ||
    /\.supabase\.co$/i.test(url.hostname) ||
    /\.pooler\.supabase\.com$/i.test(url.hostname)

  return {
    connectionString,
    connectionTimeoutMillis: 15_000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  }
}

async function buildClientConfigWithIpv4Host(connectionString) {
  let url = new URL(connectionString)
  let ipv4
  try {
    ipv4 = await dns.lookup(url.hostname, { family: 4 }).then((r) => r.address)
  } catch (err) {
    const code = err?.code
    const message = err instanceof Error ? err.message : String(err)

    if (code === 'ENOTFOUND') {
      const poolerConnStr = derivePoolerConnectionString(connectionString)
      if (poolerConnStr) {
        url = new URL(poolerConnStr)
        ipv4 = await dns.lookup(url.hostname, { family: 4 }).then((r) => r.address)
      } else {
        throw new Error(
          `[bootstrapE2EDb] DB host has no IPv4 A record: ${url.hostname}. ` +
            `If your environment cannot reach IPv6, use a Supabase pooler connection string (IPv4) ` +
            `or enable IPv6 routing. Original error: ${message}`
        )
      }
    } else {
      throw err
    }
  }

  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  const requiresSsl =
    sslmode === 'require' ||
    /\.supabase\.co$/i.test(url.hostname) ||
    /\.pooler\.supabase\.com$/i.test(url.hostname)

  return {
    host: ipv4,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionTimeoutMillis: 15_000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  }
}

async function connectWithIpv4Fallback(connectionString) {
  const primary = new Client(buildClientConfig(connectionString))
  try {
    await primary.connect()
    return primary
  } catch (err) {
    try {
      await primary.end()
    } catch {}

    const message = err instanceof Error ? err.message : String(err)
    const code = err?.code

    if (code === 'ENOTFOUND') {
      const poolerConnStr = derivePoolerConnectionString(connectionString)
      if (poolerConnStr) {
        const poolerClient = new Client(buildClientConfig(poolerConnStr))
        await poolerClient.connect()
        return poolerClient
      }
    }

    const looksLikeIpv6Unreach =
      code === 'ENETUNREACH' ||
      (typeof message === 'string' && /ENETUNREACH/i.test(message) && /:\d{2,5}\b/.test(message))

    if (!looksLikeIpv6Unreach) throw err

    const fallback = new Client(await buildClientConfigWithIpv4Host(connectionString))
    await fallback.connect()
    return fallback
  }
}

async function ensureBaselineDropTargetsExist(client) {
  // Some migrations assume legacy tables exist when running DROP POLICY ... ON <table>.
  // On a brand-new database, those tables won't exist and Postgres errors even if the policy is IF EXISTS.
  await client.query(`
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL THEN
    CREATE TABLE public.chat_messages (id uuid);
  END IF;

  IF to_regclass('public.user_profiles') IS NULL THEN
    CREATE TABLE public.user_profiles (id uuid);
  END IF;
END $$;
  `)
}

async function wipeAndRecreatePublicSchema(client) {
  // Keep it simple: this is intended for a dedicated E2E database only.
  // The production-ref guard (assertNotProduction) is what prevents accidents.
  await client.query('DROP SCHEMA IF EXISTS public CASCADE')
  await client.query('CREATE SCHEMA public')

  // Restore common Supabase roles access (PostgREST relies on these).
  await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role')
  await client.query('GRANT ALL ON SCHEMA public TO postgres')
}

async function ensurePostBaselineFixups(client) {
  // Some later migrations assume these columns existed historically, even if the chosen baseline
  // migration doesn't create them. Add them here so a fresh E2E DB can continue bootstrapping.
  await client.query(
    'ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS stock_number TEXT'
  )

  // Used by demo preload and calendar workflows.
  await client.query(
    'ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS promised_date TIMESTAMPTZ'
  )
  await client.query("ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'scheduled'")
  await client.query('ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS service_type TEXT')
  await client.query(
    'ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS calendar_notes TEXT'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS customer_needs_loaner BOOLEAN DEFAULT false'
  )

  // Calendar expects these fields to exist before some function migrations run.
  await client.query(
    'ALTER TABLE IF EXISTS public.job_parts ADD COLUMN IF NOT EXISTS promised_date DATE'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.job_parts ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.job_parts ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ'
  )
  await client.query('ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS location TEXT')
  await client.query('ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS color_code TEXT')

  // Later RLS/auth helper migrations sometimes expect a separate auth_user_id column.
  await client.query(
    'ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid'
  )
  await client.query('UPDATE public.user_profiles SET auth_user_id = id WHERE auth_user_id IS NULL')
}

async function applyJobPartsDedupeAndUnique(client) {
  const vendorPlaceholder = '00000000-0000-0000-0000-000000000000'
  const timePlaceholder = '1970-01-01 00:00:00+00'

  // Best-effort dedupe (safe if there are no duplicates)
  await client.query(`
    DELETE FROM public.job_parts jp
    USING (
      SELECT
        job_id,
        product_id,
        COALESCE(vendor_id, '${vendorPlaceholder}'::uuid) AS vendor_id_normalized,
        COALESCE(scheduled_start_time, '${timePlaceholder}'::timestamptz) AS start_norm,
        COALESCE(scheduled_end_time, '${timePlaceholder}'::timestamptz) AS end_norm,
        MIN(id::text) AS keep_id
      FROM public.job_parts
      GROUP BY
        job_id,
        product_id,
        COALESCE(vendor_id, '${vendorPlaceholder}'::uuid),
        COALESCE(scheduled_start_time, '${timePlaceholder}'::timestamptz),
        COALESCE(scheduled_end_time, '${timePlaceholder}'::timestamptz)
      HAVING COUNT(*) > 1
    ) d
    WHERE jp.job_id = d.job_id
      AND jp.product_id = d.product_id
      AND COALESCE(jp.vendor_id, '${vendorPlaceholder}'::uuid) = d.vendor_id_normalized
      AND COALESCE(jp.scheduled_start_time, '${timePlaceholder}'::timestamptz) = d.start_norm
      AND COALESCE(jp.scheduled_end_time, '${timePlaceholder}'::timestamptz) = d.end_norm
      AND jp.id::text <> d.keep_id
  `)

  // Create the intended uniqueness index using literal sentinels (works in pure SQL)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS job_parts_unique_job_product_schedule
      ON public.job_parts (
        job_id,
        product_id,
        COALESCE(vendor_id, '${vendorPlaceholder}'::uuid),
        COALESCE(scheduled_start_time, '${timePlaceholder}'::timestamptz),
        COALESCE(scheduled_end_time, '${timePlaceholder}'::timestamptz)
      )
  `)
}

async function ensureOrgIdColumnsForRlsPolicies(client) {
  // The organizations + minimal RLS migration defines policies that reference org_id on multiple tables.
  // On a fresh DB, those columns may not exist yet. Add them (with FK) once organizations exists.
  await client.query(
    'ALTER TABLE IF EXISTS public.vendors ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.sms_templates ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.transactions ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )
  await client.query(
    'ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )

  await client.query(
    'ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id)'
  )

  // Some later migrations assume loaner_assignments exists and will hard-fail otherwise.
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.loaner_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
      org_id uuid NULL REFERENCES public.organizations(id),
      customer_phone text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
}

async function runStatement(client, statement) {
  const sql = statement.trim()
  if (!sql) return

  const stripLeadingComments = (text) => {
    let s = text
    // Remove leading whitespace + comment-only prefixes so we can classify the statement.
    while (true) {
      const t = s.trimStart()
      if (t.startsWith('--')) {
        const nl = t.indexOf('\n')
        if (nl === -1) return ''
        s = t.slice(nl + 1)
        continue
      }
      if (t.startsWith('/*')) {
        const end = t.indexOf('*/')
        if (end === -1) return t // malformed comment; best-effort
        s = t.slice(end + 2)
        continue
      }
      return t
    }
  }

  try {
    await client.query(sql)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code = err?.code

    const upper = stripLeadingComments(sql).toUpperCase()
    const isCreatePolicy = upper.startsWith('CREATE POLICY')
    const isCreateIndex =
      upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')
    const isCreateExtension = upper.startsWith('CREATE EXTENSION')
    const isCreateTrigger = upper.startsWith('CREATE TRIGGER')
    const touchesStorageObjects = /\bstorage\.objects\b/i.test(sql)
    const isDoBlock = upper.startsWith('DO $$') || upper.startsWith('DO $')
    const isAnalyze = upper.startsWith('ANALYZE')

    const looksLikeDuplicate =
      code === '42710' || // duplicate_object
      code === '42P07' || // duplicate_table / duplicate_relation (indexes often)
      /already exists/i.test(message)

    if (
      looksLikeDuplicate &&
      (isCreatePolicy || isCreateIndex || isCreateExtension || isCreateTrigger)
    ) {
      return
    }

    // Pooler connections often lack ownership privileges on Supabase-managed schemas (e.g., storage.objects).
    // Those policies are not required for our E2E schema bootstrap unless tests explicitly cover storage.
    const looksLikeOwnershipError =
      code === '42501' ||
      /must be owner of table\s+objects/i.test(message) ||
      /permission denied/i.test(message)

    if (looksLikeOwnershipError && touchesStorageObjects) {
      return
    }

    // Supabase pooler roles typically can't call superuser-only helpers.
    if (code === '42501' && /pg_read_file/i.test(message)) {
      return
    }

    // Some migrations wrap policy creation in DO $$ blocks. On fresh DBs, a referenced table might not exist;
    // skipping these blocks keeps bootstrap moving (the app/tests can still function without optional policies).
    const looksLikeUndefinedTable = code === '42P01' || /does not exist/i.test(message)
    if (looksLikeUndefinedTable && /\bpublic\.loaner_assignments\b/i.test(sql)) {
      return
    }
    if (looksLikeUndefinedTable && /\bpublic\.claim_attachments\b/i.test(sql)) {
      return
    }
    if (looksLikeUndefinedTable && /\bpublic\.notification_outbox\b/i.test(sql)) {
      return
    }
    if (looksLikeUndefinedTable && /\bpublic\.sms_templates\b/i.test(sql)) {
      return
    }
    if (
      looksLikeUndefinedTable &&
      (isCreatePolicy || isCreateIndex || (isDoBlock && /CREATE\s+POLICY/i.test(sql)))
    ) {
      return
    }

    throw err
  }
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

  const client = await connectWithIpv4Fallback(dbUrl)
  try {
    if (shouldWipePublicSchema()) {
      console.log('[bootstrapE2EDb] Wiping public schema (E2E-only) ...')
      await wipeAndRecreatePublicSchema(client)
    }

    await ensureBaselineDropTargetsExist(client)

    for (const filePath of migrations) {
      const rel = path.relative(process.cwd(), filePath)
      console.log(`[bootstrapE2EDb] Applying ${rel}...`)
      const sql = fs.readFileSync(filePath, 'utf8')

      const baseName = path.basename(filePath)
      
      if (baseName === '20251212190000_job_parts_dedupe_and_unique.sql') {
        await applyJobPartsDedupeAndUnique(client)
        continue
      }

      const statements = splitSqlStatements(sql)
      for (const statement of statements) {
        await runStatement(client, statement)

        if (
          baseName === '20251022180000_add_organizations_and_minimal_rls.sql' &&
          /create\s+table\s+if\s+not\s+exists\s+public\.organizations\b/i.test(statement)
        ) {
          await ensureOrgIdColumnsForRlsPolicies(client)
        }
      }

      if (baseName === '20250922170950_automotive_aftermarket_system.sql') {
        await ensurePostBaselineFixups(client)
      }
    }

    console.log('[bootstrapE2EDb] ✅ Schema bootstrap complete.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)

  if (err?.code === '28P01' || /password authentication failed/i.test(message)) {
    console.error('[bootstrapE2EDb] ❌ Password authentication failed.')
    console.error(
      '[bootstrapE2EDb] Verify your E2E database password (this is NOT your anon/service_role key).'
    )
    console.error(
      '[bootstrapE2EDb] Suggested: copy the Postgres connection string from Supabase → Project Settings → Database → Connection string (Direct or Pooler),'
    )
    console.error(
      '[bootstrapE2EDb] then paste it into E2E_DATABASE_URL (and ensure it is NOT the production project ref).'
    )
  }

  console.error(message)
  process.exit(1)
})
