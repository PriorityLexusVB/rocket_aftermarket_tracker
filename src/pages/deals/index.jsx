// src/pages/deals/index.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllDeals, markLoanerReturned } from '../../services/dealService'
import ExportButton from '../../components/common/ExportButton'
import NewDealModal from './NewDealModal'
import EditDealModal from './components/EditDealModal'
import DealDetailDrawer from './components/DealDetailDrawer'

import { useDropdownData } from '../../hooks/useDropdownData'
import Navbar from '../../components/ui/Navbar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'

// ✅ UPDATED: StatusPill with enhanced styling
const StatusPill = ({ status }) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const color = statusColors?.[status] || 'bg-gray-100 text-gray-700'
  const displayStatus = status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN'

  return <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>{displayStatus}</span>
}

// Small helper: "2h ago", "3d ago" fallback to date if invalid
const relativeTimeFromNow = (iso) => {
  try {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const diff = Date.now() - d.getTime()
    const sec = Math.floor(diff / 1000)
    const min = Math.floor(sec / 60)
    const hr = Math.floor(min / 60)
    const day = Math.floor(hr / 24)
    if (day > 0) return `${day}d ago`
    if (hr > 0) return `${hr}h ago`
    if (min > 0) return `${min}m ago`
    return 'just now'
  } catch (_) {
    return '—'
  }
}

// ✅ ADDED: Helper to format names as "Lastname, F."
const formatStaffName = (fullName) => {
  if (!fullName) return ''
  const parts = fullName?.trim()?.split(' ')
  if (parts?.length < 2) return fullName

  const firstName = parts?.[0]
  const lastName = parts?.slice(1)?.join(' ')
  const firstInitial = firstName?.[0]?.toUpperCase()

  return `${lastName}, ${firstInitial}.`
}

