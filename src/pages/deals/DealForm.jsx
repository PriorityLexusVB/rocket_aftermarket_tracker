// src/pages/deals/DealForm.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  getVendors,
  getProducts,
  getSalesConsultants,
  getFinanceManagers,
  getDeliveryCoordinators,
} from '../../services/dropdownService'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lineErrors, setLineErrors] = useState({})
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [finance, setFinance] = useState([])
  const [delivery, setDelivery] = useState([])

  const [form, setForm] = useState({
    id: initial.id || undefined,
    job_number: initial.job_number || '',
    vehicle_id: initial.vehicle_id || '',
    stock_number: initial.stock_number || '', // display only if you don’t want editable
    title: initial.title || '',
    description: initial.description || '',
    vendor_id: initial.vendor_id || '',
    assigned_to: initial.assigned_to || '',
    finance_manager_id: initial.finance_manager_id || '',
    delivery_coordinator_id: initial.delivery_coordinator_id || '',
    customer_mobile: initial.customer_mobile || '',
    customer_needs_loaner: !!initial.customer_needs_loaner,
    lineItems: initial.lineItems?.length ? initial.lineItems : [emptyLineItem()],
    promised_date: initial.promised_date || '',
    scheduled_start_time: initial.scheduled_start_time || '',
    scheduled_end_time: initial.scheduled_end_time || '',
    calendar_notes: initial.calendar_notes || '',
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [vOpts, pOpts, sOpts, fOpts, dOpts] = await Promise.all([
          getVendors(),
          getProducts(),
          getSalesConsultants(),
          getFinanceManagers(),
          getDeliveryCoordinators(),
        ])
        if (!mounted) return
        setVendors(vOpts || [])
        setProducts(pOpts || [])
        setSales(sOpts || [])
        setFinance(fOpts || [])
        setDelivery(dOpts || [])
      } catch (e) {
        console.error('DealForm dropdown load error', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const productMap = useMemo(() => {
    const m = new Map()
    ;(products || []).forEach((p) => {
      // options come as { id, value, label, unit_price }
      const key = p.id ?? p.value
      if (key != null) m.set(String(key), p)
    })
    return m
  }, [products])

  const handleChange = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

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

  const submit = async (e) => {
    e?.preventDefault?.()
    setSaving(true)
    try {
      // Guard: If requires_scheduling === false, no_schedule_reason is required
      const missingReasonIdxs = (form.lineItems || []).reduce((arr, li, idx) => {
        const requires = !!li?.requires_scheduling
        const reason = String(li?.no_schedule_reason || '').trim()
        if (!requires && !reason) arr.push(idx)
        return arr
      }, [])
      if (missingReasonIdxs.length > 0) {
        const errs = {}
        missingReasonIdxs.forEach((i) => {
          errs[i] = { ...(errs[i] || {}), noScheduleReason: true }
        })
        setLineErrors(errs)
        setSaving(false)
        return
      } else {
        setLineErrors({})
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
        customer_needs_loaner: !!form.customer_needs_loaner,
        // mirror phone fields for downstream services
        customer_phone: form.customer_phone || form.customer_mobile || '',
        customerPhone: form.customerPhone || form.customer_mobile || form.customer_phone || '',
        lineItems: normalizedLineItems,
      }

      if (onSave) {
        // parent-provided save handler is authoritative — let it close the form
        await onSave(payload)
        onCancel?.()
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
        }
      }
    } catch (err) {
      console.error('Deal save failed', err)
      alert('Save failed. See console for details.')
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
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            data-testid="title-input"
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="mt-1 input-mobile w-full"
            placeholder="Describe the job"
            required
          />
        </div>

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
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
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

        {form.lineItems.map((item, idx) => {
          const itemKey = `li-${idx}`
          const onSiteSelected = !item.is_off_site
          return (
            <div key={itemKey} className="card-mobile space-y-3" data-testid={`line-${idx}`}>
              {/* Product + qty + price */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                  <label className="block text-sm font-medium text-slate-700">Qty</label>
                  <input
                    data-testid={`qty-input-${idx}`}
                    type="number"
                    min={1}
                    value={item.quantity_used}
                    onChange={(e) =>
                      handleLineChange(idx, 'quantity_used', Number(e.target.value || 1))
                    }
                    className="mt-1 input-mobile w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Unit Price</label>
                  <input
                    data-testid={`unit-price-input-${idx}`}
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      handleLineChange(idx, 'unit_price', Number(e.target.value || 0))
                    }
                    className="mt-1 input-mobile w-full"
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
                  <label className="block text-sm font-medium text-slate-700">Promised Date</label>
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

      {/* Actions */}
      <section className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-mobile button-enhanced"
          data-testid="save-deal-btn"
        >
          {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Deal'}
        </button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="btn-mobile button-outline-enhanced"
        >
          Cancel
        </button>
      </section>
    </form>
  )
}
