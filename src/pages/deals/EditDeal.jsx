// src/pages/deals/EditDeal.jsx
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../../components/layouts/AppLayout'
import DealFormV2 from '../../components/deals/DealFormV2'
import * as dealService from '../../services/dealService'
// Wave G: import mapDbDealToForm directly from dealMappers (not the
// dealService re-export) to mirror EditDealModal's circular-dep break.
import { mapDbDealToForm } from '../../services/deal/dealMappers'

export default function EditDeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [dealData, setDealData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const deal = await dealService?.getDeal(id)
        if (!alive) return
        setDealData(mapDbDealToForm(deal))
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load deal')
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [id])

  const handleSave = async (payload) => {
    try {
      await dealService?.updateDeal(id, payload)
      // V2 calls onCancel after a successful save, which navigates back to
      // /deals. No need to refetch+rehydrate locally — the destination page
      // refetches on mount. Mirrors EditDealModal.jsx:62-79.
    } catch (e) {
      setError(e?.message || 'Failed to save deal')
      throw e
    }
  }

  const dealNumber = dealData?.job_number || `#${id}`
  const stockNumber = dealData?.vehicle?.stock_number || dealData?.stock_number || '—'

  const returnTo =
    typeof location?.state?.from === 'string' && location.state.from.startsWith('/')
      ? location.state.from
      : '/deals'

  const backLabel = returnTo.startsWith('/currently-active-appointments')
    ? '← Back to Appointments'
    : '← Back to Deals'

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-4 md:p-8" style={{ paddingTop: '5rem' }}>
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-border p-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Edit Deal</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Deal {dealNumber} / Stock # {stockNumber}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground 0"
            >
              {backLabel}
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-8 text-sm text-muted-foreground">Loading deal...</div>
            ) : error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : dealData ? (
              <DealFormV2
                mode="edit"
                job={dealData}
                onSave={handleSave}
                onCancel={() => navigate(returnTo)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
