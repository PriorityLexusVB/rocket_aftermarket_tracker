// src/lib/supabaseServer.js
// NOTE: This helper must remain free of Node globals (like `process`) because anything
// under `src/` may be imported into the Vite client bundle.

import { createClient } from '@supabase/supabase-js'

export const supabaseServer = ({ supabaseUrl, supabaseServiceKey, url, serviceKey } = {}) => {
  const resolvedUrl = supabaseUrl ?? url
  const resolvedServiceKey = supabaseServiceKey ?? serviceKey

  if (!resolvedUrl || !resolvedServiceKey) {
    throw new Error('supabaseServer requires explicit { url, serviceKey } (server-only usage)')
  }

  // Guard against accidental browser usage.
  if (typeof window !== 'undefined') {
    throw new Error('supabaseServer is server-only and must not be used in the browser')
  }

  return createClient(resolvedUrl, resolvedServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
