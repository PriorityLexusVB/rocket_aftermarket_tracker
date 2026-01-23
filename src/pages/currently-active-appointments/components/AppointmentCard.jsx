import React from 'react'
import {
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  AlertTriangle,
  Car,
  ArrowRight,
  Check,
} from 'lucide-react'
import { getAppointmentScheduleDisplay, toSafeDateForTimeZone } from '@/utils/scheduleDisplay'
import { getUncompleteTargetStatus } from '@/utils/jobStatusTimeRules.js'

const AppointmentCard = ({
  appointment,
  onClick,
  onUpdateStatus,
  isSelected,
  bulkMode,
  onToggleSelect,
}) => {
  const StatusIcon = appointment?.statusConfig?.icon
  const isOverdue = appointment?.isOverdue

  const scheduleDisplay = getAppointmentScheduleDisplay(appointment)

  const getTimeRemaining = () => {
    if (!appointment?.promised_date) return null

    const promisedDate = toSafeDateForTimeZone(appointment?.promised_date)
    if (!promisedDate) return null

    const diffMs = promisedDate.getTime() - Date.now()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffMs < 0) return 'Overdue'
    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`
    if (diffHours > 0) return `${diffHours}h remaining`
    return 'Due soon'
  }

  const timeRemaining = getTimeRemaining()

  const handleStatusChange = (newStatus, e) => {
    e?.stopPropagation()
    onUpdateStatus?.(appointment?.id, newStatus)
  }

  const handleCardClick = (e) => {
    if (bulkMode && onToggleSelect) {
      e?.stopPropagation()
      onToggleSelect()
    } else {
      onClick()
    }
  }

  const handleCheckboxClick = (e) => {
    e?.stopPropagation()
    onToggleSelect?.()
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group relative bg-white rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden cursor-pointer hover:shadow-xl hover:border-gray-200 ${
        isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
      } ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-200' : ''} ${
        bulkMode ? 'hover:ring-2 hover:ring-indigo-300' : ''
      }`}
    >
      {/* Premium gradient overlay */}
      <div
        className={`absolute top-0 left-0 w-full h-1 ${
          isSelected
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
            : isOverdue
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
        }`}
      ></div>

      {/* Bulk Selection Checkbox */}
      {bulkMode && (
        <div className="absolute top-4 left-4 z-10">
          <div
            onClick={handleCheckboxClick}
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
              isSelected
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : 'bg-white border-gray-300 hover:border-indigo-400'
            }`}
          >
            {isSelected && <Check className="w-4 h-4" />}
          </div>
        </div>
      )}

      {/* Overdue Alert Banner */}
      {isOverdue && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-2 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-semibold">OVERDUE - Immediate Attention Required</span>
        </div>
      )}

      <div className={`p-6 ${bulkMode ? 'ml-8' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700'
                  : isOverdue
                    ? 'bg-gradient-to-br from-red-600 to-red-700'
                    : 'bg-gradient-to-br from-indigo-600 to-purple-700'
              }`}
            >
              <StatusIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <span className="text-lg font-bold text-gray-900">#{appointment?.job_number}</span>
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${appointment?.priorityConfig?.bg} ${appointment?.priorityConfig?.color}`}
                >
                  {appointment?.priority?.toUpperCase()}
                </div>
                {(appointment?.has_active_loaner || appointment?.customer_needs_loaner) && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                    Loaner
                  </span>
                )}
                {appointment?.assigned_to_profile && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <User className="w-3 h-3 mr-1" />
                    {appointment?.assigned_to_profile?.full_name?.split(' ')?.[0]}
                  </div>
                )}
              </div>
              <h3 className="text-base font-semibold text-gray-900 leading-tight">
                {appointment?.title}
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${appointment?.statusConfig?.bg} ${appointment?.statusConfig?.text} ${appointment?.statusConfig?.border} border`}
          >
            <StatusIcon className="w-3 h-3 mr-1.5" />
            {appointment?.statusConfig?.label}
          </div>
        </div>

        {/* Vehicle & Customer Info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Vehicle Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600 font-medium">
              <Car className="w-4 h-4" />
              <span>Vehicle</span>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {appointment?.vehicles?.year} {appointment?.vehicles?.make}{' '}
                {appointment?.vehicles?.model}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                {appointment?.vehicles?.stock_number && (
                  <div>Stock: #{appointment?.vehicles?.stock_number}</div>
                )}
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full`}
                    style={{
                      backgroundColor: appointment?.vehicles?.color?.toLowerCase() || '#gray',
                    }}
                  ></div>
                  <span>{appointment?.vehicles?.color}</span>
                  <span>•</span>
                  <span>{appointment?.vehicles?.license_plate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600 font-medium">
              <User className="w-4 h-4" />
              <span>Customer</span>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {appointment?.vehicles?.owner_name || 'No customer info'}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                {appointment?.vehicles?.owner_phone && (
                  <div className="flex items-center">
                    <Phone className="w-3 h-3 mr-2 text-gray-400" />
                    {appointment?.vehicles?.owner_phone}
                  </div>
                )}
                {appointment?.vehicles?.owner_email && (
                  <div className="flex items-center">
                    <Mail className="w-3 h-3 mr-2 text-gray-400" />
                    <div className="truncate">{appointment?.vehicles?.owner_email}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vendor & Schedule Info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Vendor Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600 font-medium">
              <Building2 className="w-4 h-4" />
              <span>Vendor</span>
            </div>
            <div>
              {appointment?.vendors ? (
                <>
                  <div className="font-semibold text-gray-900">{appointment?.vendors?.name}</div>
                  <div className="text-sm text-gray-600">{appointment?.vendors?.specialty}</div>
                </>
              ) : (
                <div className="text-sm text-gray-500 italic">No vendor assigned</div>
              )}
            </div>
          </div>

          {/* Schedule Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600 font-medium">
              <Calendar className="w-4 h-4" />
              <span>Schedule</span>
            </div>
            <div>
              <div className="text-sm text-gray-900 font-medium">{scheduleDisplay?.primary}</div>
              {scheduleDisplay?.badge ? (
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-full bg-slate-200/60 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {scheduleDisplay.badge}
                  </span>
                </div>
              ) : null}
              {timeRemaining && (
                <div
                  className={`text-xs font-semibold ${
                    isOverdue
                      ? 'text-red-600'
                      : timeRemaining?.includes('remaining')
                        ? 'text-green-600'
                        : 'text-orange-600'
                  }`}
                >
                  {timeRemaining}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {!bulkMode && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              {appointment?.job_status === 'completed' ? (
                <button
                  onClick={(e) =>
                    handleStatusChange(
                      {
                        status: getUncompleteTargetStatus(appointment, { now: new Date() }),
                        patch: { completed_at: null },
                      },
                      e
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors duration-200"
                  title="Undo complete"
                >
                  Undo
                </button>
              ) : (
                <button
                  onClick={(e) =>
                    handleStatusChange(
                      {
                        status: 'completed',
                        patch: { completed_at: new Date().toISOString() },
                      },
                      e
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                  title="Marks this job as completed (status: completed)"
                >
                  Complete
                </button>
              )}
            </div>

            <div className="flex items-center text-sm text-gray-600 group-hover:text-indigo-600 transition-colors">
              <span className="mr-2">View Details</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </div>
        )}

        {/* Bulk Mode Indicator */}
        {bulkMode && (
          <div className="pt-4 border-t border-gray-100 text-center">
            <div className="text-xs text-gray-500">
              {isSelected ? 'Selected for bulk operation' : 'Click to select for bulk operation'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Memoize to avoid re-rendering large lists when irrelevant state changes
function propsAreEqual(prev, next) {
  const a = prev.appointment || {}
  const b = next.appointment || {}
  return (
    a.id === b.id &&
    a.job_status === b.job_status &&
    a.promised_date === b.promised_date &&
    a.scheduled_start_time === b.scheduled_start_time &&
    a.scheduled_end_time === b.scheduled_end_time &&
    prev.isSelected === next.isSelected &&
    prev.bulkMode === next.bulkMode
  )
}

export default React.memo(AppointmentCard, propsAreEqual)
