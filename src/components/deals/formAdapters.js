// Phone normalization helper
export const normalizePhone = (s = '') => {
  const d = (s.match(/\d/g) || []).join('')
  if (d.length === 10) return `+1${d}`
  if (d.startsWith('1') && d.length === 11) return `+${d}`
  return d ? `+${d}` : ''
}

export function normalizeLineItems(draft = {}) {
  const raw = Array.isArray(draft.items)
    ? draft.items
    : Array.isArray(draft.lineItems)
      ? draft.lineItems
      : []
  return raw
    .filter(Boolean)
    .map((it) => {
      const unitPrice = Number(it.unitPrice ?? it.unit_price ?? it.price ?? 0)
      const quantity = Number(it.quantity ?? it.qty ?? it.quantity_used ?? 1)
      return {
        ...it,
        unitPrice,
        quantity,
        // Remove redundant fields for clean output
        unit_price: undefined,
        qty: undefined,
        price: undefined,
        quantity_used: undefined,
      }
    })
    .filter(
      (it) => Number.isFinite(it.unitPrice) && Number(isNaN(it.quantity) ? 0 : it.quantity) >= 0
    )
    .filter((it) => it.quantity > 0)
    .map(({ unit_price, qty, price, quantity_used, ...rest }) => rest) // Clean up undefined fields
}

export function stripLoanerWhenOff(draft = {}) {
  const on = !!(draft.customer_needs_loaner ?? draft.customerNeedsLoaner)
  if (on) return { ...draft }
  const clone = { ...draft }
  // Remove all loaner-related keys when toggle is off
  for (const k of Object.keys(clone)) {
    if (k.toLowerCase().includes('loaner')) delete clone[k]
  }
  return clone
}

export function entityToDraft(entity = {}) {
  const draft = {
    ...entity,
    job_number: entity.job_number ?? '',
    description: entity.description ?? '',
    vendor_id: entity.vendor_id ?? '',
    assigned_to: entity.assigned_to ?? entity.sales_consultant_id ?? '',
    finance_manager_id: entity.finance_manager_id ?? '',
    delivery_coordinator_id: entity.delivery_coordinator_id ?? '',
    customer_mobile: entity.customer_mobile ?? entity.customer_phone ?? '',
    customer_needs_loaner: !!entity.customer_needs_loaner,
  }
  
  // Handle loanerForm: null if toggle is off, object if on
  if (entity.customer_needs_loaner) {
    draft.loanerForm = entity.loanerForm || {
      loaner_number: entity.loaner_number ?? '',
      eta_return_date: entity.eta_return_date ?? '',
      notes: entity.loaner_notes ?? '',
    }
  } else {
    draft.loanerForm = {
      loaner_number: '',
      eta_return_date: '',
      notes: '',
    }
  }
  
  // Handle lineItems from job_parts
  draft.lineItems = (entity.job_parts ?? []).map((p) => ({
    product_id: p.product_id ?? '',
    unit_price: Number(p.unit_price ?? 0),
    quantity_used: Number(p.quantity_used ?? 1),
    promised_date: p.promised_date ?? '',
    requires_scheduling: p.requires_scheduling ?? true,
    is_off_site: p.is_off_site ?? false,
    service_location: p.service_location ?? (p.is_off_site ? 'offsite' : 'onsite'),
  }))
  
  // Keep backward compatible items field
  draft.items = normalizeLineItems(draft)
  
  return draft
}

export function draftToCreatePayload(draft = {}) {
  // Strip loaner fields first if toggle is off
  const stripped = stripLoanerWhenOff(draft)
  
  const payload = {
    ...stripped,
    job_number: stripped.job_number ?? '',
    description: stripped.description ?? '',
    vendor_id: stripped.vendor_id ?? '',
    assigned_to: stripped.assigned_to ?? stripped.sales_consultant_id ?? '',
    finance_manager_id: stripped.finance_manager_id ?? '',
    delivery_coordinator_id: stripped.delivery_coordinator_id ?? '',
    customer_needs_loaner: !!stripped.customer_needs_loaner,
  }
  
  // Normalize phone if customer_mobile is present
  if (stripped.customer_mobile) {
    payload.customer_phone = normalizePhone(stripped.customer_mobile)
  }
  
  // Handle loanerForm: null if toggle is off, object if on
  if (stripped.customer_needs_loaner && stripped.loanerForm) {
    payload.loanerForm = { ...stripped.loanerForm }
  } else {
    payload.loanerForm = null
  }
  
  // Normalize lineItems
  payload.lineItems = normalizeLineItems(stripped)
  payload.items = payload.lineItems
  
  return payload
}

export function draftToUpdatePayload(original = {}, draft = {}) {
  const payload = draftToCreatePayload(draft)
  if (original?.id && !payload.id) payload.id = original.id
  if (draft.id) payload.id = draft.id
  payload.updated_at = draft.updated_at ?? new Date().toISOString()
  return payload
}

export default {
  normalizeLineItems,
  stripLoanerWhenOff,
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
}
