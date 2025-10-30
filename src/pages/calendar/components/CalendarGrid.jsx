import React from 'react'
import {
  format,
  addDays,
  startOfWeek,
  parseISO,
  getHours,
  isSameDay,
  set as setHM,
  startOfDay,
} from 'date-fns'
import { Clock, MapPin } from 'lucide-react'
import { estLabel } from '../../../lib/time'

// Enhanced safe date parsing utility with comprehensive validation
const safeParseDateISO = (dateString) => {
  if (!dateString || typeof dateString !== 'string' || dateString?.trim() === '') {
    console.warn('Empty or invalid date string provided:', dateString)
    return null
  }

  try {
    // Handle common invalid date patterns
    if (dateString === 'Invalid Date' || dateString === 'null' || dateString === 'undefined') {
      return null
    }

    const parsed = parseISO(dateString)
    if (!parsed || isNaN(parsed?.getTime()) || parsed?.getTime() === 0) {
      console.warn('Invalid date parsed from string:', dateString)
      return null
    }

    // Check for reasonable date range (not too far in past/future)
    const year = parsed?.getFullYear()
    if (year < 1900 || year > 2100) {
      console.warn('Date outside reasonable range:', dateString, year)
      return null
    }

    return parsed
  } catch (error) {
    console.warn('Date parsing error for string:', dateString, error)
    return null
  }
}

// Safe date validation utility
const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date?.getTime()) && date?.getTime() > 0
}

// Safe format utility with fallback
const safeFormat = (date, formatString) => {
  try {
    if (!isValidDate(date)) return 'Invalid Date'
    return format(date, formatString)
  } catch (error) {
    console.warn('Date formatting error:', error)
    return 'Invalid Date'
  }
}

// Enhanced estLabel with validation
const safeEstLabel = (dateString, fmt = 'h:mm a') => {
  try {
    if (!dateString) return ''

    const parsed = safeParseDateISO(dateString)
    if (!parsed) return 'Invalid Date'

    return estLabel(dateString, fmt)
  } catch (error) {
    console.warn('estLabel error for:', dateString, error)
    return 'Invalid Date'
  }
}

// Build non-mutating slot bounds for a given day/hour (local time -> ISO)
const makeSlot = (baseDate, hour) => {
  try {
    if (!isValidDate(baseDate)) {
      const fallbackDate = new Date()
      console.warn('Invalid base date provided to makeSlot, using current date')
      baseDate = fallbackDate
    }

    const dayStart = startOfDay(baseDate)
    const start = setHM(dayStart, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 })
    const end = setHM(dayStart, { hours: hour + 1, minutes: 0, seconds: 0, milliseconds: 0 })

    return {
      startISO: start?.toISOString(),
      endISO: end?.toISOString(),
      start,
      end,
    }
  } catch (error) {
    console.error('Error creating time slot:', error)
    const now = new Date()
    return {
      startISO: now?.toISOString(),
      endISO: new Date(now?.getTime() + 3600000)?.toISOString(),
      start: now,
      end: new Date(now?.getTime() + 3600000),
    }
  }
}

// Format a clock label without mutating "now"
const clockLabel = (hour, mobile) => {
  try {
    const t = setHM(new Date(), { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 })
    return safeFormat(t, mobile ? 'ha' : 'h:mm a')
  } catch (error) {
    console.error('Error creating clock label:', error)
    return mobile ? `${hour}a` : `${hour}:00 AM`
  }
}

