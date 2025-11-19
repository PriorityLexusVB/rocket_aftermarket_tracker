// Phone normalization helper with edge case handling
export const normalizePhone = (s = '') => {
  if (!s || typeof s !== 'string') return ''

  // Handle extensions (preserve original if extension detected)
  // Common patterns: ext, x, #, extension
  if (/\b(ext|x|extension|#)\s*\.?\s*\d+/i.test(s)) {
    // Return original for manual review - extensions need special handling
    return s.trim()
  }

  // Extract only digits
  const d = (s.match(/\d/g) || []).join('')

  // Validate minimum length (at least 10 digits for valid phone)
  if (d.length < 10) {
    // Return original if too short - likely invalid or incomplete
    return s.trim()
  }

  // Validate maximum length (reasonable phone number limit)
  if (d.length > 15) {
    // E.164 max is 15 digits - return original if exceeded
    return s.trim()
  }

  // US/Canada numbers (NANP - North American Numbering Plan)
  if (d.length === 10) {
    return `+1${d}` // Add US/Canada country code
  }

  if (d.startsWith('1') && d.length === 11) {
    return `+${d}` // Already has US/Canada country code
  }

  // International numbers (10-15 digits, not US/Canada)
  // Format as E.164 with + prefix
  return `+${d}`
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
      const result = {
        ...it,
        unitPrice,
        quantity,
      }

      // Preserve scheduling fields with proper naming
      if (it.requires_scheduling !== undefined || it.requiresScheduling !== undefined) {
        result.requiresScheduling = it.requiresScheduling ?? it.requires_scheduling ?? true
      }
      if (it.is_off_site !== undefined || it.isOffSite !== undefined) {
        result.isOffSite = it.isOffSite ?? it.is_off_site ?? false
      }
      if (it.promised_date !== undefined) {
        result.promisedDate = it.promised_date
      }

      // Remove redundant fields for clean output
      delete result.unit_price
      delete result.qty
      delete result.price
      delete result.quantity_used
      delete result.requires_scheduling
      delete result.is_off_site
      delete result.promised_date

      return result
    })
    .filter(
      (it) => Number.isFinite(it.unitPrice) && Number(isNaN(it.quantity) ? 0 : it.quantity) >= 0
    )
    .filter((it) => it.quantity > 0)
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
    scheduled_start_time: stripped.scheduled_start_time || null,
    scheduled_end_time: stripped.scheduled_end_time || null,
    scheduling_location: stripped.scheduling_location || null,
    scheduling_notes: stripped.scheduling_notes || null,
    color_code: stripped.color_code || null,
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
  // Support both signatures: (id, draft) and (original, draft)
  let id, actualDraft
  if (typeof original === 'string') {
    // Signature: (id, draft)
    id = original
    actualDraft = draft
  } else {
    // Signature: (original, draft)
    id = original?.id
    actualDraft = draft
  }

  const payload = draftToCreatePayload(actualDraft)
  if (id && !payload.id) payload.id = id
  if (actualDraft.id) payload.id = actualDraft.id
  payload.updated_at = actualDraft.updated_at ?? new Date().toISOString()
  payload.scheduled_start_time = actualDraft.scheduled_start_time || null
  payload.scheduled_end_time = actualDraft.scheduled_end_time || null
  payload.scheduling_location = actualDraft.scheduling_location || null
  payload.scheduling_notes = actualDraft.scheduling_notes || null
  payload.color_code = actualDraft.color_code || null
  return payload
}

export default {
  normalizeLineItems,
  stripLoanerWhenOff,
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
}
