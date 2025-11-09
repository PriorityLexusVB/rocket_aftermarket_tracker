#!/usr/bin/env node
/**
 * scripts/verify-capabilities.js
 * Minimal verification script aggregating health + telemetry endpoints.
 * Assumes local dev or deployed endpoints available under process.env.VERIFY_BASE_URL.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const base = process.env.VERIFY_BASE_URL || 'http://localhost:5173'
// For serverless endpoints when deployed on Vercel use production URL.

async function fetchJson(url) {
  try {
    const res = await fetch(url)
    return await res.json()
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function main() {
  const results = {}

  results.healthDealsRel = await fetchJson(`${base}/api/health-deals-rel`)
  results.healthJobPartsIndexes = await fetchJson(`${base}/api/health-indexes`)
  results.healthLoaner = await fetchJson(`${base}/api/health-loaner-assignments`)

  // Telemetry is client-side; attempt optional diagnostics endpoint if wired server-side later
  const telemetryPath = path.resolve('src/api/diagnostics/telemetry.js')
  let telemetryLocal = null
  if (fs.existsSync(telemetryPath)) {
    try {
      const mod = await import(pathToFileUrl(telemetryPath))
      telemetryLocal = mod?.getTelemetryDiagnostics?.() || null
    } catch {
      telemetryLocal = null
    }
  }

  // Basic PASS conditions
  const pass =
    results.healthDealsRel?.ok !== false &&
    results.healthLoaner?.classification !== 'exception' &&
    results.healthJobPartsIndexes?.ok === true

  const summary = {
    pass,
    timestamp: new Date().toISOString(),
    results,
    telemetryLocal,
    guidance: !pass
      ? [
          'If vendor_id or scheduled_* missing: apply migrations + NOTIFY pgrst, "reload schema"',
          'If RLS denied on loaner_assignments: add SELECT policy (see runbook)',
          'If indexes missing: apply DDL in /api/health-indexes remediation field',
        ]
      : ['All core capability checks passed'],
  }

  console.log(JSON.stringify(summary, null, 2))
  if (!pass) process.exit(1)
}

function pathToFileUrl(p) {
  const abs = path.resolve(p)
  const url = new URL('file://' + abs)
  return url.href
}

main()
