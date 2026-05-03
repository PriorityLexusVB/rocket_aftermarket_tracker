// src/pages/deals/index.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteDeal, getAllDeals, markLoanerReturned } from '../../services/dealService'
import { listByJobId } from '@/services/opportunitiesService'
import { handleAuthError, isTechNoiseMessage } from '@/lib/authErrorHandler'
import { jobService } from '@/services/jobService'
import ExportButton from '../../components/common/ExportButton'
import NewDealModal from './NewDealModal'
import EditDealModal from './components/EditDealModal'
import DealDetailDrawer from './components/DealDetailDrawer'
import { titleCase } from '../../lib/format'
import ScheduleBlock from '../../components/deals/ScheduleBlock'
import { getReopenTargetStatus } from '@/utils/jobStatusTimeRules.js'
import { calculateDealKPIs, getDealFinancials } from '../../utils/dealKpis'

import { useDropdownData } from '../../hooks/useDropdownData'
import Navbar from '../../components/ui/Navbar'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/ToastProvider'

// Extracted sub-components
import {
  StatusPill,
  LoanerBadge,
  Pill,
  CustomerDisplay,
  ServiceLocationTag,
  DraftReminderBanner,
  ErrorAlert,
  DealCoreSnapshot,
  SheetSummaryRow,
  SheetViewTable,
  DeleteConfirmModal,
} from './components/DealPresentational'
import DealsKpiRow from './components/DealsKpiRow'
import DealsFilterBar from './components/DealsFilterBar'

// Extracted helpers
import {
  safeJsonStringify,
  formatCreatedShort,
  formatStaffName,
  toFiniteNumberOrNull,
  formatMoney0OrDash,
  getEtDayKey,
  getDealPromiseIso,
  getPromiseDayKey,
  getDealProductLabelSummary,
  getDealVehicleDisplay,
  getDealPrimaryRef,
  getDisplayPhone,
  isDealsDebugEnabled,
} from './components/dealHelpers'

// Feature flag for Simple Agenda
const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

