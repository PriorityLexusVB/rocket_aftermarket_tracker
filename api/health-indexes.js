// Vercel serverless function: /api/health-indexes
// Heuristic index health check for job_parts; PostgREST doesn't expose pg_indexes directly.
// We provide guidance and best-effort checks plus remediation DDL.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

export default async function handler(req, res) {
  const started = Date.now()
  const expected = [
    'idx_job_parts_scheduled_start_time',
    'idx_job_parts_scheduled_end_time',
    'idx_job_parts_vendor_id',
  ]

  // Best-effort: verify columns exist to avoid false-positive guidance
  let columnsOk = true
  try {
    const { error } = await supabase
      .from('job_parts')
      .select('scheduled_start_time, scheduled_end_time, vendor_id')
      .limit(0)
    if (error) columnsOk = false
  } catch {
    columnsOk = false
  }

  const ddl = [
    'create index concurrently if not exists idx_job_parts_scheduled_start_time on public.job_parts(scheduled_start_time);',
    'create index concurrently if not exists idx_job_parts_scheduled_end_time on public.job_parts(scheduled_end_time);',
    'create index concurrently if not exists idx_job_parts_vendor_id on public.job_parts(vendor_id);',
  ]

  return res.status(200).json({
    ok: true,
    columnsOk,
    expectedIndexes: expected,
    verification:
      'Direct pg_indexes introspection is not available via PostgREST; use psql or MCP execute_sql to confirm.',
    remediation: ddl,
    ms: Date.now() - started,
  })
}
