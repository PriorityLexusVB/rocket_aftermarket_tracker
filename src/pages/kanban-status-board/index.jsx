// Wave XXX-Z item 2: ReverseReasonModal replaces window.prompt in handleStatusChange
// FIX: window.prompt removed — DO NOT REVERT, see Wave XXX-Z item 2
import React, { useState, useEffect, useCallback } from 'react'
import Activity from 'lucide-react/dist/esm/icons/activity.js'
import Filter from 'lucide-react/dist/esm/icons/filter.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import { useToast } from '@/components/ui/ToastProvider'
import { kanbanService } from '../../services/kanbanService'
import vendorService from '../../services/vendorService'
import ReverseReasonModal from '@/components/modals/ReverseReasonModal'

// Kanban components
import KanbanColumn from './components/KanbanColumn'
import JobCard from './components/JobCard'
import StatusUpdateModal from './components/StatusUpdateModal'
import FilterPanel from './components/FilterPanel'

const KanbanStatusBoard = () => {
  const toast = useToast()
  // State management
  const [jobs, setJobs] = useState([])
  const [vendors, setVendors] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draggedJob, setDraggedJob] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    vendors: [],
    priorities: [],
    overdue: false,
    dateRange: 'all', // 'today', 'week', 'month', 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  // Wave XXX-Z item 2: ReverseReasonModal state — replaces window.prompt
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [reverseTargetJobId, setReverseTargetJobId] = useState(null)

  // Kanban columns definition — Wave XXX-V: 5-state model.
  // quality_check column removed (merged into in_progress).
  // delivered column removed (merged into completed).
  // reversed column added at the end.
  const kanbanColumns = [
    {
      id: 'pending',
      title: 'Not Started',
      color: 'bg-gray-100 border-gray-300',
      headerColor: 'bg-gray-50 text-gray-700',
      statuses: ['pending'],
    },
    {
      id: 'scheduled',
      title: 'Scheduled',
      color: 'bg-blue-100 border-blue-300',
      headerColor: 'bg-blue-50 text-blue-700',
      statuses: ['scheduled'],
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'bg-yellow-100 border-yellow-300',
      headerColor: 'bg-yellow-50 text-yellow-700',
      statuses: ['in_progress'],
    },
    {
      id: 'completed',
      title: 'Completed',
      color: 'bg-green-100 border-green-300',
      headerColor: 'bg-green-50 text-green-700',
      statuses: ['completed'],
    },
    {
      id: 'reversed',
      title: 'Reversed',
      color: 'bg-red-100 border-red-300',
      headerColor: 'bg-red-50 text-red-700',
      statuses: ['reversed'],
    },
  ]

  // Load data on mount
  useEffect(() => {
    loadJobs()
    loadVendors()
  }, [])

  // Real-time subscription for job updates
  useEffect(() => {
    const unsubscribe = kanbanService.subscribeToJobChanges(() => {
      loadJobs() // Refresh jobs on any change
    })

    return unsubscribe
  }, [])

  // Apply filters whenever jobs, searchTerm, or filters change
  const applyFilters = useCallback(() => {
    let filtered = [...jobs]

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm?.toLowerCase()
      filtered = filtered?.filter(
        (job) =>
          job?.title?.toLowerCase()?.includes(searchLower) ||
          job?.description?.toLowerCase()?.includes(searchLower) ||
          job?.job_number?.toLowerCase()?.includes(searchLower) ||
          job?.vendor?.name?.toLowerCase()?.includes(searchLower) ||
          job?.vehicle?.owner_name?.toLowerCase()?.includes(searchLower) ||
          `${job?.vehicle?.year} ${job?.vehicle?.make} ${job?.vehicle?.model}`
            ?.toLowerCase()
            ?.includes(searchLower)
      )
    }

    // Vendor filter
    if (filters?.vendors?.length > 0) {
      filtered = filtered?.filter((job) => filters?.vendors?.includes(job?.vendor_id))
    }

    // Priority filter
    if (filters?.priorities?.length > 0) {
      filtered = filtered?.filter((job) => filters?.priorities?.includes(job?.priority))
    }

    // Overdue filter — Wave XXX-V: 5-state model terminal statuses
    if (filters?.overdue) {
      const now = new Date()
      filtered = filtered?.filter(
        (job) =>
          job?.due_date &&
          new Date(job.due_date) < now &&
          !['completed', 'reversed']?.includes(job?.job_status)
      )
    }

    // Date range filter
    if (filters?.dateRange !== 'all') {
      const now = new Date()
      let startDate = new Date()

      switch (filters?.dateRange) {
        case 'today':
          startDate?.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate?.setDate(now?.getDate() - 7)
          break
        case 'month':
          startDate?.setMonth(now?.getMonth() - 1)
          break
        default:
          break
      }

      filtered = filtered?.filter((job) => {
        const created = job?.created_at ? new Date(job.created_at) : null
        return created && created >= startDate
      })
    }

    setFilteredJobs(filtered)
  }, [jobs, searchTerm, filters])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const loadJobs = async () => {
    try {
      setLoading(true)

      const { data, error } = await kanbanService.getAllJobsForKanban()

      if (error) {
        console.error('Error loading jobs:', error)
        return
      }

      setJobs(data || [])
      setFilteredJobs(data || [])
    } catch (err) {
      console.error('Error in loadJobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadVendors = async () => {
    try {
      const rows = await vendorService.getAllVendors()
      setVendors(
        (rows || [])?.map((v) => ({
          id: v?.id,
          name: v?.name,
          specialty: v?.specialty,
        }))
      )
    } catch (err) {
      console.error('Error in loadVendors:', err)
    }
  }

  const getJobsForColumn = (columnStatuses) => {
    return filteredJobs?.filter((job) => columnStatuses?.includes(job?.job_status))
  }

  const handleJobClick = (job) => {
    setSelectedJob(job)
    setShowStatusModal(true)
  }

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      // Wave XXX-V hotfix: reversed transitions require audit fields; route
      // through reverse_deal RPC instead of raw status update. Without this
      // intercept the enforce_reversal_audit trigger rejects the write.
      // Codex post-hotfix catch: drag-to-Reversed-column was bypassing this.
      if (newStatus === 'reversed') {
        // Wave XXX-Z item 2: open ReverseReasonModal instead of window.prompt.
        // handleStatusChange returns false (no immediate status update); the
        // modal's confirmReverseKanban callback does the RPC + reload.
        setReverseTargetJobId(jobId)
        setReverseModalOpen(true)
        return false
      }

      const { error } = await kanbanService.updateJobStatus(jobId, newStatus)

      if (error) {
        const message = error?.message || String(error)
        console.error('Error updating job status:', error)
        if (message?.includes('Invalid status progression')) {
          toast?.error?.("Couldn't update this status. The transition isn't allowed from the current step.")
          return false
        }
        toast?.error?.("Couldn't update this status. Try again.")
        return false
      }

      loadJobs()
      return true
    } catch (error) {
      console.error('Error in handleStatusChange:', error)
      return false
    }
  }

  // Wave XXX-Z item 2: confirmReverseKanban — modal's onConfirm callback.
  // Receives validated reason string, calls reverse_deal RPC, reloads board.
  const confirmReverseKanban = async (reason) => {
    const jobId = reverseTargetJobId
    if (!jobId) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error: rpcErr } = await supabase.rpc('reverse_deal', {
        p_deal_id: jobId,
        p_reason: reason,
      })
      if (rpcErr) throw rpcErr
      toast?.success?.('Deal reversed')
      setReverseModalOpen(false)
      setReverseTargetJobId(null)
      loadJobs()
    } catch (err) {
      console.error('Error reversing deal (kanban):', err)
      toast?.error?.(err?.message || "Couldn't reverse this deal. Try again.")
      // Rethrow so ReverseReasonModal can display inline error
      throw err
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e, job) => {
    setDraggedJob(job)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedJob(null)
  }

  const handleDrop = async (e, targetStatus) => {
    e?.preventDefault()

    if (!draggedJob || targetStatus === draggedJob?.job_status) {
      return
    }

    const success = await handleStatusChange(draggedJob?.id, targetStatus)
    if (!success) {
      // Could show error feedback here
    }
  }

  const handleDragOver = (e) => {
    e?.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Wave XXX-V: 5-state model terminal statuses
  const isOverdue = (job) => {
    if (!job?.due_date || ['completed', 'reversed']?.includes(job?.job_status)) {
      return false
    }
    return new Date(job.due_date) < new Date()
  }

  const getColumnStats = (columnStatuses) => {
    const columnJobs = getJobsForColumn(columnStatuses)
    const overdue = columnJobs?.filter(isOverdue)?.length
    const urgent = columnJobs?.filter((job) => job?.priority === 'urgent')?.length

    return {
      total: columnJobs?.length,
      overdue,
      urgent,
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading kanban board...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Kanban Status Board</h1>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                placeholder="Search jobs, vehicles, or vendors..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors
                ${showFilters ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
              `}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Active filters indicator */}
            {(filters?.vendors?.length > 0 ||
              filters?.priorities?.length > 0 ||
              filters?.overdue ||
              searchTerm) && (
              <div className="flex items-center space-x-1 text-sm text-blue-600">
                <span>Filtered</span>
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
            )}

            {/* Jobs count */}
            <div className="text-sm text-gray-600">
              {filteredJobs?.length} of {jobs?.length} jobs
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <FilterPanel
            vendors={vendors}
            filters={filters}
            onFiltersChange={setFilters}
            onFilterChange={setFilters}
            onClearFilters={() =>
              setFilters({ vendors: [], priorities: [], overdue: false, dateRange: 'all' })
            }
            onSavePreset={() => {}}
            onLoadPreset={() => {}}
            className="mt-4"
          />
        )}
      </div>
      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex space-x-4 p-6 overflow-x-auto">
          {kanbanColumns?.map((column) => (
            <KanbanColumn
              key={column?.id}
              column={column}
              jobs={getJobsForColumn(column?.statuses)}
              stats={getColumnStats(column?.statuses)}
              onJobClick={handleJobClick}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column?.statuses?.[0])}
              draggedJob={draggedJob}
            >
              {getJobsForColumn(column?.statuses)?.map((job) => (
                <JobCard
                  key={job?.id}
                  job={job}
                  isOverdue={isOverdue(job)}
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </div>
      {/* Status Update Modal */}
      {showStatusModal && selectedJob && (
        <StatusUpdateModal
          job={selectedJob}
          onClose={() => {
            setShowStatusModal(false)
            setSelectedJob(null)
          }}
          onStatusUpdate={handleStatusChange}
        />
      )}

      {/* Wave XXX-Z item 2: ReverseReasonModal — replaces window.prompt */}
      <ReverseReasonModal
        isOpen={reverseModalOpen}
        onClose={() => {
          setReverseModalOpen(false)
          setReverseTargetJobId(null)
        }}
        onConfirm={confirmReverseKanban}
        dealLabel={reverseTargetJobId ? `Job ID ${reverseTargetJobId}` : undefined}
      />
    </div>
  )
}

export default KanbanStatusBoard
