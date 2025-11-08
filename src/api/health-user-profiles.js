// /api/health-user-profiles
// Purpose: Detect which display columns exist on user_profiles and confirm REST access.
// Returns JSON with availability of name, full_name, display_name and a classification.

import { supabase } from '@/lib/supabase'

async function checkCol(col) {
  try {
    const { error } = await supabase.from('user_profiles').select(`id, ${col}`).limit(1)
    return !error
  } catch (_) {
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
