// src/pages/deals/components/dealHelpers.js
// Pure utility functions extracted from the deals index page.
// These have zero React dependencies and can be imported anywhere.

import { money0, titleCase, prettyPhone } from '../../../lib/format'
import { formatEtMonthDay, toSafeDateForTimeZone } from '../../../utils/scheduleDisplay'
import { getDealFinancials } from '../../../utils/dealKpis'

// ── Formatting helpers ──────────────────────────────────────────────

export const safeJsonStringify = (value) => {
  try {
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unserializable]'
    }
  }
}

export const formatCreatedShort = (input) => {
  if (!input) return null
  try {
    const d = input instanceof Date ? input : new Date(input)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return null
  }
}

export const formatStaffName = (fullName) => {
  if (!fullName) return ''
  const parts = fullName?.trim()?.split(/\s+/)
  if (parts?.length === 0) return ''
  if (parts?.length === 1) return parts[0]

  const lastName = parts[parts.length - 1]
  const firstInitial = parts[0]?.[0] ?? ''

  return `${lastName}, ${firstInitial}.`
}

export const toFiniteNumberOrNull = (value) => {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(num) ? num : null
}

export const formatMoney0OrDash = (value) => {
  const num = toFiniteNumberOrNull(value)
  return num == null ? '—' : money0.format(num)
}

// ── Date / key helpers ──────────────────────────────────────────────

