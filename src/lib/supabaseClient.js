// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // This helps catch misconfigured Rocket secrets immediately
  // (You'll see a clean error instead of "Failed to fetch")
  throw new Error('Supabase env missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
  // no local session needed for internal tool
})
