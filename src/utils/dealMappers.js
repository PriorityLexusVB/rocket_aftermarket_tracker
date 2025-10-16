// src/utils/dealMappers.js
// Converts a DB "deal" (jobs + job_parts) to your UI form state and vice-versa.

export const EMPTY_LINE_ITEM = () => ({
  id: null,                 // DB id (for edit-only visuals)
  productId: null,
  vendorId: null,
  unitPrice: 0,
  notes: '',
  isOffSite: false,         // maps to is_off_site
  needsLoaner: false,
  promisedDate: '',         // yyyy-MM-dd string for inputs
  requiresScheduling: true, // maps to requires_scheduling
  noScheduleReason: '',     // maps to no_schedule_reason
  quantity: 1,
  _saved: false             // optional UI flag
});

export function dealToFormState(deal) {
  if (!deal) {
    return {
      title: '',
      description: '',
      service_type: 'in_house',
      vehicle_id: null,
      vendor_id: null,
      customer_needs_loaner: false,
      lineItems: [EMPTY_LINE_ITEM()]
    };
  }

  const lineItems = (deal?.job_parts || [])?.map(p => ({
    id: p?.id ?? null,
    productId: p?.product_id ?? null,
    vendorId: p?.vendor_id ?? null,
    unitPrice: num(p?.unit_price),
    notes: p?.notes ?? '',
    isOffSite: !!p?.is_off_site,                    // ✅ Fixed: use correct column name
    needsLoaner: false, 
    promisedDate: toYMD(p?.promised_date),
    requiresScheduling: !!p?.requires_scheduling,   // ✅ Fixed: use correct column name  
    noScheduleReason: p?.no_schedule_reason || '',  // ✅ Fixed: use correct column name
    quantity: p?.quantity_used ?? 1,
    _saved: true
  }));

  return {
    id: deal?.id,
    title: deal?.title || '',
    description: deal?.description || '',
    service_type: deal?.service_type || 'in_house',
    vehicle_id: deal?.vehicle?.id ?? deal?.vehicle_id ?? null,
    vendor_id: deal?.vendor?.id ?? deal?.vendor_id ?? null,
    customer_needs_loaner: !!deal?.customer_needs_loaner, // ✅ Fixed: use correct column name
    lineItems: lineItems?.length ? lineItems : [EMPTY_LINE_ITEM()]
  };
}

export function addEmptyLineItem(form) {
  return {
    ...form,
    lineItems: [...(form?.lineItems || []), EMPTY_LINE_ITEM()]
  };
}

export function removeLineItem(form, index) {
  const items = [...(form?.lineItems || [])];
  items?.splice(index, 1);
  return { ...form, lineItems: items?.length ? items : [EMPTY_LINE_ITEM()] };
}

export function updateLineItem(form, index, patch) {
  const items = [...(form?.lineItems || [])];
  items[index] = { ...items?.[index], ...patch };
  return { ...form, lineItems: items };
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function toYMD(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(+d)) return '';
  const m = `${d?.getMonth()+1}`?.padStart(2,'0');
  const day = `${d?.getDate()}`?.padStart(2,'0');
  return `${d?.getFullYear()}-${m}-${day}`;
}