import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

// Ensure single instance to prevent multiple GoTrueClient warnings
let supabaseInstance = null;

const createSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }
  return supabaseInstance;
}

export const supabase = createSupabaseClient();
function recoverSession(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: recoverSession is not implemented yet.', args);
  return null;
}

export { recoverSession };