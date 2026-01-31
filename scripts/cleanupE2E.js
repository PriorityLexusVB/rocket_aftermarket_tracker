import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

const PROD_REF = 'ogjtmtndgiqqdtwatsue'

// Best-effort: load local env files for scripts.
// Never log env values.
{
  const root = process.cwd()
  const envFiles = ['.env.e2e.local', '.env.local', '.env']
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

function parseBoolEnv(value) {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

const DATABASE_URL =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!DATABASE_URL) {
  console.error('[cleanupE2E] DATABASE_URL (or SUPABASE_DB_URL/E2E_DATABASE_URL) is missing.')
  process.exit(1)
}

if (DATABASE_URL.includes(PROD_REF)) {
  const confirmProd = process.env.CONFIRM_PROD === 'YES'
  const allowSeedProd = process.env.ALLOW_SEED_PROD === 'YES'

  if (!confirmProd || !allowSeedProd) {
    console.error(
      `[cleanupE2E] Refusing to run: connection string appears to contain production project ref ${PROD_REF}. ` +
        'To override (NOT recommended), you must set CONFIRM_PROD=YES and ALLOW_SEED_PROD=YES.'
    )
    process.exit(1)
  }

  console.warn(
    `[cleanupE2E] WARNING: production ref ${PROD_REF} detected, but override is enabled via CONFIRM_PROD=YES and ALLOW_SEED_PROD=YES.`
  )
}

const orgId = getArgValue('--org-id') || process.env.E2E_ORG_ID || null

const deleteRequested =
  hasFlag('--delete') ||
  parseBoolEnv(process.env.CONFIRM_DELETE) ||
  parseBoolEnv(process.env.E2E_CLEANUP_DELETE)

const dryRun = !deleteRequested || hasFlag('--dry-run')

if (!dryRun && !orgId) {
  console.error(
    '[cleanupE2E] Refusing to delete without org scoping. Set E2E_ORG_ID or pass --org-id.'
  )
  console.error(
    '[cleanupE2E] You can still run a dry-run without org scoping to inspect candidates.'
  )
  process.exit(1)
}

const patterns = {
  jobPrefix: 'E2E ',
  vendorPrefix: 'E2E Vendor ',
  productPrefix: 'E2E Product ',
  productDescriptionExact: 'E2E created test product',
  loanerNumberExact: 'LOANER-E2E-123',
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
        `[cleanupE2E] DB connect failed: IPv6 appears unreachable, and IPv4 fallback failed. ${hint}`,
        { cause: fallbackErr }
      )
    }
  }
}

const toQuotedCsv = (values) => values.map((v) => JSON.stringify(String(v))).join(', ')

