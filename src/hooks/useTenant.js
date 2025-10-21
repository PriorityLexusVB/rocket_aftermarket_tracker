// src/hooks/useTenant.js
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

/**
 * useTenant hook
 * Exposes orgId (profile.org_id), loading and session.
 * Reads user_profiles for the current user on mount.
 */
export default function useTenant() {
  const { session, user } = useAuth() || {}
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(Boolean(user) && !orgId)

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      setLoading(true)
      try {
        if (!user?.id) {
          setOrgId(null)
          setLoading(false)
          return
        }
        const { data, error } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (error) {
          // If permission denied or RLS, just treat as anonymous/no-org for now
          console.warn('useTenant: profile select error (may be RLS)', error?.message || error)
          setOrgId(null)
          setLoading(false)
          return
        }
        if (!cancelled) {
          setOrgId(data?.org_id ?? null)
          setLoading(false)
        }
      } catch (err) {
        console.error('useTenant unexpected error:', err)
        if (!cancelled) {
          setOrgId(null)
          setLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { orgId, loading, session }
}
