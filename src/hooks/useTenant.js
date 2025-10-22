// src/hooks/useTenant.js
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * useTenant
 * - Default-exported hook that returns the current org id from the user's profile.
 * - Return shape: { orgId, loading, session }
 * - Non-fatal behavior: any error when reading the profile (RLS/perm denied) will
 *   be logged as a warning and treated the same as "no org" (orgId === null).
 * - Uses an alive/ref flag to avoid state updates after unmount.
 */
function useTenant() {
  const { user } = useAuth() || {}
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(Boolean(user) && orgId === null)
  const aliveRef = useRef(true)
  // Derive a session-like shape for consumers that expect session.user
  const derivedSession = user ? { user } : null

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

      const CANDIDATES = ['org_id', 'organization_id', 'tenant_id']
      let resolvedOrg = null
      let nonFatal = false
      for (const col of CANDIDATES) {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select(col)
            .eq('id', user.id)
            .single()

          if (!error && data && Object.prototype.hasOwnProperty.call(data, col)) {
            resolvedOrg = data[col] ?? null
            break
          }
          if (error) {
            const msg = String(error?.message || '').toLowerCase()
            // If this column doesn't exist, try the next candidate
            if (msg.includes('does not exist') || msg.includes('column')) continue
            // Permission/RLS: treat as non-fatal (orgId=null); stop trying
            if (msg.includes('permission') || msg.includes('rls')) {
              nonFatal = true
              break
            }
            // Other errors: log and continue fallback
            console.warn('useTenant: profile select warning:', error?.message || error)
          }
        } catch (e) {
          console.warn('useTenant: profile select attempt failed:', e?.message || e)
        }
      }

      if (aliveRef.current && !didCancel) {
        if (resolvedOrg !== null) {
          setOrgId(resolvedOrg)
        } else {
          if (nonFatal) {
            console.warn('useTenant: treating RLS/permission as no-org')
          }
          setOrgId(null)
        }
        setLoading(false)
      }
    }

    load()

    return () => {
      didCancel = true
    }
  }, [user?.id])

  return { orgId, loading, session: derivedSession }
}

// Default export required by callers; also provide a named export for compatibility
export default useTenant
export { useTenant }
