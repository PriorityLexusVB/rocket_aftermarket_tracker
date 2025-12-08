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
  const { user, userProfile } = useAuth() || {}
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
    let retryAttempt = 0
    const MAX_RETRIES = 1

    const load = async () => {
      // If there's no authenticated user, ensure we surface null and not-loading
      if (!user?.id && !user?.email) {
        if (aliveRef.current) {
          setOrgId(null)
          setLoading(false)
        }
        return
      }

      // If AuthContext already resolved org_id, prefer it and skip extra selects
      if (userProfile?.org_id != null) {
        if (aliveRef.current) {
          setOrgId(userProfile.org_id)
          setLoading(false)
        }
        return
      }
      if (userProfile && 'org_id' in userProfile) {
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
      let shouldRetry = false

      // Try lookup by user.id first
      for (const col of CANDIDATES) {
        try {
          if (!user?.id) break // Skip id-based lookup if no id

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
            // Network error: consider retry
            if (msg.includes('failed to fetch') || msg.includes('network')) {
              shouldRetry = retryAttempt < MAX_RETRIES
              if (shouldRetry) break
            }
            // Other errors: log and continue fallback
            console.warn('useTenant: profile select warning:', error?.message || error)
          }
        } catch (e) {
          const msg = String(e?.message || '').toLowerCase()
          // Network/fetch errors: consider retry
          if (msg.includes('failed to fetch') || msg.includes('network')) {
            shouldRetry = retryAttempt < MAX_RETRIES
            if (shouldRetry) break
          }
          console.warn('useTenant: profile select attempt failed:', e?.message || e)
        }
      }

      // If id-based lookup didn't find org_id and we have email, try email fallback
      if (resolvedOrg === null && !nonFatal && user?.email && !shouldRetry) {
        for (const col of CANDIDATES) {
          try {
            const { data, error } = await supabase
              .from('user_profiles')
              .select(col)
              .eq('email', user.email)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle?.()

            if (!error && data && Object.prototype.hasOwnProperty.call(data, col)) {
              resolvedOrg = data[col] ?? null
              if (resolvedOrg) {
                console.log('[useTenant] Found org_id via email fallback')
              }
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
            }
          } catch (e) {
            console.warn('useTenant: email fallback attempt failed:', e?.message || e)
          }
        }
      }

      // Handle retry for transient network errors
      if (shouldRetry && retryAttempt < MAX_RETRIES) {
        retryAttempt++
        console.log(`[useTenant] Retrying due to network error (attempt ${retryAttempt})`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (!didCancel) {
          load()
        }
        return
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
  }, [user?.id, user?.email, userProfile?.org_id])

  return { orgId, loading, session: derivedSession }
}

// Default export required by callers; also provide a named export for compatibility
export default useTenant
export { useTenant }
