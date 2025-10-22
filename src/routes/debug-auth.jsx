import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTenant } from '../hooks/useTenant'

export default function DebugAuth() {
  const auth = useAuth()
  const { orgId, loading: tenantLoading } = useTenant()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!auth?.user) return
      setLoading(true)
      try {
        // Unfiltered counts
        const [uV, uP, uS, uT] = await Promise.all([
          supabase.from('vendors').select('id', { count: 'exact' }).throwOnError(),
          supabase.from('products').select('id', { count: 'exact' }).throwOnError(),
          supabase.from('staff_records').select('id', { count: 'exact' }).throwOnError(),
          supabase.from('sms_templates').select('id', { count: 'exact' }).throwOnError(),
        ])

        // Org-filtered counts (if we have orgId)
        let oV = null
        let oP = null
        let oS = null
        let oT = null
        if (orgId) {
          ;[oV, oP, oS, oT] = await Promise.all([
            supabase
              .from('vendors')
              .select('id', { count: 'exact' })
              .eq('org_id', orgId)
              .throwOnError(),
            supabase
              .from('products')
              .select('id', { count: 'exact' })
              .eq('org_id', orgId)
              .throwOnError(),
            supabase
              .from('staff_records')
              .select('id', { count: 'exact' })
              .eq('org_id', orgId)
              .throwOnError(),
            supabase
              .from('sms_templates')
              .select('id', { count: 'exact' })
              .eq('org_id', orgId)
              .throwOnError(),
          ])
        }

        if (!alive) return
        setCounts({
          user: { id: auth.user?.id, email: auth.user?.email },
          profileOrg: orgId,
          unfiltered: {
            vendors: uV?.count ?? null,
            products: uP?.count ?? null,
            staff_records: uS?.count ?? null,
            sms_templates: uT?.count ?? null,
          },
          filtered: {
            vendors: oV?.count ?? null,
            products: oP?.count ?? null,
            staff_records: oS?.count ?? null,
            sms_templates: oT?.count ?? null,
          },
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('debug-auth counts failed', e)
        if (alive) setCounts({ error: String(e) })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [auth?.user?.id, orgId])

  if (!auth?.user) return <div>Please sign in to view debug-auth</div>
  if (tenantLoading) return <div>Loading tenant...</div>

  return (
    <div style={{ padding: 20 }}>
      <h2>Debug Auth & Tenant</h2>
      <pre>{JSON.stringify(counts, null, 2)}</pre>
      {loading ? <div>Loading counts...</div> : null}
    </div>
  )
}
