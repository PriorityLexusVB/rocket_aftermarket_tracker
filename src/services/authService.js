import { supabase, recoverSession } from '../lib/supabase';

export const authService = {
  // Enhanced sign in with refresh token error handling
  async signIn(email, password) {
    try {
      // Clear any potentially corrupted session first
      await recoverSession()?.catch(err => console.warn('Recovery attempt failed:', err));
      
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Handle refresh token specific errors
        if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
          console.warn('Refresh token error during sign in, clearing session...');
          await recoverSession();
          return { data: null, error: { message: 'Session was corrupted and has been reset. Please try signing in again.' } };
        }
        
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      // Handle refresh token errors in catch block too
      if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Refresh token error caught, attempting recovery...');
        try {
          await recoverSession();
          return { data: null, error: { message: 'Session was corrupted and has been reset. Please try signing in again.' } };
        } catch (recoveryError) {
          console.error('Session recovery failed:', recoveryError);
          return { data: null, error: { message: 'Authentication service temporarily unavailable. Please refresh the page.' } };
        }
      }
      
      if (error?.message?.includes('Failed to fetch') || 
          error?.message?.includes('AuthRetryableFetchError')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to authentication service. Your Supabase project may be paused or inactive. Please check your Supabase dashboard and resume your project if needed.' }
        };
      }
      return { data: null, error: { message: 'Network error. Please try again.' } };
    }
  },

  // Sign up with email and password
  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch') || 
          error?.message?.includes('AuthRetryableFetchError')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to authentication service. Your Supabase project may be paused or inactive. Please check your Supabase dashboard and resume your project if needed.' }
        };
      }
      return { data: null, error: { message: 'Network error. Please try again.' } };
    }
  },

  // Enhanced sign out with session cleanup
  async signOut() {
    try {
      // Clear local storage before API call
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-' + supabaseUrl?.split('//')?.[1] + '-auth-token');
      }
      
      const { error } = await supabase?.auth?.signOut();
      
      if (error && !error?.message?.includes('refresh_token')) {
        return { error: { message: error?.message } };
      }

      return { error: null };
    } catch (error) {
      // If it's a refresh token error during sign out, ignore it since we're signing out anyway
      if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Refresh token error during sign out - ignoring as user is signing out anyway');
        return { error: null };
      }
      return { error: { message: 'Network error. Please try again.' } };
    }
  },

  // Enhanced get current session with error handling
  async getSession() {
    try {
      const { data: { session }, error } = await supabase?.auth?.getSession();
      
      if (error) {
        // Handle refresh token errors
        if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
          console.warn('Refresh token error in getSession, attempting recovery...');
          const recoveredSession = await recoverSession();
          return { session: recoveredSession, error: null };
        }
        
        return { session: null, error: { message: error?.message } };
      }

      return { session, error: null };
    } catch (error) {
      if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Caught refresh token error in getSession, attempting recovery...');
        try {
          const recoveredSession = await recoverSession();
          return { session: recoveredSession, error: null };
        } catch (recoveryError) {
          console.error('Session recovery failed in getSession:', recoveryError);
          return { session: null, error: { message: 'Session recovery failed. Please sign in again.' } };
        }
      }
      return { session: null, error: { message: 'Network error. Please try again.' } };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase?.auth?.getUser();
      
      if (error) {
        // Handle refresh token errors
        if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
          console.warn('Refresh token error in getCurrentUser, attempting recovery...');
          await recoverSession();
          return { user: null, error: { message: 'Session was refreshed. Please try again.' } };
        }
        
        return { user: null, error: { message: error?.message } };
      }

      return { user, error: null };
    } catch (error) {
      if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Caught refresh token error in getCurrentUser, attempting recovery...');
        try {
          await recoverSession();
          return { user: null, error: { message: 'Session was refreshed. Please try again.' } };
        } catch (recoveryError) {
          return { user: null, error: { message: 'Session recovery failed. Please sign in again.' } };
        }
      }
      return { user: null, error: { message: 'Network error. Please try again.' } };
    }
  },

  // Reset password
  async resetPassword(email) {
    try {
      const { data, error } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: `${window.location?.origin}/reset-password`,
      });
      
      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: 'Network error. Please try again.' } };
    }
  },

  // Update password
  async updatePassword(password) {
    try {
      const { data, error } = await supabase?.auth?.updateUser({ password });
      
      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: 'Network error. Please try again.' } };
    }
  }
};