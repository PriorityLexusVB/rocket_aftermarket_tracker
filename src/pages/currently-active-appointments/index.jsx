import React, { useState, useEffect, useCallback } from 'react'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.js'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check.js'
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
      // Wave XXX-V: quality_check removed, reversed added
      reversed: {
        color: 'from-red-500 to-red-600',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: CheckCircle,
        label: 'Reversed',
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

      // Wave XXX-V signals (BulkOperationsPanel emits these instead of raw status values)
      if (status === 'mark_qc') {
        const { error } = await appointmentsService.bulkMarkQualityChecked({
          jobIds: appointmentIds,
          orgId,
        })
        if (error) throw error
      } else if (status === 'bulk_reverse') {
        // Use reverse_deal RPC per job (audit fields enforced server-side)
        const { supabase } = await import('@/lib/supabase')
        const reason = 'Bulk reverse'
        for (const id of appointmentIds) {
          const { error } = await supabase.rpc('reverse_deal', {
            p_deal_id: id,
            p_reason: reason,
          })
          if (error) throw error
        }
      } else {
        const { error } = await appointmentsService.bulkUpdateJobStatus({
          jobIds: appointmentIds,
          status,
          orgId,
        })
        if (error) throw error
      }

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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
            <p className="text-muted-foreground font-medium">Loading workflow center...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <h1 className="sr-only">Currently Active Appointments</h1>

        {/* Header */}
        <div className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-6 sm:px-8 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Vehicles
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vehicles in your inventory with active aftermarket work
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search jobs, vehicles, customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    className="pl-9 pr-4 py-2 border border-border rounded-md w-full sm:w-72 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>

                {/* Workflow Management Tools */}
                <button
                  onClick={() => setShowPerformanceWidget(!showPerformanceWidget)}
                  className={`px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2 transition-colors ${showPerformanceWidget ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-border text-foreground hover:bg-muted'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Analytics</span>
                </button>

                <button
                  onClick={() => setBulkOperationsMode(!bulkOperationsMode)}
                  className={`px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2 transition-colors ${bulkOperationsMode ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-border text-foreground hover:bg-muted'}`}
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Bulk Actions</span>
                  {selectedAppointments?.size > 0 && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {selectedAppointments?.size}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`px-3 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted flex items-center gap-2 transition-colors ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => navigate('/calendar')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md px-4 py-2 flex items-center gap-2 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule New</span>
                </button>
              </div>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md border border-blue-200">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">
                  {counts?.total} Total Active
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-md border border-orange-200">
                <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-xs font-medium text-orange-800">
                  {counts?.inProgress} In Progress
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-md border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-800">
                  {counts?.scheduled} Scheduled
                </span>
              </div>
              {counts?.overdue > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-md border border-red-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-medium text-red-800">
                    {counts?.overdue} Overdue
                  </span>
                </div>
              )}
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
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Active Appointments</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
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
            <div className="w-2/5 border-l border-border">
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
