// src/pages/deals/components/EditDealModal.jsx
// Simplified Edit Deal Modal using DealFormV2 for wizard parity
import React, { useEffect, useState } from 'react'
import { getDeal, updateDeal, mapDbDealToForm } from '../../../services/dealService'
import DealFormV2 from '../../../components/deals/DealFormV2'
import Icon from '../../../components/ui/Icon'

const EditDealModal = ({ isOpen, dealId, deal: initialDeal, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dealData, setDealData] = useState(null)

  // Load deal data
  useEffect(() => {
    if (!isOpen) return

    const loadDeal = async () => {
      try {
        setLoading(true)
        setError('')

        // Use preloaded deal if available
        if (initialDeal && initialDeal?.id) {
          const formDeal = mapDbDealToForm(initialDeal)
          setDealData(formDeal)
          setLoading(false)
        } else if (dealId) {
          const fetchedDeal = await getDeal(dealId)
          const formDeal = mapDbDealToForm(fetchedDeal)
          setDealData(formDeal)
          setLoading(false)
        } else {
          setError('No deal selected to edit.')
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load deal:', err)
        setError(`Failed to load deal: ${err?.message}`)
        setLoading(false)
      }
    }

    loadDeal()
  }, [isOpen, dealId, initialDeal?.id])

  // Handle save
  const handleSave = async (payload) => {
    try {
      const savedDeal = await updateDeal(dealId || initialDeal?.id, payload)
      // Pass the saved deal back to parent for in-place update
      if (onSuccess) onSuccess(savedDeal)
    } catch (err) {
      throw err
    }
  }

  // Handle close
  const handleClose = () => {
    setDealData(null)
    setError('')
    setLoading(true)
    if (onClose) onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Deal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {dealData?.job_number ? `Job # ${dealData.job_number}` : 'Update deal information'}
            </p>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-slate-600">Loading deal...</div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <strong>Error:</strong> {error}
              </div>
            </div>
          ) : dealData ? (
            <div className="p-6">
              <DealFormV2 mode="edit" job={dealData} onSave={handleSave} onCancel={handleClose} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default EditDealModal
