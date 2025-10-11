import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

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
          // Create basic profile for auth.users with admin role by default
          const { data: { user } } = await supabase?.auth?.getUser()
          if (user) {
            const basicProfile = {
              id: user?.id,
              email: user?.email,
              full_name: user?.email?.split('@')?.[0] || 'User',
              role: 'admin', // Updated to default to admin role
              is_active: true
            }
            
            const { data: newProfile } = await supabase?.from('user_profiles')?.insert(basicProfile)?.select()?.single()
            
            if (newProfile) {
              setUserProfile(newProfile)
              localStorage.setItem('userRole', newProfile?.role);
            }
          }
        }
      } catch (error) {
        console.error('Error loading or creating user profile:', error)
      } finally {
        setProfileLoading(false)
      }
    },
    clear() {
      setUserProfile(null)
      localStorage.removeItem('userRole')
    }
  }

  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase?.auth?.getSession()
      if (session?.user) {
        setUser(session?.user)
        await profileOperations?.load(session?.user?.id)
      } else {
        setUser(null)
        profileOperations?.clear()
      }
    } catch (error) {
      console.error("Error checking user session:", error)
      setUser(null)
      profileOperations?.clear()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkUser()
    const { data: authListener } = supabase?.auth?.onAuthStateChange((event, session) => {
      setLoading(true)
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session?.user)
        profileOperations?.load(session?.user?.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        profileOperations?.clear()
      }
      setLoading(false)
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    };
  }, [checkUser])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({ email, password })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error?.message };
    }
  }

  const signOut = async () => {
    await supabase?.auth?.signOut()
    setUser(null)
    profileOperations?.clear()
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, profileLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};