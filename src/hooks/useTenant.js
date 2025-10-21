// src/hooks/useTenant.js
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

/**
 * useTenant
 * - Default-exported hook that returns the current org id from the user's profile.
 * - Return shape: { orgId, loading, session }
 * - Non-fatal behavior: any error when reading the profile (RLS/perm denied) will
 *   be logged as a warning and treated the same as "no org" (orgId === null).
 * - Uses an alive/ref flag to avoid state updates after unmount.
 */
function useTenant() {
  const { session, user } = useAuth() || {}
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(Boolean(user) && orgId === null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    let didCancel = false

    const load = async () => {
      // If there's no authenticated user, ensure we surface null and not-loading
      if (!user?.id) {
        if (aliveRef.current) {
          setOrgId(null)
          setLoading(false)
        }
        return
      }

      if (aliveRef.current) setLoading(true)

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('id', user.id)
          .single()

        // Treat permission/RLS errors as non-fatal: log a warning and continue
        if (error) {
          console.warn('useTenant: profile select error (possibly RLS/perm denied)',
            error?.message || error)
          if (aliveRef.current && !didCancel) {
            setOrgId(null)
            setLoading(false)
          }
          return
        }

        if (aliveRef.current && !didCancel) {
          setOrgId(data?.org_id ?? null)
          setLoading(false)
        }
      } catch (err) {
        // Unexpected errors are logged and treated like "no org"
        console.error('useTenant unexpected error reading profile:', err)
        if (aliveRef.current && !didCancel) {
          setOrgId(null)
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      didCancel = true
    }
  }, [user?.id])

  return { orgId, loading, session }
}

// Default export required by callers; also provide a named export for compatibility
export default useTenant
export { useTenant }
