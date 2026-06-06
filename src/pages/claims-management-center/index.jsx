import React, { useState, useEffect } from 'react'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import { claimsService } from '../../services/claimsService'
import { handleAuthError } from '@/lib/authErrorHandler'
import ClaimProcessingModal from './components/ClaimProcessingModal'
import ClaimStatsWidget from './components/ClaimStatsWidget'
import NewClaimModal from './components/NewClaimModal'
import AppLayout from '../../components/layouts/AppLayout'

const ClaimsManagementCenter = () => {
  const [claims, setClaims] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)

  // Filters and search
  // Wave XXX-AH hotfix-1 (Codex BLOCKER E): parse ?status=X URL param on
  // mount so the navbar New Claims pill's deep-link actually filters to
  // submitted claims. Falls back to 'all' if param missing/invalid.
  const initialStatusFromUrl = (() => {
    if (typeof window === 'undefined') return 'all'
    try {
      const p = new URLSearchParams(window.location.search).get('status')
      const valid = ['all', 'submitted', 'under_review', 'approved', 'denied', 'resolved']
      return p && valid.includes(p) ? p : 'all'
    } catch {
      return 'all'
    }
  })()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatusFromUrl)
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Wave XXX-AG: Active/Completed tabs. Default Active = work-queue view.
  // Completed = archive view with totals strip.
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'completed'
  const [showNewClaimModal, setShowNewClaimModal] = useState(false)

  // Wave XXX-AH hotfix-1 (Codex REQUIRED J): when on /claims-management-center
  // and a new claim arrives via realtime, refresh the page's claims list so
  // the user doesn't have to manually refresh.
  useEffect(() => {
    const unsubscribe = claimsService?.subscribeToClaims?.(() => {
      loadData()
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [claimsData, statsData] = await Promise.all([
        claimsService?.getAllClaims(),
        claimsService?.getClaimsStats(),
      ])

      setClaims(claimsData || [])
      setStats(statsData)
    } catch (err) {
      console.error('Error loading claims data:', err)
      if (handleAuthError(err, 'claims')) return
      setError("Couldn't load claims. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  // Wave XXX-AI: hard-delete a claim via claimsService.deleteClaim
  const handleDeleteClaim = async (claimId) => {
    try {
      const { success, error } = await claimsService.deleteClaim(claimId)
      if (!success) throw new Error(error || 'Could not delete claim')
      setShowProcessingModal(false)
      setSelectedClaim(null)
      await loadData()
    } catch (err) {
      setError(err?.message || 'Failed to delete claim')
    }
  }

  const handleUpdateClaim = async (claimId, updates) => {
    try {
      const updatedClaim = await claimsService?.updateClaim(claimId, updates)
      setClaims((prev) => prev?.map((claim) => (claim?.id === claimId ? updatedClaim : claim)))
      setSelectedClaim(updatedClaim)
      // Wave XXX-AI hotfix-1 (Codex REQUIRED F): when a claim is resolved,
      // auto-switch to the Completed tab so the user can SEE where the claim
      // went instead of it silently disappearing from the Active view.
      if (updates?.status === 'resolved' && activeTab !== 'completed') {
        setActiveTab('completed')
      }
    } catch (err) {
      console.error('Error updating claim:', err)
      if (handleAuthError(err, 'claims')) return
      setError("Couldn't update claim. Try again.")
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
        return <CheckCircle className="w-4 h-4 text-slate-500" />
      default:
        return <Clock className="w-4 h-4 text-slate-500" />
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
        return 'bg-slate-100 text-slate-800'
      default:
        return 'bg-slate-100 text-slate-800'
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
        return 'bg-slate-500'
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

        // Wave XXX-AG: tab-based partition. Active hides resolved; Completed shows only resolved.
        if (activeTab === 'active' && claim?.status === 'resolved') {
          return false
        }
        if (activeTab === 'completed' && claim?.status !== 'resolved') {
          return false
        }

        return matchesSearch && matchesStatus && matchesPriority
      })
      ?.sort((a, b) => {
        let aValue = a?.[sortBy]
        let bValue = b?.[sortBy]

        // Handle nested objects
        if (sortBy === 'customer_name') {
          aValue = a?.customer_name || ''
          bValue = b?.customer_name || ''
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

  // Wave XXX-AG: tab-aware total for the summary line
  const tabTotal =
    activeTab === 'active'
      ? claims?.filter((c) => c?.status !== 'resolved')?.length || 0
      : claims?.filter((c) => c?.status === 'resolved')?.length || 0

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading claims management center...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card shadow-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Claims</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Process, review, and resolve customer warranty claims
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadData}
                  className="px-4 py-2 text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClaimModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Claim
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

          {/* Active / Completed tab pills */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {['active', 'completed'].map((tab) => {
              const active = activeTab === tab
              const label = tab === 'active' ? 'Active Claims' : 'Completed'
              const count = tab === 'active'
                ? claims.filter(c => c?.status !== 'resolved').length
                : claims.filter(c => c?.status === 'resolved').length
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${
                    active ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Totals strip — visible only on Completed tab */}
          {activeTab === 'completed' && (() => {
            const completedClaims = claims.filter(c => c?.status === 'resolved')
            const count = completedClaims.length
            const totalPayout = completedClaims.reduce((sum, c) => sum + (Number(c?.claim_amount) || 0), 0)
            // Wave XXX-AG hotfix-1 (Codex REQUIRED B): avg-resolution math was
            // distorted — divided totalDays by full count even when many claims
            // had null resolved_at. Now divide by claims with BOTH timestamps;
            // show "N/A" if zero usable.
            const claimsWithTimestamps = completedClaims.filter(
              (c) => c?.created_at && c?.resolved_at,
            )
            const totalResolutionDays = claimsWithTimestamps.reduce((sum, c) => {
              const days =
                (new Date(c.resolved_at) - new Date(c.created_at)) / (1000 * 60 * 60 * 24)
              return sum + Math.max(0, days)
            }, 0)
            const avgResolutionDays =
              claimsWithTimestamps.length > 0
                ? (totalResolutionDays / claimsWithTimestamps.length)
                : null
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Resolved</div>
                  <div className="text-2xl font-bold text-emerald-900 mt-0.5">{count}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Total Payout</div>
                  <div className="text-2xl font-bold text-blue-900 mt-0.5">
                    ${totalPayout.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Avg Resolution</div>
                  <div className="text-2xl font-bold text-amber-900 mt-0.5">
                    {avgResolutionDays === null
                      ? <span className="text-base">N/A</span>
                      : <>{avgResolutionDays.toFixed(1)} <span className="text-base font-medium">days</span></>}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Main Content */}
          <div className="mt-4 bg-card rounded-xl shadow-sm border border-border">
            {/* Controls */}
            <div className="p-6 border-b border-border">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search claims by number, customer, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      const v = e?.target?.value
                      setStatusFilter(v)
                      // Wave XXX-AG hotfix-1 (Codex REQUIRED A): auto-switch tab
                      // so the status filter doesn't contradict the tab gate
                      // and silently show zero rows.
                      if (v === 'resolved' && activeTab !== 'completed') {
                        setActiveTab('completed')
                      } else if (v !== 'resolved' && v !== 'all' && activeTab !== 'active') {
                        setActiveTab('active')
                      }
                    }}
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredAndSortedClaims?.length || 0} of {tabTotal}{' '}
                  {activeTab === 'active' ? 'active' : 'completed'} claims
                </p>
                <div className="text-sm text-muted-foreground">
                  {filteredAndSortedClaims?.filter((claim) => isOverdue(claim))?.length || 0}{' '}
                  overdue claims
                </div>
              </div>
            </div>

            {/* Claims Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('claim_number')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Claim #
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('customer_name')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Customer
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Vehicle/Product
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Status
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('priority')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Priority
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('claim_amount')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Amount
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                      >
                        Created
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredAndSortedClaims?.map((claim) => (
                    <tr
                      key={claim?.id}
                      className={`hover:bg-muted/40 cursor-pointer ${isOverdue(claim) ? 'bg-red-50' : ''}`}
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
                          <span className="text-sm font-medium text-foreground">
                            {claim?.claim_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {claim?.customer_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{claim?.customer_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {claim?.vehicle && (
                            <div className="flex items-center gap-1">
                              <Car className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground">
                                {claim?.vehicle?.year} {claim?.vehicle?.make}{' '}
                                {claim?.vehicle?.model}
                              </span>
                            </div>
                          )}
                          {claim?.product && (
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground">{claim?.product?.name}</span>
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
                          <span className="text-sm text-foreground capitalize">
                            {claim?.priority}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {claim?.claim_amount
                              ? parseFloat(claim?.claim_amount)?.toFixed(2)
                              : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {new Date(claim?.created_at)?.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getDaysOld(claim?.created_at)} days ago
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e?.stopPropagation()
                              setSelectedClaim(claim)
                              setShowProcessingModal(true)
                            }}
                            className="text-muted-foreground hover:text-foreground"
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

              <p className="px-6 py-2 text-xs text-muted-foreground">
                † Claims older than 7 days are flagged overdue.
              </p>

              {filteredAndSortedClaims?.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">No claims found matching your filters</p>
                  <button
                    onClick={() => {
                      // Wave XXX-AG hotfix-1 (Codex REQUIRED I): clear-filters
                      // should ONLY reset filter inputs, NOT yank the user out
                      // of the tab they're intentionally viewing.
                      setSearchTerm('')
                      setStatusFilter('all')
                      setPriorityFilter('all')
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
            onClose={() => {
              setShowProcessingModal(false)
              setSelectedClaim(null)
            }}
            onUpdate={handleUpdateClaim}
            onDelete={handleDeleteClaim}
          />
        )}
        <NewClaimModal
          isOpen={showNewClaimModal}
          onClose={() => setShowNewClaimModal(false)}
          // Wave XXX-AG hotfix-1 (Codex RECOMMENDED G+J): modal calls onClose
          // itself after onCreated, so we don't double-close here. Also await
          // loadData so the refresh runs to completion before the modal teardown.
          onCreated={async () => {
            await loadData()
          }}
        />
      </div>
    </AppLayout>
  )
}

export default ClaimsManagementCenter
