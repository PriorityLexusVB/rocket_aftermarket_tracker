import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch (error) {
          console.error('Error reading from localStorage:', error)
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch (error) {
          console.error('Error writing to localStorage:', error)
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.error('Error removing from localStorage:', error)
        }
      }
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
function recoverSession(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: recoverSession is not implemented yet.', args);
  return null;
}

export { recoverSession };