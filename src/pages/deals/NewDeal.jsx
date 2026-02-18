// src/pages/deals/NewDeal.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import useTenant from '../../hooks/useTenant'
import dealService from '../../services/dealService'
import { draftToCreatePayload } from '../../components/deals/formAdapters'
import DealFormV2 from '../../components/deals/DealFormV2'

export default function NewDeal() {
  const navigate = useNavigate()
  const { orgId } = useTenant() || {}
  const [error, setError] = React.useState('')

  async function handleSave(payload) {
    try {
      setError('')

      const dealPayload = {
        ...payload,
        dealer_id: orgId || undefined,
      }

      const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
      const adapted = useV2 ? draftToCreatePayload(dealPayload) : dealPayload
      const created = await dealService.createDeal(adapted)

      if (created?.id) {
        navigate(`/deals/${created.id}/edit`)
      } else {
        throw new Error('Deal created but no id was returned')
      }
    } catch (e) {
      const msg = e?.message || 'Failed to create deal'
      setError(msg)
      throw new Error(msg)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create Deal</h1>
        <p className="text-gray-600">Enter deal information and line items.</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <DealFormV2 mode="create" job={null} onSave={handleSave} onCancel={() => navigate('/deals')} />
    </div>
  )
}
