// src/lib/supabaseServer.js (server-only usage!)
import { createClient } from '@supabase/supabase-js'

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
}
