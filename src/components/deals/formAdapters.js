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
      const quantity = Number(it.quantity ?? it.qty ?? 1)
      const rest = { ...it }
      delete rest.unit_price
      delete rest.qty
      delete rest.price
      return { ...rest, unitPrice, quantity }
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
  for (const k of Object.keys(clone)) {
    if (k.startsWith('loaner') || k.startsWith('loaner_')) delete clone[k]
  }
  return clone
}

export function entityToDraft(entity = {}) {
  // Keep it permissive: pass through and normalize items for the form.
  const clone = { ...entity }
  clone.items = normalizeLineItems(entity)
  return clone
}

export function draftToCreatePayload(draft = {}) {
  const base = stripLoanerWhenOff(draft)
  const items = normalizeLineItems(base)
  return { ...base, items }
}

export function draftToUpdatePayload(original = {}, draft = {}) {
  const payload = draftToCreatePayload(draft)
  if (original?.id && !payload.id) payload.id = original.id
  return payload
}

export default {
  normalizeLineItems,
  stripLoanerWhenOff,
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
}