export default function DealsPage() {
  const toast = useToast?.()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [openOppByJobId, setOpenOppByJobId] = useState({})
  const [showNewDealModal, setShowNewDealModal] = useState(false)
  const [showEditDealModal, setShowEditDealModal] = useState(false)
  const [editingDealId, setEditingDealId] = useState(null)
  const [editingDeal, setEditingDeal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletingDeal, setDeletingDeal] = useState(false)

  // ✅ FIXED: Added missing error state management
  const [error, setError] = useState('')

  const currentMonthKey = getEtDayKey(new Date()).slice(0, 7)

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
    createdMonth: '', // YYYY-MM (ET) — blank means no date restriction by default
    search: '',
  })
  const [searchDebounce, setSearchDebounce] = useState('')
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [selectedDealForDetail, setSelectedDealForDetail] = useState(null)
  const [expandedDealIds, setExpandedDealIds] = useState(() => new Set())
  const [showSheetView, setShowSheetView] = useState(false)

  // ✅ FIXED: Properly use the dropdown hook instead of direct function calls
  const {
    getUserOptions,
    getVendorOptions,
    clearSearch,
    error: dropdownError,
  } = useDropdownData({ loadOnMount: true })

  const navigate = useNavigate()
  const { user } = useAuth()

  // Debug-only: helps confirm the browser is running the latest bundle.
  const didLogDealsDebugInitRef = useRef(false)

  const lastDeletedDealIdRef = useRef(null)
  const lastDeletedAtRef = useRef(0)

  // Guard against rapid double-click triggering duplicate deletes
  const deleteInFlightRef = useRef(false)

  // Guard against rapid double-click triggering duplicate status updates (complete/reopen)
  const statusUpdateInFlightRef = useRef(new Set())

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
    const startedAt = Date.now()
    try {
      if (deleteInFlightRef.current) return
      deleteInFlightRef.current = true

      setDeletingDeal(true)
      setError('') // Clear previous errors

      lastDeletedDealIdRef.current = dealId
      lastDeletedAtRef.current = Date.now()

      if (isDealsDebugEnabled()) {
        console.info(
          '[Deals][delete] start',
          safeJsonStringify({
            dealId,
            at: new Date(lastDeletedAtRef.current).toISOString(),
          })
        )
      }

      await deleteDeal(dealId)

      // Optimistic: remove the deleted row immediately.
      setDeals((prev) => (Array.isArray(prev) ? prev.filter((d) => d?.id !== dealId) : prev))

      // If any UI is currently open for this deal, close it before reloading.
      // This prevents confusing states where a drawer/modal appears to "come back" after deletion.
      const closedUiState = {
        closedDetailDrawer: false,
      }
      if (selectedDealForDetail?.id === dealId) {
        setShowDetailDrawer(false)
        setSelectedDealForDetail(null)
        closedUiState.closedDetailDrawer = true
      }

      if (isDealsDebugEnabled()) {
        console.info(
          '[Deals][delete] success',
          safeJsonStringify({
            dealId,
            durationMs: Date.now() - startedAt,
            ...closedUiState,
          })
        )
      }

      toast?.success?.('Deal deleted')

      setDeleteConfirm(null)
      await loadDeals(0, 'after-delete')
    } catch (e) {
      setError(`Failed to delete deal: ${e?.message}`)
      console.error('Delete error:', e)

      toast?.error?.(e?.message || 'Failed to delete deal')

      if (isDealsDebugEnabled()) {
        console.info(
          '[Deals][delete] failed',
          safeJsonStringify({
            dealId,
            durationMs: Date.now() - startedAt,
            message: e?.message,
          })
        )
      }
    } finally {
      setDeletingDeal(false)
      deleteInFlightRef.current = false
    }
  }
  const handleMarkDealComplete = async (deal) => {
    const dealId = deal?.id
    if (!dealId) return
    const loanerAssignmentId = deal?.loaner_id || null

    // Auto-return the loaner on completion (Deals page no longer has a manual return control).
    if (deal?.has_active_loaner && !loanerAssignmentId) {
      toast?.error?.(
        'Active loaner assignment exists but no assignment id is available. Refresh and try again.'
      )
      return
    }

    // Prevent double-clicks from sending duplicate completion updates.
    if (statusUpdateInFlightRef.current.has(dealId)) return
    statusUpdateInFlightRef.current.add(dealId)

    if (loanerAssignmentId) {
      try {
        await markLoanerReturned(loanerAssignmentId)
      } catch (e) {
        setError(`Failed to auto-return loaner: ${e?.message}`)
        console.error('[Deals] auto-return loaner failed', e)
        toast?.error?.(e?.message || 'Failed to auto-return loaner')
        statusUpdateInFlightRef.current.delete(dealId)
        return
      }
    }

    const previousStatus = deal?.job_status
    const previousCompletedAt = deal?.completed_at

    try {
      const completedAt = new Date().toISOString()
      await jobService.updateStatus(dealId, 'completed', { completed_at: completedAt })

      const undo = async () => {
        try {
          const normalizedPrev = String(previousStatus || '')
            .trim()
            .toLowerCase()
          const fallbackStatus = getReopenTargetStatus(deal, { now: new Date() })
          const undoStatus =
            normalizedPrev === 'quality_check' || normalizedPrev === 'delivered'
              ? normalizedPrev
              : fallbackStatus
          await jobService.updateStatus(dealId, undoStatus, {
            completed_at: previousCompletedAt || null,
          })
          toast?.success?.('Undo successful')
          await loadDeals(0, 'undo-complete')
        } catch (err) {
          console.error('[Deals] undo complete failed', err)
          toast?.error?.('Undo failed')
        }
      }

      toast?.success?.({
        message: 'Completed',
        action: { label: 'Undo', onClick: undo },
        duration: 10000,
      })

      await loadDeals(0, 'mark-complete')
    } catch (e) {
      console.error('[Deals] mark complete failed', e)
      toast?.error?.(e?.message || 'Failed to complete')
    } finally {
      statusUpdateInFlightRef.current.delete(dealId)
    }
  }

  const handleReopenDeal = async (deal) => {
    const dealId = deal?.id
    if (!dealId) return

    if (statusUpdateInFlightRef.current.has(dealId)) return
    statusUpdateInFlightRef.current.add(dealId)

    const targetStatus = getReopenTargetStatus(deal, { now: new Date() })

    try {
      await jobService.updateStatus(dealId, targetStatus, { completed_at: null })

      // Optimistic update for the open drawer (if any)
      setSelectedDealForDetail((prev) =>
        prev?.id === dealId
          ? {
              ...prev,
              job_status: targetStatus,
              completed_at: null,
            }
          : prev
      )

      toast?.success?.('Reopened')
      await loadDeals(0, 'reopen')
    } catch (e) {
      console.error('[Deals] reopen failed', e)
      toast?.error?.(e?.message || 'Failed to reopen')
    } finally {
      statusUpdateInFlightRef.current.delete(dealId)
    }
  }

  // ✅ ADDED: Handle schedule chip click
  const handleScheduleClick = (deal) => {
    if (!deal?.id) return

    // If Simple Agenda is enabled, navigate to agenda with focus parameter
    if (SIMPLE_AGENDA_ENABLED) {
      navigate(`/calendar/agenda?focus=${deal.id}`)
    } else {
      // Otherwise, open edit modal
      handleEditDeal(deal.id)
    }
  }

  // Guards against overlapping loadDeals() calls overwriting state
  const loadDealsRequestIdRef = useRef(0)

  // ✅ FIXED: Enhanced load deals with better error handling and retry logic
  const loadDeals = useCallback(async (retryCount = 0, reason = 'unknown') => {
    const requestId = ++loadDealsRequestIdRef.current
    const startedAt = Date.now()
    const lastDeletedDealId = lastDeletedDealIdRef.current
    const lastDeletedAt = lastDeletedAtRef.current

    const callerHint = isDealsDebugEnabled()
      ? new Error().stack?.split('\n')?.[2]?.trim() || null
      : null

    if (isDealsDebugEnabled()) {
      console.info(
        '[Deals][load] start',
        safeJsonStringify({
          requestId,
          retryCount,
          reason,
          callerHint,
          lastDeletedDealId,
          lastDeletedAgeMs: lastDeletedAt ? Date.now() - lastDeletedAt : null,
        })
      )
    }
    try {
      setLoading(true)
      setError('') // Clear previous errors
      const data = await getAllDeals()

      // Ignore stale responses (e.g., overlapping loads in React 18 StrictMode)
      if (requestId !== loadDealsRequestIdRef.current) {
        if (isDealsDebugEnabled()) {
          console.info(
            '[Deals][load] stale response ignored',
            safeJsonStringify({
              requestId,
              currentRequestId: loadDealsRequestIdRef.current,
              durationMs: Date.now() - startedAt,
              count: Array.isArray(data) ? data.length : null,
              reason,
            })
          )
        }
        return
      }

      if (isDealsDebugEnabled()) {
        const includesLastDeleted =
          !!lastDeletedDealId &&
          Array.isArray(data) &&
          data.some((d) => d?.id === lastDeletedDealId || d?.job_id === lastDeletedDealId)

        const sample = Array.isArray(data)
          ? data.slice(0, 3).map((d) => ({
              id: d?.id,
              primary: getDealPrimaryRef(d),
              customer_needs_loaner: !!d?.customer_needs_loaner,
              loaner_id: d?.loaner_id || null,
              loaner_number: d?.loaner_number || null,
              has_active_loaner: !!d?.has_active_loaner,
            }))
          : null

        console.info(
          '[Deals][load] apply',
          safeJsonStringify({
            requestId,
            durationMs: Date.now() - startedAt,
            count: Array.isArray(data) ? data.length : null,
            includesLastDeleted,
            sample,
            reason,
          })
        )
      }

      setDeals(data || [])
    } catch (e) {
      // Ignore stale errors from superseded requests
      if (requestId !== loadDealsRequestIdRef.current) {
        if (isDealsDebugEnabled()) {
          console.info(
            '[Deals][load] stale error ignored',
            safeJsonStringify({
              requestId,
              currentRequestId: loadDealsRequestIdRef.current,
              durationMs: Date.now() - startedAt,
              message: e?.message,
              reason,
            })
          )
        }
        return
      }

      // If this is a real auth failure (stale JWT, etc.), redirect to /auth.
      if (handleAuthError(e)) return
      const rawMsg = String(e?.message || '')
      const errorMessage = isTechNoiseMessage(rawMsg)
        ? "Couldn't load deals. Please refresh the page. If the problem continues, contact support."
        : rawMsg.startsWith('Failed to load deals')
          ? rawMsg
          : `Failed to load deals: ${rawMsg}`
      console.error('Load deals error:', e)

      if (isDealsDebugEnabled()) {
        console.info(
          '[Deals][load] failed',
          safeJsonStringify({
            requestId,
            durationMs: Date.now() - startedAt,
            message: e?.message,
            reason,
          })
        )
      }

      // Retry logic for network issues
      if (retryCount < 2 && (e?.message?.includes('fetch') || e?.message?.includes('network'))) {
        // Only schedule retries for the latest request
        if (requestId !== loadDealsRequestIdRef.current) return
        setTimeout(() => loadDeals(retryCount + 1, `retry:${reason}`), 1000 * (retryCount + 1))
        return
      }

      setError(errorMessage)
      setDeals([]) // Set empty array on error
    } finally {
      // Only let the latest request control the loading indicator
      if (requestId === loadDealsRequestIdRef.current) {
        setLoading(false)

        if (isDealsDebugEnabled()) {
          console.info(
            '[Deals][load] done (latest)',
            safeJsonStringify({
              requestId,
              durationMs: Date.now() - startedAt,
              reason,
            })
          )
        }
      } else if (isDealsDebugEnabled()) {
        console.info(
          '[Deals][load] done (stale)',
          safeJsonStringify({
            requestId,
            currentRequestId: loadDealsRequestIdRef.current,
            durationMs: Date.now() - startedAt,
            reason,
          })
        )
      }
    }
  }, [])

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
    if (!user?.id) return

    if (isDealsDebugEnabled() && !didLogDealsDebugInitRef.current) {
      didLogDealsDebugInitRef.current = true
      console.info(
        '[Deals][debug] bundle',
        safeJsonStringify({
          marker: '2025-12-30-delete-ui-reset-v1',
          at: new Date().toISOString(),
        })
      )
    }

    loadDeals(0, 'auth-mount')
  }, [user?.id, loadDeals])

  const handleOpenDetail = (deal) => {
    setSelectedDealForDetail(deal)
    setShowDetailDrawer(true)
  }

  // ✅ UPDATED: Enhanced filter deals with 300ms debounced search
  const filteredDeals = deals?.filter((deal) => {
    // Status filter with tab-based logic
    if (filters?.status !== 'All') {
      let targetStatus = filters?.status?.toLowerCase()?.replace(' ', '_')
      // Map UI label "Active" to backend status "in_progress"
      if (targetStatus === 'active') targetStatus = 'in_progress'
      // "Open" is the default view: everything except completed
      if (targetStatus === 'open') {
        if (deal?.job_status === 'completed') return false
      } else if (deal?.job_status !== targetStatus) {
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

      const todayKey = getEtDayKey(new Date())
      const apptKey = deal?.appt_start ? getEtDayKey(deal?.appt_start) : ''
      const promiseKey = getPromiseDayKey(deal)
      const loanerKey = deal?.loaner_eta_return_date
        ? getEtDayKey(deal?.loaner_eta_return_date)
        : ''
      const hasSchedLine = Array.isArray(deal?.job_parts)
        ? deal?.job_parts?.some((p) => p?.requires_scheduling)
        : false
      const hasActiveLoaner = !!(deal?.has_active_loaner || deal?.loaner_id)

      switch (filters?.presetView) {
        case 'Today':
          if (!(apptKey && apptKey === todayKey)) return false
          break
        case 'Past Due':
          if (!(promiseKey && promiseKey < todayKey)) return false
          break
        case 'Unscheduled':
          if (!(hasSchedLine && !apptKey)) return false
          break
        case 'Off-site Today': {
          const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []
          const hasOff = parts.some((p) => p?.is_off_site)
          if (
            !(
              hasOff &&
              ((apptKey && apptKey === todayKey) || (promiseKey && promiseKey === todayKey))
            )
          )
            return false
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
          if (!(hasActiveLoaner && loanerKey && loanerKey === todayKey)) return false
          break
        case 'Loaners Overdue':
          if (!(hasActiveLoaner && loanerKey && loanerKey < todayKey)) return false
          break
        default:
          break
      }
    }

    // Created month filter (ET, YYYY-MM)
    if (filters?.createdMonth) {
      const rawCreated =
        deal?.created_at ||
        deal?.createdAt ||
        deal?.created ||
        deal?.inserted_at ||
        deal?.deal_date ||
        deal?.dealDate ||
        deal?.date ||
        null
      const createdKey = rawCreated ? getEtDayKey(rawCreated) : ''
      if (!createdKey || !createdKey.startsWith(filters.createdMonth)) return false
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
      const todayKey = getEtDayKey(new Date())
      const hasActiveLoaner = !!(deal?.has_active_loaner || deal?.loaner_id)
      const loanerKey = deal?.loaner_eta_return_date
        ? getEtDayKey(deal?.loaner_eta_return_date)
        : null

      switch (filters.loanerStatus) {
        case 'Active':
          if (!hasActiveLoaner) return false
          break
        case 'Due Today':
          if (!(hasActiveLoaner && loanerKey && todayKey && loanerKey === todayKey)) return false
          break
        case 'Overdue':
          if (!(hasActiveLoaner && loanerKey && todayKey && loanerKey < todayKey)) return false
          break
        case 'None':
          if (hasActiveLoaner) return false
          break
        default:
          break
      }
    }

    // Promise date range filter (date-only, YYYY-MM-DD)
    if (filters?.promiseStartDate || filters?.promiseEndDate) {
      const promiseKey = getPromiseDayKey(deal)
      if (!promiseKey) return false
      if (filters?.promiseStartDate && promiseKey < filters.promiseStartDate) return false
      if (filters?.promiseEndDate && promiseKey > filters.promiseEndDate) return false
    }

    // ✅ UPDATED: Search filter with debounced search (matches stock, name, phone with stripped non-digits)
    if (searchDebounce?.trim()) {
      const searchTerm = searchDebounce?.toLowerCase()

      // Strip non-digits for phone matching
      const stripNonDigits = (str) => str?.replace(/\D/g, '') || ''
      const searchDigits = stripNonDigits(searchTerm)

      const searchableFields = [
        deal?.customer_name,
        deal?.customerName,
        deal?.customer_phone,
        deal?.customer_phone_e164,
        deal?.customer_email,
        deal?.customerEmail,
        deal?.job_number,
        deal?.delivery_coordinator_name,
        deal?.sales_consultant_name,
        deal?.finance_manager_name,
        deal?.vehicle?.make,
        deal?.vehicle?.model,
        deal?.vehicle?.owner_name,
        deal?.vehicle?.owner_email,
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

  const kpis = calculateDealKPIs(filteredDeals)

  // Default ordering: most recently added first
  const sortedDeals = React.useMemo(() => {
    const list = Array.isArray(filteredDeals) ? [...filteredDeals] : []

    const toSortMs = (deal) => {
      const raw =
        deal?.created_at ||
        deal?.createdAt ||
        deal?.created ||
        deal?.inserted_at ||
        deal?.deal_date ||
        deal?.dealDate ||
        deal?.date ||
        null
      if (!raw) return 0
      const s = String(raw)
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s
      const ms = Date.parse(iso)
      return Number.isFinite(ms) ? ms : 0
    }

    list.sort((a, b) => {
      const diff = toSortMs(b) - toSortMs(a)
      if (diff !== 0) return diff
      return String(a?.id || '').localeCompare(String(b?.id || ''))
    })

    return list
  }, [filteredDeals])

  useEffect(() => {
    let alive = true
    const ids = (sortedDeals || []).map((deal) => deal?.id).filter(Boolean)
    const missing = ids.filter((id) => openOppByJobId?.[id] == null)
    if (!missing.length) return () => {}
    ;(async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const rows = await listByJobId(id)
            const openCount = (Array.isArray(rows) ? rows : []).filter(
              (row) => (row?.status || 'open') === 'open'
            ).length
            return [id, openCount]
          } catch {
            return [id, 0]
          }
        })
      )

      if (!alive) return
      setOpenOppByJobId((prev) => {
        const next = { ...prev }
        for (const [id, count] of results) {
          next[id] = count
        }
        return next
      })
    })()

    return () => {
      alive = false
    }
  }, [sortedDeals, openOppByJobId])

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
      createdMonth: '',
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
  const handleEditDeal = (dealId) => {
    setEditingDealId(dealId)
    // Preload full deal object from current list for instant modal render
    try {
      const found = (filteredDeals?.length ? filteredDeals : deals)?.find((d) => d?.id === dealId)
      if (found) setEditingDeal(found)
      else setEditingDeal(null)
    } catch {
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
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="p-4 md:p-8" style={{ paddingTop: '5rem' }}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-muted-foreground">Loading deals...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Deals</h1>
          <div className="flex items-center space-x-3">
            <ExportButton
              exportType="jobs"
              filters={{ status: filters?.status }}
              onExportStart={() => {}}
              onExportComplete={() => {}}
              onExportError={(errorMessage) => setError(`Export failed: ${errorMessage}`)}
              variant="outline"
              size="sm"
              className="bg-card border border-border text-foreground hover:bg-accent/50"
              data-testid="export-button"
            />
            <Button
              onClick={() => setShowNewDealModal(true)}
              className="bg-accent/50 hover:bg-accent/75 text-white border border-border px-4 py-2 h-11"
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

        {/* ✅ UPDATED: KPI Row */}
        <DealsKpiRow kpis={kpis} />

        {/* Status tabs and search */}
        <DealsFilterBar
          filters={filters}
          updateFilter={updateFilter}
          clearAllFilters={clearAllFilters}
          showSheetView={showSheetView}
          setShowSheetView={setShowSheetView}
          vendorOptions={vendorOptions}
          salesOptions={salesOptions}
          deliveryOptions={deliveryOptions}
          financeOptions={financeOptions}
          allWorkTags={allWorkTags}
        />

        {/* Results count */}
        <div className="mb-4 text-sm text-muted-foreground flex items-center gap-3">
          <span>
            Showing {sortedDeals?.length} of {deals?.length} deals
            {filters?.search && <span className="ml-2 text-blue-300">(filtered)</span>}
          </span>
          {(() => {
            // Count overdue promises
            const now = new Date()
            const overdueCount =
              sortedDeals?.filter((deal) => {
                const promisedAt = deal?.next_promised_iso
                if (!promisedAt) {
                  // Check job_parts for fallback
                  if (Array.isArray(deal?.job_parts)) {
                    const dates = deal.job_parts.map((p) => p?.promised_date).filter(Boolean)
                    if (dates.length > 0) {
                      const earliest = dates.sort()[0]
                      const dateStr = earliest.includes('T') ? earliest : `${earliest}T00:00:00Z`
                      return new Date(dateStr) < now
                    }
                  }
                  return false
                }
                return new Date(promisedAt) < now
              })?.length || 0

            if (overdueCount > 0) {
              return (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-200">
                  {overdueCount} overdue
                </span>
              )
            }
            return null
          })()}
        </div>

        {/* Desktop/iPad: modern card rows (no horizontal scroll) */}
        <div className="hidden md:block">
          {showSheetView ? (
            sortedDeals?.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-10 text-center">
                <div className="text-foreground font-medium">
                  {(deals?.length || 0) > 0 ? 'No results match your filters' : 'No deals'}
                </div>
                {(deals?.length || 0) > 0 ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground 0"
                    onClick={clearAllFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              <SheetViewTable deals={sortedDeals} onRowClick={handleOpenDetail} />
            )
          ) : sortedDeals?.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-10 text-center">
              <div className="text-foreground font-medium">
                {(deals?.length || 0) > 0 ? 'No results match your filters' : 'No deals'}
              </div>
              {(deals?.length || 0) > 0 ? (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground 0"
                  onClick={clearAllFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedDeals?.map((deal) => {
                const promiseIso = getDealPromiseIso(deal)
                const createdShort = formatCreatedShort(
                  deal?.created_at || deal?.createdAt || deal?.created || deal?.inserted_at
                )
                const isExpanded = expandedDealIds?.has?.(deal?.id)
                const openOppCount = openOppByJobId?.[deal?.id]

                return (
                  <div
                    key={deal?.id}
                    data-testid={`deal-row-${deal?.id}`}
                    className="group cursor-pointer rounded-xl border border-border bg-card 0 px-4 py-4"
                    onClick={() => {
                      if (isDealsDebugEnabled()) {
                        console.info(
                          '[Deals][ui] row click -> open detail',
                          safeJsonStringify({
                            dealId: deal?.id,
                            primary: getDealPrimaryRef(deal),
                            customerNeedsLoaner: !!deal?.customer_needs_loaner,
                            loanerId: deal?.loaner_id || null,
                            loanerNumber: deal?.loaner_number || null,
                          })
                        )
                      }
                      handleOpenDetail(deal)
                    }}
                  >
                    <div className="mb-3">
                      <DealCoreSnapshot deal={deal} />
                    </div>

                    {/* Column order (desktop): Created | Schedule | Customer/Sales | Vehicle | Pills | Actions */}
                    <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                      {/* Created */}
                      <div className="col-span-12 lg:col-span-2 min-w-0">
                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <div className="text-sm text-foreground tabular-nums">
                            {createdShort || '—'}
                          </div>
                          {typeof deal?.age_days === 'number' ? (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {deal?.age_days}d
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Schedule */}
                      <div className="col-span-12 lg:col-span-2 min-w-0">
                        <ScheduleBlock
                          deal={deal}
                          promiseDate={promiseIso}
                          onClick={() => handleScheduleClick?.(deal)}
                          className="w-full"
                        />
                      </div>

                      {/* Customer/Sales */}
                      <div className="col-span-12 lg:col-span-3 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate">
                              <CustomerDisplay deal={deal} />
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {deal?.delivery_coordinator_name ? (
                                <span>{formatStaffName(deal?.delivery_coordinator_name)}</span>
                              ) : null}
                              {deal?.sales_consultant_name ? (
                                <span>{formatStaffName(deal?.sales_consultant_name)}</span>
                              ) : null}
                              {deal?.job_number ? (
                                <span className="tabular-nums">{deal?.job_number}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <div className="flex items-center gap-2">
                              <StatusPill status={deal?.job_status} />
                              {openOppCount > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">
                                  Opps {openOppCount}
                                </span>
                              ) : null}
                              {deal?.job_status === 'completed' ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 border border-emerald-500/20"
                                  title={
                                    deal?.completed_at
                                      ? `Completed: ${formatCreatedShort(deal.completed_at)}`
                                      : 'Completed'
                                  }
                                  aria-label="Completed"
                                >
                                  <Icon name="BadgeCheck" size={14} className="text-emerald-200" />
                                  Completed
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vehicle */}
                      <div className="col-span-12 lg:col-span-1 min-w-0">
                        {(() => {
                          const v = getDealVehicleDisplay(deal)
                          return (
                            <div
                              data-testid={`deal-vehicle-${deal?.id}`}
                              className="truncate text-sm text-foreground"
                              title={v?.title || ''}
                            >
                              {v?.isMissing ? <span className="text-gray-500">—</span> : v?.main}
                              {v?.stock ? (
                                <span className="text-gray-500"> • Stock: {v?.stock}</span>
                              ) : null}
                            </div>
                          )
                        })()}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {getDisplayPhone(deal)}
                        </div>
                        {(() => {
                          const summary = getDealProductLabelSummary(deal, 3)
                          if (!summary.labels.length) return null
                          return (
                            <div
                              className="mt-1 flex flex-wrap items-center gap-1"
                              aria-label={`Products: ${summary.labels.join(', ')}${summary.extraCount ? ` plus ${summary.extraCount} more` : ''}`}
                            >
                              {summary.labels.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex items-center rounded-full 0 px-2 py-0.5 text-[11px] font-medium text-foreground"
                                  title={label}
                                >
                                  {label}
                                </span>
                              ))}
                              {summary.extraCount ? (
                                <span className="inline-flex items-center rounded-full 0 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  +{summary.extraCount}
                                </span>
                              ) : null}
                            </div>
                          )
                        })()}
                      </div>

                      {/* $ | Vendor | Location | Loaner */}
                      <div className="col-span-12 md:col-span-6 lg:col-span-2 min-w-0">
                        <div className="flex flex-col items-start md:items-end gap-2">
                          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                            {(() => {
                              const fin = getDealFinancials(deal)
                              const profitClass =
                                typeof fin.profit === 'number'
                                  ? fin.profit > 0
                                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                    : fin.profit < 0
                                      ? 'bg-red-500/15 text-red-200 border-red-500/20'
                                      : ''
                                  : ''

                              return (
                                <>
                                  <Pill className="tabular-nums whitespace-nowrap">
                                    S {formatMoney0OrDash(fin.sale)} / C{' '}
                                    {formatMoney0OrDash(fin.cost)}
                                  </Pill>
                                  <Pill className={`tabular-nums whitespace-nowrap ${profitClass}`}>
                                    P {formatMoney0OrDash(fin.profit)}
                                  </Pill>
                                </>
                              )
                            })()}
                            {deal?.loaner_number || deal?.has_active_loaner ? (
                              <LoanerBadge deal={deal} />
                            ) : (
                              <Pill className="whitespace-nowrap">Loaner: —</Pill>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                            <ServiceLocationTag jobParts={deal?.job_parts} />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-12 md:col-span-6 lg:col-span-2 min-w-0 justify-self-stretch md:justify-self-end">
                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = deal?.id
                              if (!id) return
                              setExpandedDealIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(id)) next.delete(id)
                                else next.add(id)
                                return next
                              })
                            }}
                            className="h-9 px-3 rounded-lg flex items-center gap-2 border border-border bg-card text-foreground 0 hover:text-white"
                            aria-label={
                              isExpanded ? 'Collapse deal details' : 'Expand deal details'
                            }
                            aria-expanded={!!isExpanded}
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                            data-testid={`deal-expand-${deal?.id}`}
                          >
                            <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} />
                            <span className="text-xs font-semibold">Details</span>
                          </button>

                          <div className="inline-flex items-center justify-end gap-1 rounded-lg border border-border bg-card p-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditDeal(deal?.id)
                              }}
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white 0"
                              aria-label="Edit deal"
                              title="Edit deal"
                            >
                              <span className="sr-only">Edit</span>
                              <Icon name="Pencil" size={16} />
                            </button>

                            {deal?.job_status !== 'completed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkDealComplete(deal)
                                }}
                                className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white 0"
                                aria-label="Complete job"
                                title="Complete"
                              >
                                <span className="sr-only">Complete</span>
                                <Icon name="BadgeCheck" size={16} />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setError('')
                                setDeleteConfirm(deal)
                              }}
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white 0"
                              aria-label="Delete deal"
                              title="Delete deal"
                            >
                              <span className="sr-only">Delete</span>
                              <Icon name="Trash2" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div
                        className="mt-4 rounded-xl border border-border bg-card p-4"
                        role="region"
                        aria-label="Deal details"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Items purchased
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = deal?.id
                              if (!id) return
                              setExpandedDealIds((prev) => {
                                const next = new Set(prev)
                                next.delete(id)
                                return next
                              })
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            aria-label="Close deal details"
                          >
                            Close
                          </button>
                        </div>

                        {Array.isArray(deal?.job_parts) && deal.job_parts.length > 0 ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                            <table className="w-full text-sm bg-card text-foreground">
                              <thead className="bg-card text-xs text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Op</th>
                                  <th className="px-3 py-2 text-left font-medium">Product</th>
                                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                                  <th className="px-3 py-2 text-right font-medium">Price</th>
                                  <th className="px-3 py-2 text-right font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[rgb(var(--border))]">
                                {deal.job_parts.map((p) => {
                                  const op =
                                    (p?.product?.op_code || p?.product?.opCode || p?.op_code || '')
                                      ?.toString?.()
                                      ?.trim?.()
                                      ?.toUpperCase?.() || ''
                                  const name =
                                    p?.product?.name || p?.product_name || p?.productLabel || '—'
                                  const qtyRaw = p?.quantity_used ?? p?.quantity ?? 1
                                  const qtyNum = Number(qtyRaw)
                                  const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1
                                  const unit = toFiniteNumberOrNull(p?.unit_price)
                                  const total =
                                    toFiniteNumberOrNull(p?.total_price) ??
                                    (typeof unit === 'number' ? unit * qty : null)

                                  return (
                                    <tr
                                      key={p?.id || `${name}-${op}`}
                                      className="bg-card 0"
                                    >
                                      <td className="px-3 py-2 text-xs font-mono tabular-nums text-foreground">
                                        {op || '—'}
                                      </td>
                                      <td className="px-3 py-2 text-foreground">{name}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                        {qty}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                        {formatMoney0OrDash(unit)}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                        {formatMoney0OrDash(total)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-muted-foreground">No line items found.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ✅ UPDATED: Mobile Cards with enhanced styling and loaner support */}
        {(() => {
          const IS_TEST = import.meta.env?.VITEST || import.meta.env?.MODE === 'test'
          if (IS_TEST) return null // Avoid duplicate content in test DOM assertions
          return (
            <div className="md:hidden space-y-4">
              {sortedDeals?.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center">
                  <div className="text-muted-foreground">
                    {filters?.status === 'All'
                      ? 'No deals found'
                      : `No ${filters?.status?.toLowerCase()} deals found`}
                  </div>
                </div>
              ) : (
                sortedDeals?.map((deal) => {
                  const openOppCount = openOppByJobId?.[deal?.id]
                  return (
                    <div
                      key={deal?.id}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="p-4 border-b border-border bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {formatCreatedShort(
                                deal?.created_at ||
                                  deal?.createdAt ||
                                  deal?.created ||
                                  deal?.inserted_at
                              ) || '—'}
                              {typeof deal?.age_days === 'number' ? (
                                <span className="ml-2 tabular-nums">{deal?.age_days}d</span>
                              ) : null}
                              {deal?.job_number ? (
                                <span className="ml-2 tabular-nums" title={getDealPrimaryRef(deal)}>
                                  {deal?.job_number}
                                </span>
                              ) : null}
                            </div>
                            <div className="font-medium text-foreground">
                              {deal?.customer_name || '—'}
                              {isDealsDebugEnabled() && deal?.id ? (
                                <span className="ml-2 text-[10px] text-gray-500">
                                  id…{String(deal.id).slice(-6)}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {deal?.sales_consultant_name
                                ? formatStaffName(deal?.sales_consultant_name)
                                : deal?.delivery_coordinator_name
                                  ? formatStaffName(deal?.delivery_coordinator_name)
                                  : '—'}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground truncate">
                              {(deal?.vehicle
                                ? titleCase(
                                    `${deal?.vehicle?.year || ''} ${deal?.vehicle?.make || ''} ${deal?.vehicle?.model || ''}`.trim()
                                  )
                                : '') || '—'}
                              {deal?.vehicle?.stock_number ? (
                                <span className="text-gray-500">
                                  {' '}
                                  • Stock: {deal?.vehicle?.stock_number}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground truncate">
                              {deal?.customer_phone_e164 ||
                              deal?.customer_phone ||
                              deal?.customer_mobile ? (
                                <a
                                  href={`tel:${deal?.customer_phone_e164 || deal?.customer_phone || deal?.customer_mobile}`}
                                  onClick={(e) => e?.stopPropagation?.()}
                                  className="underline"
                                >
                                  {getDisplayPhone(deal)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusPill status={deal?.job_status} />
                            {openOppCount > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">
                                Opps {openOppCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Card Content with compact 3-line mobile layout */}
                      <div className="p-4 space-y-2">
                        <SheetSummaryRow deal={deal} dense />

                        {/* Unified schedule (no duplicate Promise / Appt Window) */}
                        <div>
                          <ScheduleBlock
                            deal={deal}
                            promiseDate={getDealPromiseIso(deal)}
                            onClick={() => handleScheduleClick?.(deal)}
                            className="w-full"
                          />

                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {(() => {
                              const summary = getDealProductLabelSummary(deal, 2)
                              if (!summary.labels.length) return null
                              const label = `${summary.labels.join(', ')}${summary.extraCount ? ` +${summary.extraCount}` : ''}`
                              return <Pill>Items: {label}</Pill>
                            })()}
                            <ServiceLocationTag jobParts={deal?.job_parts} />
                            {deal?.loaner_number || deal?.has_active_loaner ? (
                              <LoanerBadge deal={deal} />
                            ) : (
                              <Pill>Loaner: —</Pill>
                            )}
                            {(() => {
                              const fin = getDealFinancials(deal)
                              const profitClass =
                                typeof fin.profit === 'number'
                                  ? fin.profit > 0
                                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                    : fin.profit < 0
                                      ? 'bg-red-500/15 text-red-200 border-red-500/20'
                                      : ''
                                  : ''

                              return (
                                <>
                                  <Pill className="tabular-nums">
                                    S {formatMoney0OrDash(fin.sale)} / C{' '}
                                    {formatMoney0OrDash(fin.cost)}
                                  </Pill>
                                  <Pill className={`tabular-nums ${profitClass}`}>
                                    P {formatMoney0OrDash(fin.profit)}
                                  </Pill>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* ✅ FIXED: Enhanced mobile footer with proper loaner actions */}
                      <div className="p-4 border-t border-border bg-card">
                        {/* Primary actions row */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditDeal(deal?.id)}
                            className="h-11 w-full bg-card border border-border text-foreground 0"
                            aria-label="Edit deal"
                          >
                            <Icon name="Edit" size={16} className="mr-2" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setError('')
                              setDeleteConfirm(deal)
                            }}
                            className="h-11 w-full bg-red-500/10 border border-red-500/20 text-red-200 hover:bg-red-500/20"
                            aria-label="Delete deal"
                          >
                            <Icon name="Trash2" size={16} className="mr-2" />
                            Delete
                          </Button>
                        </div>

                        {/* ✅ FIXED: Loaner actions row with proper conditions */}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })()}

        {/* ✅ UPDATED: New Deal Modal */}
        <NewDealModal
          isOpen={showNewDealModal}
          onClose={() => setShowNewDealModal(false)}
          onSuccess={(savedDeal) => {
            if (savedDeal && savedDeal?.id) {
              // In-place add: prepend the new deal to the list
              setDeals((prev) => [savedDeal, ...prev])
            } else {
              // Fallback: refetch all
              loadDeals()
            }
          }}
        />

        {/* Edit Deal Modal */}
        <EditDealModal
          isOpen={showEditDealModal}
          dealId={editingDealId}
          deal={editingDeal}
          onClose={closeEditModal}
          onSuccess={(savedDeal) => {
            if (savedDeal && savedDeal?.id) {
              // In-place update: replace the deal in the list
              setDeals((prev) => prev.map((d) => (d.id === savedDeal.id ? savedDeal : d)))
            } else {
              // Fallback: refetch all
              loadDeals()
            }
            closeEditModal()
          }}
        />

        {/* ✅ UPDATED: Delete Confirmation Modal */}
        <DeleteConfirmModal
          deleteConfirm={deleteConfirm}
          error={error}
          deletingDeal={deletingDeal}
          onDelete={handleDeleteDeal}
          onCancel={() => setDeleteConfirm(null)}
        />

        {/* Deal Detail Drawer (read-only) */}
        <DealDetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => {
            setShowDetailDrawer(false)
            setSelectedDealForDetail(null)
          }}
          deal={selectedDealForDetail}
          onComplete={handleMarkDealComplete}
          onReopen={handleReopenDeal}
        />
      </div>
    </div>
  )
}
