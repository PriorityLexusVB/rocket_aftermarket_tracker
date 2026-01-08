// src/lib/supabaseServer.js (server-only usage!)
import { createClient } from '@supabase/supabase-js'

export const supabaseServer = () => {
  // Important: never reference `process` directly in code that may be bundled
  // for the browser. `globalThis.process?.env` is safe in browser (undefined)
  // and works in Node.
  const env = globalThis.process?.env

  const url = env?.NEXT_PUBLIC_SUPABASE_URL
  const service = env?.SUPABASE_SERVICE_KEY

  return createClient(url, service, { auth: { persistSession: false } })
}
