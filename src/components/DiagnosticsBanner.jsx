// src/components/DiagnosticsBanner.jsx
// UI banner showing capability status and telemetry
import { useEffect, useState } from 'react'
import { getAllTelemetry, getTelemetrySummary } from '@/utils/capabilityTelemetry'

/**
 * DiagnosticsBanner - Shows capability status at the top of the page
 * Only visible when there are active fallbacks or in dev mode
 */
export function DiagnosticsBanner({ showInProd = false }) {
  const [telemetry, setTelemetry] = useState({})
  const [isExpanded, setIsExpanded] = useState(false)
  const [capabilities, setCapabilities] = useState(null)

  useEffect(() => {
    // Initial load
    updateTelemetry()

    // Update every 5 seconds
    const interval = setInterval(updateTelemetry, 5000)
    return () => clearInterval(interval)
  }, [])

  const updateTelemetry = () => {
    const data = getAllTelemetry()
    setTelemetry(data)

    // Check capability flags from sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      setCapabilities({
        jobPartsVendorRel: sessionStorage.getItem('cap_jobPartsVendorRel') !== 'false',
        jobPartsScheduledTimes: sessionStorage.getItem('cap_jobPartsScheduledTimes') !== 'false',
        jobPartsVendorId: sessionStorage.getItem('cap_jobPartsVendorId') !== 'false',
        userProfilesName: sessionStorage.getItem('cap_userProfilesName') !== 'false',
      })
    }
  }

  // Calculate total fallbacks
  const totalFallbacks = Object.values(telemetry).reduce((sum, val) => sum + val, 0)

  // Don't show banner if no fallbacks and not in dev mode
  const isDev = import.meta.env.DEV
  if (!isDev && !showInProd && totalFallbacks === 0) {
    return null
  }

  const hasFallbacks = totalFallbacks > 0
  const bannerColor = hasFallbacks ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
  const textColor = hasFallbacks ? 'text-yellow-900' : 'text-blue-900'
  const iconColor = hasFallbacks ? 'text-yellow-600' : 'text-blue-600'

  return (
    <div className={`border-b ${bannerColor}`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${hasFallbacks ? 'bg-yellow-200' : 'bg-blue-200'}`}>
              {hasFallbacks ? (
                <svg className={`h-4 w-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className={`h-4 w-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className={`text-sm font-medium ${textColor}`}>
              {hasFallbacks ? (
                <>Capability Fallbacks Active: {totalFallbacks} event{totalFallbacks !== 1 ? 's' : ''}</>
              ) : (
                <>All Capabilities OK</>
              )}
            </div>
            {isDev && (
              <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                DEV
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-sm font-medium ${textColor} hover:underline`}
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Telemetry Counters
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
              <div className="rounded bg-white px-3 py-2 shadow-sm">
                <div className="text-xs text-gray-500">Vendor Fallback</div>
                <div className="text-lg font-semibold">{telemetry.vendorFallback || 0}</div>
              </div>
              <div className="rounded bg-white px-3 py-2 shadow-sm">
                <div className="text-xs text-gray-500">Vendor ID</div>
                <div className="text-lg font-semibold">{telemetry.vendorIdFallback || 0}</div>
              </div>
              <div className="rounded bg-white px-3 py-2 shadow-sm">
                <div className="text-xs text-gray-500">Vendor Rel</div>
                <div className="text-lg font-semibold">{telemetry.vendorRelFallback || 0}</div>
              </div>
              <div className="rounded bg-white px-3 py-2 shadow-sm">
                <div className="text-xs text-gray-500">Scheduled Times</div>
                <div className="text-lg font-semibold">{telemetry.scheduledTimesFallback || 0}</div>
              </div>
              <div className="rounded bg-white px-3 py-2 shadow-sm">
                <div className="text-xs text-gray-500">Profile Name</div>
                <div className="text-lg font-semibold">{telemetry.userProfileNameFallback || 0}</div>
              </div>
            </div>

            {capabilities && (
              <>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Capability Flags
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <CapabilityStatus
                    label="Vendor Relationship"
                    enabled={capabilities.jobPartsVendorRel}
                  />
                  <CapabilityStatus
                    label="Scheduled Times"
                    enabled={capabilities.jobPartsScheduledTimes}
                  />
                  <CapabilityStatus
                    label="Vendor ID Column"
                    enabled={capabilities.jobPartsVendorId}
                  />
                  <CapabilityStatus
                    label="User Profiles Name"
                    enabled={capabilities.userProfilesName}
                  />
                </div>
              </>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  window.location.href = '/api/health/capabilities'
                }}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Check Health
              </button>
              <button
                onClick={() => {
                  const data = getTelemetrySummary()
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `telemetry-${new Date().toISOString()}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="rounded bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
              >
                Export Telemetry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CapabilityStatus({ label, enabled }) {
  return (
    <div className="flex items-center gap-2 rounded bg-white px-3 py-2 shadow-sm">
      <div className={`h-2 w-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="text-xs">
        <div className="font-medium text-gray-700">{label}</div>
        <div className="text-gray-500">{enabled ? 'Enabled' : 'Disabled'}</div>
      </div>
    </div>
  )
}
