import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Car,
  Package,
  DollarSign,
  FileText,
  Eye,
  ArrowUpDown,
} from 'lucide-react'
import { claimsService } from '../../services/claimsService'
import ClaimProcessingModal from './components/ClaimProcessingModal'
import ClaimStatsWidget from './components/ClaimStatsWidget'
import ClaimAssignmentModal from './components/ClaimAssignmentModal'
import AppLayout from '../../components/layouts/AppLayout'

const ClaimsManagementCenter = () => {
  const [claims, setClaims] = useState([])
  const [staff, setStaff] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [claimsData, staffData, statsData] = await Promise.all([
        claimsService?.getAllClaims(),
        claimsService?.getStaff(),
        claimsService?.getClaimsStats(),
      ])

      setClaims(claimsData || [])
      setStaff(staffData || [])
      setStats(statsData)
    } catch (err) {
      setError(err?.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateClaim = async (claimId, updates) => {
    try {
      const updatedClaim = await claimsService?.updateClaim(claimId, updates)
      setClaims((prev) => prev?.map((claim) => (claim?.id === claimId ? updatedClaim : claim)))
      setSelectedClaim(updatedClaim)
    } catch (err) {
      setError(`Failed to update claim: ${err?.message}`)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'under_review':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      case 'resolved':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getDaysOld = (dateString) => {
    const days = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24))
    return days
  }

  const isOverdue = (claim) => {
    const daysOld = getDaysOld(claim?.created_at)
    return daysOld > 7 && ['submitted', 'under_review']?.includes(claim?.status)
  }

  // Filter and sort claims
  const filteredAndSortedClaims =
    claims
      ?.filter((claim) => {
        const matchesSearch =
          searchTerm === '' ||
          claim?.claim_number?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          claim?.customer_name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          claim?.customer_email?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          claim?.issue_description?.toLowerCase()?.includes(searchTerm?.toLowerCase())

        const matchesStatus = statusFilter === 'all' || claim?.status === statusFilter
        const matchesPriority = priorityFilter === 'all' || claim?.priority === priorityFilter
        const matchesAssignee =
          assigneeFilter === 'all' ||
          (assigneeFilter === 'unassigned' && !claim?.assigned_to) ||
          claim?.assigned_to === assigneeFilter

        return matchesSearch && matchesStatus && matchesPriority && matchesAssignee
      })
      ?.sort((a, b) => {
        let aValue = a?.[sortBy]
        let bValue = b?.[sortBy]

        // Handle nested objects
        if (sortBy === 'customer_name') {
          aValue = a?.customer_name || ''
          bValue = b?.customer_name || ''
        } else if (sortBy === 'assigned_to_name') {
          aValue = a?.assigned_to_profile?.full_name || ''
          bValue = b?.assigned_to_profile?.full_name || ''
        }

        if (typeof aValue === 'string') {
          return sortOrder === 'asc' ? aValue?.localeCompare(bValue) : bValue?.localeCompare(aValue)
        }

        if (aValue instanceof Date || typeof aValue === 'string') {
          aValue = new Date(aValue)
          bValue = new Date(bValue)
        }

        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }) || []

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading claims management center...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Claims Management Center</h1>
                <p className="text-gray-600 mt-2">
                  Process, review, and resolve customer warranty claims
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadData}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Dashboard */}
          {stats && <ClaimStatsWidget stats={stats} />}

          {/* Main Content */}
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Controls */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search claims by number, customer, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e?.target?.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e?.target?.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e?.target?.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {staff?.map((member) => (
                      <option key={member?.id} value={member?.id}>
                        {member?.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {filteredAndSortedClaims?.length || 0} of {claims?.length || 0} claims
                </p>
                <div className="text-sm text-gray-600">
                  {filteredAndSortedClaims?.filter((claim) => isOverdue(claim))?.length || 0}{' '}
                  overdue claims
                </div>
              </div>
            </div>

            {/* Claims Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('claim_number')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Claim #
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('customer_name')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Customer
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle/Product
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Status
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('priority')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Priority
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('claim_amount')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Amount
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('assigned_to_name')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Assigned To
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      >
                        Created
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedClaims?.map((claim) => (
                    <tr
                      key={claim?.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isOverdue(claim) ? 'bg-red-50' : ''}`}
                      onClick={() => {
                        setSelectedClaim(claim)
                        setShowProcessingModal(true)
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isOverdue(claim) && (
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {claim?.claim_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {claim?.customer_name}
                          </div>
                          <div className="text-sm text-gray-500">{claim?.customer_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {claim?.vehicle && (
                            <div className="flex items-center gap-1">
                              <Car className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-900">
                                {claim?.vehicle?.year} {claim?.vehicle?.make}{' '}
                                {claim?.vehicle?.model}
                              </span>
                            </div>
                          )}
                          {claim?.product && (
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-900">{claim?.product?.name}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(claim?.status)}
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim?.status)}`}
                          >
                            {claim?.status?.replace('_', ' ')?.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getPriorityColor(claim?.priority)}`}
                          />
                          <span className="text-sm text-gray-900 capitalize">
                            {claim?.priority}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {claim?.claim_amount
                              ? parseFloat(claim?.claim_amount)?.toFixed(2)
                              : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {claim?.assigned_to_profile?.full_name || (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(claim?.created_at)?.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getDaysOld(claim?.created_at)} days ago
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e?.stopPropagation()
                              setSelectedClaim(claim)
                              setShowAssignmentModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Assign"
                          >
                            <User className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e?.stopPropagation()
                              setSelectedClaim(claim)
                              setShowProcessingModal(true)
                            }}
                            className="text-gray-600 hover:text-gray-900"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredAndSortedClaims?.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">No claims found matching your filters</p>
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                      setPriorityFilter('all')
                      setAssigneeFilter('all')
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {showProcessingModal && selectedClaim && (
          <ClaimProcessingModal
            claim={selectedClaim}
            staff={staff}
            onClose={() => {
              setShowProcessingModal(false)
              setSelectedClaim(null)
            }}
            onUpdate={handleUpdateClaim}
          />
        )}
        {showAssignmentModal && selectedClaim && (
          <ClaimAssignmentModal
            claim={selectedClaim}
            staff={staff}
            onClose={() => {
              setShowAssignmentModal(false)
              setSelectedClaim(null)
            }}
            onUpdate={handleUpdateClaim}
          />
        )}
      </div>
    </AppLayout>
  )
}

export default ClaimsManagementCenter
