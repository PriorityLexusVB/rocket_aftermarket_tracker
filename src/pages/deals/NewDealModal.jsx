// src/pages/deals/NewDealModal.jsx
// Simplified New Deal Modal using DealFormV2 for wizard parity with Edit
import React, { useState } from 'react'
import useTenant from '../../hooks/useTenant'
import dealService from '../../services/dealService'
import { draftToCreatePayload } from '../../components/deals/formAdapters'
import DealFormV2 from '../../components/deals/DealFormV2'
import Icon from '../../components/ui/Icon'

export default function NewDealModal({ isOpen, onClose, onSuccess }) {
  const { orgId } = useTenant() || {}
  const [error, setError] = useState('')

  // Handle save - DealFormV2 will call this with the payload
  const handleSave = async (payload) => {
    try {
      setError('')

      // Add dealer_id if available (tenant scoping)
      const dealPayload = {
        ...payload,
        dealer_id: orgId || undefined,
      }

      // Use feature flag to determine if we need to adapt the payload
      const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
      const adapted = useV2 ? draftToCreatePayload(dealPayload) : dealPayload

      // Create the deal via dealService
      const savedDeal = await dealService.createDeal(adapted)

      // Success - call callbacks, passing back the saved deal for in-place update
      if (onSuccess) onSuccess(savedDeal)
      handleClose()
    } catch (err) {
      setError(`Failed to create deal: ${err?.message}`)
      throw err
    }
  }

  // Handle close
  const handleClose = () => {
    setError('')
    if (onClose) onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Deal</h2>
            <p className="text-sm text-gray-600 mt-1">Enter deal information and line items</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>Error:</strong> {error}
                  </div>
                  <button
                    onClick={() => setError('')}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    <Icon name="X" size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            <DealFormV2 mode="create" job={null} onSave={handleSave} onCancel={handleClose} />
          </div>
        </div>
      </div>
    </div>
  )
}