export const getEtDayKey = (isoOrDate) => {
  const d = toSafeDateForTimeZone(isoOrDate)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export const getDealPromiseIso = (deal) => {
  const explicit = deal?.next_promised_iso
  if (explicit) return explicit

  try {
    if (Array.isArray(deal?.job_parts)) {
      const dates = deal.job_parts
        .map((p) => p?.promised_date)
        .filter(Boolean)
        .sort()
      return dates?.[0] || null
    }
  } catch {
    // ignore
  }

  return null
}

export const getPromiseDayKey = (deal) => {
  const iso = getDealPromiseIso(deal)
  if (!iso) return ''
  return String(iso).slice(0, 10)
}

// ── Product / vehicle display helpers ───────────────────────────────

export const normalizeProductName = (name) => {
  if (!name) return ''
  return String(name)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const abbreviateProductName = (name) => {
  const raw = normalizeProductName(name)
  if (!raw) return ''

  const lower = raw.toLowerCase()
  if (lower.includes('paint protection film')) return 'PPF'
  if (lower.includes('tint')) return 'Tint'
  if (lower.includes('ceramic')) return 'Ceramic'
  if (lower.includes('rust')) return 'Rust'
  if (/(^|\b)ppf(\b|$)/i.test(raw)) return 'PPF'

  const words = raw.split(' ').filter(Boolean)
  if (words.length >= 2 && words[0].length <= 12) return titleCase(words[0])

  const maxLen = 14
  if (raw.length <= maxLen) return titleCase(raw)
  return `${titleCase(raw.slice(0, maxLen - 1))}…`
}

export const getDealProductLabelSummary = (deal, maxLabels = 3) => {
  const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []

  const byKey = new Map()
  for (const part of parts) {
    const opCodeRaw = part?.product?.op_code || part?.product?.opCode || part?.op_code || ''
    const opCode = String(opCodeRaw || '')
      .trim()
      .toUpperCase()
    const name =
      part?.product?.name ||
      part?.product_name ||
      part?.productLabel ||
      part?.product?.label ||
      part?.product_id ||
      ''

    const abbr = opCode || abbreviateProductName(name)
    if (!abbr) continue

    const keyRaw = part?.product?.id || part?.product_id || abbr
    const key = String(keyRaw).toLowerCase()

    const qtyRaw = part?.quantity_used ?? part?.quantity ?? 1
    const qtyNum = Number(qtyRaw)
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1

    const isOffSite = !!(part?.is_off_site || part?.service_type === 'vendor')

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { label: abbr, qty, isOffSite })
    } else {
      existing.qty += qty
      existing.isOffSite = existing.isOffSite || isOffSite
    }
  }

  const items = Array.from(byKey.values()).sort((a, b) => {
    if (a.isOffSite !== b.isOffSite) return a.isOffSite ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  const formatted = items.map((it) => (it.qty > 1 ? `${it.label}×${it.qty}` : it.label))
  const clipped = formatted.slice(0, maxLabels)
  const extraCount = Math.max(0, formatted.length - clipped.length)
  return { labels: clipped, extraCount }
}

export const getDealVehicleDisplay = (deal) => {
  const year = deal?.vehicle?.year
  const make = deal?.vehicle?.make
  const model = deal?.vehicle?.model
  const stock =
    deal?.vehicle?.stock_number ||
    deal?.vehicle?.vin ||
    deal?.stock_no ||
    deal?.stockNumber ||
    deal?.vin ||
    null

  const ymm = [year, make, model].filter(Boolean).join(' ').trim()
  const vehicleLabel = ymm ? titleCase(ymm) : ''

  const rawDesc = (deal?.vehicle_description || '').trim()
  const title = ((deal?.title || deal?.description || '') + '').trim()
  const jobNumber = ((deal?.job_number || deal?.jobNumber || '') + '').trim()
  const descLower = rawDesc.toLowerCase()

  const isDuplicativeDesc =
    !rawDesc ||
    (title && descLower === title.toLowerCase()) ||
    (jobNumber &&
      (descLower === jobNumber.toLowerCase() || descLower.includes(jobNumber.toLowerCase())))

  if (vehicleLabel) {
    return {
      main: vehicleLabel,
      stock: stock || null,
      title: `${vehicleLabel}${stock ? ` • Stock: ${stock}` : ''}`,
      isMissing: false,
    }
  }

  if (!isDuplicativeDesc) {
    const descLabel = titleCase(rawDesc)
    return {
      main: descLabel,
      stock: null,
      title: descLabel,
      isMissing: false,
    }
  }

  if (stock) {
    const stockLabel = `Stock: ${stock}`
    return {
      main: stockLabel,
      stock: null,
      title: stockLabel,
      isMissing: false,
    }
  }

  return { main: '—', stock: null, title: '—', isMissing: true }
}

export const getDealNumberDisplay = (deal) => {
  if (!deal) return '—'
  return (
    deal?.job_number ||
    deal?.jobNumber ||
    deal?.deal_number ||
    deal?.dealNumber ||
    deal?.transaction_number ||
    '—'
  )
}

export const getDealDateDisplay = (deal) => {
  const raw =
    deal?.deal_date ||
    deal?.dealDate ||
    deal?.created_at ||
    deal?.createdAt ||
    deal?.created ||
    deal?.inserted_at
  return formatCreatedShort(raw) || '—'
}

export const getDealPrimaryRef = (deal) => {
  if (!deal) return 'Deal'

  const jobNumber = deal?.job_number || deal?.jobNumber
  const title = (deal?.title || deal?.description || '').trim()
  const stockNumber =
    deal?.vehicle?.stock_number || deal?.stock_no || deal?.stockNumber || deal?.vehicle_stock
  const fallbackId = deal?.id ? `Job-${String(deal.id).slice(0, 8)}` : ''
  const customer = (deal?.customer_name || deal?.customerName || '').trim()

  if (jobNumber && title) return `${jobNumber} • ${title}`
  if (jobNumber && stockNumber) return `${jobNumber} • Stock ${stockNumber}`
  if (jobNumber) return jobNumber
  if (title && stockNumber) return `${title} • Stock ${stockNumber}`
  if (title) return title
  if (stockNumber) return `Stock ${stockNumber}`
  if (customer) return customer
  return fallbackId || 'Deal'
}

export const getDisplayPhone = (deal) => {
  const phone = deal?.customer_phone_e164 || deal?.customer_phone || deal?.customer_mobile || ''
  return prettyPhone(phone) || '—'
}

// ── Sheet view helpers ──────────────────────────────────────────────

export const SHEET_CATEGORY_RULES = [
  { key: 'exterior', tokens: ['exterior', 'paint', 'ppf', 'ceramic', 'coating', 'tint'] },
  { key: 'interior', tokens: ['interior', 'leather', 'carpet', 'fabric', 'upholstery'] },
  { key: 'windshield', tokens: ['windshield', 'glass'] },
  { key: 'rg', tokens: ['rg', 'rust', 'rustguard', 'rust guard', 'rustproof'] },
]

export const normalizeSheetToken = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()

export const getSheetDateLabel = (deal) => {
  const raw =
    deal?.deal_date ||
    deal?.dealDate ||
    deal?.created_at ||
    deal?.createdAt ||
    deal?.created ||
    deal?.inserted_at
  const date = raw ? toSafeDateForTimeZone(raw) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

export const getSheetTrackingRef = (deal) => {
  return (
    deal?.deal_number ||
    deal?.dealNumber ||
    deal?.transaction_number ||
    deal?.job_number ||
    deal?.jobNumber ||
    '—'
  )
}

export const getSheetSalesLabel = (deal) => {
  const raw = deal?.sales_consultant_name || deal?.delivery_coordinator_name || ''
  return raw ? formatStaffName(raw) : '—'
}

export const getSheetCategoryFlags = (deal) => {
  const parts = Array.isArray(deal?.job_parts) ? deal.job_parts : []
  const flags = { exterior: false, interior: false, windshield: false, rg: false }
  const extraLabels = new Map()

  for (const part of parts) {
    const product = part?.product || part?.products || {}
    const rawName =
      product?.name || part?.product_name || part?.productLabel || part?.product_id || ''
    const rawCategory = product?.category || part?.category || ''
    const rawOp = product?.op_code || product?.opCode || part?.op_code || ''

    const token = [rawCategory, rawName, rawOp].map(normalizeSheetToken).filter(Boolean).join(' ')

    let matchedKey = null
    for (const rule of SHEET_CATEGORY_RULES) {
      if (rule.tokens.some((t) => token.includes(t))) {
        matchedKey = rule.key
        flags[rule.key] = true
        break
      }
    }

    if (!matchedKey) {
      const label = rawOp || abbreviateProductName(rawName)
      if (label) extraLabels.set(label.toLowerCase(), label)
    }
  }

  const extras = Array.from(extraLabels.values())
  const max = 2
  const clipped = extras.slice(0, max)
  const extraCount = Math.max(0, extras.length - clipped.length)
  const additionalLabel = clipped.length
    ? `${clipped.join(', ')}${extraCount ? ` +${extraCount}` : ''}`
    : '—'

  return { flags, additionalLabel }
}

// ── Debug flag ──────────────────────────────────────────────────────

export const isDealsDebugEnabled = () =>
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEBUG_DEALS_LIST === 'true' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('debug:deals') === '1'))
