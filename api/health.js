// Vercel serverless function: /api/health
// Basic reachability health check for Supabase.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

function sendJson(res, status, body) {
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(body)
  }

  // Node.js http.ServerResponse
  if (res && typeof res.setHeader === 'function' && typeof res.end === 'function') {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
    return
  }

  // Fallback (e.g., Fetch API style)
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req, res) {
  const started = Date.now()

  if (!supabaseUrl || !supabaseKey) {
    return sendJson(res, 500, {
      ok: false,
      db: false,
      error: 'Missing Supabase env vars (SUPABASE_URL/VITE_SUPABASE_URL and key)',
      ms: Date.now() - started,
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  try {
    // Lightweight ping: table existence + auth reachability.
    const { error } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .limit(0)

    if (!error) {
      return sendJson(res, 200, { ok: true, db: true, ms: Date.now() - started })
    }

    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('permission') || msg.includes('rls') || msg.includes('not authorized')) {
      // Endpoint reachable, but protected — still OK for ping purposes.
      return sendJson(res, 200, { ok: true, db: true, ms: Date.now() - started })
    }

    return sendJson(res, 500, {
      ok: false,
      db: false,
      error: error?.message,
      ms: Date.now() - started,
    })
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      db: false,
      error: e?.message,
      ms: Date.now() - started,
    })
  }
}
