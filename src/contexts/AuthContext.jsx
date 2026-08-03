import React, { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { persistOrgId } from '../utils/orgStorage'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const role = userProfile?.role || null
  const orgId = userProfile?.org_id ?? null
  const vendorId = userProfile?.vendor_id ?? null
  const isVendor = role === 'vendor'
  const isManager = role === 'manager' || role === 'admin'
  const isAdmin = role === 'admin'

  const profileOperations = useMemo(
    () => ({
      async load(userId) {
        if (!userId) return { ok: false, error: 'No authenticated user.' }
        setProfileLoading(true)
        try {
          const { data, error } = await supabase
            ?.from('user_profiles')
            ?.select('*')
            ?.or(`id.eq.${userId},auth_user_id.eq.${userId}`)
            ?.limit(1)
            ?.maybeSingle()
          if (!error && data?.is_active) {
            setUserProfile(data)
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('userRole', data?.role)
            }
            persistOrgId(data?.org_id ?? null, userId)
            return { ok: true, profile: data }
          }
          // Profiles are provisioned by controlled server/admin flows only.
          // Browser sessions must never create roles or restore access.
          const message = data?.is_active === false
            ? 'Your Rocket access has been deactivated. Contact Samantha Morgan for help.'
            : 'Your account is not provisioned for Rocket. Contact Samantha Morgan for help.'
          setUserProfile(null)
          if (typeof localStorage !== 'undefined') localStorage.removeItem('userRole')
          persistOrgId(null)
          await supabase?.auth?.signOut({ scope: 'local' })
          setSession(null)
          setUser(null)
          return { ok: false, error: message, cause: error || null }
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
          setUserProfile(null)
          if (typeof localStorage !== 'undefined') localStorage.removeItem('userRole')
          persistOrgId(null)
          try {
            await supabase?.auth?.signOut({ scope: 'local' })
          } catch {
            // Local state below still closes the route if Auth cleanup itself fails.
          }
          setSession(null)
          setUser(null)
          return { ok: false, error: 'Unable to verify your Rocket access.' }
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
    }),
    []
  )

  const checkUser = useCallback(async () => {
    try {
      const { data, error } = await supabase?.auth?.getSession()
      if (error) throw error
      const nextSession = data?.session ?? null
      setSession(nextSession)
      const authedUser = nextSession?.user || null
      setUser(authedUser)
      if (authedUser) {
        await profileOperations?.load(authedUser?.id)
      } else {
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
      setSession(null)
      setUser(null)
      profileOperations?.clear()
    } finally {
      setLoading(false)
    }
  }, [profileOperations])

  useEffect(() => {
    checkUser()
    const { data: authListener } = supabase?.auth?.onAuthStateChange((event, nextSession) => {
      setLoading(true)
      if (event === 'SIGNED_IN' && nextSession?.user) {
        setSession(nextSession)
        setUser(nextSession?.user)
        profileOperations?.load(nextSession?.user?.id)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        profileOperations?.clear()
      }
      setLoading(false)
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [checkUser, profileOperations])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({ email, password })
      if (error) throw error

      const { data: sessionResult, error: sessionError } = await supabase?.auth?.getSession()
      if (sessionError) throw sessionError

      const nextSession = sessionResult?.session || data?.session || null
      const sessionUser = nextSession?.user || data?.user
      if (sessionUser) {
        setSession(nextSession)
        setUser(sessionUser)
        const profileResult = await profileOperations?.load(sessionUser?.id)
        if (!profileResult?.ok) {
          return { success: false, error: profileResult?.error || 'Your Rocket access is unavailable.' }
        }
        return { success: true, data: { ...data, session: nextSession } }
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
    await supabase?.auth?.signOut({ scope: 'local' })
    setUser(null)
    setSession(null)
    profileOperations?.clear()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        loading,
        profileLoading,
        role,
        orgId,
        vendorId,
        isVendor,
        isManager,
        isAdmin,
        isAuthed: !!session?.user && !!userProfile?.is_active,
        signIn,
        signOut,
      }}
    >
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
