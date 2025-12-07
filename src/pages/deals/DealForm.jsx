// src/pages/deals/DealForm.jsx
import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getVendors,
  getProducts,
  getSalesConsultants,
  getFinanceManagers,
  getDeliveryCoordinators,
  getUserProfiles,
} from '../../services/dropdownService'
import { listVendorsByOrg, listProductsByOrg, listStaffByOrg } from '../../services/tenantService'
import useTenant from '../../hooks/useTenant'
import { useLogger } from '../../hooks/useLogger'
import UnsavedChangesGuard from '../../components/common/UnsavedChangesGuard'
import { useToast } from '../../components/ui/ToastProvider'
import { UI_FLAGS } from '../../config/ui'

// Optional fallback to service-layer create/update if parent didn't pass onSave
let dealServicePromise
try {
  dealServicePromise = import('../../services/dealService.js')
} catch (_) {
  // ignore if not present or already injected via props
}

const emptyLineItem = () => ({
  product_id: '',
  quantity_used: 1,
  unit_price: 0,
  promised_date: '',
  requires_scheduling: true,
  no_schedule_reason: '',
  is_off_site: false,
})

export default function DealForm({
  initial = {},
  mode = 'create', // 'create' | 'edit'
  onCancel,
  onSave, // optional (payload) => Promise<{id}>
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [lineErrors, setLineErrors] = useState({})
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [finance, setFinance] = useState([])
  const [delivery, setDelivery] = useState([])

  const [form, setForm] = useState({
    id: initial.id || undefined,
    updated_at: initial.updated_at || undefined,
    job_number: initial.job_number || '',
    vehicle_id: initial.vehicle_id || '',
    stock_number: initial.stock_number || '', // display only if you don’t want editable
    description: initial.description || '',
    vendor_id: initial.vendor_id || '',
    assigned_to: initial.assigned_to || '',
    finance_manager_id: initial.finance_manager_id || '',
    delivery_coordinator_id: initial.delivery_coordinator_id || '',
    customer_mobile: initial.customer_mobile || '',
    customer_needs_loaner: !!initial.customer_needs_loaner,
    loanerForm: {
      loaner_number: initial?.loanerForm?.loaner_number || '',
      eta_return_date: initial?.loanerForm?.eta_return_date || '',
      notes: initial?.loanerForm?.notes || '',
    },
    lineItems: initial.lineItems?.length ? initial.lineItems : [emptyLineItem()],
    promised_date: initial.promised_date || '',
    scheduled_start_time: initial.scheduled_start_time || '',
    scheduled_end_time: initial.scheduled_end_time || '',
    calendar_notes: initial.calendar_notes || '',
  })

  // Server-truth: Do not override description from localStorage; rely on props/DB values

  // Keep local form state in sync when parent provides a new initial (e.g., after save/refetch or route change)
  useEffect(() => {
    // Only sync when a meaningful initial is provided (e.g., edit mode or refetch),
    // not for an empty default object which would clear user input on every render.
    const hasMeaningfulInitial =
      initial &&
      (initial.id ||
        initial.job_number ||
        (Array.isArray(initial.lineItems) && initial.lineItems.length > 0))
    if (!hasMeaningfulInitial) return

    setForm({
      id: initial.id || undefined,
      updated_at: initial.updated_at || undefined,
      job_number: initial.job_number || '',
      vehicle_id: initial.vehicle_id || '',
      stock_number: initial.stock_number || '',
      description: initial.description || '',
      vendor_id: initial.vendor_id || '',
      assigned_to: initial.assigned_to || '',
      finance_manager_id: initial.finance_manager_id || '',
      delivery_coordinator_id: initial.delivery_coordinator_id || '',
      customer_mobile: initial.customer_mobile || '',
      customer_needs_loaner: !!initial.customer_needs_loaner,
      loanerForm: {
        loaner_number: initial?.loanerForm?.loaner_number || '',
        eta_return_date: initial?.loanerForm?.eta_return_date || '',
        notes: initial?.loanerForm?.notes || '',
      },
      lineItems: initial.lineItems?.length ? initial.lineItems : [emptyLineItem()],
      promised_date: initial.promised_date || '',
      scheduled_start_time: initial.scheduled_start_time || '',
      scheduled_end_time: initial.scheduled_end_time || '',
      calendar_notes: initial.calendar_notes || '',
    })
    // We intentionally do not update initialSnapshot here to preserve dirty tracking vs the very first load.
    // The UnsavedChangesGuard still works because isDirty compares to the original initialSnapshot.
    // For edit-after-save UX, the toast/success banner is shown and the new values render from props.
  }, [initial])

  const { orgId } = useTenant()
  const { logFormSubmission, logError } = useLogger()
  const toast = useToast?.()
  const [initialSnapshot] = useState(() =>
    JSON.stringify({
      id: initial.id || undefined,
      updated_at: initial.updated_at || undefined,
      job_number: initial.job_number || '',
      vehicle_id: initial.vehicle_id || '',
      stock_number: initial.stock_number || '',
      description: initial.description || '',
      vendor_id: initial.vendor_id || '',
      assigned_to: initial.assigned_to || '',
      finance_manager_id: initial.finance_manager_id || '',
      delivery_coordinator_id: initial.delivery_coordinator_id || '',
      customer_mobile: initial.customer_mobile || '',
      customer_needs_loaner: !!initial.customer_needs_loaner,
      loanerForm: {
        loaner_number: initial?.loanerForm?.loaner_number || '',
        eta_return_date: initial?.loanerForm?.eta_return_date || '',
        notes: initial?.loanerForm?.notes || '',
      },
      lineItems: initial.lineItems?.length ? initial.lineItems : [emptyLineItem()],
      promised_date: initial.promised_date || '',
      scheduled_start_time: initial.scheduled_start_time || '',
      scheduled_end_time: initial.scheduled_end_time || '',
      calendar_notes: initial.calendar_notes || '',
    })
  )

  // Load vendors/products/staff dropdown data
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const ignoreOrg = UI_FLAGS?.forceGlobalDropdowns === true
        const vendorsPromise =
          orgId && !ignoreOrg ? listVendorsByOrg(orgId, { activeOnly: true }) : getVendors()
        const productsPromise =
          orgId && !ignoreOrg ? listProductsByOrg(orgId, { activeOnly: true }) : getProducts()

        // Prefer tenant-aware staff lists when orgId is available
        const salesPromise =
          orgId && !ignoreOrg
            ? listStaffByOrg(orgId, {
                departments: ['Sales', 'Sales Consultant', 'Sales Consultants'],
                roles: ['staff'],
                activeOnly: true,
              })
            : getSalesConsultants()
        const financePromise =
          orgId && !ignoreOrg
            ? listStaffByOrg(orgId, {
                departments: ['Finance', 'Finance Manager', 'Finance Managers', 'Managers'],
                roles: ['staff'],
                activeOnly: true,
              })
            : getFinanceManagers()
        const deliveryPromise =
          orgId && !ignoreOrg
            ? listStaffByOrg(orgId, {
                departments: ['Delivery', 'Delivery Coordinator', 'Delivery Coordinators'],
                roles: ['staff'],
                activeOnly: true,
              })
            : getDeliveryCoordinators()

        let [vOpts, pOpts, sOpts, fOpts, dOpts] = await Promise.all([
          vendorsPromise,
          productsPromise,
          salesPromise,
          financePromise,
          deliveryPromise,
        ])

        // Fallbacks
        if (orgId && !ignoreOrg) {
          // Vendors/products: if org-scoped is empty, fall back to global lists
          if (!Array.isArray(vOpts) || vOpts.length === 0) {
            vOpts = await getVendors().catch(() => [])
          }
          if (!Array.isArray(pOpts) || pOpts.length === 0) {
            pOpts = await getProducts().catch(() => [])
          }

          // Staff: avoid showing admins/managers when department-scoped list is empty.
          // Prefer global department-specific list first, then a strict staff-only org list.
          if (!Array.isArray(sOpts) || sOpts.length === 0) {
            sOpts = (await getSalesConsultants().catch(() => [])) || []
            if (!sOpts?.length)
              sOpts = await listStaffByOrg(orgId, { roles: ['staff'], activeOnly: true }).catch(
                () => []
              )
          }
          if (!Array.isArray(fOpts) || fOpts.length === 0) {
            fOpts = (await getFinanceManagers().catch(() => [])) || []
            if (!fOpts?.length)
              fOpts = await listStaffByOrg(orgId, { roles: ['staff'], activeOnly: true }).catch(
                () => []
              )
          }
          if (!Array.isArray(dOpts) || dOpts.length === 0) {
            dOpts = (await getDeliveryCoordinators().catch(() => [])) || []
            if (!dOpts?.length)
              dOpts = await listStaffByOrg(orgId, { roles: ['staff'], activeOnly: true }).catch(
                () => []
              )
          }
        } else {
          // No orgId: at minimum ensure products/vendors load globally
          if (!Array.isArray(vOpts) || vOpts.length === 0)
            vOpts = await getVendors().catch(() => [])
          if (!Array.isArray(pOpts) || pOpts.length === 0)
            pOpts = await getProducts().catch(() => [])
        }

        // Last resort: if staff lists are still empty, use all active users to keep UI functional
        if (!Array.isArray(sOpts) || sOpts.length === 0) {
          sOpts = (await getUserProfiles({ activeOnly: true }).catch(() => [])) || []
        }
        if (!Array.isArray(fOpts) || fOpts.length === 0) {
          fOpts = (await getUserProfiles({ activeOnly: true }).catch(() => [])) || []
        }
        if (!Array.isArray(dOpts) || dOpts.length === 0) {
          dOpts = (await getUserProfiles({ activeOnly: true }).catch(() => [])) || []
        }
        if (!mounted) return
        // Extra safety: filter to role==='staff' if role is present
        const onlyStaff = (arr) =>
          Array.isArray(arr) ? arr.filter((u) => u?.role === 'staff' || u?.role === undefined) : []
        setVendors(vOpts || [])
        setProducts(pOpts || [])
        const sFiltered = onlyStaff(sOpts)
        const fFiltered = onlyStaff(fOpts)
        const dFiltered = onlyStaff(dOpts)
        setSales(sFiltered?.length ? sFiltered : sOpts || [])
        setFinance(fFiltered?.length ? fFiltered : fOpts || [])
        setDelivery(dFiltered?.length ? dFiltered : dOpts || [])
      } catch (e) {
        console.error('DealForm dropdown load error', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [orgId])

  // Synthetic option reconciliation so selected values render immediately
  useEffect(() => {
    // Vendors
    if (!vendors?.length && form?.vendor_id) {
      setVendors([{ id: form.vendor_id, value: form.vendor_id, label: 'Selected vendor' }])
    }
    // Sales
    if (!sales?.length && form?.assigned_to) {
      setSales([{ id: form.assigned_to, value: form.assigned_to, label: 'Selected sales' }])
    }
    // Finance
    if (!finance?.length && form?.finance_manager_id) {
      setFinance([
        { id: form.finance_manager_id, value: form.finance_manager_id, label: 'Selected finance' },
      ])
    }
    // Delivery
    if (!delivery?.length && form?.delivery_coordinator_id) {
      setDelivery([
        {
          id: form.delivery_coordinator_id,
          value: form.delivery_coordinator_id,
          label: 'Selected delivery',
        },
      ])
    }
    // Products – seed any selected product ids from line items with their current unit_price
    const selectedProductIds = new Set(
      (form?.lineItems || [])
        .map((li) => (li?.product_id ? String(li.product_id) : null))
        .filter(Boolean)
    )
    if (!products?.length && selectedProductIds.size > 0) {
      const synthetic = []
      ;(form?.lineItems || []).forEach((li) => {
        if (!li?.product_id) return
        const pid = String(li.product_id)
        if (selectedProductIds.has(pid)) {
          synthetic.push({
            id: pid,
            value: pid,
            label: 'Selected product',
            unit_price: Number(li?.unit_price ?? 0),
          })
          selectedProductIds.delete(pid)
        }
      })
      if (synthetic.length) setProducts(synthetic)
    }
    // We intentionally do not include vendors/products/sales/... in deps to avoid loops when real data loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const productMap = useMemo(() => {
    const m = new Map()
    ;(products || []).forEach((p) => {
      // options come as { id, value, label, unit_price }
      const key = p.id ?? p.value
      if (key != null) m.set(String(key), p)
    })
    return m
  }, [products])

  const handleChange = (key, val) => {
    // V2 behavior: when turning loaner off, clear its fields so UI re-opens empty
    if (key === 'customer_needs_loaner' && !val) {
      const isV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
      if (isV2) {
        return setForm((prev) => ({
          ...prev,
          [key]: val,
          loanerForm: {
            loaner_number: '',
            eta_return_date: '',
            notes: '',
          },
        }))
      }
    }
    return setForm((prev) => ({ ...prev, [key]: val }))
  }

  const handleLoanerChange = (key, val) =>
    setForm((prev) => ({ ...prev, loanerForm: { ...(prev.loanerForm || {}), [key]: val } }))

  const handleLineChange = (idx, key, val) =>
    setForm((prev) => {
      const next = { ...prev }
      const lineItems = Array.isArray(next.lineItems) ? [...next.lineItems] : []
      const li = { ...(lineItems[idx] || {}) }
      li[key] = val
      if (key === 'product_id') {
        // ensure we look up by the option value string
        const prod = productMap.get(String(val))
        if (prod && prod.unit_price !== undefined) {
          li.unit_price = Number(prod.unit_price || 0)
        }
      }
      // Clear validation error when user fixes the issue
      if (key === 'no_schedule_reason' && String(val || '').trim()) {
        setLineErrors((errs) => {
          if (!errs || !errs[idx]?.noScheduleReason) return errs
          const copy = { ...errs }
          const row = { ...(copy[idx] || {}) }
          delete row.noScheduleReason
          if (!Object.keys(row).length) delete copy[idx]
          else copy[idx] = row
          return copy
        })
      }
      if (key === 'requires_scheduling' && !!val) {
        // if user now requires scheduling, clear the previous missing-reason error
        setLineErrors((errs) => {
          if (!errs || !errs[idx]?.noScheduleReason) return errs
          const copy = { ...errs }
          const row = { ...(copy[idx] || {}) }
          delete row.noScheduleReason
          if (!Object.keys(row).length) delete copy[idx]
          else copy[idx] = row
          return copy
        })
      }
      lineItems[idx] = li
      next.lineItems = lineItems
      return next
    })

  const addLineItem = () => setForm((p) => ({ ...p, lineItems: [...p.lineItems, emptyLineItem()] }))
  const removeLineItem = (idx) =>
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }))

  // Dirty tracking for unsaved-changes guard
  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(form) !== initialSnapshot
    } catch {
      return true
    }
  }, [form, initialSnapshot])

  useEffect(() => {
    const handler = (e) => {
      if (!isDirty || saving) return
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, saving])

  const handleCancel = () => {
    if (saving) return
    if (isDirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    onCancel?.()
  }

  // Totals bar calculation (qty is always 1, but keep quantity_used support)
  const dealSubtotal = useMemo(() => {
    try {
      return (form.lineItems || []).reduce((sum, li) => {
        const qty = Number(li?.quantity_used ?? 1) || 1
        const price = Number(li?.unit_price ?? 0) || 0
        return sum + qty * price
      }, 0)
    } catch {
      return 0
    }
  }, [form.lineItems])

  const currencyFmt = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    []
  )

  const submit = async (e) => {
    e?.preventDefault?.()
    // Prevent duplicate submits
    if (saving) return
    setSaving(true)
    setErrorMsg('')
    try {
      // Guard: require at least one valid product selection
      const validProductIdxs = (form.lineItems || []).reduce((arr, li, idx) => {
        if (li?.product_id) arr.push(idx)
        return arr
      }, [])
      if (validProductIdxs.length === 0) {
        setSaving(false)
        setErrorMsg('Please add at least one product to the deal.')
        // Focus first product dropdown
        try {
          const el = document.querySelector('[data-testid="product-select-0"]')
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el?.focus?.()
        } catch {}
        return
      }

      // Guard: If requires_scheduling === false, no_schedule_reason is required
      const missingReasonIndexes = (form.lineItems || []).reduce((arr, li, idx) => {
        const requires = !!li?.requires_scheduling
        const reason = String(li?.no_schedule_reason || '').trim()
        if (!requires && !reason) arr.push(idx)
        return arr
      }, [])
      if (missingReasonIndexes.length > 0) {
        const errs = {}
        missingReasonIndexes.forEach((i) => {
          errs[i] = { ...(errs[i] || {}), noScheduleReason: true }
        })
        setLineErrors(errs)
        setSaving(false)
        // Focus first offending field for quicker correction
        try {
          const first = missingReasonIndexes[0]
          const el = document.querySelector(`[data-testid="no-schedule-reason-${first}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el?.focus?.()
        } catch {}
        return
      } else {
        setLineErrors({})
      }

      // Light phone normalization (digits only; prefix +1 for 10-digit US)
      const normalizePhone = (s) => {
        try {
          const digits = String(s || '').replace(/\D+/g, '')
          if (digits.length === 10) return `+1${digits}`
          if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
          return s || ''
        } catch {
          return s || ''
        }
      }

      // Build payload that includes both snake_case (UI) and camelCase (service) fields
      const normalizedLineItems = (form.lineItems || []).map((li) => ({
        product_id: li.product_id || null,
        quantity_used: Number(li.quantity_used || 1),
        unit_price: Number(li.unit_price || 0),
        // snake_case (UI)
        promised_date: li.promised_date || li.lineItemPromisedDate || null,
        requires_scheduling: !!li.requires_scheduling || !!li.requiresScheduling,
        no_schedule_reason: li.no_schedule_reason || li.noScheduleReason || null,
        is_off_site: !!li.is_off_site || !!li.isOffSite,
        // camelCase (service compatibility)
        lineItemPromisedDate: li.lineItemPromisedDate || li.promised_date || null,
        requiresScheduling: !!li.requiresScheduling || !!li.requires_scheduling,
        noScheduleReason: li.noScheduleReason || li.no_schedule_reason || null,
        isOffSite: !!li.isOffSite || !!li.is_off_site,
      }))

      const payload = {
        ...form,
        // attach tenant org for write policies when available
        org_id: form.org_id || orgId || undefined,
        customer_needs_loaner: !!form.customer_needs_loaner,
        // pass loaner details to the service (service gracefully ignores when number is empty)
        loanerForm: form.customer_needs_loaner
          ? {
              loaner_number: form?.loanerForm?.loaner_number?.trim() || '',
              eta_return_date: form?.loanerForm?.eta_return_date || null,
              notes: form?.loanerForm?.notes || '',
            }
          : null,
        // mirror phone fields for downstream services
        customer_phone: normalizePhone(form.customer_phone || form.customer_mobile || ''),
        customerPhone: normalizePhone(
          form.customerPhone || form.customer_mobile || form.customer_phone || ''
        ),
        lineItems: normalizedLineItems,
      }

      if (onSave) {
        // parent-provided save handler is authoritative (handles navigation/closing)
        await onSave(payload)
        await logFormSubmission?.(
          'DealForm',
          { orgId, hasLineItems: payload?.lineItems?.length > 0 },
          true
        )
        setSavedAt(Date.now())
        try {
          toast?.success?.('Saved successfully')
        } catch {}
      } else if (dealServicePromise) {
        const mod = await dealServicePromise
        const dealService = mod?.default ?? mod
        // Use service directly and reflect the saved record in the form (do not auto-close)
        let savedRecord = null
        if (mode === 'edit' && payload.id) {
          savedRecord = await dealService.updateDeal(payload.id, payload)
        } else {
          savedRecord = await dealService.createDeal(payload)
        }

        if (savedRecord) {
          // map DB shape to form if helper exists
          try {
            const mapped = dealService.mapDbDealToForm
              ? dealService.mapDbDealToForm(savedRecord)
              : null
            if (mapped)
              setForm((prev) => ({ ...prev, ...mapped, lineItems: mapped.lineItems || [] }))
          } catch (e) {
            // fallback: do nothing if mapping fails
            console.warn('Failed to map saved record to form:', e)
          }
          // Optional: redirect to Agenda when feature flag enabled and scheduling set
          try {
            const agendaOn =
              String(import.meta.env?.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'
            const hasSchedule = !!(
              savedRecord?.scheduled_start_time || payload?.scheduled_start_time
            )
            if (agendaOn && hasSchedule && savedRecord?.id) {
              navigate(`/calendar/agenda?focus=${encodeURIComponent(savedRecord.id)}`)
            }
          } catch (_) {}
        }
        await logFormSubmission?.(
          'DealForm',
          { orgId, hasLineItems: payload?.lineItems?.length > 0 },
          true
        )
        setSavedAt(Date.now())
        try {
          toast?.success?.('Saved successfully')
        } catch {}
      }
    } catch (err) {
      // V2: friendly handling for optimistic concurrency conflicts
      const isV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
      const isConflict =
        err?.code === 'VERSION_CONFLICT' ||
        err?.status === 409 ||
        (err?.message || '').startsWith('Conflict:')

      if (isV2 && isConflict) {
        // Non-blocking conflict message - user can see the error and reload
        setErrorMsg(
          err?.message || 'This deal was updated by someone else. Please reload and try again.'
        )
        console.warn('Version conflict detected:', err)
        return // Early return - don't overwrite data
      }

      const msg = err?.message || String(err)
      console.error('Deal save failed', err)
      setErrorMsg(msg)
      try {
        await logError?.(err, { where: 'DealForm.submit', orgId })
      } catch (_) {}
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <form className="space-y-6 p-4" onSubmit={submit} data-testid="deal-form">
      {/* Quick Identifiers */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Deal / Job #</label>
          <input
            data-testid="deal-number-input"
            type="text"
            value={form.job_number}
            onChange={(e) => handleChange('job_number', e.target.value)}
            className="mt-1 input-mobile w-full"
            placeholder="Auto or manual"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Stock #</label>
          <input
            data-testid="stock-number-display"
            type="text"
            value={form.stock_number || ''}
            onChange={(e) => handleChange('stock_number', e.target.value)}
            className="mt-1 input-mobile w-full"
            placeholder="e.g. A1234"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Customer Mobile</label>
          <input
            data-testid="customer-mobile-input"
            type="tel"
            value={form.customer_mobile}
            onChange={(e) => handleChange('customer_mobile', e.target.value)}
            className="mt-1 input-mobile w-full"
            placeholder="+1 555 555 5555"
          />
        </div>
      </section>

      {/* Primary Info */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Vendor</label>
          <select
            data-testid="vendor-select"
            value={form.vendor_id || ''}
            onChange={(e) => handleChange('vendor_id', e.target.value || null)}
            className="mt-1 input-mobile w-full"
          >
            <option value="">— Select Vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          {vendors.length === 0 && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
              No vendors found yet.{' '}
              <button
                type="button"
                onClick={() => navigate('/admin?section=vendors')}
                className="underline hover:text-amber-900"
                data-testid="admin-link-vendors"
              >
                Open Admin
              </button>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description-input" className="block text-sm font-medium text-slate-700">Customer Name</label>
          <textarea
            id="description-input"
            aria-label="Customer Name"
            data-testid="description-input"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="mt-1 input-mobile w-full"
            rows={3}
          />
        </div>
      </section>

      {/* Staff */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Sales Consultant</label>
          <select
            data-testid="sales-select"
            value={form.assigned_to || ''}
            onChange={(e) => handleChange('assigned_to', e.target.value || null)}
            className="mt-1 input-mobile w-full"
          >
            <option value="">— Select Sales —</option>
            {sales.map((u) => (
              <option key={u.id} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          {sales.length === 0 && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
              No sales staff found yet.{' '}
              <button
                type="button"
                onClick={() => navigate('/admin/staff')}
                className="underline hover:text-amber-900"
                data-testid="admin-link-sales-empty"
              >
                Open Admin
              </button>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Need to edit sales staff?{' '}
            <button
              type="button"
              onClick={() => navigate('/admin/staff')}
              className="text-blue-600 hover:underline"
              data-testid="admin-link-sales"
            >
              Open Admin
            </button>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Finance Manager</label>
          <select
            data-testid="finance-select"
            value={form.finance_manager_id || ''}
            onChange={(e) => handleChange('finance_manager_id', e.target.value || null)}
            className="mt-1 input-mobile w-full"
          >
            <option value="">— Select Finance —</option>
            {finance.map((u) => (
              <option key={u.id} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          {finance.length === 0 && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
              No finance managers found yet.{' '}
              <button
                type="button"
                onClick={() => navigate('/admin/staff')}
                className="underline hover:text-amber-900"
                data-testid="admin-link-finance-empty"
              >
                Open Admin
              </button>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Need to edit finance managers?{' '}
            <button
              type="button"
              onClick={() => navigate('/admin/staff')}
              className="text-blue-600 hover:underline"
              data-testid="admin-link-finance"
            >
              Open Admin
            </button>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Delivery Coordinator</label>
          <select
            data-testid="delivery-select"
            value={form.delivery_coordinator_id || ''}
            onChange={(e) => handleChange('delivery_coordinator_id', e.target.value || null)}
            className="mt-1 input-mobile w-full"
          >
            <option value="">— Select Delivery —</option>
            {delivery.map((u) => (
              <option key={u.id} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          {delivery.length === 0 && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
              No delivery coordinators found yet.{' '}
              <button
                type="button"
                onClick={() => navigate('/admin/staff')}
                className="underline hover:text-amber-900"
                data-testid="admin-link-delivery-empty"
              >
                Open Admin
              </button>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Need to edit coordinators?{' '}
            <button
              type="button"
              onClick={() => navigate('/admin/staff')}
              className="text-blue-600 hover:underline"
              data-testid="admin-link-delivery"
            >
              Open Admin
            </button>
          </p>
        </div>
      </section>

      {/* Customer needs loaner */}
      <section className="flex items-center gap-3">
        <input
          data-testid="loaner-checkbox"
          id="needsLoaner"
          type="checkbox"
          checked={!!form.customer_needs_loaner}
          onChange={(e) => handleChange('customer_needs_loaner', e.target.checked)}
          className="h-5 w-5 accent-blue-600 appearance-auto"
        />
        <label htmlFor="needsLoaner" className="text-sm text-slate-800">
          Customer needs loaner
        </label>
      </section>

      {form.customer_needs_loaner ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="loaner-section">
          <div>
            <label className="block text-sm font-medium text-slate-700">Loaner Number</label>
            <input
              data-testid="loaner-number-input"
              type="text"
              value={form?.loanerForm?.loaner_number || ''}
              onChange={(e) => handleLoanerChange('loaner_number', e.target.value)}
              className="mt-1 input-mobile w-full"
              placeholder="e.g. L-1024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">ETA Return Date</label>
            <input
              data-testid="loaner-eta-input"
              type="date"
              value={form?.loanerForm?.eta_return_date || ''}
              onChange={(e) => handleLoanerChange('eta_return_date', e.target.value || '')}
              className="mt-1 input-mobile w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <input
              data-testid="loaner-notes-input"
              type="text"
              value={form?.loanerForm?.notes || ''}
              onChange={(e) => handleLoanerChange('notes', e.target.value)}
              className="mt-1 input-mobile w-full"
              placeholder="Optional"
            />
          </div>
        </section>
      ) : null}

      {/* Line Items */}
      <section className="space-y-4" data-testid="line-items-section">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Line Items</h3>
          <button
            type="button"
            onClick={addLineItem}
            className="btn-mobile btn-mobile-sm"
            data-testid="add-line-item-btn"
          >
            + Add Item
          </button>
        </div>
        {products.length === 0 && (
          <div className="p-3 rounded bg-amber-50 text-amber-800 text-sm">
            No products found yet. Add aftermarket products in{' '}
            <button
              type="button"
              onClick={() => navigate('/admin?section=products')}
              className="underline hover:text-amber-900"
              data-testid="admin-link-products"
            >
              Admin
            </button>
            .
          </div>
        )}

        {form.lineItems.map((item, idx) => {
          const itemKey = `li-${idx}`
          const onSiteSelected = !item.is_off_site
          return (
            <div key={itemKey} className="card-mobile space-y-3" data-testid={`line-${idx}`}>
              {/* Product + price */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700">Product</label>
                  <select
                    data-testid={`product-select-${idx}`}
                    value={item.product_id || ''}
                    onChange={(e) => handleLineChange(idx, 'product_id', e.target.value || '')}
                    className="mt-1 input-mobile w-full"
                  >
                    <option value="">— Select Product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Unit Price</label>
                  <input
                    data-testid={`unit-price-input-${idx}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      handleLineChange(idx, 'unit_price', Number(e.target.value || 0))
                    }
                    className="mt-1 input-mobile w-full input-currency"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="btn-mobile btn-mobile-sm w-full"
                    data-testid={`remove-line-item-btn-${idx}`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Service location tiles (On-Site vs Off-Site) */}
              <div className="flex gap-3">
                {/* On-Site */}
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer border rounded px-3 py-2
                    ${!item.is_off_site ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name={`serviceLocation_${itemKey}`}
                    checked={!item.is_off_site}
                    onChange={() => handleLineChange(idx, 'is_off_site', false)}
                    className="h-4 w-4 accent-blue-600 appearance-auto"
                    data-testid={`onsite-radio-${idx}`}
                  />
                  <span className="text-sm">On-Site</span>
                </label>

                {/* Off-Site */}
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer border rounded px-3 py-2
                    ${item.is_off_site ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name={`serviceLocation_${itemKey}`}
                    checked={!!item.is_off_site}
                    onChange={() => handleLineChange(idx, 'is_off_site', true)}
                    className="h-4 w-4 accent-blue-600 appearance-auto"
                    data-testid={`offsite-radio-${idx}`}
                  />
                  <span className="text-sm">Off-Site</span>
                </label>
              </div>

              {/* Scheduling controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Date Scheduled</label>
                  <input
                    data-testid={`promised-date-${idx}`}
                    type="date"
                    value={item.promised_date || ''}
                    onChange={(e) => handleLineChange(idx, 'promised_date', e.target.value || '')}
                    className="mt-1 input-mobile w-full"
                  />
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <input
                    id={`requiresScheduling-${idx}`}
                    data-testid={`requires-scheduling-${idx}`}
                    type="checkbox"
                    checked={!!item.requires_scheduling}
                    onChange={(e) => handleLineChange(idx, 'requires_scheduling', e.target.checked)}
                    className="h-5 w-5 accent-blue-600 appearance-auto"
                  />
                  <label htmlFor={`requiresScheduling-${idx}`} className="text-sm">
                    Requires Scheduling
                  </label>
                </div>

                {!item.requires_scheduling && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      No Schedule Reason
                    </label>
                    <input
                      data-testid={`no-schedule-reason-${idx}`}
                      type="text"
                      value={item.no_schedule_reason || ''}
                      onChange={(e) =>
                        handleLineChange(idx, 'no_schedule_reason', e.target.value || '')
                      }
                      className="mt-1 input-mobile w-full"
                    />
                    {lineErrors?.[idx]?.noScheduleReason && (
                      <p className="mt-1 text-sm text-red-600">
                        Reason is required when not scheduling.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* Calendar notes (optional) */}
      <section>
        <label className="block text-sm font-medium text-slate-700">Calendar Notes</label>
        <textarea
          data-testid="calendar-notes-input"
          value={form.calendar_notes || ''}
          onChange={(e) => handleChange('calendar_notes', e.target.value)}
          className="mt-1 input-mobile w-full"
          rows={3}
        />
      </section>

      {/* Sticky actions + total (mobile-safe) */}
      <section
        className="sticky bottom-20 md:bottom-0 z-40 -mx-4 px-4 py-3 bg-white/90 backdrop-blur border-t shadow-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2" data-testid="deal-total">
            <span className="text-sm text-slate-600">Total</span>
            <span className="text-lg font-semibold" data-testid="deal-total-amount">
              {currencyFmt.format(dealSubtotal || 0)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="btn-mobile button-outline-enhanced"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-mobile button-enhanced"
              data-testid="save-deal-btn"
            >
              {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Deal'}
            </button>
          </div>
        </div>
      </section>

      {errorMsg ? (
        <div className="mt-3 p-3 rounded bg-red-50 text-red-700" data-testid="save-error">
          {errorMsg}
        </div>
      ) : null}
      {savedAt && !errorMsg ? (
        <div className="mt-3 p-3 rounded bg-emerald-50 text-emerald-700" data-testid="save-success">
          Saved successfully.
        </div>
      ) : null}
      <UnsavedChangesGuard isDirty={isDirty} isSubmitting={saving} />
    </form>
  )
}
