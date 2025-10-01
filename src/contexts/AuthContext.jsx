import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, recoverSession } from '../lib/supabase';


const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Enhanced profile operations with error handling
  const profileOperations = {
    async load(userId) {
      if (!userId) return
      setProfileLoading(true)
      try {
        const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('id', userId)?.single()
        if (!error && data) {
          setUserProfile(data)
          localStorage.setItem('userRole', data?.role)
        } else {
          // Create basic profile for auth.users
          const { data: { user } } = await supabase?.auth?.getUser()
          if (user) {
            const basicProfile = {
              id: user?.id,
              email: user?.email,
              full_name: user?.email?.split('@')?.[0] || 'User',
              role: 'staff',
              is_active: true
            }
            
            const { data: newProfile } = await supabase
              ?.from('user_profiles')
              ?.insert(basicProfile)
              ?.select()
              ?.single()
            
            if (newProfile) {
              setUserProfile(newProfile)
              localStorage.setItem('userRole', newProfile?.role);
            }
          }
        }
      } catch (error) {
        console.error('Profile load error:', error);
        // Don't throw error, just log it
      } finally {
        setProfileLoading(false)
      }
    },

    clear() {
      setUserProfile(null)
      setProfileLoading(false)
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
    }
  }

  // Enhanced auth state handlers with refresh token error handling
  const authStateHandlers = {
    onChange: async (event, session) => {
      console.log('Auth state changed:', { event, hasSession: !!session, hasUser: !!session?.user });
      
      // Handle refresh token errors specifically
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.error('Token refresh failed - clearing auth state');
        setUser(null);
        profileOperations?.clear();
        setLoading(false);
        return;
      }
      
      // Handle signed out events
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setUser(null);
        profileOperations?.clear();
        setLoading(false);
        return;
      }
      
      setUser(session?.user ?? null)
      setLoading(false)
      
      if (session?.user) {
        profileOperations?.load(session?.user?.id)
      } else {
        profileOperations?.clear()
      }
    }
  }

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    // Enhanced initial auth check with retry logic
    const initAuth = async () => {
      try {
        console.log('Initializing auth...', { retryCount });
        
        const { data: { session }, error } = await supabase?.auth?.getSession()
        
        if (error && error?.message?.includes('refresh_token_not_found')) {
          console.warn('Refresh token not found - attempting session recovery...');
          
          // Try session recovery first
          const recoveredSession = await recoverSession();
          if (mounted) {
            authStateHandlers?.onChange('RECOVERED', recoveredSession);
          }
          return;
        }
        
        if (error) {
          console.error('Auth initialization error:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => initAuth(), 1000 * retryCount); // Exponential backoff
            return;
          }
        }
        
        if (mounted) {
          authStateHandlers?.onChange('INITIAL_SESSION', session);
        }
      } catch (error) {
        console.error('Initial auth check failed:', error);
        
        // If it's a refresh token error, try recovery
        if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
          console.log('Attempting session recovery due to refresh token error...');
          try {
            const recoveredSession = await recoverSession();
            if (mounted) {
              authStateHandlers?.onChange('RECOVERED', recoveredSession);
            }
          } catch (recoveryError) {
            console.error('Session recovery failed:', recoveryError);
            if (mounted) {
              setLoading(false);
            }
          }
        } else if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Enhanced auth state change listener with error handling
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change event:', event);
        
        // Handle specific error events
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.error('Token refresh failed - will attempt recovery');
          recoverSession()?.then(recoveredSession => {
            if (mounted) {
              authStateHandlers?.onChange('RECOVERED', recoveredSession);
            }
          });
          return;
        }
        
        authStateHandlers?.onChange(event, session);
      }
    )

    return () => {
      mounted = false;
      subscription?.unsubscribe()
    }
  }, [])

  // Enhanced signIn method with refresh token error handling
  const signIn = async (email, password, rememberMe = false) => {
    console.log('=== AUTHENTICATION DEBUG START ===');
    console.log('Email:', email);
    console.log('Supabase client exists:', !!supabase);
    console.log('Environment check:', {
      hasUrl: !!import.meta.env?.VITE_SUPABASE_URL,
      hasKey: !!import.meta.env?.VITE_SUPABASE_ANON_KEY
    });

    try {
      // Input validation
      if (!email?.trim() || !password?.trim()) {
        return { success: false, error: 'Email and password are required' };
      }

      // Environment validation
      if (!supabase) {
        console.error('Supabase client not initialized');
        return { success: false, error: 'Authentication service unavailable. Please refresh the page.' };
      }

      // Clear any existing corrupted session before signing in
      try {
        await recoverSession();
      } catch (recoveryError) {
        console.warn('Session recovery failed, continuing with sign in:', recoveryError);
      }

      console.log('Starting enhanced auth process...');
      
      let authResult = null;
      let timeoutId = null;
      let isResolved = false;

      try {
        const authPromise = new Promise(async (resolve, reject) => {
          try {
            console.log('Making direct Supabase auth call...');
            const result = await supabase.auth.signInWithPassword({ 
              email: email?.trim()?.toLowerCase(), 
              password: password?.trim()
            });
            console.log('Auth call returned:', { 
              hasData: !!result?.data, 
              hasError: !!result?.error,
              errorMessage: result?.error?.message 
            });
            resolve(result);
          } catch (authError) {
            console.error('Auth promise internal error:', authError);
            reject(authError);
          }
        });

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            if (!isResolved) {
              console.error('=== AUTHENTICATION TIMEOUT ===');
              reject(new Error('TIMEOUT_15_SECONDS'));
            }
          }, 15000);
        });

        authResult = await Promise.race([authPromise, timeoutPromise]);
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);

      } catch (raceError) {
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        console.error('Auth race error:', raceError?.message);
        
        if (raceError?.message === 'TIMEOUT_15_SECONDS') {
          return { 
            success: false, 
            error: 'Authentication timeout. Please refresh the page and try again.' 
          };
        }
        
        return { 
          success: false, 
          error: 'Authentication request failed. Please check your internet connection and try again.' 
        };
      }

      console.log('=== PROCESSING AUTH RESULT ===');
      const { data, error } = authResult || {};

      if (error) {
        console.error('Supabase auth error:', error?.message);
        
        let userFriendlyError = 'Login failed. Please check your credentials.';
        
        if (error?.message?.includes('Invalid login credentials')) {
          userFriendlyError = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error?.message?.includes('Email not confirmed')) {
          userFriendlyError = 'Email not confirmed. Please check your email for confirmation instructions.';
        } else if (error?.message?.includes('Too many requests')) {
          userFriendlyError = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
          userFriendlyError = 'Session expired. The page will refresh automatically.';
          // Auto-refresh page to clear corrupted state
          setTimeout(() => window.location?.reload(), 2000);
        } else if (error?.status === 500) {
          userFriendlyError = 'Server error. Please refresh the page and try again.';
        }
        
        return { success: false, error: userFriendlyError };
        
      } else if (data?.user && data?.session) {
        console.log('=== LOGIN SUCCESSFUL ===');
        console.log('User ID:', data?.user?.id);
        console.log('Session valid:', !!data?.session?.access_token);
        
        // Store session info
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('userEmail', email);
        }
        
        return { success: true, data, error: null };
        
      } else {
        console.error('Invalid auth response:', { data, error });
        return { 
          success: false, 
          error: 'Invalid authentication response. Please refresh the page and try again.' 
        };
      }
      
    } catch (error) {
      console.error('=== AUTH SYSTEM ERROR ===');
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      
      let errorMessage = 'Authentication failed. Please refresh the page and try again.';
      
      if (error?.message?.includes('refresh_token') || error?.message?.includes('Invalid Refresh Token')) {
        errorMessage = 'Session corrupted. The page will refresh automatically to fix this.';
        setTimeout(() => window.location?.reload(), 2000);
      } else if (error?.message?.includes('fetch') || error?.name === 'TypeError') {
        errorMessage = 'Network connection failed. Please check your internet connection.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again or refresh the page.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      console.log('=== AUTHENTICATION DEBUG END ===');
    }
  }

  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: { data: metadata }
      })
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  // Enhanced signOut with session cleanup
  const signOut = async () => {
    try {
      // Clear local storage first to prevent any issues
      localStorage.removeItem('rememberMe')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userEmail')
      
      // Clear any Supabase session storage
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-' + supabaseUrl?.split('//')?.[1] + '-auth-token');
      }
      
      const { error } = await supabase?.auth?.signOut()
      
      // Clear state regardless of API success
      setUser(null)
      profileOperations?.clear()
      
      return { error }
    } catch (error) {
      // Still clear local state even if API call fails
      setUser(null)
      profileOperations?.clear()
      return { error: { message: 'Network error during sign out. Local session cleared.' } }
    }
  }

  const resetPassword = async (email) => {
    try {
      const { data, error } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: `${window.location?.origin}/reset-password`,
      })
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'No user logged in' } }
    
    try {
      const { data, error } = await supabase?.from('user_profiles')?.update(updates)?.eq('id', user?.id)?.select()?.single()
      
      if (!error) {
        setUserProfile(data)
      }
      
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: userProfile?.role === 'admin',
    isManager: userProfile?.role === 'manager' || userProfile?.role === 'admin',
    isStaff: !!userProfile?.role,
    isVendor: userProfile?.role === 'vendor',
    vendorId: userProfile?.vendor_id
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };