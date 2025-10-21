// src/pages/deals/EditDeal.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DealForm from './DealForm'
import * as dealService from '../../services/dealService'

export default function EditDeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [initial, setInitial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const d = await dealService?.getDeal(id)
        if (alive) {
          const mapped = dealService.mapDbDealToForm ? dealService.mapDbDealToForm(d) : d
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
      // Update then re-fetch latest persisted values; stay on Edit
      await dealService?.updateDeal(id, formState)
      const fresh = await dealService?.getDeal(id)
      const mapped = dealService.mapDbDealToForm ? dealService.mapDbDealToForm(fresh) : fresh
      setInitial(mapped)
    } catch (e) {
      alert(e?.message || 'Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8">Loading...</div>
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {/* Deal/Stock area (visible above form header) */}
      <div className="mb-4">
        <div className="text-sm text-slate-600">Deal / Job #</div>
        <div className="text-lg font-medium text-slate-900">{initial?.job_number || `#${id}`}</div>
        <div className="text-sm text-slate-500">
          Stock # {initial?.vehicle?.stock_number || initial?.stock_number || '—'}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit Deal</h1>
        <p className="text-gray-600">Update details and save.</p>
      </div>
      <DealForm
        mode="edit"
        initial={initial}
        onSave={onSubmit}
        onCancel={() => navigate('/deals')}
        saving={saving}
      />
    </div>
  )
}
