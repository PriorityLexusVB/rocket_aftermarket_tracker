// src/utils/lineItemUtils.js
// Small helpers to keep payloads safe & consistent with DB columns.

export function toMoney(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.round(x * 100) / 100
}

// Normalize a single line item to job_parts columns we know exist.
export function normalizeLineItem(it) {
  if (!it) return null
  return {
    id: it?.id ?? undefined, // keep if present
    product_id: it?.product_id ?? null, // can be null
    vendor_id: it?.vendor_id ?? it?.vendorId ?? null, // NEW: per-line vendor support
    part_name: (it?.part_name || it?.name || '')?.trim(),
    sku: (it?.sku || '')?.trim(),
    quantity_used: Number(it?.quantity_used ?? it?.quantity ?? 1) || 1,
    unit_price: toMoney(it?.unit_price ?? it?.price ?? 0),
    notes: (it?.notes || it?.description || '')?.trim(),
  }
}

export function sanitizeLineItems(arr) {
  if (!Array.isArray(arr)) return []
  return arr?.map(normalizeLineItem)?.filter(Boolean)
}

// Safe deal payload for the jobs table.
export function sanitizeDealPayload(form) {
  const safe = {
    title: (form?.title || '')?.trim(),
    description: (form?.description || '')?.trim(),
    vendor_id: form?.vendor_id || null,
    vehicle_id: form?.vehicle_id || null,
    job_status: form?.job_status || 'new',
    priority: form?.priority || 'normal',
    scheduled_start_time: form?.scheduled_start_time || null,
    scheduled_end_time: form?.scheduled_end_time || null,
    estimated_hours: form?.estimated_hours != null ? Number(form?.estimated_hours) : null,
    estimated_cost: form?.estimated_cost != null ? toMoney(form?.estimated_cost) : null,
    actual_cost: form?.actual_cost != null ? toMoney(form?.actual_cost) : null,
    location: (form?.location || '')?.trim() || null,
  }
  // Strip undefined so we don't send garbage to Supabase
  Object.keys(safe)?.forEach((k) => safe?.[k] === undefined && delete safe?.[k])
  return safe
}
