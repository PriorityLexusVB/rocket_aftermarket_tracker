// src/lib/supabaseServer.js
// NOTE: This helper must remain free of Node globals (like `process`) because anything
// under `src/` may be imported into the Vite client bundle.

import { createClient } from '@supabase/supabase-js'

export const supabaseServer = ({ url, serviceKey } = {}) => {
  if (!url || !serviceKey) {
    throw new Error('supabaseServer requires { url, serviceKey } (server-only usage)')
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } })
}
