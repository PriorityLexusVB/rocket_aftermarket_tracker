// src/pages/deals/EditDeal.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../../components/layouts/AppLayout'
import DealFormV2 from '../../components/deals/DealFormV2'
import * as dealService from '../../services/dealService'

export default function EditDeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dealData, setDealData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const deal = await dealService?.getDeal(id)
        if (!alive) return
        const mapped = dealService.mapDbDealToForm ? dealService.mapDbDealToForm(deal) : deal
        setDealData(mapped)
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

  const handleSave = async (formState) => {
    try {
      await dealService?.updateDeal(id, formState)
      const fresh = await dealService?.getDeal(id)
      const mapped = dealService.mapDbDealToForm ? dealService.mapDbDealToForm(fresh) : fresh
      setDealData(mapped)
      setLastSavedAt(new Date())
    } catch (e) {
      setError(e?.message || 'Failed to save deal')
      throw e
    }
  }

  const dealNumber = dealData?.job_number || `#${id}`
  const stockNumber = dealData?.vehicle?.stock_number || dealData?.stock_number || '—'

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-4 md:p-8" style={{ paddingTop: '5rem' }}>
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-6">
            <div>
              <h1 className="text-2xl font-semibold text-[rgb(var(--foreground))]">Edit Deal</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
                Deal {dealNumber} / Stock # {stockNumber}
              </p>
              {lastSavedAt ? (
                <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]" data-testid="last-saved-timestamp">
                  Last saved:{' '}
                  {lastSavedAt.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate('/deals')}
              className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 text-sm font-medium text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.5)]"
            >
              ← Back to Deals
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-8 text-sm text-[rgb(var(--muted-foreground))]">Loading deal...</div>
            ) : error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : (
              <DealFormV2
                mode="edit"
                job={dealData || {}}
                onSave={handleSave}
                onCancel={() => navigate('/deals')}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
