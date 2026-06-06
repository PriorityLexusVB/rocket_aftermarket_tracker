import React, { useState, useEffect, useCallback } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import Save from 'lucide-react/dist/esm/icons/save.js'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Mail from 'lucide-react/dist/esm/icons/mail.js'
import Phone from 'lucide-react/dist/esm/icons/phone.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import { claimsService } from '../../../services/claimsService'
// Wave XXX-AI hotfix-1 (Codex BLOCKER A): role-gate the Delete button
import { useAuth } from '@/contexts/AuthContext'
import { useRef } from 'react'

// Wave XXX-AI: added onDelete prop + Delete/Resolve buttons + slate design refresh
const ClaimProcessingModal = ({ claim, onClose, onUpdate, onDelete }) => {
  // Wave XXX-AI hotfix-1 (Codex BLOCKER A): only admin/manager can delete
  // (matches RLS policy admin_can_delete_claims). Hide button entirely for
  // staff-role users so they don't see a button that silently fails.
  const { isAdmin } = useAuth() || {}
  const canDelete = !!isAdmin
  const [formData, setFormData] = useState({
    status: claim?.status || 'submitted',
    priority: claim?.priority || 'medium',
    resolution_notes: claim?.resolution_notes || '',
    claim_amount: claim?.claim_amount || '',
  })

  const [attachments, setAttachments] = useState([])
  const [loadingAttachments, setLoadingAttachments] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Wave XXX-AI: two-click delete guard
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Wave XXX-AI hotfix-1 (Codex RECOMMENDED C): track confirm timer so we
  // can clear it on confirm/unmount instead of leaking timers.
  const confirmTimerRef = useRef(null)

  // Clear confirm-delete timer on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
  }, [])

  const loadAttachments = useCallback(async () => {
    try {
      setLoadingAttachments(true)
      const attachmentsData = await claimsService?.getClaimAttachments(claim?.id)
      setAttachments(attachmentsData || [])
    } catch (error) {
      console.error('Error loading attachments:', error)
    } finally {
      setLoadingAttachments(false)
    }
  }, [claim?.id])

  useEffect(() => {
    if (claim?.id) {
      loadAttachments()
    }
  }, [claim?.id, loadAttachments])

  const handleInputChange = (e) => {
    const { name, value } = e?.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const updates = {
        ...formData,
        claim_amount: formData?.claim_amount ? parseFloat(formData?.claim_amount) : null,
      }

      await onUpdate(claim?.id, updates)
      onClose()
    } catch (err) {
      setError(err?.message)
    } finally {
      setSaving(false)
    }
  }

  // Wave XXX-AI: resolve handler — saves formData + forces status=resolved
  const handleResolve = async () => {
    if (saving) return
    try {
      setSaving(true)
      setError(null)
      // Wave XXX-AI hotfix-1 (Codex BLOCKER E): normalize claim_amount to
      // number/null like handleSave does — otherwise the Resolve path
      // sends a raw string and breaks the DB numeric type.
      const updates = {
        ...formData,
        claim_amount: formData?.claim_amount ? parseFloat(formData?.claim_amount) : null,
        status: 'resolved',
      }
      await onUpdate(claim?.id, updates)
      onClose()
    } catch (err) {
      setError(err?.message)
    } finally {
      setSaving(false)
    }
  }

  // Wave XXX-AI: two-click delete guard. First click arms; second click fires.
  // Auto-disarms after 4s if user doesn't confirm.
  const handleDelete = async () => {
    if (saving) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      // Wave XXX-AI hotfix-1 (Codex RECOMMENDED C): use ref so we can clear
      // the timer on confirm/unmount instead of letting it fire after the
      // delete already completed (or after the component unmounts).
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    // Second click — clear the disarm timer since we're committing
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    try {
      setSaving(true)
      setError(null)
      await onDelete?.(claim?.id)
      onClose()
    } catch (err) {
      setError(err?.message)
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'under_review':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-slate-500" />
      default:
        return <Clock className="w-4 h-4 text-slate-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      case 'resolved':
        return 'bg-slate-100 text-slate-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-slate-500'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString)?.toLocaleString()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getPriorityColor(claim?.priority)}`} />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{claim?.claim_number}</h2>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(claim?.status)}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim?.status)}`}
                >
                  {claim?.status?.replace('_', ' ')?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Column - Claim Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Name:</span>
                    <p className="text-slate-600">{claim?.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Email:</span>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-600">{claim?.customer_email || 'N/A'}</p>
                      {claim?.customer_email && (
                        <a
                          href={`mailto:${claim?.customer_email}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Mail className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Phone:</span>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-600">{claim?.customer_phone || 'N/A'}</p>
                      {claim?.customer_phone && (
                        <a
                          href={`tel:${claim?.customer_phone}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle and Product Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {claim?.vehicle && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Vehicle
                    </h3>
                    <div className="text-sm space-y-2">
                      <p>
                        <span className="font-medium">Vehicle:</span> {claim?.vehicle?.year}{' '}
                        {claim?.vehicle?.make} {claim?.vehicle?.model}
                      </p>
                      <p>
                        <span className="font-medium">Owner:</span> {claim?.vehicle?.owner_name}
                      </p>
                    </div>
                  </div>
                )}

                {claim?.product && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Product
                    </h3>
                    <div className="text-sm space-y-2">
                      <p>
                        <span className="font-medium">Product:</span> {claim?.product?.name}
                      </p>
                      <p>
                        <span className="font-medium">Brand:</span> {claim?.product?.brand}
                      </p>
                      <p>
                        <span className="font-medium">Category:</span> {claim?.product?.category}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Issue Description */}
              <div>
                <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Issue Description
                </h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {claim?.issue_description || 'No description provided'}
                  </p>
                </div>
              </div>

              {/* Preferred Resolution */}
              {claim?.preferred_resolution && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-3">Preferred Resolution</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-slate-700 whitespace-pre-wrap">
                      {claim?.preferred_resolution}
                    </p>
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div>
                <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Attachments
                  {loadingAttachments && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </h3>
                {attachments?.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No attachments uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attachments?.map((attachment) => (
                      <div key={attachment?.id} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {attachment?.file_name}
                          </span>
                          {attachment?.signedUrl && (
                            <a
                              href={attachment?.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              View
                            </a>
                          )}
                        </div>
                        {attachment?.description && (
                          <p className="text-xs text-slate-500 mb-2">{attachment?.description}</p>
                        )}
                        {attachment?.signedUrl && attachment?.file_type?.startsWith('image/') && (
                          <img
                            src={attachment?.signedUrl}
                            alt={attachment?.description || attachment?.file_name}
                            className="w-full h-32 object-cover rounded border"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Processing Controls */}
            <div className="space-y-6">
              {/* Timeline */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Submitted:</span>
                    <span className="text-slate-900">{formatDate(claim?.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Last Updated:</span>
                    <span className="text-slate-900">{formatDate(claim?.updated_at)}</span>
                  </div>
                  {claim?.resolved_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Resolved:</span>
                      <span className="text-slate-900">{formatDate(claim?.resolved_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Processing Form */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-4">Processing Actions</h3>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                    <select
                      name="status"
                      value={formData?.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                    <select
                      name="priority"
                      value={formData?.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Claim Amount
                    </label>
                    <input
                      type="number"
                      name="claim_amount"
                      value={formData?.claim_amount}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Resolution Notes
                    </label>
                    <textarea
                      name="resolution_notes"
                      value={formData?.resolution_notes}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Add notes about the resolution..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — Wave XXX-AI: Delete (left) + Cancel/Save/Resolve (right) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {/* Left: Delete — Wave XXX-AI hotfix-1 (Codex BLOCKER A): role-gated
              to admin/manager only. Staff role never sees the button. */}
          {canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDelete ? 'Click again to confirm' : 'Delete Claim'}
            </button>
          ) : (
            <span />
          )}

          {/* Right: Cancel + Save + Resolve */}
          <div className="flex items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
            {/* Wave XXX-AI hotfix-1 (Codex BLOCKER D): base visibility on
                PERSISTED status (claim.status), not the unsaved formData.
                Picking 'resolved' in the dropdown shouldn't hide the
                one-click Resolve action before anything is saved. */}
            {claim?.status !== 'resolved' && (
              <button
                onClick={handleResolve}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Mark Resolved
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClaimProcessingModal
