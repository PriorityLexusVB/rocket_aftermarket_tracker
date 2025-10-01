import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    // Add storage configuration for better session handling
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Error writing to localStorage:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing from localStorage:', error);
        }
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
});

// Add session recovery function
export const recoverSession = async () => {
  try {
    console.log('Attempting session recovery...');
    
    // Clear potentially corrupted session data
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-' + supabaseUrl?.split('//')?.[1] + '-auth-token');
    
    // Get fresh session
    const { data: { session }, error } = await supabase?.auth?.getSession();
    
    if (error) {
      console.error('Session recovery failed:', error?.message);
      // Force sign out to clear any corrupt state
      await supabase?.auth?.signOut();
      return null;
    }
    
    console.log('Session recovery completed:', { hasSession: !!session });
    return session;
  } catch (error) {
    console.error('Session recovery error:', error);
    // Clear everything and force fresh start
    try {
      await supabase?.auth?.signOut();
    } catch (signOutError) {
      console.error('Error during cleanup signout:', signOutError);
    }
    return null;
  }
};