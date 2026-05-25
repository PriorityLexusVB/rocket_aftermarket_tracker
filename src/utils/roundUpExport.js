// Round-Up export — produces the 13-column row shape that matches the
// `01_JANUARY 2026 Aftermarket_BDC.xlsx` workbook Rob has been maintaining
// manually. Pure shaping helpers (no I/O) plus a thin fetch wrapper.

import { supabase } from '@/lib/supabase'
import { buildUserProfileSelectFragment, resolveUserProfileName } from './userProfileName'
import { etStartOfDay, etEndOfDay } from './etDateBoundaries'

const BDC_HEADERS = [
  'DATE',
  'CUSTOMER',
  'VEHICLE',
  'EXTERIOR',
  'INTERIOR',
  'WINDSHIELD',
  'RG',
  'ADDITIONAL PACKAGE',
  'PRICE',
  'COST',
  'GROSS',
  'SALES',
  'TRACKING',
]

// Maps a product to one of the 4 BDC boolean buckets, or 'PACKAGE' for any
// product that's not one of the core categories (EverNew, FILM, etc.).
// Classifies PRIMARILY by op_code — the stable canonical identifier
// (EXT/INT/WS/RG, and EN* → PACKAGE) — and only falls back to a
// case-insensitive name/brand substring match for products lacking an op_code.
function classifyProduct(product) {
  if (!product) return null
  const opCode = String(product.op_code || '').trim().toUpperCase()
  if (opCode === 'EXT') return 'EXTERIOR'
  if (opCode === 'INT') return 'INTERIOR'
  if (opCode === 'WS') return 'WINDSHIELD'
  if (opCode === 'RG') return 'RG'
  if (opCode.startsWith('EN')) return 'PACKAGE'
  // Fallback: case-insensitive name/brand match for products with no op_code.
  const name = String(product.name || '').toLowerCase()
  const brand = String(product.brand || '').toLowerCase()
  if (name.includes('exterior')) return 'EXTERIOR'
  if (name.includes('interior')) return 'INTERIOR'
  if (name.includes('windshield')) return 'WINDSHIELD'
  if (brand === 'rustshield' || name.includes('rust')) return 'RG'
  return 'PACKAGE'
}

function lastName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/)
  return parts.length ? parts[parts.length - 1].toUpperCase() : ''
}

function firstNameUpper(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/)
  return parts.length && parts[0] ? parts[0].toUpperCase() : ''
}

function vehicleCode(make, model) {
  const m = String(model || '').trim().toUpperCase()
  if (!m) return String(make || '').toUpperCase()
  // Workbook style "20 IMPALA" — pass through year-prefixed strings as-is.
  if (/^\d/.test(m)) return m
  // Lexus codes: extract leading letter run (GX, TX, RX, NX, RXH, NXH).
  const match = m.match(/^([A-Z]+)/)
  return match ? match[1] : m
}

