#!/usr/bin/env node
/*
  Executes SQL against the currently linked Supabase project WITHOUT requiring a stored DB password.

  How it works:
  - Uses `npx supabase@latest db dump --dry-run` to generate ephemeral connection env vars.
  - Captures/parses those env vars without printing them.
  - Executes SQL via node-postgres (`pg`).

  Intended usage is via the repo's env switching wrapper:
    bash scripts/supabase/with-env.sh test -- node scripts/supabase/sql-exec.mjs --sql "select 1"

  Safety:
  - If linked to the PROD ref, will refuse non-read-only SQL unless ALLOW_PROD_SQL_WRITE=YES.
*/

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

function usage(exitCode = 0) {
  const msg = `Usage:
  node scripts/supabase/sql-exec.mjs (--sql <sql> | --file <path.sql>) [options]

Options:
  --format <pretty|json|lines>     Output format (default: pretty)
  --column <name>                 Column to print when --format lines is used
  --out <path>                    Write output to file (stdout if omitted)
  --max-rows <n>                  Fail if result row count exceeds n
  --statement-timeout-ms <n>       Set Postgres statement_timeout (milliseconds)
  --lock-timeout-ms <n>            Set Postgres lock_timeout (milliseconds)

Environment:
  CONFIRM_PROD=YES                Required by scripts/supabase/with-env.sh for prod linking
  ALLOW_PROD_SQL_WRITE=YES        Required to run non-read-only SQL when linked to PROD
`
  ;(exitCode === 0 ? console.log : console.error)(msg)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = {
    sql: null,
    file: null,
    format: 'pretty',
    column: null,
    out: null,
    maxRows: null,
    statementTimeoutMs: null,
    lockTimeoutMs: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') usage(0)
    if (a === '--sql') {
      args.sql = argv[++i] ?? null
      continue
    }
    if (a === '--file') {
      args.file = argv[++i] ?? null
      continue
    }
    if (a === '--format') {
      args.format = argv[++i] ?? 'pretty'
      continue
    }
    if (a === '--column') {
      args.column = argv[++i] ?? null
      continue
    }
    if (a === '--out') {
      args.out = argv[++i] ?? null
      continue
    }
    if (a === '--max-rows') {
      const v = argv[++i]
      args.maxRows = v ? Number(v) : null
      continue
    }

    if (a === '--statement-timeout-ms') {
      const v = argv[++i]
      args.statementTimeoutMs = v ? Number(v) : null
      continue
    }

    if (a === '--lock-timeout-ms') {
      const v = argv[++i]
      args.lockTimeoutMs = v ? Number(v) : null
      continue
    }

    console.error(`Unknown arg: ${a}`)
    usage(2)
  }

  if (!args.sql && !args.file) {
    console.error('Missing --sql or --file')
    usage(2)
  }

  if (args.sql && args.file) {
    console.error('Provide only one of --sql or --file')
    usage(2)
  }

  if (!['pretty', 'json', 'lines'].includes(args.format)) {
    console.error(`Unsupported --format: ${args.format}`)
    usage(2)
  }

  if (args.format === 'lines' && !args.column) {
    console.error('--format lines requires --column <name>')
    usage(2)
  }

  if (args.maxRows != null && (!Number.isFinite(args.maxRows) || args.maxRows < 0)) {
    console.error(`Invalid --max-rows: ${args.maxRows}`)
    usage(2)
  }

  if (
    args.statementTimeoutMs != null &&
    (!Number.isFinite(args.statementTimeoutMs) || args.statementTimeoutMs < 0)
  ) {
    console.error(`Invalid --statement-timeout-ms: ${args.statementTimeoutMs}`)
    usage(2)
  }

  if (
    args.lockTimeoutMs != null &&
    (!Number.isFinite(args.lockTimeoutMs) || args.lockTimeoutMs < 0)
  ) {
    console.error(`Invalid --lock-timeout-ms: ${args.lockTimeoutMs}`)
    usage(2)
  }

  return args
}

function getLinkedProjectRef() {
  const refFile = path.join('supabase', '.temp', 'project-ref')
  try {
    const ref = fs.readFileSync(refFile, 'utf8').trim()
    return ref || null
  } catch {
    return null
  }
}

