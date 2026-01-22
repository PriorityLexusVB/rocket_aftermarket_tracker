import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Copy,
  Download,
  MessageSquare,
  Camera,
  FileText,
  CheckCircle,
} from 'lucide-react'

import { estLabel } from '../../../lib/time'

const AppointmentDrawer = ({ appointment, onClose, onExportICS, getStatusColor }) => {
  const [activeTab, setActiveTab] = useState('details')
  const [copied, setCopied] = useState(false)
  const closeButtonRef = useRef(null)

  const stockNumber = useMemo(() => {
    const info = appointment?.vehicle_info
    if (info?.includes('Stock:')) {
      return info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim()
    }
    return appointment?.job_number?.split('-')?.pop() || 'N/A'
  }, [appointment?.vehicle_info, appointment?.job_number])

  const handleCopyStock = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(stockNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [stockNumber])

  const { ymm, color } = useMemo(() => {
    const info = appointment?.vehicle_info || ''
    if (info?.includes('•')) {
      const parts = info?.split('•')
      return { ymm: parts?.[0]?.trim(), color: parts?.[1]?.trim() }
    }
    return { ymm: info, color: null }
  }, [appointment?.vehicle_info])

  const tabs = useMemo(
    () => [
      { id: 'details', label: 'Details', icon: FileText },
      { id: 'timeline', label: 'Timeline/Notes', icon: MessageSquare },
      { id: 'photos', label: 'Photos', icon: Camera },
      { id: 'sms', label: 'SMS', icon: Phone },
    ],
    []
  )

  const handleExportIcs = useCallback(() => {
    onExportICS?.(appointment)
  }, [appointment, onExportICS])

  useEffect(() => {
    closeButtonRef.current?.focus?.()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-drawer-title"
    >
      {/* Header with BIG STOCK # */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* BIG STOCK NUMBER */}
            <div className="flex items-center space-x-3 mb-2">
              <h2
                id="appointment-drawer-title"
                className="text-2xl font-bold text-gray-900 tracking-wide"
              >
                {stockNumber}
              </h2>
              <button
                onClick={handleCopyStock}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-full transition-all"
                title="Copy stock number"
                aria-label="Copy stock number"
              >
                {copied ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment?.job_status)}`}
              >
                {appointment?.job_status
                  ? String(appointment?.job_status).replace(/_/g, ' ')
                  : '—'}
              </span>

            </div>

            {/* Subline: Y/M/M/Color + VIN last4 */}
            <div className="text-sm text-gray-600 mb-1">
              {ymm}
              {color && <span className="ml-2">• {color}</span>}
            </div>
            <div className="text-xs text-gray-500 font-mono">
              VIN: ...{appointment?.vehicle_vin?.slice(-4) || '0000'}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close appointment details"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs?.map((tab) => {
            const Icon = tab?.icon
            return (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                aria-current={activeTab === tab?.id ? 'page' : undefined}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab?.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab?.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">{appointment?.title}</h4>
              {appointment?.description && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {appointment?.description}
                </p>
              )}
            </div>

            {/* Time & Schedule */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="font-medium">Scheduled Time</div>
                  <div className="text-gray-600">
                    {estLabel(appointment?.scheduled_start_time, 'MMM d, yyyy h:mm a')} -{' '}
                    {estLabel(appointment?.scheduled_end_time, 'h:mm a')} EST
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="font-medium">Duration</div>
                  <div className="text-gray-600">{appointment?.estimated_hours}h estimated</div>
                </div>
              </div>

              {appointment?.location && (
                <div className="flex items-center space-x-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Location</div>
                    <div className="text-gray-600">{appointment?.location}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="font-medium">Vendor</div>
                  <div className="text-gray-600">{appointment?.vendor_name}</div>
                </div>
              </div>
            </div>

            {/* Priority & Tags */}
            <div className="flex items-center space-x-4 pt-4 border-t border-gray-200">
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  appointment?.priority === 'urgent'
                    ? 'bg-red-100 text-red-800'
                    : appointment?.priority === 'high'
                      ? 'bg-orange-100 text-orange-800'
                      : appointment?.priority === 'low'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-100 text-blue-800'
                }`}
              >
                {appointment?.priority?.toUpperCase()} PRIORITY
              </div>

              <div className="text-xs text-gray-500">Job #{appointment?.job_number}</div>
            </div>

            {/* Calendar Notes */}
            {appointment?.calendar_notes && (
              <div className="pt-4 border-t border-gray-200">
                <h5 className="font-medium text-gray-900 mb-2">Calendar Notes</h5>
                <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                  {appointment?.calendar_notes}
                </p>
              </div>
            )}

            {/* Copy .ics Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleExportIcs}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 transition-colors"
                aria-label="Copy calendar file (.ics)"
              >
                <Download className="w-4 h-4" />
                <span>Copy .ics Calendar File</span>
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center">UTC times with EST labels</p>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-4">
            <div className="space-y-4">
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Timeline and Notes</p>
                <p className="text-xs mt-1">Activity history will appear here</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="p-4">
            <div className="text-center py-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Photo Documentation</p>
              <p className="text-xs mt-1">Job photos will appear here</p>
            </div>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="p-4">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border">
                <h5 className="font-medium text-blue-900 mb-2">SMS Templates</h5>
                <div className="space-y-2 text-sm">
                  <div className="bg-white p-2 rounded border">
                    <strong>Vendor NEW:</strong>
                    <br />
                    <span className="font-mono text-xs">
                      {stockNumber}: {appointment?.title} {ymm}{' '}
                      {estLabel(appointment?.scheduled_start_time, 'MMM d @ h:mm a')} ET. Reply
                      YES/NO.
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <strong>Customer BOOKED:</strong>
                    <br />
                    <span className="font-mono text-xs">
                      {stockNumber} set for {appointment?.title}{' '}
                      {estLabel(appointment?.scheduled_start_time, 'MMM d @ h:mm a')} ET at Priority
                      Lexus VB. Reply C/R.
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">SMS History</p>
                <p className="text-xs">Messages will appear here</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppointmentDrawer
