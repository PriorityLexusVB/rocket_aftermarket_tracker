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
      // Only surface a storage object when running in the browser to avoid SSR issues
      const browserStorage = (typeof window !== 'undefined' && window?.localStorage) ? window.localStorage : undefined;

      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // Keep session persistence and refresh enabled for SPA behavior
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Provide storage only when available (avoid referencing window during SSR)
          storage: browserStorage,
          storageKey: 'priority-automotive-auth',
          // Prefer the PKCE flow for modern browser-based auth
          flowType: 'pkce'
        },
        db: {
          schema: 'public'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
        // Intentionally do NOT set global.headers here — let the SDK manage required headers.
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

      // Prefer an RPC that validates auth/role-specific reachability when available.
      // If the RPC doesn't exist or fails, fall back to a safe select that tolerates RLS/permission responses.
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('check_auth_connection');
        if (!rpcError) {
          console.log(`✅ Supabase RPC check_auth_connection success (attempt ${attempt})`);
          return true;
        }

        // If rpc returns permission/RLS-related error, treat the endpoint as reachable
        if (rpcError && (rpcError.code === 'PGRST116' || rpcError.message?.toLowerCase().includes('permission') || rpcError.message?.toLowerCase().includes('rls'))) {
          console.log('⚠️ Supabase RPC returned RLS/permission info but endpoint is reachable:', rpcError.message);
          return true;
        }

        // Otherwise fall through to the fallback select below
        console.warn('⚠️ Supabase RPC returned an unexpected error, falling back to safe select:', rpcError?.message);
      } catch (rpcException) {
        // If the RPC call throws unexpectedly, ignore and try the fallback select
        console.warn('⚠️ Supabase RPC check failed (will try fallback select):', rpcException?.message);
      }

      // Fallback: safe, small select that works under RLS. Treat permission/RLS errors as "reachable".
      const { data, error } = await supabase.from('user_profiles').select('id').limit(1);

      if (error) {
        const msg = String(error?.message ?? '').toLowerCase();
        // Accept a handful of errors as signs that the DB is reachable but protected by RLS/permissions.
        if (['pgrst116', '42501'].includes(String(error?.code).toLowerCase()) || msg.includes('permission') || msg.includes('rls') || msg.includes('not found')) {
          console.log('⚠️ Supabase select returned RLS/permission info but DB is reachable:', error.message);
          return true;
        }
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
