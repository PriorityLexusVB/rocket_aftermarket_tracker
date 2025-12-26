import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

const getArgValue = (flag) => {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return null
  return next
}

// Best-effort: load local env files for scripts.
// Never log env values.
{
  const root = process.cwd()
  const envFiles = ['.env.local', '.env']
  for (const filename of envFiles) {
    const fullPath = path.join(root, filename)
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false })
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('[printOrgId] DATABASE_URL (or SUPABASE_DB_URL) is missing.')
  process.exit(1)
}

const email = getArgValue('--email') || process.env.E2E_EMAIL
if (!email) {
  console.error('[printOrgId] Missing email. Provide --email or set E2E_EMAIL.')
  process.exit(1)
}

const main = async () => {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    const res = await client.query(
      `select id, email, org_id
       from public.user_profiles
       where email = $1
       limit 1`,
      [email]
    )

    if (res.rowCount === 0) {
      console.error(`[printOrgId] No user_profiles row found for email: ${email}`)
      process.exitCode = 1
      return
    }

    const row = res.rows[0]
    if (!row.org_id) {
      console.error(`[printOrgId] user_profiles.org_id is null for email: ${email}`)
      process.exitCode = 1
      return
    }

    // Print org_id only (easy to export).
    console.log(String(row.org_id))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[printOrgId] Failed:', message)
    process.exitCode = 1
  } finally {
    try {
      await client.end()
    } catch {}
  }
}

await main()
