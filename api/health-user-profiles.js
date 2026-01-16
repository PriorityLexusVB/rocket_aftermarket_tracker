// Vercel serverless function: /api/health-user-profiles
// Detect which profile display columns exist and return a classification.

import { createClient } from '@supabase/supabase-js'

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

// Allowed column names to prevent SQL injection.
// NOTE: Currently column names are hardcoded in the handler (lines 42-44) and only
// called internally, but this validation provides defense-in-depth for future changes
// where column names might come from external input or request parameters.
const ALLOWED_COLUMNS = ['name', 'full_name', 'display_name']

const WARNED_KEYS = new Set()

function logOnce(key, message) {
  if (WARNED_KEYS.has(key)) return
  WARNED_KEYS.add(key)
  console.warn(message)
}

async function check(col) {
  // Validate column name (defensive programming for future-proofing)
  if (!ALLOWED_COLUMNS.includes(col)) {
    console.warn(`[health-user-profiles] Invalid column name: ${col}`)
    return null
  }

  try {
    const { supabase } = getSupabase()
    if (!supabase) return null

    const { error } = await supabase.from('user_profiles').select(`id, ${col}`).limit(1)
    // If no error, column exists
    if (!error) return true
    // Check if it's a "column does not exist" error
    const errMsg = String(error?.message || '').toLowerCase()
    if (errMsg.includes('column') && errMsg.includes('does not exist')) {
      return false
    }
    if (errMsg.includes('permission denied') || errMsg.includes('not authorized')) {
      // Expected in some RLS configurations; treat as unknown/unavailable without log spam.
      return null
    }
    // Other errors (RLS, network, etc.) - treat as unknown
    logOnce(
      `unexpected-${col}`,
      `[health-user-profiles] Unexpected error checking ${col}: ${error?.message}`
    )
    return null
  } catch (err) {
    logOnce(`exception-${col}`, `[health-user-profiles] Exception checking ${col}: ${err?.message}`)
    return null
  }
}

function sendJson(res, status, body) {
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(body)
  }

  // Node.js http.ServerResponse (used by vite-plugin-api)
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

export default async function handler(req, res) {
  const started = Date.now()
  const columns = { name: null, full_name: null, display_name: null }
  try {
    const { supabase, env } = getSupabase()
    if (!supabase) {
      return sendJson(res, 200, {
        ok: false,
        classification: 'misconfigured',
        columns,
        env,
        ms: Date.now() - started,
      })
    }

    columns.name = await check('name')
    columns.full_name = await check('full_name')
    columns.display_name = await check('display_name')
    const ok = !!(columns.name || columns.full_name || columns.display_name)
    const classification = ok ? 'ok' : 'missing_all'
    return sendJson(res, 200, { ok, classification, columns, ms: Date.now() - started })
  } catch (e) {
    return sendJson(res, 200, {
      ok: false,
      classification: 'error',
      columns,
      error: e?.message,
      ms: Date.now() - started,
    })
  }
}
