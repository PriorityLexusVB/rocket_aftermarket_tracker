// src/pages/currently-active-appointments/components/SnapshotView.jsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ExternalLink, CheckCircle, Calendar, Undo } from 'lucide-react'
import { jobService } from '@/services/jobService'
import useTenant from '@/hooks/useTenant'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * SnapshotView - Simplified view of currently active appointments
 * Shows scheduled/in_progress jobs with minimal actions: View Deal, Complete, Reschedule
 */
export default function SnapshotView() {
  const navigate = useNavigate()
  const { orgId, loading: tenantLoading } = useTenant()
  const toast = useToast?.()
  
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoState, setUndoState] = useState(null) // { jobId, previousStatus, timeoutId }
  
  const SIMPLE_CALENDAR_ON =
    String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

  useEffect(() => {
    if (!tenantLoading) {
      loadJobs()
    }
  }, [tenantLoading, orgId])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const allJobs = await jobService.getAllJobs({ orgId })
      
      // Filter to scheduled/in_progress with non-null scheduled_start_time
      const filtered = allJobs.filter(
        (job) =>
          ['scheduled', 'in_progress'].includes(job.job_status) &&
          job.scheduled_start_time != null
      )
      
      // Sort ascending by scheduled_start_time
      filtered.sort((a, b) => {
        const aTime = new Date(a.scheduled_start_time).getTime()
        const bTime = new Date(b.scheduled_start_time).getTime()
        return aTime - bTime
      })
      
      setJobs(filtered)
    } catch (err) {
      console.error('[SnapshotView] Failed to load jobs:', err)
      toast?.error?.('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (job) => {
    try {
      const previousStatus = job.job_status
      await jobService.updateStatus(job.id, 'completed', {
        completed_at: new Date().toISOString(),
      })
      
      toast?.success?.(`Marked "${job.title || job.job_number}" as completed`)
      
      // Setup undo functionality (10 second window)
      if (undoState?.timeoutId) {
        clearTimeout(undoState.timeoutId)
      }
      
      const timeoutId = setTimeout(() => {
        setUndoState(null)
      }, 10000)
      
      setUndoState({
        jobId: job.id,
        jobTitle: job.title || job.job_number,
        previousStatus,
        timeoutId,
      })
      
      // Refresh the list
      await loadJobs()
    } catch (err) {
      console.error('[SnapshotView] Failed to complete job:', err)
      toast?.error?.('Failed to mark as completed')
    }
  }

  const handleUndo = async () => {
    if (!undoState) return
    
    try {
      await jobService.updateStatus(undoState.jobId, undoState.previousStatus, {
        completed_at: null,
      })
      
      toast?.info?.(`Restored "${undoState.jobTitle}" to ${undoState.previousStatus}`)
      
      if (undoState.timeoutId) {
        clearTimeout(undoState.timeoutId)
      }
      setUndoState(null)
      
      // Refresh the list
      await loadJobs()
    } catch (err) {
      console.error('[SnapshotView] Failed to undo:', err)
      toast?.error?.('Failed to undo')
    }
  }

  const formatTimeRange = (startTime, endTime) => {
    if (!startTime) return 'Not scheduled'
    
    const start = new Date(startTime)
    const startFormatted = start.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    
    if (!endTime) return startFormatted
    
    const end = new Date(endTime)
    const endFormatted = end.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    
    return `${startFormatted} → ${endFormatted}`
  }

  const getCustomerName = (job) => {
    return job.vehicle?.owner_name || job.vehicles?.owner_name || 'Unknown Customer'
  }

  const getVehicleDescription = (job) => {
    const vehicle = job.vehicle || job.vehicles
    if (!vehicle) return 'Unknown Vehicle'
    
    const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : 'Unknown Vehicle'
  }

  const getVendorName = (job) => {
    return job.vendor?.name || job.vendors?.name || 'No vendor'
  }

  const getStatusBadge = (status) => {
    const configs = {
      scheduled: {
        label: 'Scheduled',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      in_progress: {
        label: 'In Progress',
        className: 'bg-orange-100 text-orange-700 border-orange-200',
      },
    }
    
    const config = configs[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    }
    
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded border ${config.className}`}
      >
        {config.label}
      </span>
    )
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Currently Active Appointments
        </h1>
        <p className="text-gray-600 mt-1">
          Quick snapshot of scheduled and in-progress appointments
        </p>
      </div>

      {/* Undo Toast */}
      {undoState && (
        <div
          className="mb-4 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between"
          role="status"
          aria-live="polite"
        >
          <span className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Job marked as completed
          </span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 px-3 py-1 bg-white text-slate-800 rounded hover:bg-gray-100 transition-colors text-sm font-medium"
            aria-label="Undo marking job as completed"
          >
            <Undo className="w-4 h-4" />
            Undo
          </button>
        </div>
      )}

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Active Appointments
          </h3>
          <p className="text-gray-600">
            All scheduled appointments are completed or there are no appointments at this time.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Currently active appointments">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 transition-colors"
                    aria-label={`Appointment for ${getCustomerName(job)}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatTimeRange(
                          job.scheduled_start_time,
                          job.scheduled_end_time
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {getCustomerName(job)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {getVehicleDescription(job)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {getVendorName(job)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(job.job_status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/deals/${job.id}/edit`)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          aria-label={`View deal details for ${job.title || job.job_number}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Deal
                        </button>
                        <button
                          onClick={() => handleComplete(job)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                          aria-label={`Mark ${job.title || job.job_number} as completed`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                        {SIMPLE_CALENDAR_ON && (
                          <button
                            onClick={() =>
                              navigate(`/calendar/agenda?focus=${job.id}`)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                            aria-label={`Reschedule ${job.title || job.job_number}`}
                          >
                            <Calendar className="w-4 h-4" />
                            Reschedule
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
