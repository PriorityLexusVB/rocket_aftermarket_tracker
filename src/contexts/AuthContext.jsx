import React, { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { persistOrgId } from '../utils/orgStorage'

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
        const { data, error } = await supabase
          ?.from('user_profiles')
          ?.select('*')
          ?.eq('id', userId)
          ?.single()
        if (!error && data) {
          setUserProfile(data)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('userRole', data?.role)
          }
          persistOrgId(data?.org_id ?? null, userId)
        } else {
          // Create basic profile for auth.users with admin role by default
          const {
            data: { user },
          } = await supabase?.auth?.getUser()
          if (user) {
            const basicProfile = {
              id: user?.id,
              email: user?.email,
              full_name: user?.email?.split('@')?.[0] || 'User',
              role: 'admin', // Updated to default to admin role
              is_active: true,
            }

            const { data: newProfile } = await supabase
              ?.from('user_profiles')
              ?.insert(basicProfile)
              ?.select()
              ?.single()

            if (newProfile) {
              setUserProfile(newProfile)
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('userRole', newProfile?.role)
              }
              persistOrgId(newProfile?.org_id ?? null, user?.id || userId)
            }
          }
        }
      } catch (error) {
        // Show user-friendly error but don't block loading
        const errorMessage = error?.message || 'Authentication service error'
        if (errorMessage?.includes('Failed to fetch') || errorMessage?.includes('NetworkError')) {
          console.warn(
            'Cannot connect to authentication service. Your Supabase project may be paused or inactive.'
          )
        } else {
          console.error('Error loading user profile:', error)
        }
      } finally {
        setProfileLoading(false)
      }
    },
    clear() {
      setUserProfile(null)
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('userRole')
      }
      persistOrgId(null)
    },
  }

  const checkUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase?.auth?.getSession()
      if (session?.user) {
        setUser(session?.user)
        await profileOperations?.load(session?.user?.id)
      } else {
        setUser(null)
        profileOperations?.clear()
      }
    } catch (error) {
      const errorMessage = error?.message || 'Session check failed'
      if (errorMessage?.includes('Failed to fetch') || errorMessage?.includes('NetworkError')) {
        console.warn(
          'Cannot connect to authentication service. Please check your network connection.'
        )
      } else {
        console.error('Error checking user session:', error)
      }
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
    }
  }, [checkUser])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({ email, password })
      if (error) throw error

      const { data: sessionResult, error: sessionError } = await supabase?.auth?.getSession()
      if (sessionError) throw sessionError

      const sessionUser = sessionResult?.session?.user || data?.user
      if (sessionUser) {
        setUser(sessionUser)
        await profileOperations?.load(sessionUser?.id)
        return { success: true, data: { ...data, session: sessionResult?.session } }
      }

      return { success: false, error: 'Login succeeded but session is unavailable. Please retry.' }
    } catch (error) {
      const errorMessage = error?.message || 'Login failed'
      if (errorMessage?.includes('Failed to fetch') || errorMessage?.includes('NetworkError')) {
        return {
          success: false,
          error:
            'Cannot connect to authentication service. Please check your network connection and try again.',
        }
      }
      return { success: false, error: errorMessage }
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
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
