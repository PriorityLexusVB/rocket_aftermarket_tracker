import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

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

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return null
  return next
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

const DATABASE_URL =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!DATABASE_URL) {
  console.error('[reportE2E] DATABASE_URL (or SUPABASE_DB_URL/E2E_DATABASE_URL) is missing.')
  process.exit(1)
}

const patterns = {
  e2ePrefix: 'E2E',
  jobPrefix: 'E2E ',
  vendorPrefix: 'E2E',
  productPrefix: 'E2E',
}

const buildClientConfig = (connectionString) => {
  const url = new URL(connectionString)
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  const requiresSsl =
    sslmode === 'require' ||
    /\.supabase\.co$/i.test(url.hostname) ||
    /\.pooler\.supabase\.com$/i.test(url.hostname)

  return {
    connectionString,
    connectionTimeoutMillis: 7_500,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  }
}

const buildClientConfigWithIpv4Host = async (connectionString) => {
  const url = new URL(connectionString)

  const ipv4 = await dns.lookup(url.hostname, { family: 4 }).then((r) => r.address)

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
    connectionTimeoutMillis: 7_500,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  }
}

const connectWithIpv4Fallback = async (connectionString) => {
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

    const looksLikeIpv6Unreach =
      code === 'ENETUNREACH' ||
      (typeof message === 'string' && /ENETUNREACH/i.test(message) && /:\d{2,5}\b/.test(message))

    if (!looksLikeIpv6Unreach) throw err

    try {
      const fallback = new Client(await buildClientConfigWithIpv4Host(connectionString))
      await fallback.connect()
      return fallback
    } catch (fallbackErr) {
      let hostname = null
      try {
        hostname = new URL(connectionString).hostname
      } catch {}

      const fallbackCode = fallbackErr?.code
      const hint =
        fallbackCode === 'ENOTFOUND'
          ? `No IPv4 DNS record found${hostname ? ` for ${hostname}` : ''}. ` +
            'If your network cannot reach IPv6, use the Supabase “Session pooler” connection string (it typically has IPv4).'
          : 'Check that your network can reach the database host and that the connection string is correct.'

      throw new Error(
        `[reportE2E] DB connect failed: IPv6 appears unreachable, and IPv4 fallback failed. ${hint}`,
        { cause: fallbackErr }
      )
    }
  }
}

const likePrefix = (prefix) => `${prefix}%`

const takeSample = (rows, pick) => {
  const out = []
  for (const row of rows) {
    out.push(pick(row))
    if (out.length >= 3) break
  }
  return out
}

