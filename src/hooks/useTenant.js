import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

export function useTenant() {
  const auth = useAuth()
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!auth?.user) return
        const { data } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('id', auth.user.id)
          .single()
          .throwOnError()
        if (alive) setOrgId(data?.org_id ?? null)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('useTenant: org_id fetch failed', e)
        if (alive) setOrgId(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [auth?.user?.id])

  return { orgId, loading, session: auth }
}

export default useTenant
