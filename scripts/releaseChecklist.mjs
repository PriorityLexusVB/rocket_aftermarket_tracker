import { spawn } from 'node:child_process'
import process from 'node:process'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function hasEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim())
}

function assertNotProdTarget() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
  const dbUrl =
    process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || ''

  if (supabaseUrl.includes(PROD_REF)) {
    throw new Error(
      `[release:check] Refusing to proceed: VITE_SUPABASE_URL contains production project ref ${PROD_REF}.`
    )
  }

  if (dbUrl.includes(PROD_REF)) {
    throw new Error(
      `[release:check] Refusing to proceed: DB connection string (E2E_DATABASE_URL/DATABASE_URL/SUPABASE_DB_URL) contains production project ref ${PROD_REF}.`
    )
  }
}

function run(cmd, args, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    })

    child.on('exit', (code) => {
      if (code === 0) return resolve()
      const err = new Error(`[release:check] Command failed (${code}): ${cmd} ${args.join(' ')}`)
      if (optional) return resolve({ skipped: true, error: err })
      reject(err)
    })

    child.on('error', (err) => {
      if (optional) return resolve({ skipped: true, error: err })
      reject(err)
    })
  })
}

async function main() {
  console.log('[release:check] Starting production-readiness checklist...')
  assertNotProdTarget()

  // Core gates (match repo guardrails: lint + unit tests + typecheck + build)
  await run('pnpm', ['lint'])
  await run('pnpm', ['-s', 'vitest', 'run'])
  await run('pnpm', ['typecheck'])
  await run('pnpm', ['build'])

  // E2E gates (only if credentials are provided)
  const hasE2ECreds = hasEnv('E2E_EMAIL') && hasEnv('E2E_PASSWORD')
  const hasSupabaseRuntime = hasEnv('VITE_SUPABASE_URL') && hasEnv('VITE_SUPABASE_ANON_KEY')

  if (hasE2ECreds && hasSupabaseRuntime) {
    console.log('[release:check] Running Playwright E2E (chromium)...')
    await run('pnpm', ['exec', 'playwright', 'test', '--project=chromium'])
  } else {
    console.log(
      '[release:check] Skipping Playwright E2E: missing E2E_EMAIL/E2E_PASSWORD and/or VITE_SUPABASE_* env.'
    )
  }

  console.log('[release:check] ✅ All enabled checks passed.')
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
