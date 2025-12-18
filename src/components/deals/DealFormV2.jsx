// src/components/deals/DealFormV2.jsx
// Shared two-step wizard form for Create and Edit modes
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import useTenant from '../../hooks/useTenant'
import dealService, { getCapabilities } from '../../services/dealService'
import { draftToCreatePayload, draftToUpdatePayload } from './formAdapters'
import { vehicleService } from '../../services/vehicleService'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { titleCase } from '../../lib/format'
import { combineDateAndTime, toDateInputValue, toTimeInputValue } from '../../utils/dateTimeUtils'
import {
  getSalesConsultants,
  getDeliveryCoordinators,
  getFinanceManagers,
  getVendors,
  getProducts,
} from '../../services/dropdownService'

// Centralized VIN validation schema
import { vinSchema } from '../../utils/claimSchemas'

// Guard flag for auto-earliest-window feature (disabled by default to avoid test conflicts)
const ENABLE_AUTO_EARLIEST_WINDOW = false

export default function DealFormV2({ mode = 'create', job = null, onSave, onCancel }) {
  const { user } = useAuth()
  const { orgId, loading: tenantLoading } = useTenant()
  const loanerRef = useRef(null)
  const initializedJobId = useRef(null)
  const userHasEdited = useRef(false) // Track if user has made intentional edits
  const savingRef = useRef(false) // Synchronous in-flight guard to prevent double-submit
  const [currentStep, setCurrentStep] = useState(1) // 1 = Customer, 2 = Line Items
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Dropdown state
  const [dropdownData, setDropdownData] = useState({
    salesConsultants: [],
    deliveryCoordinators: [],
    financeManagers: [],
    vendors: [],
    products: [],
    loading: true,
    error: null,
  })

  // Removed autocomplete feature per user request - it was interfering with typing

  // Customer form data
  const [customerData, setCustomerData] = useState({
    customerName: job?.customer_name || '',
    dealDate: job?.deal_date || new Date().toISOString().slice(0, 10),
    jobNumber: job?.job_number || '',
    stockNumber: job?.stock_number || '',
    vin: job?.vehicle?.vin || '',
    customerMobile: job?.customer_phone || '',
    customerEmail: job?.customer_email || '',
    vendorId: job?.vendor_id || null,
    notes: job?.notes || job?.description || '', // Notes field with legacy fallback
    vehicleDescription: job?.vehicle_description || '',
    assignedTo: job?.assigned_to || null,
    deliveryCoordinator: job?.delivery_coordinator_id || null,
    financeManager: job?.finance_manager_id || null,
    needsLoaner: Boolean(job?.customer_needs_loaner),
    loanerNumber: job?.loaner_number || '',
    loanerReturnDate: toDateInputValue(job?.eta_return_date) || '',
    loanerNotes: job?.loaner_notes || '',
  })

  // Line items data - initialize empty, will be populated by useEffect when job loads
  // ✅ FIX: Don't initialize from job prop to avoid potential duplication from useState + useEffect
  const [lineItems, setLineItems] = useState([])

  // Load dropdown data
  const loadDropdownData = async () => {
    try {
      setDropdownData((prev) => ({ ...prev, loading: true, error: null }))

      const [sales, dc, finance, vendorsOpts, productsOpts] = await Promise.all([
        getSalesConsultants().catch(() => []),
        getDeliveryCoordinators().catch(() => []),
        getFinanceManagers().catch(() => []),
        getVendors({ activeOnly: true }).catch(() => []),
        getProducts({ activeOnly: true }).catch(() => []),
      ])

      setDropdownData({
        salesConsultants: sales,
        deliveryCoordinators: dc,
        financeManagers: finance,
        vendors: vendorsOpts,
        products: productsOpts?.map((p) => ({ ...p, unitPrice: p?.unit_price })),
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error('Failed to load dropdown data:', err)
      setDropdownData((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load dropdown data.',
      }))
    }
  }

  useEffect(() => {
    loadDropdownData()
  }, [])

  // ✅ FIX: Reload customer data and line items from job prop when it changes in edit mode
  // This ensures that when EditDealModal loads deal data asynchronously, the form picks it up
  // GUARD: Only hydrate once per job to prevent duplication
  useEffect(() => {
    if (job && mode === 'edit' && job.id && initializedJobId.current !== job.id) {
      // If switching to a different job, reset the edit tracking to allow fresh rehydration
      // This handles the case where user navigates between different deals
      if (initializedJobId.current !== null) {
        userHasEdited.current = false
      }
      
      initializedJobId.current = job.id
      
      // Apply titleCase normalization immediately when loading job data in edit mode
      const customerName = job?.customer_name || job?.customerName || ''
      const vehicleDescription = job?.vehicle_description || job?.vehicleDescription || ''
      
      setCustomerData({
        customerName: customerName ? titleCase(customerName) : '',
        dealDate: job?.deal_date || new Date().toISOString().slice(0, 10),
        jobNumber: job?.job_number || '',
        stockNumber: job?.stock_number || job?.stockNumber || '',
        vin: job?.vehicle?.vin || '',
        customerMobile: job?.customer_phone || job?.customerMobile || '',
        customerEmail: job?.customer_email || '',
        vendorId: job?.vendor_id || null,
        notes: job?.notes || job?.description || '',
        vehicleDescription: vehicleDescription ? titleCase(vehicleDescription) : '',
        assignedTo: job?.assigned_to || null,
        deliveryCoordinator: job?.delivery_coordinator_id || null,
        financeManager: job?.finance_manager_id || null,
        needsLoaner: Boolean(job?.customer_needs_loaner),
        loanerNumber: job?.loaner_number || job?.loanerNumber || '',
        loanerReturnDate: toDateInputValue(job?.eta_return_date) || '',
        loanerNotes: job?.loaner_notes || '',
      })

      // ✅ FIX: REPLACE line items (not append) to prevent duplication
      // Ensure we're setting a fresh array from job.lineItems
      if (Array.isArray(job?.lineItems) && job.lineItems.length > 0) {
        const mappedLineItems = job.lineItems.map((item) => ({
          ...item,
          vendorId:
            item?.vendor_id ||
            item?.vendorId ||
            (item?.isOffSite || item?.is_off_site ? job?.vendor_id : null) ||
            null,
          dateScheduled: toDateInputValue(item?.promised_date) || '',
          // ✅ FIX: Time fields should already be in HH:MM format from mapDbDealToForm's formatTime()
          // Keep them as-is without additional transformation
          scheduledStartTime: item?.scheduled_start_time || item?.scheduledStartTime || '',
          scheduledEndTime: item?.scheduled_end_time || item?.scheduledEndTime || '',
          isMultiDay: false,
        }))
        
        // 🔍 DEBUG: Log line items loading
        if (import.meta.env.MODE === 'development') {
          console.log('[DealFormV2] Loading line items into state:', {
            jobId: job.id,
            fromJobProp: job.lineItems.length,
            mappedCount: mappedLineItems.length,
            sample: mappedLineItems[0] ? {
              id: mappedLineItems[0].id,
              product_id: mappedLineItems[0].product_id,
              productId: mappedLineItems[0].productId,
            } : null,
          })
        }
        
        setLineItems(mappedLineItems)
      } else {
        // No line items or empty array - set to empty
        if (import.meta.env.MODE === 'development') {
          console.log('[DealFormV2] Setting lineItems to empty (no items in job prop)')
        }
        setLineItems([])
      }
    }
  }, [job?.id, mode])

  // Track unsaved changes and mark user edits
  useEffect(() => {
    // Mark as changed when user modifies form (skip for initial load in edit mode)
    if (mode === 'create' || (mode === 'edit' && initializedJobId.current)) {
      setHasUnsavedChanges(true)
      // Mark that user has made edits (to prevent async rehydration from overwriting)
      userHasEdited.current = true
    }
  }, [customerData, lineItems, mode])

  // Warn before navigation if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault()
        e.returnValue = '' // Required for Chrome
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, isSubmitting])

  // Autocomplete removed - user reported it was interfering with typing

  // Native select component
  const MobileSelect = ({ label, options, value, onChange, placeholder, testId, helpLink }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e?.target?.value || null)}
        className="bg-white border border-gray-300 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        disabled={dropdownData?.loading}
        data-testid={testId}
      >
        <option value="">{placeholder}</option>
        {options?.map((option) => (
          <option key={option?.id} value={option?.id}>
            {option?.full_name || option?.label || option?.name}
          </option>
        ))}
      </select>
      {helpLink && <p className="mt-2 text-xs text-slate-500">{helpLink}</p>}
      {!helpLink && options?.length === 0 && !dropdownData?.loading && (
        <p className="mt-1 text-xs text-gray-500">
          No {label?.toLowerCase()} found yet. Add it in Admin.
        </p>
      )}
    </div>
  )

  // Add new line item
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        unitPrice: '',
        requiresScheduling: true,
        dateScheduled: '',
        isMultiDay: false,
        scheduledStartTime: '',
        scheduledEndTime: '',
        noScheduleReason: '',
        isOffSite: false,
        vendorId: null,
      },
    ])
  }

  // Update line item
  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev?.map((item) => {
        if (item?.id === id) {
          let updatedItem = { ...item, [field]: value }

          if (field === 'requiresScheduling') {
            if (value === true) {
              updatedItem.noScheduleReason = ''
            } else {
              updatedItem.dateScheduled = ''
              updatedItem.scheduledStartTime = ''
              updatedItem.scheduledEndTime = ''
              updatedItem.isMultiDay = false
            }
          }

          return updatedItem
        }
        return item
      })
    )

    // Auto-populate price when product is selected
    if (field === 'productId' && value) {
      const selectedProduct = dropdownData?.products?.find((p) => p?.id === value)
      if (selectedProduct) {
        setLineItems((prev) =>
          prev?.map((item) =>
            item?.id === id ? { ...item, unitPrice: selectedProduct?.unitPrice || '' } : item
          )
        )
      }
    }
  }

  // Remove line item with confirmation
  const removeLineItem = (id) => {
    if (window.confirm('Are you sure you want to delete this line item?')) {
      setLineItems((prev) => prev?.filter((item) => item?.id !== id))
    }
  }

  // Autocomplete removed per user request

  // Validation
  const validateStep1 = async () => {
    // Validate org_id for RLS compliance
    if (import.meta.env.MODE === 'development') {
      console.log('[DealFormV2] Validating orgId:', { orgId, tenantLoading, user: user?.id })
    }

    if (tenantLoading) {
      setError('Loading organization context. Please wait...')
      return false
    }

    if (!orgId) {
      console.error('[DealFormV2] Missing orgId - RLS will fail')
      setError('Organization context required. Please refresh the page and try again.')
      return false
    }

    // Validate orgId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(String(orgId))) {
      console.error('[DealFormV2] Invalid orgId format:', orgId)
      setError('Invalid organization context. Please refresh the page and try again.')
      return false
    }

    // Validate stock number format if provided (optional field)
    if (customerData?.stockNumber?.trim()) {
      const stockNo = customerData.stockNumber.trim()
      // Allow alphanumeric with common separators (hyphens, underscores)
      // Length between 3-20 characters
      const stockRegex = /^[A-Z0-9][A-Z0-9\-_]{2,19}$/i
      if (!stockRegex.test(stockNo)) {
        setError('Stock number must be 3-20 alphanumeric characters (hyphens and underscores allowed)')
        return false
      }
    }

    // Validate VIN format if provided (optional field)
    if (customerData?.vin?.trim()) {
      const vinTrimmed = customerData.vin.trim().toUpperCase()

      // Use the shared schema to validate length and character set
      const vinResult = vinSchema.safeParse(vinTrimmed)
      if (!vinResult?.success) {
        setError(vinResult?.error?.issues?.[0]?.message ?? 'Invalid VIN')
        return false
      }

      // Check for duplicate VIN (skip if editing existing vehicle with same VIN)
      try {
        const vinExists = await vehicleService.checkVinExists(vinTrimmed)
        if (vinExists && mode === 'create') {
          setError('A vehicle with this VIN already exists in the system')
          return false
        }
        // For edit mode, allow same VIN if it belongs to current vehicle
        if (vinExists && mode === 'edit' && job?.vehicle?.vin !== vinTrimmed) {
          setError('A vehicle with this VIN already exists in the system')
          return false
        }
      } catch (err) {
        console.error('[DealFormV2] VIN check error:', err)
        // Don't block save on VIN check failure, just log warning
      }
    }

    // Validate email format if provided (optional field)
    if (customerData?.customerEmail?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(customerData.customerEmail.trim())) {
        setError('Please enter a valid email address')
        return false
      }
    }

    // Validate deal date is not in the future
    if (customerData?.dealDate) {
      const dealDate = new Date(customerData.dealDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dealDate.setHours(0, 0, 0, 0)

      if (dealDate > today) {
        setError('Deal date cannot be in the future')
        return false
      }
    }

    return (
      customerData?.customerName?.trim()?.length > 0 && customerData?.jobNumber?.trim()?.length > 0
    )
  }

  // Pure validation function (no side effects) - safe to call on every render
  const validateStep2 = () => {
    if (lineItems?.length === 0) return false

    return lineItems?.every((item) => {
      if (!item?.productId || !item?.unitPrice) return false
      if (item?.requiresScheduling && !item?.dateScheduled) return false
      if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) return false

      // Validate scheduled time ranges
      if (item?.requiresScheduling && item?.scheduledStartTime && item?.scheduledEndTime) {
        if (item.scheduledStartTime >= item.scheduledEndTime) {
          return false // Don't set error here - this runs on every render
        }
      }

      return true
    })
  }

  // Validation with error messages - only call when actually validating (e.g., on save)
  const validateStep2WithErrors = () => {
    if (lineItems?.length === 0) {
      setError('Please add at least one line item')
      return false
    }

    for (let index = 0; index < lineItems.length; index++) {
      const item = lineItems[index]

      if (!item?.productId || !item?.unitPrice) {
        setError(`Line item ${index + 1}: Product and price are required`)
        return false
      }

      if (item?.requiresScheduling && !item?.dateScheduled) {
        setError(`Line item ${index + 1}: Scheduled date is required`)
        return false
      }

      if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) {
        setError(`Line item ${index + 1}: No-schedule reason is required`)
        return false
      }

      // Validate scheduled time ranges
      if (item?.requiresScheduling && item?.scheduledStartTime && item?.scheduledEndTime) {
        if (item.scheduledStartTime >= item.scheduledEndTime) {
          setError(`Line item ${index + 1}: Start time must be before end time`)
          return false
        }
      }
    }

    return true
  }

  // Calculate total
  const calculateTotal = () => {
    return lineItems?.reduce((sum, item) => {
      return sum + (parseFloat(item?.unitPrice) || 0)
    }, 0)
  }

  // Parse database errors into user-friendly messages
  const parseError = (err) => {
    const msg = err?.message || ''

    // RLS policy violations
    if (msg.includes('permission denied') || msg.includes('RLS')) {
      return 'You do not have permission to perform this action. Please contact your administrator.'
    }

    // Duplicate key violations
    if (msg.includes('duplicate key') || msg.includes('already exists')) {
      if (msg.includes('job_number')) {
        return 'This job number already exists. Please use a unique job number.'
      }
      return 'A record with this information already exists. Please check for duplicates.'
    }

    // Foreign key violations
    if (msg.includes('foreign key') || msg.includes('violates foreign key constraint')) {
      if (msg.includes('vendor')) {
        return 'Invalid vendor selected. Please refresh the page and try again.'
      }
      if (msg.includes('product')) {
        return 'Invalid product selected. Please refresh the page and try again.'
      }
      if (msg.includes('user') || msg.includes('assigned_to')) {
        return 'Invalid user assignment. Please refresh the page and try again.'
      }
      return 'Invalid reference to related data. Please refresh and try again.'
    }

    // Check constraint violations
    if (msg.includes('violates check constraint')) {
      return 'Invalid data format. Please check all fields and try again.'
    }

    // Network/connection errors
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
      return 'Network error. Please check your connection and try again.'
    }

    // Generic fallback
    return `Failed to save: ${msg}`
  }

  // Handle "Next" button click
  const handleNext = async () => {
    const isValid = await validateStep1()
    if (isValid) {
      setCurrentStep(2)
    }
  }

  // Quick synchronous check for basic required fields (for disabled state)
  const hasRequiredFields = () => {
    return customerData?.customerName?.trim()?.length > 0 && customerData?.jobNumber?.trim()?.length > 0
  }

  // Handle save
  const handleSave = async () => {
    // Synchronous in-flight guard: prevent double-submit before state updates
    if (savingRef.current) {
      return
    }
    
    // Guard against duplicate submits (async state check)
    if (isSubmitting) {
      return
    }

    // Set synchronous guard immediately
    savingRef.current = true

    const step1Valid = await validateStep1()
    if (!step1Valid) {
      savingRef.current = false
      return
    }

    const step2Valid = validateStep2WithErrors()
    if (!step2Valid) {
      savingRef.current = false
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Check job number uniqueness (skip in edit mode for same job)
      const jobNumber = customerData?.jobNumber?.trim()
      if (jobNumber) {
        const { data: existing, error: checkError } = await supabase
          .from('jobs')
          .select('id')
          .eq('job_number', jobNumber)
          .maybeSingle()

        if (checkError) {
          throw new Error(`Failed to validate job number: ${checkError.message}`)
        }

        // If found and it's not the current job (edit mode), it's a duplicate
        if (existing && existing.id !== job?.id) {
          setError('Job number already exists. Please use a unique job number.')
          setIsSubmitting(false)
          return
        }
      }

      const payload = {
        customer_name: customerData?.customerName?.trim(),
        deal_date: customerData?.dealDate,
        job_number: customerData?.jobNumber?.trim(),
        stock_number: customerData?.stockNumber?.trim() || null,
        customer_mobile: customerData?.customerMobile?.trim() || null,
        customer_email: customerData?.customerEmail?.trim() || null,
        vendor_id: customerData?.vendorId || null,
        notes: customerData?.notes?.trim() || null, // Notes field maps to description in dealService
        vehicle_description: customerData?.vehicleDescription?.trim() || null,
        assigned_to: customerData?.assignedTo || user?.id,
        delivery_coordinator_id: customerData?.deliveryCoordinator || null,
        finance_manager_id: customerData?.financeManager || null,
        customer_needs_loaner: Boolean(customerData?.needsLoaner),
        org_id: orgId, // ✅ Include org_id for proper tenant scoping and RLS compliance
        // Send loanerForm when needsLoaner is true for proper persistence via loaner_assignments
        loanerForm: customerData?.needsLoaner
          ? {
              loaner_number: customerData?.loanerNumber?.trim() || '',
              eta_return_date: customerData?.loanerReturnDate || null,
              notes: customerData?.loanerNotes?.trim() || null,
            }
          : null,
        lineItems: lineItems.map((item) => {
          // Combine date and time into proper ISO datetime for timestamptz columns
          // This fixes: "invalid input syntax for type timestamp with time zone: '13:07'"
          const scheduledStartIso = item?.requiresScheduling
            ? combineDateAndTime(item?.dateScheduled, item?.scheduledStartTime)
            : null
          const scheduledEndIso = item?.requiresScheduling
            ? combineDateAndTime(item?.dateScheduled, item?.scheduledEndTime)
            : null

          return {
            product_id: item?.productId,
            quantity_used: 1,
            unit_price: parseFloat(item?.unitPrice || 0),
            promised_date: item?.requiresScheduling && item?.dateScheduled ? item.dateScheduled : null,
            scheduled_start_time: scheduledStartIso,
            scheduled_end_time: scheduledEndIso,
            requires_scheduling: Boolean(item?.requiresScheduling),
            no_schedule_reason: !item?.requiresScheduling ? item?.noScheduleReason : null,
            is_off_site: Boolean(item?.isOffSite),
            vendor_id: item?.vendorId || customerData?.vendorId || null, // Inherit job vendor if line item vendor not specified
          }
        }),
      }

      if (import.meta.env.MODE === 'development') {
        console.log('[DealFormV2] Saving deal with payload:', {
          mode,
          org_id: payload.org_id,
          customer_name: payload.customer_name,
          job_number: payload.job_number,
          lineItemsCount: payload.lineItems?.length,
          lineItemsStateCount: lineItems?.length, // 🔍 DEBUG: Compare state vs payload
          lineItemsSample: payload.lineItems?.[0] ? {
            product_id: payload.lineItems[0].product_id,
            unit_price: payload.lineItems[0].unit_price,
          } : null,
        })
      }

      if (onSave) {
        await onSave(payload)
      } else {
        // Fallback: use dealService directly
        if (mode === 'edit' && job?.id) {
          const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
          const adapted = useV2 ? draftToUpdatePayload({ id: job.id }, payload) : payload
          await dealService.updateDeal(job.id, adapted)
        } else {
          const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
          const adapted = useV2 ? draftToCreatePayload(payload) : payload
          await dealService.createDeal(adapted)
        }
      }

      // Mark as saved (no unsaved changes after successful save)
      setHasUnsavedChanges(false)

      if (onCancel) onCancel()
    } catch (err) {
      setError(parseError(err))
    } finally {
      setIsSubmitting(false)
      savingRef.current = false
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      {/* Loading skeleton while dropdown data loads */}
      {dropdownData?.loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      )}

      {/* Main form - hidden while loading */}
      {!dropdownData?.loading && (
        <>
          {/* Progress indicator */}
          <div className="mb-6 flex items-center space-x-4">
        <div
          className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            1
          </div>
          <span className="font-medium">Customer</span>
        </div>
        <div className="flex-1 h-px bg-gray-300"></div>
        <div
          className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            2
          </div>
          <span className="font-medium">Line Items</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {tenantLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <strong>Loading:</strong> Initializing organization context...
        </div>
      )}

      {/* Step 1: Customer */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal Date</label>
              <input
                type="date"
                value={customerData?.dealDate || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, dealDate: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="deal-date-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerData?.customerName || ''}
                onChange={(e) => {
                  setCustomerData((prev) => ({ ...prev, customerName: e?.target?.value }))
                }}
                onBlur={(e) => {
                  setCustomerData((prev) => ({
                    ...prev,
                    customerName: titleCase(e?.target?.value),
                  }))
                }}
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter customer name"
                required
                data-testid="customer-name-input"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deal # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerData?.jobNumber || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, jobNumber: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter deal number"
                required
                data-testid="deal-number-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vehicle Description
              </label>
              <input
                type="text"
                value={customerData?.vehicleDescription || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, vehicleDescription: e?.target?.value }))
                }
                onBlur={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    vehicleDescription: titleCase(e?.target?.value),
                  }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2025 Lexus RX350"
                data-testid="vehicle-description-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock #</label>
              <input
                type="text"
                value={customerData?.stockNumber || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, stockNumber: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter stock number"
                data-testid="stock-number-display"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VIN</label>
              <input
                type="text"
                value={customerData?.vin || ''}
                onChange={(e) => {
                  const value = e?.target?.value?.toUpperCase() || ''
                  setCustomerData((prev) => ({ ...prev, vin: value }))
                }}
                maxLength={17}
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="17-character VIN"
                data-testid="vin-input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. Must be 17 characters (excludes I, O, Q)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Mobile
              </label>
              <input
                type="tel"
                value={customerData?.customerMobile || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, customerMobile: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone"
                data-testid="customer-mobile-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                value={customerData?.customerEmail || ''}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, customerEmail: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email"
                data-testid="customer-email-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={customerData?.notes || ''}
              onChange={(e) => setCustomerData((prev) => ({ ...prev, notes: e?.target?.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter notes"
              data-testid="notes-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MobileSelect
              label="Sales"
              options={dropdownData?.salesConsultants}
              value={customerData?.assignedTo || ''}
              onChange={(value) => setCustomerData((prev) => ({ ...prev, assignedTo: value }))}
              placeholder="Select sales consultant"
              testId="sales-select"
              helpLink={
                <span>
                  Need to edit sales staff?{' '}
                  <a
                    data-testid="admin-link-sales"
                    className="underline"
                    href="/admin/staff"
                  >
                    Open Admin
                  </a>
                </span>
              }
            />

            <MobileSelect
              label="Finance"
              options={dropdownData?.financeManagers}
              value={customerData?.financeManager || ''}
              onChange={(value) => setCustomerData((prev) => ({ ...prev, financeManager: value }))}
              placeholder="Select finance manager"
              testId="finance-select"
              helpLink={
                <span>
                  Need to edit finance managers?{' '}
                  <a
                    data-testid="admin-link-finance"
                    className="underline"
                    href="/admin/staff"
                  >
                    Open Admin
                  </a>
                </span>
              }
            />

            <MobileSelect
              label="Delivery Coordinator"
              options={dropdownData?.deliveryCoordinators}
              value={customerData?.deliveryCoordinator || ''}
              onChange={(value) =>
                setCustomerData((prev) => ({ ...prev, deliveryCoordinator: value }))
              }
              placeholder="Select delivery coordinator"
              testId="delivery-select"
              helpLink={
                <span>
                  Need to edit coordinators?{' '}
                  <a
                    data-testid="admin-link-delivery"
                    className="underline"
                    href="/admin/staff"
                  >
                    Open Admin
                  </a>
                </span>
              }
            />
          </div>

          {/* Loaner checkbox */}
          <section className="flex items-center gap-3">
            <input
              id="needsLoaner"
              data-testid="loaner-checkbox"
              className="h-5 w-5 accent-blue-600 appearance-auto"
              type="checkbox"
              checked={customerData?.needsLoaner}
              onChange={(e) => {
                setCustomerData((prev) => ({ ...prev, needsLoaner: e.target.checked }))
                if (e.target.checked) {
                  setTimeout(() => loanerRef?.current?.focus?.(), 0)
                }
              }}
            />
            <label htmlFor="needsLoaner" className="text-sm text-slate-800">
              Customer needs loaner
            </label>
          </section>

          {customerData?.needsLoaner && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Loaner #</label>
                <input
                  ref={loanerRef}
                  data-testid="loaner-number-input"
                  className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter loaner vehicle number"
                  value={customerData?.loanerNumber ?? ''}
                  onChange={(e) =>
                    setCustomerData((prev) => ({ ...prev, loanerNumber: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  data-testid="loaner-return-date-input"
                  className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
                  value={customerData?.loanerReturnDate ?? ''}
                  onChange={(e) =>
                    setCustomerData((prev) => ({ ...prev, loanerReturnDate: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Loaner Notes</label>
                <input
                  type="text"
                  data-testid="loaner-notes-input"
                  className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Any special instructions"
                  value={customerData?.loanerNotes ?? ''}
                  onChange={(e) =>
                    setCustomerData((prev) => ({ ...prev, loanerNotes: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Line Items */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
            <Button
              onClick={addLineItem}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 h-11"
            >
              <Icon name="Plus" size={16} />
              <span>Add Item</span>
            </Button>
          </div>

          {/* Capability notice: per-line time windows not supported */}
          {!getCapabilities().jobPartsHasTimes && (
            <div
              className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg"
              data-testid="capability-notice-job-parts-times"
            >
              <Icon name="Info" size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <strong>Note:</strong> This environment doesn't store per-line time windows yet.
                Promised dates will save; time windows are ignored.
              </div>
            </div>
          )}

          {lineItems?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-slate-50 rounded-lg border-2 border-dashed border-gray-300">
              <Icon name="Package" size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No line items added yet</p>
              <p className="text-sm">Click "Add Item" to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lineItems?.map((item, index) => (
                <div key={item?.id} className="border rounded-xl p-4 bg-slate-50 border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                    <button
                      onClick={() => removeLineItem(item?.id)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item?.productId || ''}
                        onChange={(e) => updateLineItem(item?.id, 'productId', e?.target?.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg text-base"
                        data-testid={`product-select-${index}`}
                      >
                        <option value="">Select product</option>
                        {dropdownData?.products?.map((product) => (
                          <option key={product?.id} value={product?.id}>
                            {product?.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item?.unitPrice}
                        onChange={(e) => updateLineItem(item?.id, 'unitPrice', e?.target?.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item?.isOffSite}
                        onChange={(e) => updateLineItem(item?.id, 'isOffSite', e?.target?.checked)}
                        className="h-5 w-5 accent-blue-600"
                        data-testid={`is-off-site-${index}`}
                      />
                      <span className="text-sm">Off-Site (Vendor)</span>
                    </label>

                    {item?.isOffSite && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Vendor</label>
                          <select
                            data-testid={`line-vendor-${index}`}
                            value={item?.vendorId || ''}
                            onChange={(e) =>
                              updateLineItem(item?.id, 'vendorId', e?.target?.value || null)
                            }
                            className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">— Select Vendor —</option>
                            {dropdownData?.vendors?.map((v) => (
                              <option key={v?.id} value={v?.id}>
                                {v?.full_name || v?.label || v?.name}
                              </option>
                            ))}
                          </select>
                          {dropdownData?.vendors?.length === 0 && (
                            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
                              No vendors available. Check{' '}
                              <a className="underline" href="/admin?section=vendors">
                                Admin → Vendors
                              </a>{' '}
                              to add or attach vendors.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item?.requiresScheduling}
                        onChange={(e) =>
                          updateLineItem(item?.id, 'requiresScheduling', e?.target?.checked)
                        }
                        className="h-5 w-5 accent-blue-600"
                        data-testid={`requires-scheduling-${index}`}
                      />
                      <span className="text-sm">Requires Scheduling</span>
                    </label>

                    {item?.requiresScheduling ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date Scheduled <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={item?.dateScheduled}
                            onChange={(e) =>
                              updateLineItem(item?.id, 'dateScheduled', e?.target?.value)
                            }
                            min={new Date()?.toISOString()?.split('T')?.[0]}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            data-testid={`date-scheduled-${index}`}
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item?.isMultiDay}
                              onChange={(e) =>
                                updateLineItem(item?.id, 'isMultiDay', e?.target?.checked)
                              }
                              className="h-5 w-5 accent-blue-600"
                              data-testid={`multi-day-${index}`}
                            />
                            <span className="text-sm">Multi-Day Scheduling</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={item?.scheduledStartTime}
                              onChange={(e) =>
                                updateLineItem(item?.id, 'scheduledStartTime', e?.target?.value)
                              }
                              className="w-full p-3 border border-gray-300 rounded-lg"
                              data-testid={`start-time-${index}`}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={item?.scheduledEndTime}
                              onChange={(e) =>
                                updateLineItem(item?.id, 'scheduledEndTime', e?.target?.value)
                              }
                              className="w-full p-3 border border-gray-300 rounded-lg"
                              data-testid={`end-time-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reason for No Schedule <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item?.noScheduleReason}
                          onChange={(e) =>
                            updateLineItem(item?.id, 'noScheduleReason', e?.target?.value)
                          }
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="e.g., installed at delivery"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-green-700">
                    ${calculateTotal()?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex justify-between">
        <div className="flex space-x-3">
          {currentStep === 2 && (
            <Button onClick={() => setCurrentStep(1)} variant="outline" disabled={isSubmitting}>
              ← Back
            </Button>
          )}
        </div>

        <div className="flex space-x-3">
          <Button onClick={onCancel} variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>

          {currentStep === 1 && (
            <Button
              onClick={handleNext}
              disabled={!hasRequiredFields() || isSubmitting || tenantLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="next-to-line-items-btn"
            >
              Next → Line Items
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasRequiredFields() || !validateStep2() || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="save-deal-btn"
            >
              {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Deal' : 'Create Deal'}
            </Button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  )
}