const groupCounts = (rows, getKey) => {
  const map = new Map()
  for (const row of rows) {
    const key = getKey(row) ?? 'UNKNOWN'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

const main = async () => {
  const client = await connectWithIpv4Fallback(DATABASE_URL)

  const onlyOrgId = getArgValue('--org-id') || null
  const includeUserProfiles = !hasFlag('--no-users')

  const hasColumn = async (table, column) => {
    const res = await client.query(
      `select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = $1
         and column_name = $2
       limit 1`,
      [table, column]
    )
    return res.rowCount > 0
  }

  const hasOrgId = {
    jobs: await hasColumn('jobs', 'org_id'),
    vendors: await hasColumn('vendors', 'org_id'),
    products: await hasColumn('products', 'org_id'),
    transactions: await hasColumn('transactions', 'org_id'),
    user_profiles: await hasColumn('user_profiles', 'org_id'),
  }

  const userProfileCols = {
    email: await hasColumn('user_profiles', 'email'),
    name: await hasColumn('user_profiles', 'name'),
    full_name: await hasColumn('user_profiles', 'full_name'),
    display_name: await hasColumn('user_profiles', 'display_name'),
  }

  const scopeWhere = (tableAlias, tableKey) => {
    if (!onlyOrgId) return { sql: '', params: [] }
    if (!hasOrgId[tableKey]) return { sql: '', params: [] }
    const prefix = tableAlias ? `${tableAlias}.` : ''
    return { sql: ` and ${prefix}org_id = $`, params: [onlyOrgId] }
  }

  const scoped = (baseSql, baseParams, tableAlias, tableKey) => {
    const scope = scopeWhere(tableAlias, tableKey)
    if (!scope.sql) return { sql: baseSql, params: baseParams }
    return {
      sql: baseSql + scope.sql + String(baseParams.length + 1),
      params: [...baseParams, ...scope.params],
    }
  }

  try {
    await client.query('begin')

    const jobsQuery = scoped(
      `select id, org_id, title
       from public.jobs
       where (title ilike $1 or coalesce(description, '') ilike $1)`,
      [likePrefix(patterns.jobPrefix)],
      null,
      'jobs'
    )
    const jobsRes = await client.query(jobsQuery.sql, jobsQuery.params)

    const vendorsQuery = scoped(
      `select id, org_id, name
       from public.vendors
       where name ilike $1`,
      [likePrefix(patterns.vendorPrefix)],
      null,
      'vendors'
    )
    const vendorsRes = await client.query(vendorsQuery.sql, vendorsQuery.params)
    const vendorIds = vendorsRes.rows.map((r) => r.id)

    const productsQuery = scoped(
      `select id, org_id, name
       from public.products
       where name ilike $1`,
      [likePrefix(patterns.productPrefix)],
      null,
      'products'
    )
    const productsRes = await client.query(productsQuery.sql, productsQuery.params)
    const productIds = productsRes.rows.map((r) => r.id)

    // Usage checks: do these E2E-ish vendors/products appear on any non-E2E jobs?
    // This is the key “don’t break anything” signal.
    let vendorRefs = []
    if (vendorIds.length > 0) {
      const vendorRefRes = await client.query(
        `select jp.vendor_id as id, count(*)::int as ref_count
         from public.job_parts jp
         join public.jobs j on j.id = jp.job_id
         where jp.vendor_id = any($1::uuid[])
           and coalesce(j.title, '') not ilike $2
           and coalesce(j.description, '') not ilike $2
         group by jp.vendor_id`,
        [vendorIds, likePrefix(patterns.jobPrefix)]
      )
      vendorRefs = vendorRefRes.rows
    }

    let productRefs = []
    if (productIds.length > 0) {
      const productRefRes = await client.query(
        `select jp.product_id as id, count(*)::int as ref_count
         from public.job_parts jp
         join public.jobs j on j.id = jp.job_id
         where jp.product_id = any($1::uuid[])
           and coalesce(j.title, '') not ilike $2
           and coalesce(j.description, '') not ilike $2
         group by jp.product_id`,
        [productIds, likePrefix(patterns.jobPrefix)]
      )
      productRefs = productRefRes.rows
    }

    // Users: report only, no usage inference.
    let userProfilesRes = { rows: [] }
    if (includeUserProfiles) {
      const columns = []
      if (userProfileCols.email) columns.push('email')
      if (userProfileCols.name) columns.push('name')
      if (userProfileCols.full_name) columns.push('full_name')
      if (userProfileCols.display_name) columns.push('display_name')

      if (columns.length === 0) {
        console.log('\n[reportE2E] user_profiles: skipped (no recognized name/email columns found)')
      } else {
        const conditions = columns
          .map((col, idx) => `coalesce(${col}, '') ilike $${idx + 1}`)
          .join(' or ')

        const params = columns.map(() => likePrefix(patterns.e2ePrefix))
        const selectCols = ['id']
        if (hasOrgId.user_profiles) selectCols.push('org_id')
        selectCols.push(...columns)

        const baseSql = `select ${selectCols.join(', ')}
           from public.user_profiles
           where (${conditions})`

        const q = scoped(baseSql, params, null, 'user_profiles')
        userProfilesRes = await client.query(q.sql, q.params)
      }
    }

    const printGroup = (label, rows, keyFn) => {
      const groups = groupCounts(rows, keyFn)
      console.log(`\n[reportE2E] ${label}: ${rows.length}`)
      for (const [org, count] of groups.slice(0, 10)) {
        console.log(`  - ${org}: ${count}`)
      }
      if (groups.length > 10) console.log(`  ...and ${groups.length - 10} more org(s)`)
    }

    console.log('[reportE2E] Report only (NO deletes).')
    if (onlyOrgId) console.log(`[reportE2E] Org filter: ${onlyOrgId}`)

    if (hasOrgId.jobs) printGroup('E2E-ish jobs', jobsRes.rows, (r) => r.org_id)
    else console.log(`\n[reportE2E] E2E-ish jobs: ${jobsRes.rows.length} (jobs.org_id not present)`)

    if (hasOrgId.vendors) printGroup('E2E-ish vendors', vendorsRes.rows, (r) => r.org_id)
    else
      console.log(
        `\n[reportE2E] E2E-ish vendors: ${vendorsRes.rows.length} (vendors.org_id not present)`
      )

    if (hasOrgId.products) printGroup('E2E-ish products', productsRes.rows, (r) => r.org_id)
    else
      console.log(
        `\n[reportE2E] E2E-ish products: ${productsRes.rows.length} (products.org_id not present)`
      )

    if (includeUserProfiles) {
      if (hasOrgId.user_profiles)
        printGroup('E2E-ish user_profiles', userProfilesRes.rows, (r) => r.org_id)
      else
        console.log(
          `\n[reportE2E] E2E-ish user_profiles: ${userProfilesRes.rows.length} (user_profiles.org_id not present)`
        )
    } else {
      console.log('\n[reportE2E] Skipped user_profiles (--no-users).')
    }

    console.log('\n[reportE2E] Samples:')
    console.log(
      '  Jobs:',
      takeSample(jobsRes.rows, (r) => `${r.id} ${r.title ?? ''}`)
    )
    console.log(
      '  Vendors:',
      takeSample(vendorsRes.rows, (r) => `${r.id} ${r.name ?? ''}`)
    )
    console.log(
      '  Products:',
      takeSample(productsRes.rows, (r) => `${r.id} ${r.name ?? ''}`)
    )
    if (includeUserProfiles) {
      console.log(
        '  User profiles:',
        takeSample(userProfilesRes.rows, (r) =>
          `${r.id} ${(r.email ?? '').trim()} ${(
            r.name ??
            r.full_name ??
            r.display_name ??
            ''
          ).trim()}`.trim()
        )
      )
    }

    const toRefMap = (rows) => new Map(rows.map((r) => [r.id, r.ref_count]))
    const vendorRefMap = toRefMap(vendorRefs)
    const productRefMap = toRefMap(productRefs)

    const vendorUsed = [...vendorRefMap.entries()].filter(([, c]) => c > 0).length
    const productUsed = [...productRefMap.entries()].filter(([, c]) => c > 0).length

    console.log('\n[reportE2E] Reference checks (non-E2E jobs):')
    console.log(`  Vendors referenced by non-E2E jobs: ${vendorUsed} / ${vendorIds.length}`)
    console.log(`  Products referenced by non-E2E jobs: ${productUsed} / ${productIds.length}`)
    console.log('  (If referenced, deleting could break existing deals.)')

    await client.query('rollback')
  } catch (err) {
    try {
      await client.query('rollback')
    } catch {}

    const message = err instanceof Error ? err.message : String(err)
    console.error('[reportE2E] Failed:', message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

await main()
