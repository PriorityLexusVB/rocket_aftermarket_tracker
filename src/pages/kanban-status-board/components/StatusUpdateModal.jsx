import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  User,
  Wrench,
  AlertTriangle,
  Clock,
  MapPin,
  Save,
  ArrowRight,
} from 'lucide-react'

const StatusUpdateModal = ({ job, onClose, onStatusUpdate }) => {
  const [selectedStatus, setSelectedStatus] = useState(job?.job_status)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const statusOptions = [
    { value: 'pending', label: 'Not Started', color: 'gray' },
    { value: 'scheduled', label: 'Scheduled', color: 'blue' },
    { value: 'in_progress', label: 'In Progress', color: 'yellow' },
    { value: 'quality_check', label: 'Quality Check', color: 'purple' },
    { value: 'completed', label: 'Completed', color: 'green' },
    { value: 'delivered', label: 'Delivered', color: 'green' },
  ]

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800 border-gray-300',
      scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      quality_check: 'bg-purple-100 text-purple-800 border-purple-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
    }
    return colors?.[status] || colors?.pending
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }
    return colors?.[priority] || colors?.medium
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isOverdue = (job) => {
    if (!job?.due_date || ['completed', 'delivered']?.includes(job?.job_status)) {
      return false
    }
    return new Date(job.due_date) < new Date()
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError('')

    try {
      const success = await onStatusUpdate?.(job?.id, selectedStatus)

      if (success) {
        onClose?.()
      } else {
        setError('Failed to update job status. Please try again.')
      }
    } catch (err) {
      setError(`Error updating status: ${err?.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e?.target === e?.currentTarget) {
      onClose?.()
    }
  }

  if (!job) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Update Job Status</h2>
            <p className="text-sm text-gray-600 mt-1">
              Job #{job?.job_number} • {job?.title}
            </p>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Job Details */}
        <div className="p-6 space-y-4">
          {/* Current Status & Priority */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(job?.job_status)}`}
              >
                {statusOptions?.find((s) => s?.value === job?.job_status)?.label || job?.job_status}
              </span>

              {isOverdue(job) && (
                <div className="flex items-center space-x-1 bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs font-medium">Overdue</span>
                </div>
              )}
            </div>

            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(job?.priority)}`}
            >
              {job?.priority?.charAt(0)?.toUpperCase() + job?.priority?.slice(1)} Priority
            </div>
          </div>

          {/* Job Information Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Vehicle Info */}
            {job?.vehicle && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Wrench className="h-4 w-4" />
                  <span className="font-medium">Vehicle</span>
                </div>
                <p className="text-sm">
                  {job?.vehicle?.year} {job?.vehicle?.make} {job?.vehicle?.model}
                  {job?.vehicle?.stock_number && ` (${job?.vehicle?.stock_number})`}
                </p>
                {job?.vehicle?.owner_name && (
                  <p className="text-sm text-gray-600">Owner: {job?.vehicle?.owner_name}</p>
                )}
              </div>
            )}

            {/* Vendor Assignment */}
            {job?.vendor && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Assigned Vendor</span>
                </div>
                <p className="text-sm">{job?.vendor?.name}</p>
                {job?.vendor?.specialty && (
                  <p className="text-sm text-gray-600">{job?.vendor?.specialty}</p>
                )}
              </div>
            )}

            {/* Scheduled Time */}
            {job?.scheduled_start_time && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Scheduled</span>
                </div>
                <p className="text-sm">{formatDate(job?.scheduled_start_time)}</p>
                {job?.scheduled_end_time && (
                  <p className="text-sm text-gray-600">
                    Until: {formatDate(job?.scheduled_end_time)}
                  </p>
                )}
              </div>
            )}

            {/* Due Date */}
            {job?.due_date && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Due Date</span>
                </div>
                <p className={`text-sm ${isOverdue(job) ? 'text-red-600 font-medium' : ''}`}>
                  {formatDate(job?.due_date)}
                  {isOverdue(job) && ' (Overdue)'}
                </p>
              </div>
            )}

            {/* Location */}
            {job?.location && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Location</span>
                </div>
                <p className="text-sm">{job?.location}</p>
              </div>
            )}

            {/* Estimated Hours */}
            {job?.estimated_hours && (
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Estimated Time</span>
                </div>
                <p className="text-sm">{job?.estimated_hours} hours</p>
              </div>
            )}
          </div>

          {/* Description */}
          {job?.description && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Description</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{job?.description}</p>
            </div>
          )}
        </div>

        {/* Status Update Form */}
        <form onSubmit={handleSubmit} className="p-6 border-t border-gray-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
              <div className="grid grid-cols-2 gap-3">
                {statusOptions?.map((status) => (
                  <label
                    key={status?.value}
                    className={`
                      flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all
                      ${
                        selectedStatus === status?.value
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="status"
                        value={status?.value}
                        checked={selectedStatus === status?.value}
                        onChange={(e) => setSelectedStatus(e?.target?.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">{status?.label}</span>
                    </div>

                    {selectedStatus === status?.value && (
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e?.target?.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any notes about this status update..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || selectedStatus === job?.job_status}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <Save className="h-4 w-4" />
                <span>{loading ? 'Updating...' : 'Update Status'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StatusUpdateModal
