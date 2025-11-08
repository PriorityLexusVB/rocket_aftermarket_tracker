import React, { useState, useEffect, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// Safe date creation utility
const safeCreateDate = (input) => {
  if (!input) return null
  try {
    const date = new Date(input)
    if (isNaN(date?.getTime())) {
      console.warn('Invalid date created from input:', input)
      return null
    }
    return date
  } catch (error) {
    console.warn('Date creation error:', input, error)
    return null
  }
}

// Safe date string validation
const safeDateString = (dateInput) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toISOString()
  } catch (error) {
    console.warn('Date string conversion error:', dateInput, error)
    return ''
  }
}

// Safe date formatting
const safeFormatDate = (dateInput, options = {}) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toLocaleDateString('en-US', options)
  } catch (error) {
    console.warn('Date formatting error:', dateInput, error)
    return ''
  }
}

// Safe time formatting
const safeFormatTime = (dateInput, options = {}) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toLocaleTimeString('en-US', options)
  } catch (error) {
    console.warn('Time formatting error:', dateInput, error)
    return ''
  }
}

const CalendarSchedulingCenter = () => {
  // State management
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState('week') // 'day', 'week', 'month'
  const [jobs, setJobs] = useState([])
  const [vendors, setVendors] = useState([])
  const [selectedVendors, setSelectedVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')

  // Date range calculation based on view type with safe date operations
  const dateRange = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    try {
      switch (viewType) {
        case 'day':
          start?.setHours(0, 0, 0, 0)
          end?.setHours(23, 59, 59, 999)
          break
        case 'week':
          const dayOfWeek = start?.getDay()
          start?.setDate(start?.getDate() - dayOfWeek)
          start?.setHours(0, 0, 0, 0)
          end?.setDate(start?.getDate() + 6)
          end?.setHours(23, 59, 59, 999)
          break
        case 'month':
          start?.setDate(1)
          start?.setHours(0, 0, 0, 0)
          end?.setMonth(end?.getMonth() + 1)
          end?.setDate(0)
          end?.setHours(23, 59, 59, 999)
          break
      }
    } catch (error) {
      console.error('Date range calculation error:', error)
      // Return safe default range
      const safeStart = new Date()
      const safeEnd = new Date()
      safeStart?.setHours(0, 0, 0, 0)
      safeEnd?.setHours(23, 59, 59, 999)
      return { start: safeStart, end: safeEnd }
    }

    return { start, end }
  }, [currentDate, viewType])

  // Load calendar data with safe date operations
  const loadCalendarData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        ?.from('jobs')
        ?.select('*')
        ?.eq('user_id', user?.id)
        ?.order('scheduled_start_time', { ascending: true })

      if (error) {
        console.error('Error loading jobs:', error)
        setError('Failed to load jobs')
        return
      }

      const jobsData = data?.map((job) => ({
        ...job,
        scheduled_start_time: safeDateString(job?.scheduled_start_time),
        scheduled_end_time: safeDateString(job?.scheduled_end_time),
        color_code: job?.color_code || '#3b82f6',
      }))

      setJobs(jobsData)

      // Update debug info
      setDebugInfo(`Loaded ${jobsData?.length} jobs`)
    } catch (error) {
      console.error('Error loading calendar data:', error)
      setError('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  // Load vendors with safe date operations
  const loadVendors = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.eq('user_id', user?.id)
        ?.order('name')

      if (error) {
        console.error('Error loading vendors:', error)
        setError('Failed to load vendors')
        return
      }

      const vendorsData = data?.map((vendor) => ({
        ...vendor,
        specialty: vendor?.specialty || 'General Service',
      }))

      setVendors(vendorsData)

      // Update debug info
      setDebugInfo(`Loaded ${vendorsData?.length} vendors`)
    } catch (error) {
      console.error('Error loading vendors:', error)
      setError('Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }

  // Load data on component mount and date range changes
  useEffect(() => {
    loadCalendarData()
    loadVendors()
  }, [dateRange, selectedVendors])

  // Navigation handlers with safe date operations
  const navigateDate = (direction) => {
    try {
      const newDate = new Date(currentDate)

      switch (viewType) {
        case 'day':
          newDate?.setDate(newDate?.getDate() + direction)
          break
        case 'week':
          newDate?.setDate(newDate?.getDate() + direction * 7)
          break
        case 'month':
          newDate?.setMonth(newDate?.getMonth() + direction)
          break
      }

      // Validate the new date before setting
      if (!isNaN(newDate?.getTime())) {
        setCurrentDate(newDate)
      } else {
        console.warn('Invalid date generated during navigation')
      }
    } catch (error) {
      console.error('Date navigation error:', error)
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Refresh data with safe date operations
  const refreshData = async () => {
    try {
      setLoading(true)
      setError(null)

      await loadCalendarData()
      await loadVendors()

      // Update debug info
      setDebugInfo('Data refreshed successfully')
    } catch (error) {
      console.error('Error refreshing data:', error)
      setError('Failed to refresh data')
    } finally {
      setLoading(false)
    }
  }

  // Format date for display with safe operations
  const formatDisplayDate = () => {
    try {
      if (viewType === 'week') {
        const weekStart = safeCreateDate(dateRange?.start)
        const weekEnd = safeCreateDate(dateRange?.end)

        if (!weekStart || !weekEnd) return 'Invalid Date Range'

        return `${safeFormatDate(weekStart, { month: 'short', day: 'numeric' })} - ${safeFormatDate(weekEnd, { month: 'short', day: 'numeric' })}`
      }

      const options = {
        year: 'numeric',
        month: 'long',
        ...(viewType === 'day' && { day: 'numeric' }),
      }

      return safeFormatDate(currentDate, options) || 'Invalid Date'
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Date Error'
    }
  }

  // Enhanced calendar grid component with safe date handling
  const CalendarGrid = ({ jobs, viewType }) => {
    if (viewType === 'week') {
      // Create week view with safe date operations
      const weekDays = []
      const startDate = safeCreateDate(dateRange?.start)

      if (!startDate) {
        return (
          <div className="p-4 text-center text-red-500">
            Error: Unable to create calendar view - Invalid date range
          </div>
        )
      }

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate)
        dayDate?.setDate(startDate?.getDate() + i)

        // Validate each day date
        if (isNaN(dayDate?.getTime())) {
          console.warn(`Invalid day date generated for day ${i}`)
          continue
        }

        const dayJobs = jobs?.filter((job) => {
          if (!job?.scheduled_start_time) return false

          const jobDate = safeCreateDate(job?.scheduled_start_time)
          if (!jobDate) return false

          return jobDate?.toDateString() === dayDate?.toDateString()
        })

        weekDays?.push({
          date: dayDate,
          jobs: dayJobs,
        })
      }

      return (
        <div className="grid grid-cols-7 gap-1 h-full">
          {/* Day headers */}
          {weekDays?.map((day, index) => (
            <div
              key={`header-${index}`}
              className="bg-gray-50 p-2 border-b font-semibold text-center"
            >
              <div className="text-sm text-gray-600">
                {safeFormatDate(day?.date, { weekday: 'short' }) || 'N/A'}
              </div>
              <div className="text-lg">{day?.date?.getDate() || '?'}</div>
            </div>
          ))}
          {/* Day content */}
          {weekDays?.map((day, index) => (
            <div
              key={`content-${index}`}
              className="bg-white p-2 border-r border-gray-200 min-h-96 overflow-y-auto"
            >
              {day?.jobs?.map((job) => {
                const jobStartTime = safeCreateDate(job?.scheduled_start_time)

                return (
                  <div
                    key={job?.id}
                    className="mb-2 p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow"
                    style={{ backgroundColor: job?.color_code || '#3b82f6', color: 'white' }}
                    onClick={() =>
                      alert(
                        `Job: ${job?.title}\nVendor: ${job?.vendor_name}\nTime: ${jobStartTime ? safeFormatTime(jobStartTime) : 'Invalid Time'}`
                      )
                    }
                  >
                    <div className="font-medium truncate">{job?.title}</div>
                    <div className="text-xs opacity-90">{job?.vendor_name}</div>
                    <div className="text-xs opacity-80">
                      {jobStartTime
                        ? safeFormatTime(jobStartTime, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'Invalid Time'}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )
    }

    // Simple list view for day/month with safe date handling
    return (
      <div className="p-4">
        {jobs?.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No jobs scheduled for this period</div>
        ) : (
          <div className="space-y-4">
            {jobs?.map((job) => {
              const jobStartTime = safeCreateDate(job?.scheduled_start_time)

              return (
                <div
                  key={job?.id}
                  className="bg-white p-4 rounded-lg shadow border cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    alert(
                      `Job Details:\n${job?.title}\nVendor: ${job?.vendor_name}\nVehicle: ${job?.vehicle_info}\nTime: ${jobStartTime ? jobStartTime?.toLocaleString() : 'Invalid Time'}`
                    )
                  }
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{job?.title}</h3>
                      <p className="text-sm text-gray-600">
                        {job?.vendor_name} • {job?.vehicle_info}
                      </p>
                      <p className="text-sm text-gray-500">
                        {jobStartTime ? jobStartTime?.toLocaleString() : 'Invalid Time'}
                      </p>
                    </div>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: job?.color_code || '#3b82f6' }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Error state component with safe date handling
  const ErrorState = () => (
    <div className="p-4 text-center text-red-500">
      <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
      <p className="text-sm mb-4">{error || 'Failed to load calendar data'}</p>
      <button
        onClick={refreshData}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  )

  // Loading state component with safe date handling
  const LoadingState = () => (
    <div className="p-4 text-center">
      <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" />
      <p className="text-sm text-gray-500">Loading calendar data...</p>
      <p className="text-xs text-gray-400 mt-2">{debugInfo || 'Initializing system...'}</p>
    </div>
  )

  // Main calendar view component with safe date handling
  const MainCalendarView = () => {
    const isWeekView = viewType === 'week'

    return (
      <div className="p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isWeekView ? 'Weekly Schedule' : 'Daily Schedule'}
            </h1>
            <p className="text-gray-600">{formatDisplayDate()}</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Today
            </button>

            <button
              onClick={() => navigateDate(1)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <CalendarGrid jobs={jobs} viewType={viewType} />
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
              <button
                onClick={refreshData}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Refresh Data
              </button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="font-medium text-gray-900 mb-3">View Settings</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setViewType('day')}
                  className={`w-full py-2 rounded transition-colors ${
                    viewType === 'day'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Day View
                </button>
                <button
                  onClick={() => setViewType('week')}
                  className={`w-full py-2 rounded transition-colors ${
                    viewType === 'week'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Week View
                </button>
                <button
                  onClick={() => setViewType('month')}
                  className={`w-full py-2 rounded transition-colors ${
                    viewType === 'month'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Month View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Calendar Scheduling Center</h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">{user?.name || 'User'}</div>
          </div>
        </div>

        {loading ? <LoadingState /> : error ? <ErrorState /> : <MainCalendarView />}
      </div>
    </div>
  )
}

export default CalendarSchedulingCenter
