// IMPORTANT:
// This repo has a JS implementation at `src/lib/supabase.js` that includes
// robust dev/test fallbacks and additional helpers.
//
// To avoid module-resolution drift (some imports resolving to .ts, others to .js)
// we re-export from the JS module so all callers share the same singleton.

export {
  supabase,
  isSupabaseConfigured,
  testSupabaseConnection,
  isNetworkOnline,
  recoverSession,
} from './supabase.js'

export { default } from './supabase.js'
