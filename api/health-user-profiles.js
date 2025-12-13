// Vercel serverless function: /api/health-user-profiles
// Detect which profile display columns exist and return a classification.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

async function check(col) {
  try {
    const { error } = await supabase.from('user_profiles').select(`id, ${col}`).limit(1)
    // If no error, column exists
    if (!error) return true
    // Check if it's a "column does not exist" error
    const errMsg = String(error?.message || '').toLowerCase()
    if (errMsg.includes('column') && errMsg.includes('does not exist')) {
      return false
    }
    // Other errors (RLS, network, etc.) - treat as unknown
    console.warn(`[health-user-profiles] Unexpected error checking ${col}:`, error?.message)
    return null
  } catch (err) {
    console.warn(`[health-user-profiles] Exception checking ${col}:`, err?.message)
    return null
  }
}

export default async function handler(req, res) {
  const started = Date.now()
  const columns = { name: null, full_name: null, display_name: null }
  try {
    columns.name = await check('name')
    columns.full_name = await check('full_name')
    columns.display_name = await check('display_name')
    const ok = !!(columns.name || columns.full_name || columns.display_name)
    const classification = ok ? 'ok' : 'missing_all'
    return res.status(200).json({ ok, classification, columns, ms: Date.now() - started })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      classification: 'error',
      columns,
      error: e.message,
      ms: Date.now() - started,
    })
  }
}