function fmtDate(input) {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

/**
 * Transform an enriched job (with vehicle + assigned profile + job_parts joined)
 * into a single BDC row object.
 */
export function jobToBdcRow(job) {
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  let exterior = false
  let interior = false
  let windshield = false
  let rg = false
  const packageBrands = new Set()
  let priceTotal = 0
  let costTotal = 0

  for (const part of parts) {
    const product = part?.product || part?.products
    const bucket = classifyProduct(product)
    if (bucket === 'EXTERIOR') exterior = true
    else if (bucket === 'INTERIOR') interior = true
    else if (bucket === 'WINDSHIELD') windshield = true
    else if (bucket === 'RG') rg = true
    else if (bucket === 'PACKAGE' && product?.brand) {
      packageBrands.add(String(product.brand).toUpperCase())
    }
    const qty = Number(part?.quantity_used ?? 1) || 1
    // job_parts.total_price is pre-computed (unit_price × qty); fall back to compute.
    const lineTotal = Number(
      part?.total_price ?? (Number(part?.unit_price ?? product?.unit_price ?? 0) * qty)
    ) || 0
    priceTotal += lineTotal
    // Cost lives only on products (no `cost` column on job_parts).
    costTotal += Number(product?.cost ?? 0) * qty
  }

  const v = job?.vehicle || job?.vehicles || {}
  const customer = lastName(v.owner_name)
  const vehicle = vehicleCode(v.make, v.model)
  const repName = resolveUserProfileName(job?.assigned_profile) || ''
  const sales = firstNameUpper(repName)

  return {
    DATE: fmtDate(
      job?.scheduled_start_time || job?.promised_date || job?.created_at
    ),
    CUSTOMER: customer,
    VEHICLE: vehicle,
    EXTERIOR: exterior,
    INTERIOR: interior,
    WINDSHIELD: windshield,
    RG: rg,
    'ADDITIONAL PACKAGE': [...packageBrands].join(', '),
    PRICE: priceTotal ? priceTotal.toFixed(2) : '',
    COST: costTotal ? costTotal.toFixed(2) : '',
    GROSS: priceTotal ? (priceTotal - costTotal).toFixed(2) : '',
    SALES: sales,
    TRACKING: '',
  }
}

// Re-fetch jobs in [start, end] with vehicle + assigned profile + job_parts joined.
// Vehicle is a left join (uses `!left`) so jobs missing a vehicle FK still appear
// — keeps export count consistent with what RoundUpModal renders.
async function fetchExportableJobs(start, end) {
  // Use ET-aware day boundaries so jobs at 23:45 ET (03:45Z next day) are not dropped.
  const startDate = start instanceof Date ? start : new Date(start)
  const endDate = end instanceof Date ? end : new Date(end)
  const startIso = etStartOfDay(startDate).toISOString()
  const endIso = etEndOfDay(endDate).toISOString()
  const profileFrag = buildUserProfileSelectFragment()
  // Wave XXX-F: include promised-only jobs. Rob's "Thursday rust-proofing" case —
  // a deal sold with a promised_date but no scheduled_start_time must still appear
  // in the Round-Up for that day. Prior query filtered on scheduled_start_time
  // alone, hiding every unscheduled-but-promised deal.
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      job_number,
      title,
      scheduled_start_time,
      promised_date,
      created_at,
      assigned_to,
      job_status,
      vehicle:vehicles!left ( owner_name, make, model, year, stock_number ),
      assigned_profile:user_profiles!jobs_assigned_to_fkey ${profileFrag},
      job_parts ( quantity_used, unit_price, total_price, product:products ( name, brand, category, op_code, unit_price, cost ) )
    `)
    .or(
      `and(scheduled_start_time.gte.${startIso},scheduled_start_time.lte.${endIso}),` +
        `and(scheduled_start_time.is.null,promised_date.gte.${startIso},promised_date.lte.${endIso})`
    )
    .not('job_status', 'in', '(completed,cancelled,delivered,no_show)')
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  // Client-side sort by canonical commitment time so promised-only jobs interleave
  // correctly with scheduled jobs (Supabase can't ORDER BY COALESCE across columns).
  return rows.sort((a, b) => {
    const at = a?.scheduled_start_time || a?.promised_date || a?.created_at || ''
    const bt = b?.scheduled_start_time || b?.promised_date || b?.created_at || ''
    return at < bt ? -1 : at > bt ? 1 : 0
  })
}

export async function buildBdcRows(start, end) {
  const jobs = await fetchExportableJobs(start, end)
  return jobs.map(jobToBdcRow)
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  if (value === true) return 'TRUE'
  if (value === false) return 'FALSE'
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function tsvCell(value) {
  if (value === null || value === undefined) return ''
  if (value === true) return 'TRUE'
  if (value === false) return 'FALSE'
  return String(value).replace(/[\t\r\n]/g, ' ')
}

function joinRows(rows, delimiter, escape) {
  const header = BDC_HEADERS.join(delimiter)
  const body = rows.map((r) => BDC_HEADERS.map((h) => escape(r[h])).join(delimiter))
  return [header, ...body].join('\r\n')
}

export const rowsToCsv = (rows) => joinRows(rows, ',', csvCell)
export const rowsToTsv = (rows) => joinRows(rows, '\t', tsvCell)

export function downloadAsFile(text, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function suggestedFilename(type, baseDate) {
  const d = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const label = type === 'weekly' ? 'week' : type === 'monthly' ? 'month' : 'day'
  return `roundup-${label}-${yyyy}${mm}${dd}.csv`
}

export const __test__ = { classifyProduct, lastName, firstNameUpper, vehicleCode, fmtDate, csvCell, tsvCell }
