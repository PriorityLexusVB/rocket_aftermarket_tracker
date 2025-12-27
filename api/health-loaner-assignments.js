// Vercel serverless function: /api/health-loaner-assignments
// Checks read access (RLS) for loaner_assignments and provides policy remediation.

import { createClient } from '@supabase/supabase-js'
import { classifySchemaError } from '../src/utils/schemaErrorClassifier.js'

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      supabase: null,
      env: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseKey: Boolean(supabaseKey),
      },
    }
  }

  return {
    supabase: createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }),
    env: {
      hasSupabaseUrl: true,
      hasSupabaseKey: true,
    },
  }
}

function sendJson(res, status, body) {
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(body)
  }

  if (res && typeof res.setHeader === 'function' && typeof res.end === 'function') {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
    return
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const POLICY_TEMPLATE = `create policy "auth_read_loaner_assignments"\non public.loaner_assignments for select\nto authenticated\nusing (true);`

export default async function handler(req, res) {
  const started = Date.now()
  try {
    const { supabase, env } = getSupabase()
    if (!supabase) {
      return sendJson(res, 200, {
        ok: false,
        classification: 'misconfigured',
        env,
        ms: Date.now() - started,
      })
    }

    const { data, error } = await supabase
      .from('loaner_assignments')
      .select('id, job_id, loaner_number')
      .is('returned_at', null)
      .limit(1)

    if (error) {
      const msg = String(error?.message || '').toLowerCase()
      const classification = classifySchemaError(error)
      const isRlsDenied = /permission denied|not allowed|rls/i.test(msg) || error?.status === 403
      return sendJson(res, 200, {
        ok: false,
        classification,
        rlsDenied: isRlsDenied,
        error: error.message,
        remediation: isRlsDenied
          ? [
              'Add SELECT RLS policy granting authenticated role access to loaner_assignments',
              POLICY_TEMPLATE,
            ]
          : ['Inspect error and apply migrations / schema reload'],
        ms: Date.now() - started,
      })
    }

    return sendJson(res, 200, {
      ok: true,
      classification: 'ok',
      rowsChecked: data?.length || 0,
      ms: Date.now() - started,
    })
  } catch (e) {
    return sendJson(res, 200, {
      ok: false,
      classification: 'exception',
      error: e.message,
      ms: Date.now() - started,
    })
  }
}
