// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY

// Guardrail: warn if local dev is pointed at known production.
if (import.meta.env?.DEV) {
  const m = String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)
  const ref = m?.[1] || null
  if (ref === 'ogjtmtndgiqqdtwatsue') {
    // Do not throw; just warn loudly.
    console.error(
      '[supabaseClient] DEV ENV WARNING: VITE_SUPABASE_URL is pointed at the known production project ref.'
    )
  }
}

if (!url || !anon) {
  // This helps catch misconfigured Rocket secrets immediately
  // (You'll see a clean error instead of "Failed to fetch")
  throw new Error('Supabase env missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
  // no local session needed for internal tool
})
