// src/components/deals/formAdapters.js
// Pure adapter functions for DealForm V2 - no React dependencies

/**
 * Converts a DB entity (job + line items + loaner) into a draft shape for DealForm.
 * This preserves all existing fields and normalizes loaner presence.
 * @param {Object} entity - The deal entity from the database
 * @returns {Object} Draft form state
 */
export function entityToDraft(entity = {}) {
  // Handle both direct entity and nested structure from dealService
  const base = entity?.deal || entity

  // Normalize line items from either job_parts or lineItems
  const rawLineItems = base?.job_parts || base?.lineItems || []
  const lineItems = Array.isArray(rawLineItems)
    ? rawLineItems.map((li) => ({
        product_id: li?.product_id || li?.productId || '',
        quantity_used: Number(li?.quantity_used || li?.quantity || 1),
        unit_price: Number(li?.unit_price || li?.unitPrice || li?.price || 0),
        promised_date: li?.promised_date || li?.lineItemPromisedDate || '',
        requires_scheduling:
          li?.requires_scheduling !== undefined
            ? !!li.requires_scheduling
            : li?.requiresScheduling !== undefined
              ? !!li.requiresScheduling
              : true,
        no_schedule_reason: li?.no_schedule_reason || li?.noScheduleReason || '',
        is_off_site:
          li?.is_off_site !== undefined
            ? !!li.is_off_site
            : li?.isOffSite !== undefined
              ? !!li.isOffSite
              : false,
      }))
    : []

  // Detect loaner presence from multiple sources
  const hasLoaner =
    !!base?.customer_needs_loaner ||
    !!base?.loaner_number ||
    !!base?.loanerForm?.loaner_number ||
    false

  // Build loaner form data if present
  const loanerForm = hasLoaner
    ? {
        loaner_number:
          base?.loanerForm?.loaner_number || base?.loaner_number || base?.loaner?.loaner_number || '',
        eta_return_date:
          base?.loanerForm?.eta_return_date ||
          base?.loaner_eta_return_date ||
          base?.loaner?.eta_return_date ||
          '',
        notes: base?.loanerForm?.notes || base?.loaner?.notes || '',
      }
    : {
        loaner_number: '',
        eta_return_date: '',
        notes: '',
      }

  return {
    id: base?.id || undefined,
    updated_at: base?.updated_at || undefined,
    job_number: base?.job_number || '',
    vehicle_id: base?.vehicle_id || '',
    stock_number: base?.stock_number || base?.vehicle?.stock_number || '',
    description: base?.description || base?.title || '',
    vendor_id: base?.vendor_id || '',
    assigned_to: base?.assigned_to || '',
    finance_manager_id: base?.finance_manager_id || '',
    delivery_coordinator_id: base?.delivery_coordinator_id || '',
    customer_mobile: base?.customer_mobile || base?.customer_phone || '',
    customer_needs_loaner: hasLoaner,
    loanerForm,
    lineItems: lineItems.length > 0 ? lineItems : [],
    promised_date: base?.promised_date || '',
    scheduled_start_time: base?.scheduled_start_time || '',
    scheduled_end_time: base?.scheduled_end_time || '',
    calendar_notes: base?.calendar_notes || '',
  }
}

/**
 * Converts a draft form state into a payload for dealService.createDeal
 * Strips blanks, normalizes numbers, and ensures field consistency
 * @param {Object} draft - The form state from DealForm
 * @returns {Object} Create payload
 */
export function draftToCreatePayload(draft = {}) {
  // Normalize phone
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

  // Normalize line items
  const normalizedLineItems = (draft?.lineItems || [])
    .filter((li) => li?.product_id) // Only include items with a product
    .map((li) => ({
      product_id: li.product_id || null,
      quantity_used: Number(li.quantity_used || 1),
      unit_price: Number(li.unit_price || 0),
      promised_date: li.promised_date || null,
      requires_scheduling: !!li.requires_scheduling,
      no_schedule_reason: li.requires_scheduling ? null : li.no_schedule_reason || null,
      is_off_site: !!li.is_off_site,
      // Keep camelCase for compatibility
      lineItemPromisedDate: li.promised_date || null,
      requiresScheduling: !!li.requires_scheduling,
      noScheduleReason: li.requires_scheduling ? null : li.no_schedule_reason || null,
      isOffSite: !!li.is_off_site,
    }))

  // Build loaner data only if toggle is on and number is provided
  const loanerData =
    draft?.customer_needs_loaner && draft?.loanerForm?.loaner_number?.trim()
      ? {
          loaner_number: draft.loanerForm.loaner_number.trim(),
          eta_return_date: draft.loanerForm.eta_return_date || null,
          notes: draft.loanerForm.notes?.trim() || '',
        }
      : null

  return {
    job_number: draft?.job_number?.trim() || '',
    vehicle_id: draft?.vehicle_id || null,
    stock_number: draft?.stock_number?.trim() || '',
    description: draft?.description?.trim() || '',
    vendor_id: draft?.vendor_id || null,
    assigned_to: draft?.assigned_to || null,
    finance_manager_id: draft?.finance_manager_id || null,
    delivery_coordinator_id: draft?.delivery_coordinator_id || null,
    customer_mobile: normalizePhone(draft?.customer_mobile),
    customer_phone: normalizePhone(draft?.customer_mobile),
    customerPhone: normalizePhone(draft?.customer_mobile),
    customer_needs_loaner: !!draft?.customer_needs_loaner,
    loanerForm: loanerData,
    lineItems: normalizedLineItems,
    promised_date: draft?.promised_date || null,
    scheduled_start_time: draft?.scheduled_start_time || null,
    scheduled_end_time: draft?.scheduled_end_time || null,
    calendar_notes: draft?.calendar_notes?.trim() || '',
    org_id: draft?.org_id || undefined,
  }
}

/**
 * Converts a draft form state into a payload for dealService.updateDeal
 * Includes the ID and version info for optimistic concurrency
 * @param {string|number} id - The deal ID
 * @param {Object} draft - The form state from DealForm
 * @returns {Object} Update payload
 */
export function draftToUpdatePayload(id, draft = {}) {
  const createPayload = draftToCreatePayload(draft)
  return {
    ...createPayload,
    id,
    updated_at: draft?.updated_at || undefined,
  }
}
