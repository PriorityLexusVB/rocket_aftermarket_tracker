import React, { useState, useEffect } from 'react'
import {
  Clock,
  Calendar,
  Filter,
  Search,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Users,
  BarChart3,
  ArrowUpRight,
  CheckCheck,
  UserPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AppLayout from '../../components/layouts/AppLayout'
import { useNavigate } from 'react-router-dom'

// Import components
import AppointmentCard from './components/AppointmentCard'
import SnapshotView from './components/SnapshotView'
import AppointmentDetailPanel from './components/AppointmentDetailPanel'
import FilterControls from './components/FilterControls'
import BulkOperationsPanel from './components/BulkOperationsPanel'
import PerformanceWidget from './components/PerformanceWidget'
import AssignmentQuickPanel from './components/AssignmentQuickPanel'

const SNAPSHOT_ON = String(import.meta.env.VITE_ACTIVE_SNAPSHOT || '').toLowerCase() === 'true'

const CurrentlyActiveAppointments = () => {
  // Feature-flagged simplified snapshot: early return before legacy workflow logic mounts
  if (SNAPSHOT_ON) {
    return (
      <AppLayout>
        <SnapshotView />
      </AppLayout>
    )
  }
  /* eslint-disable react-hooks/rules-of-hooks */
  // Legacy: All hooks after conditional return. Refactor to split components when snapshot becomes default.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Legacy: Hooks after conditional return. Refactor to split components when snapshot becomes default.
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
  const [showAssignmentPanel, setShowAssignmentPanel] = useState(false)
  const [unassignedJobs, setUnassignedJobs] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [performanceMetrics, setPerformanceMetrics] = useState({})

  const navigate = useNavigate()

  useEffect(() => {
    loadAppointments()
    loadVendors()
    loadStaffMembers()
    loadUnassignedJobs()
    loadPerformanceMetrics()

    // Set up real-time subscription for job updates
    const subscription = supabase
      ?.channel('job_updates')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadAppointments()
        loadUnassignedJobs()
        loadPerformanceMetrics()
      })
      ?.subscribe()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, statusFilter, vendorFilter, priorityFilter, originalAppointments])

  const loadStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('id, full_name, email, role, department')
        ?.eq('is_active', true)
        ?.order('full_name')

      if (error) throw error
      setStaffMembers(data || [])
    } catch (error) {
      console.error('Error loading staff members:', error)
    }
  }

  const loadUnassignedJobs = async () => {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(
          `
          *,
          vehicles (
            id, stock_number, year, make, model, owner_name
          ),
          vendors (
            id, name
          )
        `
        )
        ?.is('assigned_to', null)
        ?.eq('job_status', 'pending')
        ?.order('created_at', { ascending: false })
        ?.limit(10)

      if (error) throw error
      setUnassignedJobs(data || [])
    } catch (error) {
      console.error('Error loading unassigned jobs:', error)
    }
  }

  const loadPerformanceMetrics = async () => {
    try {
      // Get today's metrics
      const today = new Date()?.toISOString()?.split('T')?.[0]

      const { data: todayJobs, error: todayError } = await supabase
        ?.from('jobs')
        ?.select('job_status, created_at, completed_at')
        ?.gte('created_at', `${today}T00:00:00Z`)
        ?.lte('created_at', `${today}T23:59:59Z`)

      if (todayError) throw todayError

      // Get this week's metrics
      const weekStart = new Date()
      weekStart?.setDate(weekStart?.getDate() - weekStart?.getDay())
      const weekStartStr = weekStart?.toISOString()?.split('T')?.[0]

      const { data: weekJobs, error: weekError } = await supabase
        ?.from('jobs')
        ?.select('job_status, created_at, completed_at')
        ?.gte('created_at', `${weekStartStr}T00:00:00Z`)

      if (weekError) throw weekError

      // Calculate metrics
      const todayCompleted =
        todayJobs?.filter((job) => job?.job_status === 'completed')?.length || 0
      const todayTotal = todayJobs?.length || 0
      const weekCompleted = weekJobs?.filter((job) => job?.job_status === 'completed')?.length || 0
      const weekTotal = weekJobs?.length || 0

      // Average completion time (in hours)
      const completedJobs = weekJobs?.filter(
        (job) => job?.job_status === 'completed' && job?.completed_at && job?.created_at
      )
      const avgCompletionTime =
        completedJobs?.length > 0
          ? completedJobs?.reduce((sum, job) => {
              const start = new Date(job?.created_at)
              const end = new Date(job?.completed_at)
              return sum + (end - start) / (1000 * 60 * 60) // Convert to hours
            }, 0) / completedJobs?.length
          : 0

      setPerformanceMetrics({
        todayCompleted,
        todayTotal,
        todayCompletionRate: todayTotal > 0 ? (todayCompleted / todayTotal) * 100 : 0,
        weekCompleted,
        weekTotal,
        weekCompletionRate: weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0,
        avgCompletionTime: Math?.round(avgCompletionTime * 100) / 100,
      })
    } catch (error) {
      console.error('Error loading performance metrics:', error)
    }
  }

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.select('id, name')
        ?.eq('is_active', true)
        ?.order('name')

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  const loadAppointments = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(
          `
          *,
          vehicles (
            id, stock_number, year, make, model, color, owner_name, 
            owner_phone, owner_email, license_plate
          ),
          vendors (
            id, name, phone, email, specialty, contact_person
          ),
          assigned_to_profile:user_profiles!assigned_to (
            id, full_name, email, phone
          ),
          created_by_profile:user_profiles!created_by (
            id, full_name, email
          )
        `
        )
        ?.in('job_status', ['pending', 'in_progress', 'scheduled', 'quality_check'])
        ?.order('scheduled_start_time', { ascending: true })

      if (error) throw error

      // Fetch active loaner assignments for these jobs to surface a Loaner badge
      const jobIds = (data || []).map((j) => j?.id).filter(Boolean)
      let loaners = []
      if (jobIds.length) {
        const { data: loanerRows } = await supabase
          ?.from('loaner_assignments')
          ?.select('job_id, id')
          ?.in('job_id', jobIds)
          ?.is('returned_at', null)
        loaners = loanerRows || []
      }

      const processedData = (data || [])?.map((job) => ({
        ...job,
        has_active_loaner: !!loaners.find((l) => l?.job_id === job?.id)?.id,
        isOverdue: job?.promised_date && new Date(job?.promised_date) < new Date(),
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
  }

  const applyFilters = () => {
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
        label: 'Pending',
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

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      const { error } = await supabase
        ?.from('jobs')
        ?.update({
          job_status: newStatus,
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', appointmentId)

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
      const { error } = await supabase
        ?.from('jobs')
        ?.update({
          job_status: status,
          updated_at: new Date()?.toISOString(),
        })
        ?.in('id', appointmentIds)

      if (error) throw error

      setSelectedAppointments(new Set())
      loadAppointments()
    } catch (error) {
      console.error('Error bulk updating appointments:', error)
    }
  }

  const handleBulkAssignment = async (staffId) => {
    if (selectedAppointments?.size === 0) return

    try {
      const appointmentIds = Array?.from(selectedAppointments)
      const { error } = await supabase
        ?.from('jobs')
        ?.update({
          assigned_to: staffId,
          updated_at: new Date()?.toISOString(),
        })
        ?.in('id', appointmentIds)

      if (error) throw error

      setSelectedAppointments(new Set())
      setShowAssignmentPanel(false)
      loadAppointments()
    } catch (error) {
      console.error('Error bulk assigning appointments:', error)
    }
  }

  const handleQuickAssignJob = async (jobId, staffId) => {
    try {
      const { error } = await supabase
        ?.from('jobs')
        ?.update({
          assigned_to: staffId,
          job_status: 'pending', // Changed from 'scheduled' - job is assigned but not yet scheduled on calendar
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', jobId)

      if (error) throw error

      loadUnassignedJobs()
      loadAppointments()
    } catch (error) {
      console.error('Error assigning job:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise?.all([loadAppointments(), loadUnassignedJobs(), loadPerformanceMetrics()])
    setTimeout(() => setRefreshing(false), 1000)
  }

  const getAppointmentCounts = () => {
    const total = originalAppointments?.length || 0
    const inProgress =
      originalAppointments?.filter((apt) => apt?.job_status === 'in_progress')?.length || 0
    const scheduled =
      originalAppointments?.filter((apt) => apt?.job_status === 'scheduled')?.length || 0
    const overdue = originalAppointments?.filter((apt) => apt?.isOverdue)?.length || 0
    const unassigned = unassignedJobs?.length || 0

    return { total, inProgress, scheduled, overdue, unassigned }
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
                {counts?.unassigned > 0 && (
                  <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 rounded-xl border border-purple-200">
                    <UserPlus className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">
                      {counts?.unassigned} Unassigned
                    </span>
                  </div>
                )}
              </div>

              {counts?.unassigned > 0 && (
                <button
                  onClick={() => setShowAssignmentPanel(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl transition-all duration-200 text-sm font-medium"
                >
                  <Users className="w-4 h-4" />
                  <span>Assign Jobs</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
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
            onAssign={() => setShowAssignmentPanel(true)}
            onCancel={() => {
              setSelectedAppointments(new Set())
              setBulkOperationsMode(false)
            }}
          />
        )}

        {/* Assignment Quick Panel */}
        {showAssignmentPanel && (
          <AssignmentQuickPanel
            unassignedJobs={unassignedJobs}
            staffMembers={staffMembers}
            selectedAppointments={selectedAppointments}
            onQuickAssign={handleQuickAssignJob}
            onBulkAssign={handleBulkAssignment}
            onClose={() => setShowAssignmentPanel(false)}
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
  /* eslint-enable react-hooks/rules-of-hooks */
}

export default CurrentlyActiveAppointments
