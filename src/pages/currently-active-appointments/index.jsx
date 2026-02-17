import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Calendar,
  Search,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  CheckCheck,
} from 'lucide-react'
import AppLayout from '../../components/layouts/AppLayout'
import { useNavigate } from 'react-router-dom'
import useTenant from '@/hooks/useTenant'
import { appointmentsService } from '@/services/appointmentsService'
import { toSafeDateForTimeZone } from '@/utils/scheduleDisplay'
import { getEffectiveJobStatus } from '@/utils/jobStatusTimeRules.js'

// Import components
import AppointmentCard from './components/AppointmentCard'
import SnapshotView from './components/SnapshotView'
import AppointmentDetailPanel from './components/AppointmentDetailPanel'
import FilterControls from './components/FilterControls'
import BulkOperationsPanel from './components/BulkOperationsPanel'
import PerformanceWidget from './components/PerformanceWidget'

const SNAPSHOT_ON = String(import.meta.env.VITE_ACTIVE_SNAPSHOT || '').toLowerCase() === 'true'

const NoOrgState = ({ onGoDebugAuth }) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-xl w-full rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-700" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-amber-900">No organization found</h2>
            <p className="mt-1 text-sm text-amber-800">
              You’re signed in, but we couldn’t determine your organization. Ask an admin to assign
              your account to an org.
            </p>
            {onGoDebugAuth ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onGoDebugAuth}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
                >
                  View debug auth
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

