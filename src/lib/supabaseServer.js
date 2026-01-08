// src/lib/supabaseServer.js
// NOTE: This helper must remain free of Node globals (like `process`) because anything
// under `src/` may be imported into the Vite client bundle.

import { createClient } from '@supabase/supabase-js'

<<<<<<< HEAD
export const supabaseServer = ({ supabaseUrl, supabaseServiceKey }) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'supabaseServer requires explicit { supabaseUrl, supabaseServiceKey } (do not read process.env from client code)'
    )
  }

  // Guard against accidental browser usage.
  if (typeof window !== 'undefined') {
    throw new Error('supabaseServer is server-only and must not be used in the browser')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
=======
export const supabaseServer = ({ url, serviceKey } = {}) => {
  if (!url || !serviceKey) {
    throw new Error('supabaseServer requires { url, serviceKey } (server-only usage)')
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } })
>>>>>>> origin/main
}
