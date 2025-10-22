// src/pages/debug-auth.jsx
import React, { useEffect, useState } from 'react'
import useTenant from '../hooks/useTenant'
import {
  listVendorsByOrg,
  listProductsByOrg,
  listStaffByOrg,
  listSmsTemplatesByOrg,
} from '../services/tenantService'
import { listSmsTemplatesGlobal } from '../services/smsTemplateService'
import {
  getVendors as getVendorsGlobal,
  getProducts as getProductsGlobal,
  getUserProfiles as getUsersGlobal,
} from '../services/dropdownService'

export default function DebugAuthPage() {
  const { orgId, loading: tenantLoading, session } = useTenant()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Unfiltered/global counts
        const [gVendors, gProducts, gUsers, gSms] = await Promise.all([
          getVendorsGlobal({ activeOnly: false }),
          getProductsGlobal({ activeOnly: false }),
          getUsersGlobal({ activeOnly: false }),
          listSmsTemplatesGlobal?.({ activeOnly: false }).catch(() => []),
        ])

        // Org-filtered counts
        const [oVendors, oProducts, oUsers, oSms] = await Promise.all([
          orgId ? listVendorsByOrg(orgId, { activeOnly: false }) : Promise.resolve([]),
          orgId ? listProductsByOrg(orgId, { activeOnly: false }) : Promise.resolve([]),
          orgId ? listStaffByOrg(orgId, { activeOnly: false }) : Promise.resolve([]),
          orgId ? listSmsTemplatesByOrg(orgId, { activeOnly: false }) : Promise.resolve([]),
        ])

        if (!mounted) return
        setCounts({
          global: {
            vendors: gVendors.length,
            products: gProducts.length,
            users: gUsers.length,
            sms_templates: gSms.length,
          },
          org: {
            vendors: oVendors.length,
            products: oProducts.length,
            users: oUsers.length,
            sms_templates: oSms.length,
          },
        })
      } catch (err) {
        console.error('debug-auth load error', err)
        if (mounted) setError(err?.message || String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [orgId])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug: Auth / Org / Tenancy</h1>

      <section className="mb-4">
        <h2 className="font-semibold">Session</h2>
        <div className="mb-2">
          <span className="text-sm text-slate-600">Session User ID: </span>
          <strong data-testid="session-user-id">{session?.user?.id || '—'}</strong>
        </div>
        <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(session || null, null, 2)}</pre>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Tenant</h2>
        <div>
          orgId: <strong data-testid="profile-org-id">{String(orgId)}</strong>
        </div>
        <div>
          loading: <strong>{String(tenantLoading)}</strong>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Counts</h2>
        {loading ? (
          <div>Loading counts...</div>
        ) : error ? (
          <div className="text-red-600">Error: {error}</div>
        ) : (
          <div>
            <h3 className="mt-2">Global</h3>
            <ul>
              <li>
                Vendors:{' '}
                <span data-testid="global-vendor-count">{counts?.global?.vendors ?? 'N/A'}</span>
              </li>
              <li>
                Products:{' '}
                <span data-testid="global-product-count">{counts?.global?.products ?? 'N/A'}</span>
              </li>
              <li>
                Users:{' '}
                <span data-testid="global-staff-count">{counts?.global?.users ?? 'N/A'}</span>
              </li>
              <li>
                SMS Templates:{' '}
                <span data-testid="global-sms-template-count">
                  {counts?.global?.sms_templates ?? 'N/A'}
                </span>
              </li>
            </ul>

            <h3 className="mt-2">Org-scoped</h3>
            <ul>
              <li>
                Vendors: <span data-testid="org-vendor-count">{counts?.org?.vendors ?? 'N/A'}</span>
              </li>
              <li>
                Products:{' '}
                <span data-testid="org-product-count">{counts?.org?.products ?? 'N/A'}</span>
              </li>
              <li>
                Users: <span data-testid="org-staff-count">{counts?.org?.users ?? 'N/A'}</span>
              </li>
              <li>
                SMS Templates:{' '}
                <span data-testid="org-sms-template-count">
                  {counts?.org?.sms_templates ?? 'N/A'}
                </span>
              </li>
            </ul>
          </div>
        )}
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Notes</h2>
        <ul className="list-disc ml-6">
          <li>
            This page uses tenant-aware list functions when <code>orgId</code> exists.
          </li>
          <li>Permission / RLS errors will appear in the console and in the error box above.</li>
        </ul>
      </section>
    </div>
  )
}
