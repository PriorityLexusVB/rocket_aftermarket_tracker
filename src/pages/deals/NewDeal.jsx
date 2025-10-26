// src/pages/deals/NewDeal.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import DealForm from './DealForm'
import * as dealService from '../../services/dealService'

export default function NewDeal() {
  const navigate = useNavigate()
  const [saving, setSaving] = React.useState(false)

  // Handler passed into DealForm as onSave
  async function onSave(formState) {
    setSaving(true)
    try {
      const created = await dealService.createDeal(formState)
      if (created?.id) {
        // Routes expect /deals/:dealId/edit
        navigate(`/deals/${created.id}/edit`)
      } else {
        alert('Deal created but no id was returned')
        throw new Error('Deal created but no id was returned')
      }
    } catch (e) {
      const msg = e?.message || 'Failed to create deal'
      alert(msg)
      // Re-throw so DealForm can surface the error inline for E2E visibility
      throw new Error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Deal # New / Stock # —</h1>
      </header>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create Deal</h1>
        <p className="text-gray-600">Enter details below. You can edit later.</p>
      </div>

      <DealForm mode="create" onSave={onSave} onCancel={() => navigate('/deals')} />
    </div>
  )
}
