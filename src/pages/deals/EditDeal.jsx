// src/pages/deals/EditDeal.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DealForm from './DealForm'
import * as dealService from '../../services/dealService'
import { entityToDraft, draftToUpdatePayload } from '../../components/deals/formAdapters'

// Feature flag for V2 unified form with adapters
const useV2 = import.meta.env.VITE_DEAL_FORM_V2 === 'true'

export default function EditDeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [initial, setInitial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const d = await dealService?.getDeal(id)
        if (alive) {
          // When V2 flag is on, use adapter to normalize entity to draft
          const mapped = useV2
            ? entityToDraft(d)
            : dealService.mapDbDealToForm
              ? dealService.mapDbDealToForm(d)
              : d
          setInitial(mapped)
        }
      } catch (e) {
        alert(e?.message || 'Failed to load deal')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  async function onSubmit(formState) {
    setSaving(true)
    try {
      // When V2 flag is on, use adapter to normalize payload
      const payload = useV2 ? draftToUpdatePayload(id, formState) : formState
      // Update then re-fetch latest persisted values; stay on Edit
      await dealService?.updateDeal(id, payload)
      const fresh = await dealService?.getDeal(id)
      const mapped = useV2
        ? entityToDraft(fresh)
        : dealService.mapDbDealToForm
          ? dealService.mapDbDealToForm(fresh)
          : fresh
      setInitial(mapped)
      setLastSavedAt(new Date())
    } catch (e) {
      alert(e?.message || 'Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8">Loading...</div>
  }

  const dealNumber = initial?.job_number || `#${id}`
  const stockNumber = initial?.vehicle?.stock_number || initial?.stock_number || '—'

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Deal {dealNumber} / Stock # {stockNumber}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/deals')}
          className="btn-mobile button-outline-enhanced"
        >
          ← Back to Deals
        </button>
      </header>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit Deal</h1>
        <p className="text-gray-600">Update details and save.</p>
        {lastSavedAt ? (
          <p className="text-sm text-gray-500 mt-1" data-testid="last-saved-timestamp">
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
      <DealForm
        mode="edit"
        initial={initial || {}}
        onSave={onSubmit}
        onCancel={() => navigate('/deals')}
      />
    </div>
  )
}
