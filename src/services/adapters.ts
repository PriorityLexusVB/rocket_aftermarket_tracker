export const normalizePhone = (s = '') => {
  const d = (s.match(/\d/g) || []).join('')
  if (d.length === 10) return `+1${d}`
  if (d.startsWith('1') && d.length === 11) return `+${d}`
  return d ? `+${d}` : ''
}

export const entityToDraft = (e: any = {}) => ({
  job_number: e.job_number ?? '',
  description: e.description ?? '',
  vendor_id: e.vendor_id ?? '',
  sales_consultant_id: e.sales_consultant_id ?? '',
  finance_manager_id: e.finance_manager_id ?? '',
  delivery_coordinator_id: e.delivery_coordinator_id ?? '',
  customer_phone: e.customer_phone ?? '',
  customer_needs_loaner: !!e.customer_needs_loaner,
  loanerForm: e.customer_needs_loaner ? {
    vehicle_id: e.loaner_vehicle_id ?? '',
    eta_return_date: e.eta_return_date ?? '',
    notes: e.loaner_notes ?? '',
  } : null,
  lineItems: (e.job_parts ?? []).map((p: any) => ({
    product_id: p.product_id ?? '',
    unit_price: Number(p.unit_price ?? 0),
    quantity_used: Number(p.quantity_used ?? 1),
    promised_date: p.promised_date ?? '',
    service_location: p.service_location ?? 'onsite',
  })),
})

export const draftToCreatePayload = (d: any) => ({
  job_number: d.job_number ?? '',
  description: d.description ?? '',
  vendor_id: d.vendor_id ?? '',
  sales_consultant_id: d.sales_consultant_id ?? '',
  finance_manager_id: d.finance_manager_id ?? '',
  delivery_coordinator_id: d.delivery_coordinator_id ?? '',
  customer_phone: normalizePhone(d.customer_phone ?? ''),
  customer_needs_loaner: !!d.customer_needs_loaner,
  loanerForm: d.customer_needs_loaner ? {
    vehicle_id: d.loanerForm?.vehicle_id ?? '',
    eta_return_date: d.loanerForm?.eta_return_date ?? '',
    notes: d.loanerForm?.notes ?? '',
  } : null,
  lineItems: Array.isArray(d.lineItems) ? d.lineItems.map((p: any) => ({
    product_id: p.product_id ?? '',
    unit_price: Number(p.unit_price ?? 0),
    quantity_used: Number(p.quantity_used ?? 1),
    promised_date: p.promised_date ?? '',
    service_location: p.service_location ?? 'onsite',
  })) : [],
})

export const draftToUpdatePayload = (id: string, d: any) => ({
  id,
  updated_at: new Date().toISOString(),
  ...draftToCreatePayload(d),
})
