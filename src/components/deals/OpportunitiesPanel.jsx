import React, { useEffect, useMemo, useState } from 'react'
import {
  createOpportunity,
  deleteOpportunity,
  listByJobId,
  updateOpportunity,
} from '@/services/opportunitiesService'

const emptyNew = {
  product_id: '',
  name: '',
  quantity: 1,
  unit_price: '',
  status: 'open',
  decline_reason: '',
}

function asNumberOrNull(value) {
  if (value === '' || value === undefined || value === null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function asIntOrDefault(value, defaultValue = 1) {
  const num = Number(value)
  if (!Number.isFinite(num)) return defaultValue
  return Math.max(1, Math.trunc(num))
}

export default function OpportunitiesPanel({ jobId, products = [] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState({})
  const [creating, setCreating] = useState(false)
  const [newOpp, setNewOpp] = useState(emptyNew)

  const productOptions = useMemo(() => {
    return Array.isArray(products) ? products : []
  }, [products])

  useEffect(() => {
    if (!jobId) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await listByJobId(jobId)
        if (!alive) return
        setItems(Array.isArray(rows) ? rows : [])
        setDrafts({})
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load opportunities')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [jobId])

  function getProductLabel(productId) {
    const match = productOptions.find((p) => (p?.value || p?.id) === productId)
    return match?.label || match?.name || ''
  }

  function updateDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }))
  }

  async function handleSaveRow(id) {
    const base = items.find((o) => o?.id === id)
    const d = drafts[id] || {}
    const merged = { ...base, ...d }

    const payload = {
      product_id: merged.product_id || null,
      name: String(merged.name || '').trim(),
      quantity: asIntOrDefault(merged.quantity, 1),
      unit_price: asNumberOrNull(merged.unit_price),
      status: merged.status || 'open',
      decline_reason:
        (merged.status || 'open') === 'declined'
          ? String(merged.decline_reason || '').trim()
          : null,
    }

    if (!payload.name) {
      setError('Opportunity name is required')
      return
    }

    setError('')
    try {
      const updated = await updateOpportunity(id, payload)
      setItems((prev) => prev.map((o) => (o?.id === id ? updated : o)))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (e) {
      setError(e?.message || 'Failed to update opportunity')
    }
  }

  async function handleDeleteRow(id) {
    if (!confirm('Delete this opportunity?')) return
    setError('')
    try {
      await deleteOpportunity(id)
      setItems((prev) => prev.filter((o) => o?.id !== id))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (e) {
      setError(e?.message || 'Failed to delete opportunity')
    }
  }

  async function handleCreate() {
    if (!jobId) return
    const name = String(newOpp.name || '').trim()
    if (!name) {
      setError('Opportunity name is required')
      return
    }

    setCreating(true)
    setError('')
    try {
      const created = await createOpportunity({
        job_id: jobId,
        product_id: newOpp.product_id || null,
        name,
        quantity: asIntOrDefault(newOpp.quantity, 1),
        unit_price: asNumberOrNull(newOpp.unit_price),
        status: newOpp.status || 'open',
        decline_reason:
          newOpp.status === 'declined' ? String(newOpp.decline_reason || '').trim() : null,
      })

      setItems((prev) => [...prev, created])
      setNewOpp(emptyNew)
    } catch (e) {
      setError(e?.message || 'Failed to create opportunity')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border bg-white p-4 shadow-sm"
      data-testid="opportunities-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Opportunities</div>
          <div className="text-xs text-gray-600">
            Track upsells (open/accepted/declined). Tracking-only in v1.
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {items.length === 0 && !loading ? (
        <div className="text-sm text-gray-600">No opportunities yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const d = drafts[o.id] || {}
            const effective = { ...o, ...d }
            const effectiveStatus = effective.status || 'open'

            return (
              <div key={o.id} className="rounded-lg border p-3">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Product (optional)
                    </label>
                    <select
                      value={effective.product_id || ''}
                      onChange={(e) => {
                        const productId = e.target.value || ''
                        const nextName = effective.name
                          ? effective.name
                          : getProductLabel(productId)
                        updateDraft(o.id, { product_id: productId || null, name: nextName })
                      }}
                      className="mt-1 input-mobile w-full"
                    >
                      <option value="">—</option>
                      {productOptions.map((p) => (
                        <option key={p.id || p.value} value={p.value || p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">Name</label>
                    <input
                      type="text"
                      value={effective.name || ''}
                      onChange={(e) => updateDraft(o.id, { name: e.target.value })}
                      className="mt-1 input-mobile w-full"
                      placeholder="e.g., Wheel locks"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Qty</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={effective.quantity ?? 1}
                      onChange={(e) => updateDraft(o.id, { quantity: e.target.value })}
                      className="mt-1 input-mobile w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Unit $</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={effective.unit_price ?? ''}
                      onChange={(e) => updateDraft(o.id, { unit_price: e.target.value })}
                      className="mt-1 input-mobile w-full input-currency"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Status</label>
                    <select
                      value={effectiveStatus}
                      onChange={(e) => {
                        const nextStatus = e.target.value
                        updateDraft(o.id, {
                          status: nextStatus,
                          decline_reason:
                            nextStatus === 'declined' ? effective.decline_reason || '' : '',
                        })
                      }}
                      className="mt-1 input-mobile w-full"
                    >
                      <option value="open">Open</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>

                  {effectiveStatus === 'declined' ? (
                    <div className="md:col-span-6">
                      <label className="block text-xs font-medium text-slate-700">
                        Decline reason
                      </label>
                      <input
                        type="text"
                        value={effective.decline_reason || ''}
                        onChange={(e) => updateDraft(o.id, { decline_reason: e.target.value })}
                        className="mt-1 input-mobile w-full"
                        placeholder="Optional but recommended"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(o.id)}
                    className="btn-mobile btn-mobile-sm"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveRow(o.id)}
                    className="btn-mobile btn-mobile-sm button-enhanced"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t pt-3">
        <div className="text-sm font-semibold text-gray-900">Add Opportunity</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Product (optional)</label>
            <select
              value={newOpp.product_id}
              onChange={(e) => {
                const productId = e.target.value || ''
                const nextName = newOpp.name ? newOpp.name : getProductLabel(productId)
                setNewOpp((prev) => ({ ...prev, product_id: productId, name: nextName }))
              }}
              className="mt-1 input-mobile w-full"
            >
              <option value="">—</option>
              {productOptions.map((p) => (
                <option key={p.id || p.value} value={p.value || p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Name</label>
            <input
              type="text"
              value={newOpp.name}
              onChange={(e) => setNewOpp((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 input-mobile w-full"
              placeholder="e.g., Door edge guards"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Qty</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={newOpp.quantity}
              onChange={(e) => setNewOpp((prev) => ({ ...prev, quantity: e.target.value }))}
              className="mt-1 input-mobile w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Unit $</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={newOpp.unit_price}
              onChange={(e) => setNewOpp((prev) => ({ ...prev, unit_price: e.target.value }))}
              className="mt-1 input-mobile w-full input-currency"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Status</label>
            <select
              value={newOpp.status}
              onChange={(e) =>
                setNewOpp((prev) => ({
                  ...prev,
                  status: e.target.value,
                  decline_reason: e.target.value === 'declined' ? prev.decline_reason : '',
                }))
              }
              className="mt-1 input-mobile w-full"
            >
              <option value="open">Open</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          {newOpp.status === 'declined' ? (
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-700">Decline reason</label>
              <input
                type="text"
                value={newOpp.decline_reason}
                onChange={(e) => setNewOpp((prev) => ({ ...prev, decline_reason: e.target.value }))}
                className="mt-1 input-mobile w-full"
                placeholder="Optional but recommended"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!jobId || creating}
            className="btn-mobile button-enhanced"
          >
            {creating ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </section>
  )
}
