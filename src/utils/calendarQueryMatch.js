export const normalizeCalendarQuery = (value = '') => {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export const calendarQueryMatches = (item, query) => {
  const normalized = normalizeCalendarQuery(query)
  if (!normalized) return true

  const raw = item?.raw || item
  const fields = [
    raw?.job_number,
    raw?.title,
    raw?.description,
    raw?.vehicle_info,
    raw?.vehicle_description,
    raw?.customer_name,
    raw?.customer_phone,
    raw?.stock_number,
    raw?.stockNumber,
    raw?.vehicle?.owner_name,
    item?.customerName,
    item?.vehicleLabel,
    item?.job_number,
    item?.title,
    item?.vehicle_info,
    item?.vehicle_description,
    item?.customer_name,
    item?.customer_phone,
  ]

  const haystack = fields.filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(normalized)
}
