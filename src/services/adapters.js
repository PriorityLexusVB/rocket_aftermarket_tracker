/**
 * Adapters for data transformation between API entities and UI draft forms
 */

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * @param {string} s - Input phone string
 * @returns {string} Normalized phone or empty string
 */
export const normalizePhone = (s = '') => {
  const digits = (s.match(/\d+/g) || []).join('').replace(/^1?(\d{10})$/, '$1')
  return digits ? `+1${digits}` : ''
}

/**
 * Convert entity (DB row) to draft form structure
 * @param {Object} e - Entity from database
 * @returns {Object} Draft form object
 */
export const entityToDraft = (e = {}) => ({
  id: e.id ?? '',
  job_number: e.job_number ?? '',
  description: e.description ?? '',
  customer_phone: e.customer_phone ?? '',
  customer_needs_loaner: !!e.customer_needs_loaner,
  loanerForm: e.customer_needs_loaner
    ? {
        customer_name: e.loaner_customer_name ?? '',
        vin: e.loaner_vehicle_vin ?? '',
        plate: e.loaner_plate ?? '',
        eta_return_date: e.loaner_eta_return_date ?? '',
        notes: e.loaner_notes ?? '',
      }
    : null,
  lineItems: (e.job_parts ?? []).map((p) => ({
    id: p.id ?? '',
    product_id: p.product_id ?? '',
    unit_price: Number(p.unit_price ?? 0),
    quantity_used: Number(p.quantity_used ?? 1),
    promised_date: p.promised_date ?? '',
  })),
})

/**
 * Convert draft form to create payload
 * @param {Object} d - Draft form object
 * @returns {Object} Create payload for API
 */
export const draftToCreatePayload = (d = {}) => ({
  job_number: d.job_number ?? '',
  description: d.description ?? '',
  customer_phone: normalizePhone(d.customer_phone ?? ''),
  customer_needs_loaner: !!d.customer_needs_loaner,
  loanerForm: d.customer_needs_loaner ? d.loanerForm ?? null : null,
  lineItems: (d.lineItems ?? []).map((li) => ({
    product_id: li.product_id ?? '',
    unit_price: Number(li.unit_price ?? 0),
    quantity_used: Number(li.quantity_used ?? 1),
    promised_date: li.promised_date ?? '',
  })),
})

/**
 * Convert draft form to update payload
 * @param {string} id - Entity ID
 * @param {Object} d - Draft form object
 * @returns {Object} Update payload for API
 */
export const draftToUpdatePayload = (id, d) => ({
  id,
  ...draftToCreatePayload(d),
  updated_at: new Date().toISOString(),
})
