import { createClient } from '@supabase/supabase-js';

// Environment variables with enhanced validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Environment Check:', {
  url: supabaseUrl ? 'Present' : 'Missing',
  anonKey: supabaseAnonKey ? 'Present' : 'Missing',
  urlValid: supabaseUrl?.includes('supabase.co') || supabaseUrl?.includes('localhost'),
  keyValid: supabaseAnonKey?.length > 50
});

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL is not defined. Please check your .env file.');
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is not defined. Please check your .env file.');
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Ensure single instance to prevent multiple GoTrueClient warnings
let supabaseInstance = null;

const createSupabaseClient = () => {
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window?.localStorage,
          storageKey: 'priority-automotive-auth'
        },
        db: {
          schema: 'public'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        },
        global: {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          }
        }
      });

      console.log('✅ Supabase client created successfully');
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error);
      throw error;
    }
  }
  return supabaseInstance;
};

export const supabase = createSupabaseClient();

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabase);
};

// Enhanced connection test with proper authentication check
export const testSupabaseConnection = async (retries = 2) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured');
      }

      // Test with a simple query that works with RLS
      const { data, error } = await supabase?.from('user_profiles')?.select('id')?.limit(1);

      if (error && error?.code !== 'PGRST116') { // PGRST116 is "table not found" - acceptable
        throw error;
      }

      console.log(`✅ Supabase connection test successful (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Supabase connection test failed (attempt ${attempt}/${retries}):`, error?.message);

      if (attempt === retries) {
        console.error('❌ Supabase connection test failed after all attempts:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        return false;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return false;
};

// Network status monitoring
let isOnline = navigator?.onLine ?? true;

window?.addEventListener?.('online', () => {
  isOnline = true;
  console.log('🌐 Network connection restored');
});

window?.addEventListener?.('offline', () => {
  isOnline = false;
  console.warn('📡 Network connection lost');
});

export const isNetworkOnline = () => isOnline;

export default supabase;
function recoverSession(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: recoverSession is not implemented yet.', args);
  return null;
}

export { recoverSession };
