import React from 'react'
import { Building, Truck } from 'lucide-react'
import { getColorLegend, getStatusLegend } from '../../utils/calendarColors'

/**
 * CalendarLegend - Visual guide for calendar color coding
 * 
 * Displays legend for service types (onsite vs vendor) and job statuses
 * Helps users understand color-coded calendar events at a glance
 */
export default function CalendarLegend({ showStatuses = false, compact = false }) {
  const serviceLegend = getColorLegend()
  const statusLegend = showStatuses ? getStatusLegend() : []

  const iconMap = {
    Building: Building,
    Truck: Truck,
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-xs">
        {serviceLegend.map((item, index) => {
          const Icon = iconMap[item.icon]
          return (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${item.bg} ${item.border} border`} />
              <span className="text-gray-700">{item.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Calendar Legend</h3>

      {/* Service Types */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
          Service Type
        </div>
        {serviceLegend.map((item, index) => {
          const Icon = iconMap[item.icon]
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${item.bg} ${item.border} border-2 flex items-center justify-center`}>
                {Icon && <Icon className={`w-4 h-4 ${item.text}`} />}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Status Indicators (optional) */}
      {showStatuses && statusLegend.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
            Job Status
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statusLegend.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${item.className} ${item.pulse ? 'animate-pulse' : ''}`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
        Color intensity indicates job status: darker = active, lighter = completed
      </div>
    </div>
  )
}