const main = async () => {
  const client = await connectWithIpv4Fallback(DATABASE_URL)

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
  }

  const scopeClause = (tableAlias, tableKey) => {
    if (!orgId) return { sql: '', params: [] }

    const has = hasOrgId[tableKey]
    if (!has) return { sql: '', params: [] }

    const prefix = tableAlias ? `${tableAlias}.` : ''
    return { sql: ` and ${prefix}org_id = $`, params: [orgId] }
  }

  const scoped = (baseSql, baseParams, tableAlias, tableKey) => {
    const scope = scopeClause(tableAlias, tableKey)
    if (!scope.sql) return { sql: baseSql, params: baseParams }

    return {
      sql: baseSql + scope.sql + String(baseParams.length + 1),
      params: [...baseParams, ...scope.params],
    }
  }

  const likePrefix = (prefix) => `${prefix}%`

  try {
    await client.query('begin')

    // Candidates
    const jobsQuery = scoped(
      `select id, title, description
       from public.jobs
       where (title ilike $1 or coalesce(description, '') ilike $1)`,
      [likePrefix(patterns.jobPrefix)],
      null,
      'jobs'
    )
    const jobsRes = await client.query(jobsQuery.sql, jobsQuery.params)
    const jobIds = jobsRes.rows.map((r) => r.id)

    const vendorsQuery = scoped(
      `select id, name
       from public.vendors
       where name ilike $1`,
      [likePrefix(patterns.vendorPrefix)],
      null,
      'vendors'
    )
    const vendorsRes = await client.query(vendorsQuery.sql, vendorsQuery.params)
    const vendorIds = vendorsRes.rows.map((r) => r.id)

    const productsQuery = scoped(
      `select id, name, description
       from public.products
       where (name ilike $1 or description = $2)`,
      [likePrefix(patterns.productPrefix), patterns.productDescriptionExact],
      null,
      'products'
    )
    const productsRes = await client.query(productsQuery.sql, productsQuery.params)
    const productIds = productsRes.rows.map((r) => r.id)

    // Loaner assignments candidates: either the specific test loaner number, or attached to candidate jobs.
    // Scope via jobs.org_id when available.
    const loanerParams = [patterns.loanerNumberExact]
    let loanerSql = `select la.id, la.job_id, la.loaner_number
       from public.loaner_assignments la
       join public.jobs j on j.id = la.job_id
       where (la.loaner_number = $1`

    if (jobIds.length > 0) {
      loanerParams.push(jobIds)
      loanerSql += ` or la.job_id = any($2::uuid[]))`
    } else {
      loanerSql += `)`
    }

    if (orgId && hasOrgId.jobs) {
      loanerParams.push(orgId)
      loanerSql += ` and j.org_id = $${loanerParams.length}`
    }

    const loanerRes = await client.query(loanerSql, loanerParams)
    const loanerIds = loanerRes.rows.map((r) => r.id)

    // Transactions candidates: created for every deal/job
    let transactionIds = []
    if (jobIds.length > 0) {
      const txnParams = [jobIds]
      let txnSql = `select id from public.transactions where job_id = any($1::uuid[])`
      if (orgId && hasOrgId.transactions) {
        txnParams.push(orgId)
        txnSql += ` and org_id = $2`
      }
      const txnRes = await client.query(txnSql, txnParams)
      transactionIds = txnRes.rows.map((r) => r.id)
    }

    // Safety checks: do not delete products/vendors if referenced by non-E2E jobs.
    // Products: keep if referenced by any job_parts where the job is NOT in the delete-set.
    const safeProductIds = []
    const unsafeProductIds = []

    if (productIds.length > 0) {
      const checkSql = `select distinct jp.product_id
         from public.job_parts jp
         join public.jobs j on j.id = jp.job_id
         where jp.product_id = any($1::uuid[])
           and not (j.id = any($2::uuid[]))`

      const checkParams = [
        productIds,
        jobIds.length > 0 ? jobIds : ['00000000-0000-0000-0000-000000000000'],
      ]
      const usedByNonE2E = await client.query(checkSql, checkParams)
      const usedSet = new Set(usedByNonE2E.rows.map((r) => r.product_id))

      for (const id of productIds) {
        if (usedSet.has(id)) unsafeProductIds.push(id)
        else safeProductIds.push(id)
      }
    }

    // Vendors: keep if referenced by any job NOT in delete-set, or any product NOT in deletable product set.
    const safeVendorIds = []
    const unsafeVendorIds = []

    if (vendorIds.length > 0) {
      const nonE2EJobsSql = `select distinct vendor_id
         from public.jobs
         where vendor_id = any($1::uuid[])
           and not (id = any($2::uuid[]))`
      const nonE2EJobsParams = [
        vendorIds,
        jobIds.length > 0 ? jobIds : ['00000000-0000-0000-0000-000000000000'],
      ]
      const vendorUsedByNonE2EJobs = await client.query(nonE2EJobsSql, nonE2EJobsParams)
      const usedByNonE2EJobsSet = new Set(vendorUsedByNonE2EJobs.rows.map((r) => r.vendor_id))

      const nonE2EProductsSql = `select distinct vendor_id
         from public.products
         where vendor_id = any($1::uuid[])
           and not (id = any($2::uuid[]))`
      const nonE2EProductsParams = [
        vendorIds,
        safeProductIds.length > 0 ? safeProductIds : ['00000000-0000-0000-0000-000000000000'],
      ]
      const vendorUsedByNonE2EProducts = await client.query(nonE2EProductsSql, nonE2EProductsParams)
      const usedByNonE2EProductsSet = new Set(
        vendorUsedByNonE2EProducts.rows.map((r) => r.vendor_id)
      )

      for (const id of vendorIds) {
        if (usedByNonE2EJobsSet.has(id) || usedByNonE2EProductsSet.has(id)) unsafeVendorIds.push(id)
        else safeVendorIds.push(id)
      }
    }

    const summary = {
      dryRun,
      orgId,
      candidates: {
        jobs: jobIds.length,
        vendors: vendorIds.length,
        products: productIds.length,
        loaner_assignments: loanerIds.length,
        transactions: transactionIds.length,
      },
      deletable: {
        jobs: jobIds.length,
        products: safeProductIds.length,
        vendors: safeVendorIds.length,
        loaner_assignments: loanerIds.length,
        transactions: transactionIds.length,
      },
      skippedForSafety: {
        products: unsafeProductIds.length,
        vendors: unsafeVendorIds.length,
      },
    }

    console.log('[cleanupE2E] Mode:', dryRun ? 'DRY RUN (no changes)' : 'DELETE')
    console.log('[cleanupE2E] Org scope:', orgId ? orgId : '(none)')
    console.log('[cleanupE2E] Candidates:', summary.candidates)
    console.log('[cleanupE2E] Deletable:', summary.deletable)
    if (unsafeProductIds.length > 0 || unsafeVendorIds.length > 0) {
      console.log('[cleanupE2E] Skipped for safety:', summary.skippedForSafety)
    }

    if (jobIds.length > 0) {
      console.log('[cleanupE2E] Example job ids:', toQuotedCsv(jobIds.slice(0, 5)))
    }

    if (dryRun) {
      await client.query('rollback')
      console.log(
        '[cleanupE2E] Dry-run complete. To delete, re-run with --delete and set E2E_ORG_ID (or pass --org-id).'
      )
      return
    }

    // Delete in FK-safe order.
    if (loanerIds.length > 0) {
      await client.query(`delete from public.loaner_assignments where id = any($1::uuid[])`, [
        loanerIds,
      ])
    }

    if (transactionIds.length > 0) {
      await client.query(`delete from public.transactions where id = any($1::uuid[])`, [
        transactionIds,
      ])
    }

    if (jobIds.length > 0) {
      // Some schemas cascade job_parts on job delete, but be explicit.
      await client.query(`delete from public.job_parts where job_id = any($1::uuid[])`, [jobIds])
      await client.query(`delete from public.jobs where id = any($1::uuid[])`, [jobIds])
    }

    if (safeProductIds.length > 0) {
      await client.query(`delete from public.products where id = any($1::uuid[])`, [safeProductIds])
    }

    if (safeVendorIds.length > 0) {
      await client.query(`delete from public.vendors where id = any($1::uuid[])`, [safeVendorIds])
    }

    await client.query('commit')
    console.log('[cleanupE2E] Delete complete.')
  } catch (err) {
    try {
      await client.query('rollback')
    } catch {}

    const message = err instanceof Error ? err.message : String(err)
    console.error('[cleanupE2E] Failed:', message)
    process.exitCode = 1
  } finally {
    try {
      await client.end()
    } catch {}
  }
}

await main()
