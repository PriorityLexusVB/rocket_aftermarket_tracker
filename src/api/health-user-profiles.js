// /api/health-user-profiles
// Purpose: Detect which display columns exist on user_profiles and confirm REST access.
// Returns JSON with availability of name, full_name, display_name and a classification.

import { supabase } from '@/lib/supabase'

// Allowed column names to prevent SQL injection.
// NOTE: Currently column names are hardcoded in the handler (lines 39-41) and only
// called internally, but this validation provides defense-in-depth for future changes
// where column names might come from external input or request parameters.
const ALLOWED_COLUMNS = ['name', 'full_name', 'display_name']

async function checkCol(col) {
  // Validate column name (defensive programming for future-proofing)
  if (!ALLOWED_COLUMNS.includes(col)) {
    console.warn(`[health-user-profiles] Invalid column name: ${col}`)
    return null
  }

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
  const result = { name: null, full_name: null, display_name: null }
  try {
    result.name = await checkCol('name')
    result.full_name = await checkCol('full_name')
    result.display_name = await checkCol('display_name')

    const ok = !!(result.name || result.full_name || result.display_name)
    const classification = ok ? 'ok' : 'missing_all'

    return res?.status(200)?.json({
      ok,
      classification,
      columns: result,
      ms: Date.now() - started,
    })
  } catch (error) {
    return res?.status(500)?.json({
      ok: false,
      classification: 'error',
      columns: result,
      error: error?.message,
      ms: Date.now() - started,
    })
  }
}