const CalendarGrid = ({
  view,
  showVendorLanes,
  currentDate,
  appointments = [],
  vendors = [],
  vendorCapacity = {},
  onAppointmentClick,
  onCreateClick,
  onDrop,
  onDragOver,
  dragging,
  getStatusColor,
  isMobile = false,
}) => {
  // Validate and sanitize props
  const safeCurrentDate = isValidDate(currentDate) ? currentDate : new Date()
  const safeAppointments = Array.isArray(appointments)
    ? appointments?.filter((apt) => apt && apt?.id)
    : []

  // Week View (Mon-Sat, 8a-6p EST) with mobile optimization
  const renderWeekView = () => {
    const weekStart = startOfWeek(safeCurrentDate, { weekStartsOn: 1 }) // Monday
    const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)) // Mon-Sat
    const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8 AM - 6 PM

    if (showVendorLanes) {
      return renderVendorLaneView(days, hours)
    }

    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        {/* Header - Mobile responsive */}
        <div
          className={`grid border-b border-gray-200 flex-shrink-0 ${isMobile ? 'grid-cols-4' : 'grid-cols-7'}`}
        >
          <div
            className={`p-2 md:p-4 font-medium text-gray-900 border-r ${isMobile ? 'text-xs' : 'text-sm'}`}
          >
            Time
          </div>
          {days?.slice(0, isMobile ? 3 : 6)?.map((day, i) => (
            <div
              key={i}
              className={`p-2 md:p-4 text-center border-r border-gray-200 last:border-r-0 ${
                isMobile ? 'text-xs' : 'text-sm'
              }`}
            >
              <div className="font-medium text-gray-900">
                {safeFormat(day, isMobile ? 'EE' : 'EEE')}
              </div>
              <div className="text-xs text-gray-500">{safeFormat(day, 'MMM d')}</div>
            </div>
          ))}
        </div>
        {/* Time Grid - Mobile optimized */}
        <div className="flex-1 overflow-auto">
          {hours?.map((hour) => (
            <div
              key={hour}
              className={`grid border-b border-gray-100 min-h-16 md:min-h-20 ${isMobile ? 'grid-cols-4' : 'grid-cols-7'}`}
            >
              <div
                className={`p-2 md:p-4 text-xs md:text-sm text-gray-500 border-r border-gray-200 flex items-start ${
                  isMobile ? 'px-1 py-2' : ''
                }`}
              >
                {clockLabel(hour, isMobile)}
              </div>

              {days?.slice(0, isMobile ? 3 : 6)?.map((day, dayIndex) => {
                const { startISO, endISO } = makeSlot(day, hour)

                return (
                  <div
                    key={dayIndex}
                    className="p-1 md:p-2 border-r border-gray-100 last:border-r-0 relative hover:bg-blue-50 cursor-pointer"
                    onClick={() =>
                      onCreateClick?.({
                        startTime: startISO,
                        endTime: endISO,
                      })
                    }
                    onDrop={(e) =>
                      onDrop?.(e, {
                        startTime: startISO,
                        endTime: endISO,
                        vendorId: null,
                      })
                    }
                    onDragOver={onDragOver}
                  >
                    {/* Render appointments for this time slot */}
                    {safeAppointments
                      ?.filter((apt) => {
                        if (!apt?.scheduled_start_time) return false
                        const aptDate = safeParseDateISO(apt?.scheduled_start_time)
                        if (!aptDate) return false

                        try {
                          return isSameDay(aptDate, day) && getHours(aptDate) === hour
                        } catch (error) {
                          console.warn('Error comparing appointment date:', apt?.id, error)
                          return false
                        }
                      })
                      ?.map((apt) => (
                        <div
                          key={apt?.id}
                          onClick={(e) => {
                            e?.stopPropagation()
                            onAppointmentClick?.(apt)
                          }}
                          className={`p-1 md:p-2 rounded-lg text-xs cursor-pointer mb-1 border ${
                            apt?._isDueOnly ? 'border-dashed' : ''
                          } shadow-sm ${getStatusColor?.(apt?.job_status) || 'bg-gray-100'} ${
                            dragging?.id === apt?.id ? 'opacity-50' : ''
                          } ${isMobile ? 'min-h-12' : 'min-h-16'}`}
                          draggable
                          onDragStart={(e) => {
                            e?.dataTransfer?.setData('text/plain', '')
                            // Parent handles drag state
                          }}
                        >
                          <div className="font-semibold text-xs mb-1 truncate leading-tight flex items-center gap-2">
                            {apt?.vehicle_info?.includes('Stock:')
                              ? apt?.vehicle_info?.split('Stock:')?.[1]?.split('•')?.[0]?.trim() ||
                                apt?.title ||
                                'Untitled'
                              : apt?.title || 'Untitled'}
                            {(apt?.has_active_loaner || apt?.loaner_id) && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                                Loaner
                              </span>
                            )}
                          </div>
                          {!isMobile && (
                            <>
                              <div className="text-xs opacity-75 truncate">
                                {apt?.vehicle_info || ''}
                              </div>
                              <div className="text-xs opacity-75 truncate">
                                {apt?.vendor_name || ''}
                              </div>
                            </>
                          )}
                          <div className="text-xs font-medium mt-1 flex items-center gap-2">
                            {safeEstLabel(apt?.scheduled_start_time, isMobile ? 'h:mm' : 'h:mm a')}
                            {apt?._isDueOnly && (
                              <span className="ml-2 text-[10px] font-semibold uppercase">DUE</span>
                            )}
                            {apt?.next_promised_short && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium whitespace-nowrap">
                                Promise {apt?.next_promised_short}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                    {/* Drop zone indicator */}
                    {dragging && (
                      <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 rounded pointer-events-none" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Vendor Lane View with mobile optimization
  const renderVendorLaneView = (days, hours) => {
    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-3 md:p-4 border-b border-gray-200">
          <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>Vendor Resources</h3>
          <p className="text-sm text-gray-500">
            {safeFormat(days?.[0], 'MMM d')} - {safeFormat(days?.[5], 'MMM d')}
          </p>
        </div>
        <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {vendors?.map((vendor) => {
            if (!vendor?.id) return null

            const vendorAppointments =
              safeAppointments?.filter((apt) => apt?.vendor_id === vendor?.id) || []
            const capacity = vendorCapacity?.[vendor?.id] || { total: 1, used: 0 }
            const capacityUsed = vendorAppointments?.length || 0
            const remaining = Math.max(0, (capacity?.total || 1) - capacityUsed)

            return (
              <div key={vendor?.id} className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-3 md:px-4 py-2 md:py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`font-medium text-gray-900 truncate ${isMobile ? 'text-sm' : 'text-base'}`}
                      >
                        {vendor?.name || 'Unnamed Vendor'}
                      </h4>
                      <p className="text-xs md:text-sm text-gray-600 truncate">
                        {vendor?.specialty || ''}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            remaining > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {capacityUsed}/{capacity?.total || 1}
                        </span>
                        {!isMobile && (
                          <span className="text-xs text-gray-500">{remaining} remaining</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="p-3 md:p-4 min-h-24 md:min-h-32 relative"
                  onDrop={(e) =>
                    onDrop?.(e, {
                      vendorId: vendor?.id,
                      startTime: new Date()?.toISOString(),
                      endTime: new Date(Date.now() + 3600000)?.toISOString(),
                    })
                  }
                  onDragOver={onDragOver}
                >
                  <div className="space-y-2">
                    {vendorAppointments?.length === 0 ? (
                      <div className="text-center py-3 md:py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <div className={isMobile ? 'text-xs' : 'text-sm'}>
                          Drop appointments here {!isMobile && 'or click to create'}
                        </div>
                      </div>
                    ) : (
                      vendorAppointments?.map((apt) => (
                        <div
                          key={apt?.id}
                          onClick={() => onAppointmentClick?.(apt)}
                          className={`p-2 md:p-3 rounded-lg cursor-pointer border ${
                            apt?._isDueOnly ? 'border-dashed' : ''
                          } shadow-sm ${getStatusColor?.(apt?.job_status) || 'bg-gray-100'} ${
                            dragging?.id === apt?.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div
                                className={`font-medium truncate ${isMobile ? 'text-sm' : 'text-base'} flex items-center gap-2`}
                              >
                                {apt?.vehicle_info?.includes('Stock:')
                                  ? apt?.vehicle_info
                                      ?.split('Stock:')?.[1]
                                      ?.split('•')?.[0]
                                      ?.trim() ||
                                    apt?.title ||
                                    'Untitled'
                                  : apt?.title || 'Untitled'}
                                {(apt?.has_active_loaner || apt?.loaner_id) && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                                    Loaner
                                  </span>
                                )}
                              </div>
                              <div className="text-xs md:text-sm text-gray-600 truncate">
                                {apt?.vehicle_info || ''}
                              </div>
                              {!isMobile && (
                                <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {apt?.estimated_hours || 0}h
                                  </span>
                                  <span className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {apt?.location || 'TBD'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-2">
                              <div
                                className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} flex items-center gap-2`}
                              >
                                {safeEstLabel(
                                  apt?.scheduled_start_time,
                                  isMobile ? 'h:mm' : 'h:mm a'
                                )}
                                {apt?._isDueOnly && (
                                  <span className="ml-2 text-[10px] font-semibold uppercase">
                                    DUE
                                  </span>
                                )}
                                {apt?.next_promised_short && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium whitespace-nowrap">
                                    Promise {apt?.next_promised_short}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {apt?.scheduled_start_time &&
                                  (() => {
                                    const aptDate = safeParseDateISO(apt?.scheduled_start_time)
                                    return aptDate ? safeFormat(aptDate, 'MMM d') : 'Invalid Date'
                                  })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Drop zone indicator for vendor lane */}
                  {dragging && (
                    <div className="absolute inset-2 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-30 rounded pointer-events-none" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Day View with mobile optimization
  const renderDayView = () => {
    const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8 AM - 6 PM
    const dayAppointments =
      safeAppointments?.filter((apt) => {
        if (!apt?.scheduled_start_time) return false
        const aptDate = safeParseDateISO(apt?.scheduled_start_time)
        return aptDate && isSameDay(aptDate, safeCurrentDate)
      }) || []

    return (
      <div className="bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-3 md:p-4 border-b border-gray-200">
          <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>
            {safeFormat(safeCurrentDate, isMobile ? 'MMM d, yyyy' : 'EEEE, MMMM d, yyyy')}
          </h3>
          <p className="text-sm text-gray-500">{dayAppointments?.length || 0} appointments</p>
        </div>
        <div className="flex-1 overflow-auto">
          {hours?.map((hour) => {
            const { startISO, endISO } = makeSlot(safeCurrentDate, hour)

            return (
              <div
                key={hour}
                className={`border-b border-gray-100 flex ${isMobile ? 'min-h-16' : 'min-h-20'}`}
              >
                <div
                  className={`border-r border-gray-200 flex items-start text-gray-500 ${
                    isMobile ? 'w-16 p-2 text-xs' : 'w-20 p-4 text-sm'
                  }`}
                >
                  {clockLabel(hour, isMobile)}
                </div>
                <div
                  className="flex-1 p-2 hover:bg-blue-50 cursor-pointer relative"
                  onClick={() =>
                    onCreateClick?.({
                      startTime: startISO,
                      endTime: endISO,
                    })
                  }
                  onDrop={(e) =>
                    onDrop?.(e, {
                      startTime: startISO,
                      endTime: endISO,
                    })
                  }
                  onDragOver={onDragOver}
                >
                  {dayAppointments
                    ?.filter((apt) => {
                      if (!apt?.scheduled_start_time) return false
                      const aptDate = safeParseDateISO(apt?.scheduled_start_time)
                      if (!aptDate) return false

                      try {
                        return getHours(aptDate) === hour
                      } catch (error) {
                        console.warn('Error getting hour from appointment date:', apt?.id, error)
                        return false
                      }
                    })
                    ?.map((apt) => (
                      <div
                        key={apt?.id}
                        onClick={(e) => {
                          e?.stopPropagation()
                          onAppointmentClick?.(apt)
                        }}
                        className={`p-2 md:p-3 rounded-lg cursor-pointer mb-2 border ${
                          apt?._isDueOnly ? 'border-dashed' : ''
                        } shadow-sm ${getStatusColor?.(apt?.job_status) || 'bg-gray-100'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-medium truncate ${isMobile ? 'text-sm' : 'text-base'} flex items-center gap-2`}
                            >
                              {apt?.vehicle_info?.includes('Stock:')
                                ? apt?.vehicle_info
                                    ?.split('Stock:')?.[1]
                                    ?.split('•')?.[0]
                                    ?.trim() ||
                                  apt?.title ||
                                  'Untitled'
                                : apt?.title || 'Untitled'}
                              {(apt?.has_active_loaner || apt?.loaner_id) && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                                  Loaner
                                </span>
                              )}
                            </div>
                            <div className="text-xs md:text-sm text-gray-600 truncate">
                              {apt?.vehicle_info || ''}
                            </div>
                            {!isMobile && (
                              <div className="text-sm text-gray-600">{apt?.vendor_name || ''}</div>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <div
                              className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} flex items-center gap-2`}
                            >
                              {safeEstLabel(
                                apt?.scheduled_start_time,
                                isMobile ? 'h:mm' : 'h:mm a'
                              )}
                              {!isMobile &&
                                apt?.scheduled_end_time &&
                                ` - ${safeEstLabel(apt?.scheduled_end_time, 'h:mm a')}`}
                              {apt?._isDueOnly && (
                                <span className="ml-2 text-[10px] font-semibold uppercase">
                                  DUE
                                </span>
                              )}
                              {apt?.next_promised_short && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium whitespace-nowrap">
                                  Promise {apt?.next_promised_short}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Drop zone indicator */}
                  {dragging && (
                    <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 rounded pointer-events-none" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render based on view
  if (view === 'day') return renderDayView()
  return renderWeekView()
}

export default CalendarGrid
