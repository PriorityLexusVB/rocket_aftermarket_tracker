import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/ui/Navbar'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { getEtDayUtcMs, toSafeDateForTimeZone } from '../../utils/scheduleDisplay'
import {
  markLoanerReturned,
  listLoanerAssignmentsForDrawer,
  listJobsNeedingLoanersForDrawer,
} from '../../services/dealService'

export default function LoanerManagementDrawer() {
  const navigate = useNavigate()
  const [loaners, setLoaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inventory, setInventory] = useState({
    available: 0,
    assigned: 0,
    overdue: 0,
  })

  const MS_DAY = 24 * 60 * 60 * 1000

  const getDayUtcMs = useCallback((value) => getEtDayUtcMs(value), [])

  const isPastEtDay = useCallback(
    (value, nowDayMs) => {
      const dayMs = getDayUtcMs(value)
      if (!dayMs || !nowDayMs) return false
      return dayMs < nowDayMs
    },
    [getDayUtcMs]
  )

  // Load loaner data
  const loadLoaners = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      // Get all loaner assignments with job and customer data
      const assignments = await listLoanerAssignmentsForDrawer()

      // Calculate inventory stats
      const todayDayMs = getDayUtcMs(new Date())
      const assigned = assignments?.filter((a) => !a?.returned_at)?.length || 0
      const overdue =
        assignments?.filter((a) => !a?.returned_at && isPastEtDay(a?.eta_return_date, todayDayMs))
          ?.length || 0

      setLoaners(assignments || [])
      setInventory({
        available: Math.max(0, 10 - assigned), // Assuming 10 total loaners
        assigned,
        overdue,
      })
    } catch (err) {
      setError(`Failed to load loaner data: ${err?.message}`)
      console.error('Load loaners error:', err)
    } finally {
      setLoading(false)
    }
  }, [getDayUtcMs, isPastEtDay])

  // Load jobs that need loaners
  const [jobsNeedingLoaners, setJobsNeedingLoaners] = useState([])

  const loadJobsNeedingLoaners = useCallback(async () => {
    try {
      const jobsWithoutActiveLoaners = await listJobsNeedingLoanersForDrawer()
      setJobsNeedingLoaners(jobsWithoutActiveLoaners || [])
    } catch (err) {
      console.error('Load jobs needing loaners error:', err)
    }
  }, [])

  // Handle mark returned
  const handleMarkReturned = async (assignmentId) => {
    try {
      setError('')

      await markLoanerReturned(assignmentId)

      // Refresh both lists: returning a loaner can make a job show up as "Pending"
      await Promise.all([loadLoaners(), loadJobsNeedingLoaners()])
    } catch (err) {
      setError(`Failed to mark loaner as returned: ${err?.message}`)
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = toSafeDateForTimeZone(dateString)
    if (!date) return '—'
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  // Determine loaner status
  const getLoanerStatus = (assignment) => {
    if (assignment?.returned_at) return 'returned'

    const todayDayMs = getDayUtcMs(new Date())
    const etaDayMs = getDayUtcMs(assignment?.eta_return_date)

    if (!etaDayMs || !todayDayMs) return 'active'
    if (etaDayMs < todayDayMs) return 'overdue'

    const daysDiff = Math.ceil((etaDayMs - todayDayMs) / MS_DAY)
    if (daysDiff <= 2) return 'due-soon'

    return 'active'
  }

  // Status colors and labels
  const getStatusDisplay = (status) => {
    const statusMap = {
      active: {
        color: 'bg-green-100 text-green-800 border-green-200',
        label: 'Active',
      },
      'due-soon': {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        label: 'Due Soon',
      },
      overdue: {
        color: 'bg-red-100 text-red-800 border-red-200',
        label: 'Overdue',
      },
      returned: {
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        label: 'Returned',
      },
    }

    return statusMap?.[status] || statusMap?.['active']
  }

  useEffect(() => {
    Promise.all([loadLoaners(), loadJobsNeedingLoaners()])
  }, [loadLoaners, loadJobsNeedingLoaners])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <div className="p-4 md:p-8" style={{ paddingTop: '5rem' }}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icon name="Loader" size={32} className="animate-spin mx-auto mb-4 text-slate-400" />
              <div className="text-slate-600">Loading loaner management...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <div className="p-4 md:p-8 max-w-7xl mx-auto" style={{ paddingTop: '5rem' }}>
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex">
                <Icon name="AlertCircle" size={20} className="text-red-500 mr-2 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
                aria-label="Dismiss error"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Loaner Management</h1>
            <p className="text-slate-600 mt-1">Track and manage loaner vehicle assignments</p>
          </div>
        </div>

        {/* Inventory Overview */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Available Loaners */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100 mr-4">
                  <Icon name="Car" size={24} className="text-green-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Available
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{inventory?.available}</p>
                </div>
              </div>
            </div>

            {/* Assigned Loaners */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100 mr-4">
                  <Icon name="Users" size={24} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Assigned
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{inventory?.assigned}</p>
                </div>
              </div>
            </div>

            {/* Overdue Returns */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-red-100 mr-4">
                  <Icon name="AlertTriangle" size={24} className="text-red-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Overdue
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{inventory?.overdue}</p>
                </div>
              </div>
            </div>

            {/* Jobs Needing Loaners */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100 mr-4">
                  <Icon name="Clock" size={24} className="text-purple-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Pending
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{jobsNeedingLoaners?.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs Needing Loaners Section */}
        {jobsNeedingLoaners?.length > 0 && (
          <div className="mb-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <Icon name="AlertCircle" size={20} className="text-yellow-600 mr-2" />
                <div>
                  <h3 className="font-medium text-yellow-800">Jobs Requiring Loaner Assignment</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {jobsNeedingLoaners?.length} job{jobsNeedingLoaners?.length !== 1 ? 's' : ''}{' '}
                    need loaner vehicles assigned
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Assignments are made from the Deal (Add/Edit Deal), not from this page.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {jobsNeedingLoaners?.map((job) => (
                <div
                  key={job?.id}
                  className="bg-white rounded-lg border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <h4 className="font-medium text-slate-900">
                      {job?.job_number || job?.transactions?.[0]?.customer_name || '—'}
                    </h4>
                    <p className="text-sm text-slate-600">
                      Customer: {job?.transactions?.[0]?.customer_name || 'Unknown'}
                    </p>
                    {job?.transactions?.[0]?.customer_phone && (
                      <p className="text-sm text-slate-500">
                        Phone: {job?.transactions?.[0]?.customer_phone}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      navigate(`/deals/${job?.id}/edit`)
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white h-11 px-6"
                  >
                    Open Deal
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Loaner Assignments */}
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-slate-900">Active Loaner Assignments</h2>
            <p className="text-sm text-slate-600 mt-1">
              Track current and returned loaner vehicles
            </p>
          </div>

          {loaners?.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Icon name="Car" size={48} className="mx-auto mb-4 text-slate-300" />
              <p>No loaner assignments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Loaner #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Expected Return
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {loaners?.map((assignment) => {
                    const status = getLoanerStatus(assignment)
                    const statusDisplay = getStatusDisplay(status)

                    return (
                      <tr key={assignment?.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Icon name="Car" size={16} className="text-slate-400 mr-2" />
                            <span className="font-medium text-slate-900">
                              #{assignment?.loaner_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-slate-900">
                              {assignment?.jobs?.transactions?.[0]?.customer_name || 'Unknown'}
                            </div>
                            {assignment?.jobs?.transactions?.[0]?.customer_phone && (
                              <div className="text-sm text-slate-500">
                                {assignment?.jobs?.transactions?.[0]?.customer_phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900">
                            {assignment?.jobs?.job_number ||
                              assignment?.jobs?.transactions?.[0]?.customer_name ||
                              'Unknown Job'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {formatDate(assignment?.eta_return_date)}
                          </div>
                          {assignment?.returned_at && (
                            <div className="text-xs text-slate-500">
                              Returned: {formatDate(assignment?.returned_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${statusDisplay?.color}`}
                          >
                            {statusDisplay?.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {!assignment?.returned_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkReturned(assignment?.id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              Mark Returned
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
