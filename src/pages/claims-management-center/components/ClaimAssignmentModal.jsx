import React, { useState } from 'react'
import { X, User, Save } from 'lucide-react'

const ClaimAssignmentModal = ({ claim, staff, onClose, onUpdate }) => {
  const [selectedAssignee, setSelectedAssignee] = useState(claim?.assigned_to || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      await onUpdate(claim?.id, { assigned_to: selectedAssignee || null })
      onClose()
    } catch (error) {
      console.error('Error assigning claim:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Assign Claim</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Claim: <span className="font-medium text-gray-900">{claim?.claim_number}</span>
            </p>
            <p className="text-sm text-gray-600">
              Customer: <span className="font-medium text-gray-900">{claim?.customer_name}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to staff member
            </label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e?.target?.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Unassigned</option>
              {staff?.map((member) => (
                <option key={member?.id} value={member?.id}>
                  {member?.full_name} -{' '}
                  {member?.role?.charAt(0)?.toUpperCase() + member?.role?.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {selectedAssignee && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                This claim will be assigned to{' '}
                <span className="font-medium">
                  {staff?.find((s) => s?.id === selectedAssignee)?.full_name}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Assigning...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Assign Claim
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ClaimAssignmentModal
