// src/pages/deals/DealForm.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  getVendors,
  getProducts,
  getSalesConsultants,
  getFinanceManagers,
  getDeliveryCoordinators
} from '../../services/dropdownService'

// Optional fallback to service-layer create/update if parent didn't pass onSave
let dealService
try {
  dealService = await import('../../services/dealService.js')
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
  is_off_site: false
})

export default function DealForm({
  initial = {},
  mode = 'create', // 'create' | 'edit'
  onCancel,
  onSave // optional (payload) => Promise<{id}>
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    calendar_notes: initial.calendar_notes || ''
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [v, p, s, f, d] = await Promise.all([
          getVendors(),
          getProducts(),
          getSalesConsultants(),
          getFinanceManagers(),
          getDeliveryCoordinators()
        ])
        if (!alive) return
        setVendors(v)
        setProducts(p)
        setSales(s)
        setFinance(f)
        setDelivery(d)
      } catch (e) {
        console.error('DealForm dropdown load error', e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const productMap = useMemo(() => {
    const m = new Map()
    products.forEach((p) => m.set(p.id, p))
    return m
  }, [products])

  const handleChange = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleLineChange = (idx, key, val) =>
    setForm((prev) => {
      const list = [...prev.lineItems]
      list[idx] = { ...list[idx], [key]: val }
      // auto-fill unit_price when product selected
      if (key === 'product_id') {
        const prod = productMap.get(val)
        if (prod) list[idx].unit_price = Number(prod.unit_price || 0)
      }
      return { ...prev, lineItems: list }
    })

  const addLineItem = () => setForm((p) => ({ ...p, lineItems: [...p.lineItems, emptyLineItem()] }))
  const removeLineItem = (idx) =>
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }))

  const submit = async (e) => {
    e?.preventDefault?.()
    setSaving(true)
    try {
      const payload = {
        ...form,
        // normalize booleans
        customer_needs_loaner: !!form.customer_needs_loaner,
        lineItems: (form.lineItems || []).map((li) => ({
          product_id: li.product_id || null,
          quantity_used: Number(li.quantity_used || 1),
          unit_price: Number(li.unit_price || 0),
          promised_date: li.promised_date || null,
          requires_scheduling: !!li.requires_scheduling,
          no_schedule_reason: li.no_schedule_reason || null,
          is_off_site: !!li.is_off_site
        }))
      }

      if (onSave) {
        await onSave(payload)
      } else if (dealService) {
        if (mode === 'edit' && payload.id) {
          await dealService.updateDeal(payload.id, payload)
        } else {
          await dealService.createDeal(payload)
        }
      }
      // success — back to parent
      onCancel?.()
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
              <option key={v.id} value={v.id}>
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
              <option key={u.id} value={u.id}>
                {u.full_name}
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
              <option key={u.id} value={u.id}>
                {u.full_name}
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
              <option key={u.id} value={u.id}>
                {u.full_name}
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
                      <option key={p.id} value={p.id}>
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
                    ${onSiteSelected ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300' : 'border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name={`serviceLocation_${itemKey}`}
                    checked={onSiteSelected}
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
                    onChange={(e) =>
                      handleLineChange(idx, 'requires_scheduling', e.target.checked)
                    }
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
