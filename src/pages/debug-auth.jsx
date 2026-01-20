// src/pages/debug-auth.jsx
import React, { useEffect, useState } from 'react'
import useTenant from '../hooks/useTenant'
import { listSmsTemplatesGlobal } from '../services/smsTemplateService'
import {
  getVendors as getVendorsGlobal,
  getProducts as getProductsGlobal,
  getUserProfiles as getUsersGlobal,
} from '../services/dropdownService'
import { isSupabaseConfigured, testSupabaseConnection } from '@/lib/supabase'
import {
  getNeedsSchedulingPromiseItems,
  getScheduleItems,
  getUnscheduledInProgressInHouseItems,
} from '@/services/scheduleItemsService'

function getSafeSessionSnapshot(session) {
  if (!session) return null

  const user = session?.user
  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          aud: user.aud,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        }
      : null,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  }
}

export default function DebugAuthPage() {
  const { orgId, loading: tenantLoading, session } = useTenant()
  const [counts, setCounts] = useState({})
  const [ops, setOps] = useState(null)
  const [dealsProbe, setDealsProbe] = useState({ loading: false, error: null, data: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [conn, setConn] = useState({ configured: false, ok: null, last: null })

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const addDays = (d, n) => {
          const dt = d ? new Date(d) : new Date()
          dt.setDate(dt.getDate() + n)
          return dt
        }

        // Unfiltered/global counts
        const [gVendors, gProducts, gUsers, gSms] = await Promise.all([
          getVendorsGlobal({ activeOnly: false }),
          getProductsGlobal({ activeOnly: false }),
          getUsersGlobal({ activeOnly: false }),
          listSmsTemplatesGlobal?.({ activeOnly: false }).catch(() => []),
        ])

        // Org+global counts (matches dropdownService logic)
        const [oVendors, oProducts, oUsers, oSms] = await Promise.all([
          orgId ? getVendorsGlobal({ activeOnly: false }) : Promise.resolve([]),
          orgId ? getProductsGlobal({ activeOnly: false }) : Promise.resolve([]),
          orgId ? getUsersGlobal({ activeOnly: false }) : Promise.resolve([]),
          orgId
            ? listSmsTemplatesGlobal({ activeOnly: false }).catch(() => [])
            : Promise.resolve([]),
        ])

        // Operational counts for the pages that appear empty (Snapshot / Agenda / Flow Center)
        let opsNext = null
        if (orgId) {
          const now = new Date()
          const next7Start = now
          const next7End = addDays(now, 7)

          const [next7Res, overdueRes, needsRes, unscheduledRes] = await Promise.all([
            getScheduleItems({ rangeStart: next7Start, rangeEnd: next7End, orgId }),
            getScheduleItems({ rangeStart: addDays(now, -7), rangeEnd: now, orgId }),
            getNeedsSchedulingPromiseItems({
              orgId,
              rangeStart: addDays(now, -365),
              rangeEnd: next7End,
            }),
            getUnscheduledInProgressInHouseItems({ orgId }),
          ])

          opsNext = {
            next7: {
              count: Array.isArray(next7Res?.items) ? next7Res.items.length : 0,
              debug: next7Res?.debug || null,
            },
            overdue7: {
              count: Array.isArray(overdueRes?.items) ? overdueRes.items.length : 0,
              debug: overdueRes?.debug || null,
            },
            needsScheduling: {
              count: Array.isArray(needsRes?.items) ? needsRes.items.length : 0,
              debug: needsRes?.debug || null,
            },
            unscheduledInProgressInHouse: {
              count: Array.isArray(unscheduledRes?.items) ? unscheduledRes.items.length : 0,
              debug: unscheduledRes?.debug || null,
            },
          }
        }

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
        setOps(opsNext)
      } catch (err) {
        console.error('debug-auth load error', err)
        if (mounted) setError(err?.message || String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    // initial env/config snapshot
    setConn((c) => ({ ...c, configured: !!isSupabaseConfigured?.() }))
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
        <p className="text-slate-500 text-sm mb-2">
          Session details are intentionally redacted to avoid exposing tokens.
        </p>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify(getSafeSessionSnapshot(session), null, 2)}
        </pre>

        {import.meta.env.DEV && session ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-600">
              Dev-only: full session (tokens redacted)
            </summary>
            <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-auto">
              {JSON.stringify(
                {
                  ...session,
                  access_token: session?.access_token ? '[REDACTED]' : session?.access_token,
                  refresh_token: session?.refresh_token ? '[REDACTED]' : session?.refresh_token,
                  provider_token: session?.provider_token ? '[REDACTED]' : session?.provider_token,
                  provider_refresh_token: session?.provider_refresh_token
                    ? '[REDACTED]'
                    : session?.provider_refresh_token,
                },
                null,
                2
              )}
            </pre>
          </details>
        ) : null}
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
        <h2 className="font-semibold">Supabase connection</h2>
        <div className="flex items-center gap-3 mb-2">
          <span>Configured:</span>
          <strong data-testid="sb-configured">{conn.configured ? 'Yes' : 'No'}</strong>
          <button
            type="button"
            className="btn-mobile btn-mobile-sm"
            onClick={async () => {
              try {
                const ok = await testSupabaseConnection?.(2)
                setConn({ configured: !!isSupabaseConfigured?.(), ok, last: new Date() })
              } catch {
                setConn({ configured: !!isSupabaseConfigured?.(), ok: false, last: new Date() })
              }
            }}
            data-testid="sb-test-btn"
          >
            Test
          </button>
        </div>
        <div>
          Status:{' '}
          <strong data-testid="sb-status">
            {conn.ok == null ? '—' : conn.ok ? 'OK' : 'Error'}
          </strong>
          {conn.last ? (
            <span className="ml-2 text-slate-600 text-sm" data-testid="sb-last">
              ({conn.last.toLocaleTimeString()})
            </span>
          ) : null}
        </div>
        <p className="text-slate-500 text-sm mt-1">
          If you see “Error” but the app otherwise works, it may be an RLS-permission message. The
          test treats those as reachable.
        </p>
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

            <h3 className="mt-4">Operational (org-scoped)</h3>
            {!orgId ? (
              <div className="text-slate-600 text-sm">No orgId available.</div>
            ) : !ops ? (
              <div className="text-slate-600 text-sm">Loading operational counts...</div>
            ) : (
              <ul>
                <li>
                  Schedule items (next 7 days):{' '}
                  <span data-testid="ops-schedule-next7-count">{ops?.next7?.count ?? 'N/A'}</span>
                </li>
                <li>
                  Schedule items (previous 7 days):{' '}
                  <span data-testid="ops-schedule-overdue7-count">
                    {ops?.overdue7?.count ?? 'N/A'}
                  </span>
                </li>
                <li>
                  All-day (promise-only):{' '}
                  <span data-testid="ops-needs-scheduling-count">
                    {ops?.needsScheduling?.count ?? 'N/A'}
                  </span>
                </li>
                <li>
                  Unscheduled in-progress (in-house/on-site):{' '}
                  <span data-testid="ops-unscheduled-inprogress-inhouse-count">
                    {ops?.unscheduledInProgressInHouse?.count ?? 'N/A'}
                  </span>
                </li>
              </ul>
            )}

            <div className="mt-4">
              <h3 className="font-semibold">Deals visibility probe</h3>
              <p className="text-slate-500 text-sm">
                Helps diagnose “0 deals” by checking what <code>getAllDeals()</code> returns for
                your current session.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="btn-mobile btn-mobile-sm"
                  disabled={!orgId || dealsProbe.loading}
                  onClick={async () => {
                    setDealsProbe({ loading: true, error: null, data: null })
                    try {
                      const { getAllDeals } = await import('../services/dealService')
                      const deals = await getAllDeals()
                      const statusCounts = (Array.isArray(deals) ? deals : []).reduce((acc, d) => {
                        const key = String(d?.job_status || 'unknown')
                        acc[key] = (acc[key] || 0) + 1
                        return acc
                      }, {})
                      const missingCustomer = (Array.isArray(deals) ? deals : []).filter((d) => {
                        const name = String(d?.customer_name || '').trim()
                        return !name
                      }).length

                      setDealsProbe({
                        loading: false,
                        error: null,
                        data: {
                          count: Array.isArray(deals) ? deals.length : 0,
                          statusCounts,
                          missingCustomer,
                        },
                      })
                    } catch (e) {
                      setDealsProbe({
                        loading: false,
                        error: e?.message || String(e),
                        data: null,
                      })
                    }
                  }}
                >
                  {dealsProbe.loading ? 'Probing…' : 'Probe Deals'}
                </button>
                {dealsProbe.data ? (
                  <span className="text-sm text-slate-700" data-testid="deals-probe-count">
                    Deals: <strong>{dealsProbe.data.count}</strong>
                  </span>
                ) : null}
              </div>

              {dealsProbe.error ? (
                <div className="mt-2 text-red-600 text-sm">Error: {dealsProbe.error}</div>
              ) : null}

              {dealsProbe.data ? (
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    Missing customer_name: <strong>{dealsProbe.data.missingCustomer}</strong>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-slate-600">
                      job_status distribution
                    </summary>
                    <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-auto">
                      {JSON.stringify(dealsProbe.data.statusCounts, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}

            </div>

            {import.meta.env.DEV && ops ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-slate-600">
                  Operational debug details
                </summary>
                <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-auto">
                  {JSON.stringify(ops, null, 2)}
                </pre>
              </details>
            ) : null}
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