// ✅ UPDATED: Next promised chip with <24h amber and overdue red; accepts ISO datetime
const NextPromisedChip = ({ nextPromisedAt }) => {
  if (!nextPromisedAt) {
    return <span className="text-xs text-gray-500">—</span>
  }

  const now = new Date()
  const due = new Date(nextPromisedAt)
  const diffMs = due - now
  const isOverdue = diffMs < 0
  const isSoon = diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000 // <24h

  const urgencyClass = isOverdue
    ? 'bg-red-100 text-red-800 border-red-200'
    : isSoon
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-green-100 text-green-800 border-green-200'

  const short = new Date(nextPromisedAt)?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${urgencyClass}`}
    >
      Next: {short}
    </span>
  )
}

// ✅ UPDATED: Service Location Tag with exact colors per checklist (#22c55e in-house / blue off-site)
const ServiceLocationTag = ({ serviceType, jobParts }) => {
  // Check if any line items are off-site to determine vendor status
  const hasOffSiteItems = jobParts?.some((part) => part?.is_off_site)
  const hasOnSiteItems = jobParts?.some((part) => !part?.is_off_site)

  if (hasOffSiteItems && hasOnSiteItems) {
    return (
      <div className="flex flex-col space-y-1">
        <span
          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
          style={{ backgroundColor: '#3b82f6' }}
        >
          🏢 Off-Site
        </span>
        <span
          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
          style={{ backgroundColor: '#22c55e' }}
        >
          🏠 In-House
        </span>
      </div>
    )
  }

  if (hasOffSiteItems) {
    return (
      <span
        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
        style={{ backgroundColor: '#3b82f6' }}
      >
        🏢 Off-Site
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
      style={{ backgroundColor: '#22c55e' }}
    >
      🏠 In-House
    </span>
  )
}

// ✅ UPDATED: Enhanced draft reminder with improved styling
const DraftReminderBanner = ({ draftsCount, onViewDrafts }) => {
  const [dismissed, setDismissed] = useState(false)

  if (draftsCount === 0 || dismissed) return null

  return (
    <div
      className="mb-6 p-4 rounded-lg border"
      style={{ backgroundColor: '#FEF3C7', borderColor: '#F3E8A3', color: '#92400E' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Icon name="AlertCircle" size={20} style={{ color: '#D97706' }} />
          </div>
          <div>
            <p className="font-medium">Draft – needs details</p>
            <p className="text-sm">
              You have {draftsCount} draft deal{draftsCount > 1 ? 's' : ''} to complete.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewDrafts}
            style={{ color: '#92400E' }}
            className="hover:bg-yellow-100"
            aria-label="View draft deals"
          >
            View drafts
          </Button>
          <button onClick={() => setDismissed(true)} className="p-1" style={{ color: '#F59E0B' }}>
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Safe display helpers to replace deprecated deal.title usage
const getDealPrimaryRef = (deal) => {
  if (!deal) return '—'
  if (deal?.job_number) return deal.job_number
  if (deal?.id) return `Job-${String(deal.id).slice(0, 8)}`
  return '—'
}

const getDealSubtitle = (deal) => {
  if (!deal) return ''
  return deal?.customer_name || ''
}

// ✅ UPDATED: Mobile-friendly customer display with enhanced tap-to-call and SMS
const CustomerDisplay = ({ deal }) => {
  if (!deal?.customer_name && !deal?.customer_phone) {
    return <span className="text-xs text-gray-500">—</span>
  }

  return (
    <div className="space-y-1">
      {deal?.customer_name && (
        <div className="font-medium text-sm text-slate-900">{deal?.customer_name}</div>
      )}
      {deal?.customer_phone && (
        <a
          href={`tel:${deal?.customer_phone}`}
          className="text-xs text-slate-500 hover:text-blue-600 underline"
          onClick={(e) => e?.stopPropagation()}
        >
          {deal?.customer_phone}
        </a>
      )}
    </div>
  )
}

// ✅ UPDATED: Value display with currency formatting
const ValueDisplay = ({ amount }) => {
  const value = parseFloat(amount) || 0
  return (
    <div className="text-right">
      <span className="text-sm font-medium text-slate-900">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        })?.format(value)}
      </span>
    </div>
  )
}

// ✅ UPDATED: Enhanced Loaner Badge component for tracker rows (teal active, red outline when overdue)
const LoanerBadge = ({ deal }) => {
  if (!deal?.loaner_number) {
    return null
  }

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const due = deal?.loaner_eta_return_date ? new Date(deal?.loaner_eta_return_date) : null
  const isOverdue = !!(due && due < startOfToday)

  const baseClasses = 'inline-flex items-center px-2 py-1 rounded text-xs font-medium border'
  const colorClasses = isOverdue
    ? 'bg-white text-red-700 border-red-300'
    : 'bg-teal-100 text-teal-800 border-teal-200'

  const copyLoaner = async (e) => {
    e?.stopPropagation?.()
    try {
      await navigator.clipboard.writeText(String(deal?.loaner_number))
      console.log('Loaner number copied')
    } catch (err) {
      console.warn('Clipboard copy failed', err)
    }
  }

  return (
    <span
      className={`${baseClasses} ${colorClasses} cursor-pointer`}
      onClick={copyLoaner}
      title="Click to copy loaner number"
    >
      🚗 Loaner #{deal?.loaner_number}
      {deal?.loaner_eta_short && <span className="ml-1">• due {deal?.loaner_eta_short}</span>}
    </span>
  )
}

// ✅ FIXED: Loaner Drawer Component with enhanced mobile functionality
const LoanerDrawer = ({ isOpen, onClose, deal, onSave, loading }) => {
  const [loanerForm, setLoanerForm] = useState({
    loaner_number: '',
    eta_return_date: '',
    notes: '',
  })
  const [error, setError] = useState('')

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (isOpen && deal) {
      // Compute default ETA as the latest scheduled promised_date if none exists yet
      let defaultEta = ''
      try {
        const dates = (deal?.job_parts || [])
          .filter((p) => p?.requires_scheduling && p?.promised_date)
          .map((p) => new Date(p.promised_date))
        if (dates?.length > 0) {
          const latest = new Date(Math.max.apply(null, dates))
          // format YYYY-MM-DD for date input
          defaultEta = latest.toISOString().split('T')[0]
        }
      } catch (_) {}

      // Pre-populate if loaner exists; otherwise use computed default for ETA
      setLoanerForm({
        loaner_number: deal?.loaner_number || '',
        eta_return_date: deal?.loaner_eta_return_date || defaultEta || '',
        notes: deal?.loaner_notes || '',
      })
      setError('')
    } else if (!isOpen) {
      setLoanerForm({ loaner_number: '', eta_return_date: '', notes: '' })
      setError('')
    }
  }, [isOpen, deal])

  const handleSave = async () => {
    setError('')

    if (!loanerForm?.loaner_number?.trim()) {
      setError('Loaner number is required')
      return
    }

    if (!loanerForm?.eta_return_date) {
      setError('ETA return date is required')
      return
    }

    try {
      await onSave({
        job_id: deal?.id,
        loaner_number: loanerForm?.loaner_number?.trim(),
        eta_return_date: loanerForm?.eta_return_date,
        notes: loanerForm?.notes?.trim() || null,
      })
      onClose() // Close drawer on successful save
    } catch (err) {
      setError(err?.message || 'Failed to save loaner assignment')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />

      {/* Drawer - Mobile-first light theme only */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Loaner Assignment</h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close drawer">
              <Icon name="X" size={20} />
            </Button>
          </div>

          {/* Deal Info */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-sm text-slate-900 mb-2">Deal Information</h4>
            <p className="text-sm text-slate-600">{getDealPrimaryRef(deal)}</p>
            <p className="text-xs text-slate-500">{getDealSubtitle(deal)}</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError('')}
                className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form with light theme inputs */}
          <div className="space-y-4">
            {/* Loaner Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Loaner Number *
              </label>
              <input
                type="text"
                value={loanerForm?.loaner_number}
                onChange={(e) =>
                  setLoanerForm((prev) => ({ ...prev, loaner_number: e?.target?.value }))
                }
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 123"
                required
              />
            </div>

            {/* ETA Return Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expected Return Date *
              </label>
              <input
                type="date"
                value={loanerForm?.eta_return_date}
                onChange={(e) =>
                  setLoanerForm((prev) => ({ ...prev, eta_return_date: e?.target?.value }))
                }
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date()?.toISOString()?.split('T')?.[0]}
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={loanerForm?.notes}
                onChange={(e) => setLoanerForm((prev) => ({ ...prev, notes: e?.target?.value }))}
                className="bg-white border border-slate-200 rounded-lg w-full px-3 py-2 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Optional notes about the loaner vehicle..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11" disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={
                loading || !loanerForm?.loaner_number?.trim() || !loanerForm?.eta_return_date
              }
            >
              {loading ? 'Saving...' : 'Save Loaner'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ✅ ADDED: Mark Returned Modal Component
const MarkReturnedModal = ({ loaner, onClose, onConfirm, loading }) => {
  if (!loaner) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Mark Loaner Returned</h3>
          <p className="text-slate-600 mb-6">
            Mark loaner <strong>#{loaner?.loaner_number}</strong> as returned?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={loading}
              aria-label="Cancel marking loaner as returned"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
              disabled={loading}
              aria-label="Confirm loaner returned"
            >
              {loading ? 'Processing...' : 'Mark Returned'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DealsPage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewDealModal, setShowNewDealModal] = useState(false)
  const [showEditDealModal, setShowEditDealModal] = useState(false)
  const [editingDealId, setEditingDealId] = useState(null)
  const [editingDeal, setEditingDeal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // ✅ FIXED: Added missing error state management
  const [error, setError] = useState('')

  // ✅ UPDATED: Status tabs & quick search with enhanced filtering
  const [filters, setFilters] = useState({
    status: 'All',
    presetView: 'All',
    salesAssigned: null,
    deliveryAssigned: null,
    financeAssigned: null,
    vendor: null,
    location: 'All', // All | In-House | Off-Site | Mixed
    workTags: [], // array of strings
    loanerStatus: 'All', // All | Active | Due Today | Overdue | None
    promiseStartDate: '', // YYYY-MM-DD
    promiseEndDate: '', // YYYY-MM-DD
    search: '',
  })

  // ✅ ADDED: Loaner management state
  const [showLoanerDrawer, setShowLoanerDrawer] = useState(false)
  const [selectedDealForLoaner, setSelectedDealForLoaner] = useState(null)
  const [loanerLoading, setLoanerLoading] = useState(false)
  const [markReturnedModal, setMarkReturnedModal] = useState(null)
  const [returningLoaner, setReturningLoaner] = useState(false)
  const [searchDebounce, setSearchDebounce] = useState('')
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [selectedDealForDetail, setSelectedDealForDetail] = useState(null)

  // ✅ FIXED: Properly use the dropdown hook instead of direct function calls
  const {
    getUserOptions,
    getVendorOptions,
    clearSearch,
    loading: dropdownLoading,
    error: dropdownError,
    refresh: refreshDropdowns,
  } = useDropdownData({ loadOnMount: true })

  const navigate = useNavigate()
  const { user } = useAuth()

  // ✅ ADDED: Saved views state (localStorage persistence)
  const [savedViews, setSavedViews] = useState([])
  const [selectedSavedView, setSelectedSavedView] = useState('')

  // ✅ FIXED: Replace direct function calls with hook-based calls
  const getSalesConsultants = () => {
    try {
      return (
        getUserOptions({
          roles: ['staff'],
          departments: ['Sales Consultants'],
          activeOnly: true,
        }) || []
      )
    } catch (err) {
      console.error('Error getting sales consultants:', err)
      return []
    }
  }

  const getDeliveryCoordinators = () => {
    try {
      return (
        getUserOptions({
          roles: ['admin', 'manager'],
          departments: ['Delivery Coordinator'],
          activeOnly: true,
        }) || []
      )
    } catch (err) {
      console.error('Error getting delivery coordinators:', err)
      return []
    }
  }

  const getFinanceManagers = () => {
    try {
      return (
        getUserOptions({
          roles: ['staff'],
          departments: ['Finance Manager'],
          activeOnly: true,
        }) || []
      )
    } catch (err) {
      console.error('Error getting finance managers:', err)
      return []
    }
  }

  const getSafeVendorOptions = (filterOptions = {}) => {
    try {
      return getVendorOptions(filterOptions) || []
    } catch (err) {
      console.error('Error getting vendor options:', err)
      return []
    }
  }

  // ✅ FIXED: Enhanced delete function with proper error handling
  const handleDeleteDeal = async (dealId) => {
    try {
      setError('') // Clear previous errors
      const { error: deleteError } = await supabase?.rpc('delete_job_cascade', { p_job_id: dealId })
      if (deleteError) throw deleteError

      setDeleteConfirm(null)
      await loadDeals()
    } catch (e) {
      setError(`Failed to delete deal: ${e?.message}`)
      console.error('Delete error:', e)
    }
  }

  // ✅ FIXED: Enhanced loaner assignment with better error handling and modal state management
  const handleSaveLoaner = async (loanerData) => {
    try {
      setLoanerLoading(true)
      setError('') // Clear previous errors

      // Insert or update loaner assignment without relying on ON CONFLICT
      let existing = null
      try {
        const { data: rows } = await supabase
          ?.from('loaner_assignments')
          ?.select('id')
          ?.eq('job_id', loanerData?.job_id)
          ?.is('returned_at', null)
          ?.limit(1)
        existing = Array.isArray(rows) ? rows[0] : rows
      } catch (_) {}

      if (existing?.id) {
        const { error: updErr } = await supabase
          ?.from('loaner_assignments')
          ?.update({
            loaner_number: loanerData?.loaner_number,
            eta_return_date: loanerData?.eta_return_date,
            notes: loanerData?.notes,
          })
          ?.eq('id', existing.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase?.from('loaner_assignments')?.insert([
          {
            job_id: loanerData?.job_id,
            loaner_number: loanerData?.loaner_number,
            eta_return_date: loanerData?.eta_return_date,
            notes: loanerData?.notes,
          },
        ])
        if (insErr) throw insErr
      }

      // ✅ FIXED: Properly close drawer and reset state
      setShowLoanerDrawer(false)
      setSelectedDealForLoaner(null)
      await loadDeals() // Refresh data
    } catch (e) {
      const errorMessage = `Failed to save loaner assignment: ${e?.message}`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoanerLoading(false)
    }
  }

  // ✅ FIXED: Enhanced mark returned with better error handling
  const handleMarkLoanerReturned = async (loanerData) => {
    try {
      setReturningLoaner(true)
      setError('') // Clear previous errors
      await markLoanerReturned(loanerData?.loaner_id)
      setMarkReturnedModal(null)
      await loadDeals() // Refresh data
    } catch (e) {
      setError(`Failed to mark loaner as returned: ${e?.message}`)
      console.error('Mark returned error:', e)
    } finally {
      setReturningLoaner(false)
    }
  }

  // ✅ FIXED: Enhanced load deals with better error handling and retry logic
  const loadDeals = async (retryCount = 0) => {
    try {
      setLoading(true)
      setError('') // Clear previous errors
      const data = await getAllDeals()
      setDeals(data || [])
    } catch (e) {
      const errorMessage = `Failed to load deals: ${e?.message}`
      console.error('Load deals error:', e)

      // Retry logic for network issues
      if (retryCount < 2 && (e?.message?.includes('fetch') || e?.message?.includes('network'))) {
        console.log(`Retrying load deals (attempt ${retryCount + 1})`)
        setTimeout(() => loadDeals(retryCount + 1), 1000 * (retryCount + 1))
        return
      }

      setError(errorMessage)
      setDeals([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  // ✅ ADDED: Initialize status from URL parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const statusParam = urlParams?.get('status')
    if (statusParam) {
      const statusValue = statusParam?.charAt(0)?.toUpperCase() + statusParam?.slice(1)
      setFilters((prev) => ({ ...prev, status: statusValue }))
    }
  }, [])

  useEffect(() => {
    loadDeals()
  }, [])

  // ✅ ADDED: Load saved views from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dealsSavedViews')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSavedViews(parsed)
      }
    } catch (_) {}
  }, [])

  // ✅ FIXED: Properly use the dropdown hook instead of direct function calls
  const loadDropdownData = async () => {
    await refreshDropdowns()
  }

  // ✅ FIXED: Move handleManageLoaner function to proper location inside component
  const handleManageLoaner = (deal) => {
    setSelectedDealForLoaner(deal)
    setShowLoanerDrawer(true)
  }

  const handleOpenDetail = (deal) => {
    setSelectedDealForDetail(deal)
    setShowDetailDrawer(true)
  }

  // ✅ FIXED: Enhanced error display component
  const ErrorAlert = ({ message, onClose }) => {
    if (!message) return null

    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex justify-between items-start">
          <div className="flex">
            <Icon name="AlertCircle" size={20} className="text-red-500 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Error</h4>
              <p className="text-sm text-red-700 mt-1">{message}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-600"
              aria-label="Dismiss error"
            >
              <Icon name="X" size={16} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ✅ UPDATED: Calculate KPIs with proper safety checks
  const calculateKPIs = (dealsData) => {
    const safeDeals = dealsData || []

    const activeJobs = safeDeals?.filter((d) => d?.job_status === 'in_progress')?.length || 0

    const totalRevenue = safeDeals?.reduce((sum, deal) => {
      const revenue = parseFloat(deal?.total_amount) || 0
      return sum + revenue
    }, 0)

    // Estimate 25% profit margin
    const totalProfit = totalRevenue * 0.25
    const margin = totalRevenue > 0 ? 25.0 : 0

    const pendingJobs = safeDeals?.filter((d) => d?.job_status === 'pending')?.length || 0

    const totalDrafts = safeDeals?.filter((d) => d?.job_status === 'draft')?.length || 0

    return {
      active: activeJobs,
      revenue: totalRevenue?.toFixed(2) || '0.00',
      profit: totalProfit?.toFixed(2) || '0.00',
      margin: margin?.toFixed(1) || '0.0',
      pending: pendingJobs,
      drafts: totalDrafts,
    }
  }

  const kpis = calculateKPIs(deals)

  // ✅ UPDATED: Enhanced filter deals with 300ms debounced search
  const filteredDeals = deals?.filter((deal) => {
    // Status filter with tab-based logic
    if (filters?.status !== 'All') {
      let targetStatus = filters?.status?.toLowerCase()?.replace(' ', '_')
      // Map UI label "Active" to backend status "in_progress"
      if (targetStatus === 'active') targetStatus = 'in_progress'
      if (deal?.job_status !== targetStatus) {
        return false
      }
    }

    // Preset views filter
    if (filters?.presetView && filters?.presetView !== 'All') {
      const now = new Date()
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)

      const apptStart = deal?.appt_start ? new Date(deal?.appt_start) : null
      const promiseAt = deal?.next_promised_iso ? new Date(deal?.next_promised_iso) : null
      const loanerDue = deal?.loaner_eta_return_date ? new Date(deal?.loaner_eta_return_date) : null
      const hasSchedLine = Array.isArray(deal?.job_parts)
        ? deal?.job_parts?.some((p) => p?.requires_scheduling)
        : false
      const hasActiveLoaner = !!(deal?.has_active_loaner || deal?.loaner_id)

      switch (filters?.presetView) {
        case 'Today':
          if (!(apptStart && apptStart >= startOfToday && apptStart <= endOfToday)) return false
          break
        case 'Past Due':
          if (!(promiseAt && promiseAt < now)) return false
          break
        case 'Unscheduled':
          if (!(hasSchedLine && !apptStart)) return false
          break
        case 'Off-site Today': {
          const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []
          const hasOff = parts.some((p) => p?.is_off_site)
          const isToday = (d) => d && d >= startOfToday && d <= endOfToday
          if (!(hasOff && (isToday(apptStart) || isToday(promiseAt)))) return false
          break
        }
        case 'Awaiting Vendor/Parts': {
          const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []
          const awaiting = parts.some((p) => p?.requires_scheduling && !p?.promised_date)
          if (!awaiting) return false
          break
        }
        case 'Completed—awaiting pickup':
          if (!(deal?.job_status === 'completed' && (deal?.has_active_loaner || deal?.loaner_id)))
            return false
          break
        case 'My Deals':
          if (!(deal?.assigned_to && user?.id && deal.assigned_to === user.id)) return false
          break
        case 'Loaners Out':
          if (!hasActiveLoaner) return false
          break
        case 'Loaners Due':
          if (
            !(hasActiveLoaner && loanerDue && loanerDue >= startOfToday && loanerDue <= endOfToday)
          )
            return false
          break
        case 'Loaners Overdue':
          if (!(hasActiveLoaner && loanerDue && loanerDue < startOfToday)) return false
          break
        default:
          break
      }
    }

    // Sales assigned filter
    if (filters?.salesAssigned && deal?.assigned_to !== filters?.salesAssigned) {
      return false
    }

    // Delivery assigned filter
    if (filters?.deliveryAssigned && deal?.delivery_coordinator_id !== filters?.deliveryAssigned) {
      return false
    }

    // Finance assigned filter
    if (filters?.financeAssigned && deal?.finance_manager_id !== filters?.financeAssigned) {
      return false
    }

    // Vendor filter
    if (filters?.vendor && deal?.vendor_id !== filters?.vendor) {
      return false
    }

    // Location filter
    if (filters?.location && filters?.location !== 'All') {
      const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []
      const hasOff = parts.some((p) => p?.is_off_site)
      const hasOn = parts.some((p) => !p?.is_off_site)
      const loc = hasOff && hasOn ? 'Mixed' : hasOff ? 'Off-Site' : 'In-House'
      if (loc !== filters.location) return false
    }

    // Work tags filter (ANY match)
    if (filters?.workTags?.length) {
      const tags = Array.isArray(deal?.work_tags) ? deal.work_tags : []
      const intersects = filters.workTags.some((t) => tags.includes(t))
      if (!intersects) return false
    }

    // Loaner status filter
    if (filters?.loanerStatus && filters?.loanerStatus !== 'All') {
      const now = new Date()
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)
      const hasActiveLoaner = !!(deal?.has_active_loaner || deal?.loaner_id)
      const loanerDue = deal?.loaner_eta_return_date ? new Date(deal?.loaner_eta_return_date) : null

      switch (filters.loanerStatus) {
        case 'Active':
          if (!hasActiveLoaner) return false
          break
        case 'Due Today':
          if (
            !(hasActiveLoaner && loanerDue && loanerDue >= startOfToday && loanerDue <= endOfToday)
          )
            return false
          break
        case 'Overdue':
          if (!(hasActiveLoaner && loanerDue && loanerDue < startOfToday)) return false
          break
        case 'None':
          if (hasActiveLoaner) return false
          break
        default:
          break
      }
    }

    // Promise date range filter
    if (filters?.promiseStartDate || filters?.promiseEndDate) {
      const promiseAt = deal?.next_promised_iso ? new Date(deal?.next_promised_iso) : null
      if (!promiseAt) return false
      if (filters?.promiseStartDate) {
        const start = new Date(filters.promiseStartDate + 'T00:00:00')
        if (promiseAt < start) return false
      }
      if (filters?.promiseEndDate) {
        const end = new Date(filters.promiseEndDate + 'T23:59:59.999')
        if (promiseAt > end) return false
      }
    }

    // ✅ UPDATED: Search filter with debounced search (matches stock, name, phone with stripped non-digits)
    if (searchDebounce?.trim()) {
      const searchTerm = searchDebounce?.toLowerCase()

      // Strip non-digits for phone matching
      const stripNonDigits = (str) => str?.replace(/\D/g, '') || ''
      const searchDigits = stripNonDigits(searchTerm)

      const searchableFields = [
        deal?.customer_name,
        deal?.customer_phone,
        deal?.customer_email,
        deal?.job_number,
        deal?.vehicle?.make,
        deal?.vehicle?.model,
        deal?.vehicle?.stock_number || deal?.stock_no,
        deal?.description,
      ]?.filter(Boolean)

      const hasMatch = searchableFields?.some((field) => {
        const fieldStr = field?.toLowerCase()
        // Standard text match
        if (fieldStr?.includes(searchTerm)) return true
        // Phone number digit match
        if (searchDigits?.length >= 3 && stripNonDigits(fieldStr)?.includes(searchDigits))
          return true
        return false
      })

      if (!hasMatch) return false
    }

    return true
  })

  // ✅ ADDED: 300ms debounced search implementation
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(filters?.search)
    }, 300)

    return () => clearTimeout(timer)
  }, [filters?.search])

  // ✅ UPDATED: Update filter function with URL parameter support
  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))

    // Update URL for status filter
    if (key === 'status') {
      const searchParams = new URLSearchParams(window.location.search)
      if (value === 'All') {
        searchParams?.delete('status')
      } else {
        searchParams?.set('status', value?.toLowerCase())
      }
      const newUrl = `${window.location?.pathname}${searchParams?.toString() ? '?' + searchParams?.toString() : ''}`
      window.history?.replaceState({}, '', newUrl)
    }
  }

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      status: 'All',
      presetView: 'All',
      salesAssigned: null,
      deliveryAssigned: null,
      financeAssigned: null,
      vendor: null,
      location: 'All',
      workTags: [],
      loanerStatus: 'All',
      promiseStartDate: '',
      promiseEndDate: '',
      search: '',
    })
    clearSearch()

    // Clear URL params
    window.history?.replaceState({}, '', window.location?.pathname)
  }

  // ✅ ADDED: Unique work tags across current dataset
  const allWorkTags = React.useMemo(() => {
    const set = new Set()
    for (const d of deals || []) {
      for (const t of d?.work_tags || []) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [deals])

  // ✅ ADDED: Vendor and staff options
  const vendorOptions = getSafeVendorOptions({ activeOnly: true })
  const salesOptions = getSalesConsultants()
  const deliveryOptions = getDeliveryCoordinators()
  const financeOptions = getFinanceManagers()

  // ✅ ADDED: Saved views helpers
  const saveCurrentView = () => {
    try {
      const name = window.prompt('Save view as:')
      if (!name || !name.trim()) return
      const view = { name: name.trim(), filters }
      const next = [...savedViews.filter((v) => v.name !== view.name), view]
      setSavedViews(next)
      localStorage.setItem('dealsSavedViews', JSON.stringify(next))
      setSelectedSavedView(view.name)
    } catch (e) {
      console.error('saveCurrentView failed', e)
    }
  }

  const applySavedView = (name) => {
    setSelectedSavedView(name)
    const view = savedViews.find((v) => v.name === name)
    if (view?.filters) setFilters(view.filters)
  }

  const deleteSavedView = () => {
    if (!selectedSavedView) return
    const next = savedViews.filter((v) => v.name !== selectedSavedView)
    setSavedViews(next)
    localStorage.setItem('dealsSavedViews', JSON.stringify(next))
    setSelectedSavedView('')
  }

  const handleEditDeal = (dealId) => {
    setEditingDealId(dealId)
    // Preload full deal object from current list for instant modal render
    try {
      const found = (filteredDeals?.length ? filteredDeals : deals)?.find((d) => d?.id === dealId)
      if (found) setEditingDeal(found)
      else setEditingDeal(null)
    } catch (_) {
      setEditingDeal(null)
    }
    setShowEditDealModal(true)
  }

  const closeEditModal = () => {
    setShowEditDealModal(false)
    setEditingDealId(null)
    setEditingDeal(null)
  }

  // ✅ FIXED: Enhanced loading state without dropdown dependency
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <div className="p-4 md:p-8" style={{ paddingTop: '5rem' }}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-slate-600">Loading deals...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ✅ FIXED: Ensure navbar is always visible */}
      <Navbar />
      <div className="p-4 md:p-8 max-w-7xl mx-auto" style={{ paddingTop: '5rem' }}>
        {/* ✅ FIXED: Error display */}
        <ErrorAlert
          message={error || dropdownError}
          onClose={() => {
            setError('')
          }}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Deal Tracker</h1>
          <div className="flex items-center space-x-3">
            <ExportButton
              exportType="jobs"
              filters={{ status: filters?.status }}
              onExportStart={() => console.log('Starting export...')}
              onExportComplete={(recordCount, filename) =>
                console.log(`Export complete: ${recordCount} records`)
              }
              onExportError={(errorMessage) => setError(`Export failed: ${errorMessage}`)}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50"
            />
            <Button
              onClick={() => setShowNewDealModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-11"
              aria-label="Create new deal"
            >
              <Icon name="Plus" size={16} className="mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* ✅ UPDATED: Draft reminder banner */}
        <DraftReminderBanner
          draftsCount={kpis?.drafts}
          onViewDrafts={() => updateFilter('status', 'Draft')}
        />

        {/* ✅ UPDATED: KPI Row - Enhanced with profit analysis */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* Active Jobs */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-100 mr-4">
                  <Icon name="Clock" size={24} className="text-orange-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Active
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.active}</p>
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100 mr-4">
                  <Icon name="DollarSign" size={24} className="text-green-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Revenue
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">${kpis?.revenue}</p>
                </div>
              </div>
            </div>

            {/* Profit */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100 mr-4">
                  <Icon name="TrendingUp" size={24} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Profit
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">${kpis?.profit}</p>
                </div>
              </div>
            </div>

            {/* Margin */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100 mr-4">
                  <Icon name="Percent" size={24} className="text-purple-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Margin
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.margin}%</p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-yellow-100 mr-4">
                  <Icon name="Clock" size={24} className="text-yellow-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Pending
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.pending}</p>
                </div>
              </div>
            </div>

            {/* Drafts */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-gray-100 mr-4">
                  <Icon name="File" size={24} className="text-gray-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">
                    Drafts
                  </h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.drafts}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ FIXED: Status tabs & enhanced dropdown filters */}
        <div className="mb-6 bg-white rounded-lg border p-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'Draft', 'Pending', 'Active', 'Completed']?.map((status) => (
              <button
                key={status}
                onClick={() => updateFilter('status', status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    filters?.status === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Preset Views */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              'All',
              'Today',
              'Past Due',
              'Unscheduled',
              'Off-site Today',
              'Awaiting Vendor/Parts',
              'Completed—awaiting pickup',
              'My Deals',
              'Loaners Out',
              'Loaners Due',
              'Loaners Overdue',
            ]?.map((view) => (
              <button
                key={view}
                onClick={() => updateFilter('presetView', view)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${
                      filters?.presetView === view
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* ✅ UPDATED: Search box with 300ms debounce, matches stock, name, phone (strip non-digits) */}
            <div className="flex-1">
              <div className="relative">
                <Icon
                  name="Search"
                  size={16}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search deals, customers, vehicles..."
                  value={filters?.search}
                  onChange={(e) => updateFilter('search', e?.target?.value)}
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 pl-9 pr-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-600 hover:text-slate-800"
                aria-label="Clear all filters"
              >
                <Icon name="X" size={16} className="mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* ✅ ADDED: Advanced filters row */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vendor */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.vendor || ''}
                onChange={(e) => updateFilter('vendor', e.target.value || null)}
              >
                <option value="">All</option>
                {vendorOptions.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sales */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sales</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.salesAssigned || ''}
                onChange={(e) => updateFilter('salesAssigned', e.target.value || null)}
              >
                <option value="">All</option>
                {salesOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Finance */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Finance</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.financeAssigned || ''}
                onChange={(e) => updateFilter('financeAssigned', e.target.value || null)}
              >
                <option value="">All</option>
                {financeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.deliveryAssigned || ''}
                onChange={(e) => updateFilter('deliveryAssigned', e.target.value || null)}
              >
                <option value="">All</option>
                {deliveryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
              >
                {['All', 'In-House', 'Off-Site', 'Mixed'].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Loaner */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Loaner</label>
              <select
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                value={filters.loanerStatus}
                onChange={(e) => updateFilter('loanerStatus', e.target.value)}
              >
                {['All', 'Active', 'Due Today', 'Overdue', 'None'].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Promise Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Promise from
                </label>
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                  value={filters.promiseStartDate}
                  onChange={(e) => updateFilter('promiseStartDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Promise to</label>
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3"
                  value={filters.promiseEndDate}
                  onChange={(e) => updateFilter('promiseEndDate', e.target.value)}
                />
              </div>
            </div>

            {/* Work tags (multi-select) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Work tags</label>
              <select
                multiple
                className="bg-white border border-slate-200 rounded-lg w-full min-h-[44px] px-3 py-2"
                value={filters.workTags}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
                  updateFilter('workTags', selected)
                }}
              >
                {allWorkTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ ADDED: Saved views controls */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">Saved views</label>
            <select
              className="bg-white border border-slate-200 rounded-lg h-9 px-3"
              value={selectedSavedView}
              onChange={(e) => applySavedView(e.target.value)}
            >
              <option value="">— Select view —</option>
              {savedViews.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={saveCurrentView}>
              Save current
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={deleteSavedView}
              disabled={!selectedSavedView}
            >
              Delete selected
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-600">
          Showing {filteredDeals?.length} of {deals?.length} deals
          {(filters?.salesAssigned ||
            filters?.deliveryAssigned ||
            filters?.financeAssigned ||
            filters?.vendor ||
            filters?.location !== 'All' ||
            (filters?.workTags && filters?.workTags.length) ||
            filters?.loanerStatus !== 'All' ||
            filters?.promiseStartDate ||
            filters?.promiseEndDate ||
            filters?.search) && <span className="ml-2 text-blue-600">(filtered)</span>}
        </div>

        {/* ✅ UPDATED: Desktop Table with expanded At-a-Glance columns */}
        <div className="hidden md:block bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Promise
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Appt Window
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  $/Margin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Work
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Loaner
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredDeals?.map((deal) => (
                <tr
                  key={deal?.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleOpenDetail(deal)}
                >
                  <td className="px-6 py-4">
                    <StatusPill status={deal?.job_status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">
                      {typeof deal?.age_days === 'number' ? `${deal?.age_days}d` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <NextPromisedChip nextPromisedAt={deal?.next_promised_iso} />
                  </td>
                  <td className="px-6 py-4">
                    {deal?.appt_start ? (
                      <span className="text-sm text-slate-700">
                        {new Date(deal?.appt_start).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' • '}
                        {new Date(deal?.appt_start).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {'–'}
                        {deal?.appt_end
                          ? new Date(deal?.appt_end).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <CustomerDisplay deal={deal} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">
                      {deal?.customer_phone_e164 || deal?.customer_phone || '—'}
                      {deal?.customer_phone_last4 ? (
                        <span className="text-slate-400">
                          {' '}
                          ({`…${deal?.customer_phone_last4}`})
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">
                      {deal?.vehicle
                        ? `${deal?.vehicle?.year || ''} ${deal?.vehicle?.make || ''} ${deal?.vehicle?.model || ''}`.trim()
                        : '—'}
                      {deal?.vehicle?.stock_number ? (
                        <span className="text-slate-400">
                          {' '}
                          • Stock: {deal?.vehicle?.stock_number}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <ValueDisplay amount={deal?.total_amount} />
                      <span className="text-xs text-slate-500">
                        est.{' '}
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format((parseFloat(deal?.total_amount) || 0) * 0.25)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(deal?.work_tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {tag}
                        </span>
                      ))}
                      {(!deal?.work_tags || deal?.work_tags?.length === 0) && (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">
                      {deal?.vendor_name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <ServiceLocationTag
                      serviceType={deal?.service_type}
                      jobParts={deal?.job_parts}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">
                      {relativeTimeFromNow(deal?.created_at)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {deal?.loaner_number || deal?.has_active_loaner ? (
                      <LoanerBadge deal={deal} />
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditDeal(deal?.id)
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        aria-label="Edit deal"
                      >
                        Edit
                      </Button>

                      {/* ✅ FIXED: Loaner management for desktop with proper condition */}
                      {deal?.customer_needs_loaner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleManageLoaner(deal)
                          }}
                          className="text-purple-600 hover:text-purple-800"
                          aria-label="Manage loaner"
                        >
                          Loaner
                        </Button>
                      )}

                      {/* Mark returned button for active loaners */}
                      {deal?.loaner_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()

                            setMarkReturnedModal({
                              loaner_id: deal?.loaner_id,
                              loaner_number: deal?.loaner_number,
                              job_title: getDealPrimaryRef(deal),
                            })
                          }}
                          className="text-green-600 hover:text-green-800"
                          aria-label="Mark loaner returned"
                        >
                          Return
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(deal)
                        }}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Delete deal"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ✅ UPDATED: Mobile Cards with enhanced styling and loaner support */}
        <div className="md:hidden space-y-4">
          {filteredDeals?.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <div className="text-slate-500">
                {filters?.status === 'All'
                  ? 'No deals found'
                  : `No ${filters?.status?.toLowerCase()} deals found`}
              </div>
            </div>
          ) : (
            filteredDeals?.map((deal) => (
              <div key={deal?.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Card Header */}
                <div className="p-4 border-b bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-slate-900">{getDealPrimaryRef(deal)}</div>
                      <div className="text-sm text-slate-600">{getDealSubtitle(deal) || '—'}</div>
                    </div>
                    <StatusPill status={deal?.job_status} />
                  </div>
                </div>

                {/* Card Content with compact 3-line mobile layout */}
                <div className="p-4 space-y-2">
                  {/* Line 1: Customer + Phone */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900 text-sm">
                        {deal?.customer_name || '—'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {deal?.customer_phone ? (
                          <a
                            href={`tel:${deal?.customer_phone}`}
                            onClick={(e) => e?.stopPropagation?.()}
                            className="underline"
                          >
                            {deal?.customer_phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0">
                      <ServiceLocationTag
                        serviceType={deal?.service_type}
                        jobParts={deal?.job_parts}
                      />
                    </div>
                  </div>

                  {/* Line 2: Vehicle + Vendor */}
                  <div className="text-xs text-slate-600 truncate">
                    {(deal?.vehicle
                      ? `${deal?.vehicle?.year || ''} ${deal?.vehicle?.make || ''} ${deal?.vehicle?.model || ''}`.trim()
                      : '') || '—'}
                    {deal?.vehicle?.stock_number ? (
                      <span className="text-slate-400">
                        {' '}
                        • Stock: {deal?.vehicle?.stock_number}
                      </span>
                    ) : null}
                    {deal?.vendor_name ? (
                      <span className="text-slate-400"> • {deal?.vendor_name}</span>
                    ) : null}
                  </div>

                  {/* Line 3: Promise + Appt Window + Loaner */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span data-testid="mobile-next-chip">
                      <NextPromisedChip nextPromisedAt={deal?.next_promised_iso} />
                    </span>
                    {deal?.appt_start && (
                      <span className="text-xs text-slate-700" data-testid="mobile-appt-window">
                        {new Date(deal?.appt_start).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' • '}
                        {new Date(deal?.appt_start).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {'–'}
                        {deal?.appt_end
                          ? new Date(deal?.appt_end).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    )}
                    {(deal?.loaner_number || deal?.has_active_loaner) && (
                      <LoanerBadge deal={deal} />
                    )}
                  </div>
                </div>

                {/* ✅ FIXED: Enhanced mobile footer with proper loaner actions */}
                <div className="p-4 border-t bg-slate-50">
                  {/* Primary actions row */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditDeal(deal?.id)}
                      className="h-11 w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      aria-label="Edit deal"
                    >
                      <Icon name="Edit" size={16} className="mr-2" />
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirm(deal)}
                      className="h-11 w-full bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      aria-label="Delete deal"
                    >
                      <Icon name="Trash2" size={16} className="mr-2" />
                      Delete
                    </Button>
                  </div>

                  {/* ✅ FIXED: Loaner actions row with proper conditions */}
                  {(deal?.customer_needs_loaner || deal?.loaner_id) && (
                    <div className="grid grid-cols-2 gap-2">
                      {deal?.customer_needs_loaner && !deal?.loaner_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageLoaner(deal)}
                          className="h-11 w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          aria-label="Manage loaner"
                        >
                          <Icon name="Car" size={16} className="mr-2" />
                          Assign Loaner
                        </Button>
                      )}

                      {deal?.loaner_id && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManageLoaner(deal)}
                            className="h-11 w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                            aria-label="Edit loaner"
                          >
                            <Icon name="Edit" size={16} className="mr-2" />
                            Edit Loaner
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setMarkReturnedModal({
                                loaner_id: deal?.loaner_id,
                                loaner_number: deal?.loaner_number,
                                job_title: getDealPrimaryRef(deal),
                              })
                            }
                            className="h-11 w-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            aria-label="Mark loaner returned"
                          >
                            <Icon name="CheckCircle" size={16} className="mr-2" />
                            Mark Returned
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ✅ UPDATED: New Deal Modal */}
        <NewDealModal
          isOpen={showNewDealModal}
          onClose={() => setShowNewDealModal(false)}
          onSuccess={loadDeals}
        />

        {/* Edit Deal Modal */}
        <EditDealModal
          isOpen={showEditDealModal}
          dealId={editingDealId}
          deal={editingDeal}
          onClose={closeEditModal}
          onSuccess={() => {
            loadDeals()
            closeEditModal()
          }}
        />

        {/* ✅ UPDATED: Delete Confirmation Modal with light theme */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Delete Deal</h3>
                <p className="text-slate-600 mb-6">
                  Delete deal and its line items? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 h-11"
                    aria-label="Cancel deletion"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteDeal(deleteConfirm?.id)}
                    className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                    aria-label="Confirm deletion"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ADDED: Loaner Drawer with improved error handling */}
        <LoanerDrawer
          isOpen={showLoanerDrawer}
          onClose={() => {
            setShowLoanerDrawer(false)
            setSelectedDealForLoaner(null)
            setError('') // Clear any drawer-related errors
          }}
          deal={selectedDealForLoaner}
          onSave={handleSaveLoaner}
          loading={loanerLoading}
        />

        {/* Deal Detail Drawer (read-only) */}
        <DealDetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => {
            setShowDetailDrawer(false)
            setSelectedDealForDetail(null)
          }}
          deal={selectedDealForDetail}
        />

        {/* Mark Loaner Returned Modal */}
        <MarkReturnedModal
          loaner={markReturnedModal}
          onClose={() => {
            setMarkReturnedModal(null)
            setError('') // Clear any modal-related errors
          }}
          onConfirm={() => handleMarkLoanerReturned(markReturnedModal)}
          loading={returningLoaner}
        />
      </div>
    </div>
  )
}