const CurrentlyActiveAppointmentsLegacy = () => {
  const [appointments, setAppointments] = useState([])
  const [originalAppointments, setOriginalAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [vendors, setVendors] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  // Enhanced workflow management state
  const [selectedAppointments, setSelectedAppointments] = useState(new Set())
  const [bulkOperationsMode, setBulkOperationsMode] = useState(false)
  const [showPerformanceWidget, setShowPerformanceWidget] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState({})

  const navigate = useNavigate()
  const { orgId, loading: tenantLoading } = useTenant()

  const canQuery = Boolean(orgId) && tenantLoading === false

  const loadPerformanceMetrics = useCallback(async () => {
    try {
      if (!canQuery) {
        setPerformanceMetrics({})
        return
      }
      const { data, error } = await appointmentsService.getPerformanceMetrics({ orgId })
      if (error) throw error
      setPerformanceMetrics(data || {})
    } catch (error) {
      console.error('Error loading performance metrics:', error)
    }
  }, [canQuery, orgId])

  const loadVendors = useCallback(async () => {
    try {
      if (!canQuery) {
        setVendors([])
        return
      }
      const { data, error } = await appointmentsService.listVendors({ orgId })
      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }, [canQuery, orgId])

  const loadAppointments = useCallback(async () => {
    try {
      if (!canQuery) {
        setOriginalAppointments([])
        setAppointments([])
        return
      }
      setLoading(true)

      const { data, error } = await appointmentsService.listActiveAppointments({ orgId })
      if (error) throw error

      const processedData = (data || [])?.map((job) => ({
        ...job,
        isOverdue: (() => {
          const promised = toSafeDateForTimeZone(job?.promised_date)
          if (!promised) return false
          return promised.getTime() < Date.now()
        })(),
        statusConfig: getStatusConfig(job?.job_status),
        priorityConfig: getPriorityConfig(job?.priority),
      }))

      setOriginalAppointments(processedData)
      setAppointments(processedData)
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setLoading(false)
    }
  }, [canQuery, orgId])

  const applyFilters = useCallback(() => {
    let filtered = [...originalAppointments]

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered?.filter((apt) => ['in_progress', 'scheduled']?.includes(apt?.job_status))
    } else if (statusFilter === 'overdue') {
      filtered = filtered?.filter((apt) => apt?.isOverdue)
    } else if (statusFilter !== 'all') {
      filtered = filtered?.filter((apt) => apt?.job_status === statusFilter)
    }

    // Vendor filter
    if (vendorFilter !== 'all') {
      filtered = filtered?.filter((apt) => apt?.vendor_id === vendorFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered?.filter((apt) => apt?.priority === priorityFilter)
    }

    // Search filter
    if (searchQuery?.trim()) {
      const query = searchQuery?.toLowerCase()?.trim()
      filtered = filtered?.filter(
        (apt) =>
          apt?.job_number?.toLowerCase()?.includes(query) ||
          apt?.title?.toLowerCase()?.includes(query) ||
          apt?.vehicles?.stock_number?.toLowerCase()?.includes(query) ||
          apt?.vehicles?.owner_name?.toLowerCase()?.includes(query) ||
          apt?.vendors?.name?.toLowerCase()?.includes(query) ||
          `${apt?.vehicles?.year} ${apt?.vehicles?.make} ${apt?.vehicles?.model}`
            ?.toLowerCase()
            ?.includes(query)
      )
    }

    setAppointments(filtered)
  }, [originalAppointments, priorityFilter, searchQuery, statusFilter, vendorFilter])

  useEffect(() => {
    if (tenantLoading) return
    if (!orgId) return

    loadAppointments()
    loadVendors()
    loadPerformanceMetrics()

    // Set up real-time subscription for job updates
    const subscription = appointmentsService.subscribeJobUpdates(() => {
      loadAppointments()
      loadPerformanceMetrics()
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [loadAppointments, loadPerformanceMetrics, loadVendors, orgId, tenantLoading])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  if (tenantLoading) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-gray-600">Loading…</div>
      </AppLayout>
    )
  }

  if (!orgId) {
    return (
      <AppLayout>
        <NoOrgState onGoDebugAuth={import.meta.env.DEV ? () => navigate('/debug-auth') : null} />
      </AppLayout>
    )
  }

  const getStatusConfig = (status) => {
    const configs = {
      scheduled: {
        color: 'from-blue-500 to-blue-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: Calendar,
        label: 'Scheduled',
      },
      in_progress: {
        color: 'from-orange-500 to-orange-600',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        icon: RefreshCw,
        label: 'In Progress',
      },
      quality_check: {
        color: 'from-green-500 to-green-600',
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: CheckCircle,
        label: 'Quality Check',
      },
      pending: {
        color: 'from-gray-500 to-gray-600',
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        icon: Clock,
        label: 'Needs Work (time TBD)',
      },
    }
    return configs?.[status] || configs?.pending
  }

  const getPriorityConfig = (priority) => {
    const configs = {
      urgent: { color: 'text-red-600', bg: 'bg-red-100' },
      high: { color: 'text-orange-600', bg: 'bg-orange-100' },
      medium: { color: 'text-yellow-600', bg: 'bg-yellow-100' },
      low: { color: 'text-green-600', bg: 'bg-green-100' },
    }
    return configs?.[priority] || configs?.medium
  }

  const handleAppointmentClick = (appointment) => {
    if (bulkOperationsMode) {
      toggleAppointmentSelection(appointment?.id)
    } else {
      setSelectedAppointment(appointment)
      setShowDetailPanel(true)
    }
  }

  const toggleAppointmentSelection = (appointmentId) => {
    const newSelection = new Set(selectedAppointments)
    if (newSelection?.has(appointmentId)) {
      newSelection?.delete(appointmentId)
    } else {
      newSelection?.add(appointmentId)
    }
    setSelectedAppointments(newSelection)
  }

  const handleUpdateStatus = async (appointmentId, newStatusOrPayload) => {
    try {
      const payload =
        newStatusOrPayload && typeof newStatusOrPayload === 'object'
          ? newStatusOrPayload
          : { status: newStatusOrPayload }

      const { error } = await appointmentsService.updateJobStatus({
        jobId: appointmentId,
        status: payload?.status,
        patch: payload?.patch,
        orgId,
      })
      if (error) throw error

      loadAppointments()
    } catch (error) {
      console.error('Error updating appointment status:', error)
    }
  }

  const handleBulkStatusUpdate = async (status) => {
    if (selectedAppointments?.size === 0) return

    try {
      const appointmentIds = Array?.from(selectedAppointments)
      const { error } = await appointmentsService.bulkUpdateJobStatus({
        jobIds: appointmentIds,
        status,
        orgId,
      })
      if (error) throw error

      setSelectedAppointments(new Set())
      loadAppointments()
    } catch (error) {
      console.error('Error bulk updating appointments:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise?.all([loadAppointments(), loadPerformanceMetrics()])
    setTimeout(() => setRefreshing(false), 1000)
  }

  const getAppointmentCounts = () => {
    const total = originalAppointments?.length || 0
    const inProgress =
      originalAppointments?.filter(
        (apt) => getEffectiveJobStatus(apt, { now: new Date() }) === 'in_progress'
      )?.length || 0
    const scheduled =
      originalAppointments?.filter(
        (apt) => getEffectiveJobStatus(apt, { now: new Date() }) === 'scheduled'
      )?.length || 0
    const overdue = originalAppointments?.filter((apt) => apt?.isOverdue)?.length || 0
    return { total, inProgress, scheduled, overdue }
  }

  const counts = getAppointmentCounts()

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading workflow center...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50">
        <h1 className="sr-only">Currently Active Appointments</h1>

        {/* Enhanced Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Workflow Management Center
                    </h1>
                    <p className="text-sm text-gray-600 font-medium">
                      Active Appointments & Operations Hub
                    </p>
                  </div>
                </div>

                {/* Enhanced Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search jobs, vehicles, customers, or vendors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    className="pl-12 pr-6 py-3.5 border border-gray-200 rounded-2xl w-96 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Workflow Management Tools */}
                <button
                  onClick={() => setShowPerformanceWidget(!showPerformanceWidget)}
                  className={`px-4 py-3 rounded-xl border text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center space-x-2 ${showPerformanceWidget ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Analytics</span>
                </button>

                <button
                  onClick={() => setBulkOperationsMode(!bulkOperationsMode)}
                  className={`px-4 py-3 rounded-xl border text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center space-x-2 ${bulkOperationsMode ? 'bg-orange-50 border-orange-200 text-orange-600' : 'border-gray-200'}`}
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Bulk Ops</span>
                  {selectedAppointments?.size > 0 && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {selectedAppointments?.size}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center space-x-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => navigate('/calendar')}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                >
                  <Calendar className="w-5 h-5" />
                  <span>Schedule New</span>
                </button>
              </div>
            </div>

            {/* Enhanced Stats Overview */}
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    {counts?.total} Total Active
                  </span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-orange-50 rounded-xl border border-orange-200">
                  <RefreshCw className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    {counts?.inProgress} In Progress
                  </span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {counts?.scheduled} Scheduled
                  </span>
                </div>
                {counts?.overdue > 0 && (
                  <div className="flex items-center space-x-2 px-4 py-2 bg-red-50 rounded-xl border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      {counts?.overdue} Overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Widget */}
        {showPerformanceWidget && (
          <PerformanceWidget
            metrics={performanceMetrics}
            onClose={() => setShowPerformanceWidget(false)}
          />
        )}

        {/* Bulk Operations Panel */}
        {bulkOperationsMode && selectedAppointments?.size > 0 && (
          <BulkOperationsPanel
            selectedCount={selectedAppointments?.size}
            onStatusUpdate={handleBulkStatusUpdate}
            onCancel={() => {
              setSelectedAppointments(new Set())
              setBulkOperationsMode(false)
            }}
          />
        )}

        {/* Main Content */}
        <div className="flex">
          {/* Appointments List (60%) */}
          <div className="flex-1 p-8" style={{ width: showDetailPanel ? '60%' : '100%' }}>
            {/* Filter Controls */}
            <FilterControls
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              vendorFilter={vendorFilter}
              setVendorFilter={setVendorFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              vendors={vendors}
            />

            {/* Appointments Grid */}
            {appointments?.length > 0 ? (
              <div className="space-y-4">
                {appointments?.map((appointment) => (
                  <AppointmentCard
                    key={appointment?.id}
                    appointment={appointment}
                    onClick={() => handleAppointmentClick(appointment)}
                    onUpdateStatus={handleUpdateStatus}
                    isSelected={selectedAppointments?.has(appointment?.id)}
                    bulkMode={bulkOperationsMode}
                    onToggleSelect={() => toggleAppointmentSelection(appointment?.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <Clock className="w-12 h-12 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Appointments</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery ||
                  statusFilter !== 'all' ||
                  vendorFilter !== 'all' ||
                  priorityFilter !== 'all'
                    ? 'No appointments match your current filters. Try adjusting your search criteria.'
                    : 'All appointments are completed or there are no scheduled appointments at this time.'}
                </p>
              </div>
            )}
          </div>

          {/* Appointment Detail Panel (40%) */}
          {showDetailPanel && selectedAppointment && (
            <div className="w-2/5 border-l border-gray-200/50">
              <AppointmentDetailPanel
                appointment={selectedAppointment}
                onClose={() => setShowDetailPanel(false)}
                onUpdate={loadAppointments}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

const CurrentlyActiveAppointments = () => {
  if (SNAPSHOT_ON) {
    return (
      <AppLayout>
        <SnapshotView />
      </AppLayout>
    )
  }

  return <CurrentlyActiveAppointmentsLegacy />
}

export default CurrentlyActiveAppointments
