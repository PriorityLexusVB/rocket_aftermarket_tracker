import { createClient } from '@supabase/supabase-js';

// Environment variables with fallback handling
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL is not defined. Please check your .env file.');
}

if (!supabaseAnonKey) {
  console.error('VITE_SUPABASE_ANON_KEY is not defined. Please check your .env file.');
}

// Ensure single instance to prevent multiple GoTrueClient warnings
let supabaseInstance = null;

const createSupabaseClient = () => {
  if (!supabaseInstance) {
    // Only create client if we have valid environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot create Supabase client: missing environment variables');
      return null;
    }

    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          // Add timeout to prevent hanging requests
          fetch: (url, options = {}) => {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(30000) // 30 second timeout
            });
          }
        },
        db: {
          schema: 'public'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      return null;
    }
  }
  return supabaseInstance;
};

export const supabase = createSupabaseClient();

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabase);
};

// Helper function to test connection
export const testSupabaseConnection = async () => {
  try {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    // Simple test query
    const { data, error } = await supabase?.from('user_profiles')?.select('id')?.limit(1);

    if (error) {
      throw error;
    }

    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
};

function recoverSession(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: recoverSession is not implemented yet.', args);
  return null;
}

export { recoverSession };