function isReadOnlySql(sql) {
  const normalized = sql
    .replace(/--[^\n]*\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .toLowerCase()

  // Allow common read-only statements.
  // Note: this is intentionally conservative; anything not clearly read-only is treated as write.
  return (
    normalized.startsWith('select') ||
    normalized.startsWith('with') ||
    normalized.startsWith('show') ||
    normalized.startsWith('explain')
  )
}

async function getEphemeralDbEnv() {
  const supabaseArgs = [
    '-y',
    'supabase@latest',
    'db',
    'dump',
    '--dry-run',
    '--data-only',
    '--schema',
    'public',
  ]

  const child = spawn('npx', supabaseArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })

  if (exitCode !== 0) {
    // Do not print stdout, as it may contain credentials.
    console.error('Failed to derive DB credentials via Supabase CLI.')
    if (stderr) console.error(stderr.trim())
    process.exit(1)
  }

  const wanted = new Set(['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'])
  const env = {}

  for (const line of stdout.split(/\r?\n/)) {
    const match = /^export\s+(PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)="([^"]*)"\s*$/.exec(
      line.trim()
    )
    if (!match) continue
    const key = match[1]
    const value = match[2]
    if (wanted.has(key)) env[key] = value
  }

  for (const key of wanted) {
    if (!env[key]) {
      console.error(`Could not parse ${key} from Supabase CLI dry-run output.`)
      process.exit(1)
    }
  }

  return env
}

function writeOutput(outPath, text) {
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, text, 'utf8')
    return
  }
  process.stdout.write(text)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const linkedRef = getLinkedProjectRef()
  const sql = args.file ? fs.readFileSync(path.resolve(args.file), 'utf8') : String(args.sql)

  if (linkedRef === PROD_REF) {
    if (!process.env.CONFIRM_PROD || process.env.CONFIRM_PROD !== 'YES') {
      console.error('Refusing to run while linked to PROD without CONFIRM_PROD=YES.')
      process.exit(1)
    }

    const readOnly = isReadOnlySql(sql)
    if (!readOnly && process.env.ALLOW_PROD_SQL_WRITE !== 'YES') {
      console.error(
        'Refusing to run non-read-only SQL on PROD. Set ALLOW_PROD_SQL_WRITE=YES to override.'
      )
      process.exit(1)
    }
  }

  const env = await getEphemeralDbEnv()

  const client = new Client({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    await client.connect()

    // The Supabase CLI's generated `pg_dump` script uses `--role postgres`.
    // Mirror that behavior so ad-hoc queries have the same visibility.
    try {
      await client.query('set role postgres')
    } catch (e) {
      console.error('Connected, but could not `SET ROLE postgres` (insufficient privileges).')
      console.error(
        'This usually means the ephemeral CLI login role cannot access your tables for ad-hoc queries.'
      )
      console.error(e?.message || String(e))
      process.exit(1)
    }

    if (args.statementTimeoutMs != null) {
      await client.query(`set statement_timeout = ${Math.floor(args.statementTimeoutMs)}`)
    }
    if (args.lockTimeoutMs != null) {
      await client.query(`set lock_timeout = ${Math.floor(args.lockTimeoutMs)}`)
    }

    const result = await client.query(sql)

    if (args.maxRows != null && result.rows.length > args.maxRows) {
      console.error(
        `Row limit exceeded: got ${result.rows.length} rows, max allowed is ${args.maxRows}.`
      )
      process.exit(1)
    }

    if (args.format === 'json') {
      writeOutput(args.out, JSON.stringify(result.rows, null, 2) + '\n')
      return
    }

    if (args.format === 'lines') {
      const col = args.column
      const lines = result.rows
        .map((row) => row?.[col])
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v))
      writeOutput(args.out, lines.join('\n') + (lines.length ? '\n' : ''))
      return
    }

    // pretty
    const out = {
      rowCount: result.rowCount,
      rows: result.rows,
    }
    writeOutput(args.out, JSON.stringify(out, null, 2) + '\n')
  } finally {
    await client.end().catch(() => undefined)
  }
}

main().catch((err) => {
  console.error(err?.message || String(err))
  process.exit(1)
})
