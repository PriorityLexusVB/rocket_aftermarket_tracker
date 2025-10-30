import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Navbar from '../../components/ui/Navbar'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'

export default function LoanerManagementDrawer() {
  const { user } = useAuth()
  const [loaners, setLoaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [inventory, setInventory] = useState({
    available: 0,
    assigned: 0,
    overdue: 0,
  })

  // Loaner assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    loaner_number: '',
    eta_return_date: '',
    notes: '',
  })

  // Load loaner data
  const loadLoaners = async () => {
    try {
      setLoading(true)
      setError('')

      // Get all loaner assignments with job and customer data
      const { data: assignments, error: assignmentsError } = await supabase
        ?.from('loaner_assignments')
        ?.select(
          `
          id,
          job_id,
          loaner_number,
          eta_return_date,
          returned_at,
          notes,
          created_at,
          jobs (
            id,
            title,
            customer_needs_loaner,
            transactions (
              customer_name,
              customer_phone
            )
          )
        `
        )
        ?.order('created_at', { ascending: false })

      if (assignmentsError) throw assignmentsError

      // Calculate inventory stats
      const today = new Date()
      const assigned = assignments?.filter((a) => !a?.returned_at)?.length || 0
      const overdue =
        assignments?.filter((a) => !a?.returned_at && new Date(a?.eta_return_date) < today)
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
  }

  // Load jobs that need loaners
  const [jobsNeedingLoaners, setJobsNeedingLoaners] = useState([])

  const loadJobsNeedingLoaners = async () => {
    try {
      const { data: jobs, error } = await supabase
        ?.from('jobs')
        ?.select(
          `
          id,
          title,
          customer_needs_loaner,
          transactions (
            customer_name,
            customer_phone
          ),
          loaner_assignments (
            id,
            returned_at
          )
        `
        )
        ?.eq('customer_needs_loaner', true)
        ?.in('job_status', ['pending', 'in_progress'])

      if (error) throw error

      // Filter jobs that don't have active loaner assignments
      const jobsWithoutActiveLoaners = jobs?.filter((job) => {
        const hasActiveLoaner = job?.loaner_assignments?.some((la) => !la?.returned_at)
        return !hasActiveLoaner
      })

      setJobsNeedingLoaners(jobsWithoutActiveLoaners || [])
    } catch (err) {
      console.error('Load jobs needing loaners error:', err)
    }
  }

  // Handle loaner assignment
  const handleAssignLoaner = async () => {
    if (
      !selectedJob ||
      !assignmentForm?.loaner_number?.trim() ||
      !assignmentForm?.eta_return_date
    ) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setError('')

      const { error } = await supabase?.from('loaner_assignments')?.insert([
        {
          job_id: selectedJob?.id,
          loaner_number: assignmentForm?.loaner_number?.trim(),
          eta_return_date: assignmentForm?.eta_return_date,
          notes: assignmentForm?.notes?.trim() || null,
        },
      ])

      if (error) throw error

      // Reset form and close modal
      setAssignmentForm({ loaner_number: '', eta_return_date: '', notes: '' })
      setShowAssignModal(false)
      setSelectedJob(null)

      // Reload data
      await Promise.all([loadLoaners(), loadJobsNeedingLoaners()])
    } catch (err) {
      setError(`Failed to assign loaner: ${err?.message}`)
    }
  }

  // Handle mark returned
  const handleMarkReturned = async (assignmentId) => {
    try {
      setError('')

      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.update({ returned_at: new Date()?.toISOString() })
        ?.eq('id', assignmentId)

      if (error) throw error

      await loadLoaners()
    } catch (err) {
      setError(`Failed to mark loaner as returned: ${err?.message}`)
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Determine loaner status
  const getLoanerStatus = (assignment) => {
    if (assignment?.returned_at) return 'returned'

    const today = new Date()
    const etaDate = new Date(assignment?.eta_return_date)

    if (etaDate < today) return 'overdue'

    const daysDiff = Math.ceil((etaDate - today) / (1000 * 60 * 60 * 24))
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
  }, [])

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
                      setSelectedJob(job)
                      setShowAssignModal(true)
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white h-11 px-6"
                  >
                    <Icon name="Car" size={16} className="mr-2" />
                    Assign Loaner
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

        {/* Assignment Modal */}
        {showAssignModal && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">Assign Loaner Vehicle</h3>
                  <button
                    onClick={() => {
                      setShowAssignModal(false)
                      setSelectedJob(null)
                      setAssignmentForm({ loaner_number: '', eta_return_date: '', notes: '' })
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="X" size={20} />
                  </button>
                </div>

                {/* Job Info */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border">
                  <h4 className="font-medium text-slate-900 mb-1">
                    {selectedJob?.job_number ||
                      selectedJob?.transactions?.[0]?.customer_name ||
                      '—'}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {selectedJob?.transactions?.[0]?.customer_name}
                  </p>
                </div>

                {/* Assignment Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Loaner Number *
                    </label>
                    <input
                      type="text"
                      value={assignmentForm?.loaner_number}
                      onChange={(e) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          loaner_number: e?.target?.value,
                        }))
                      }
                      className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., L-001"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expected Return Date *
                    </label>
                    <input
                      type="date"
                      value={assignmentForm?.eta_return_date}
                      onChange={(e) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          eta_return_date: e?.target?.value,
                        }))
                      }
                      className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={new Date()?.toISOString()?.split('T')?.[0]}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={assignmentForm?.notes}
                      onChange={(e) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          notes: e?.target?.value,
                        }))
                      }
                      className="bg-white border border-slate-200 rounded-lg w-full px-3 py-2 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Any special instructions or notes..."
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAssignModal(false)
                      setSelectedJob(null)
                      setAssignmentForm({ loaner_number: '', eta_return_date: '', notes: '' })
                    }}
                    className="flex-1 h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignLoaner}
                    className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={
                      !assignmentForm?.loaner_number?.trim() || !assignmentForm?.eta_return_date
                    }
                  >
                    Assign Loaner
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
