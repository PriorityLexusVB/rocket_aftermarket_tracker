// Wave XXI: Round-Up export that mirrors the BDC tracking workbook format Rob
// has been maintaining manually (`01_JANUARY 2026 Aftermarket_BDC.xlsx`).
//
// Per-row schema matches the per-rep tracking sheets (ASHLEY/SAM):
//   DATE | CUSTOMER | VEHICLE | EXTERIOR | INTERIOR | WINDSHIELD | RG |
//   ADDITIONAL PACKAGE | PRICE | COST | GROSS | SALES | TRACKING
//
// EXTERIOR/INTERIOR/WINDSHIELD/RG are booleans derived from the products in
// each job_parts join. ADDITIONAL PACKAGE is the brand of any job_part that
// isn't one of the 4 core booleans (e.g., "EVERNEW", "FILM"). PRICE / COST /
// GROSS aggregate across all parts on the job. SALES is the assigned-to user's
// first name uppercase. TRACKING is left blank — Rob hand-writes follow-up
// notes in the source workbook today.

import { supabase } from '@/lib/supabase'

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

// Match a product to the 4 BDC boolean buckets. Maps to current rocket catalog:
//   EXTERIOR  ← brand=Premium AND name contains 'Exterior'
//   INTERIOR  ← brand=Premium AND name contains 'Interior'
//   WINDSHIELD ← brand=SafeGuard (Windshield Protection)
//   RG        ← brand=RustShield (Rust Guard)
// Anything else → ADDITIONAL PACKAGE bucket (EverNew → "EVERNEW", etc.)
function classifyProduct(product) {
  if (!product) return null
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

function vehicleCode(make, model, _year) {
  const m = String(model || '').trim().toUpperCase()
  if (!m) return String(make || '').toUpperCase()
  // Workbook style "20 IMPALA" — pass through year-prefixed model strings as-is.
  if (/^\d/.test(m)) return m
  // Lexus model codes: extract leading letter run (GX, TX, RX, NX, RXH, NXH).
  const match = m.match(/^([A-Z]+)/)
  return match ? match[1] : m
}

function fmtDate(input) {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  // M/D/YYYY — matches Excel default for the Date column
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
    priceTotal += Number(part?.unit_price ?? product?.unit_price ?? 0) * qty
    costTotal += Number(part?.cost ?? product?.cost ?? 0) * qty
  }

  const v = job?.vehicle || job?.vehicles || {}
  const customer = lastName(v.owner_name)
  const vehicle = vehicleCode(v.make, v.model, v.year)
  const sales = firstNameUpper(job?.assigned_profile?.full_name || job?.assigned_to_name)

  return {
    DATE: fmtDate(job?.scheduled_start_time || job?.created_at),
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

// Re-fetch jobs in [start, end] with job_parts + product + vehicle + assigned
// profile joined. Uses Supabase REST since the existing get_jobs_by_date_range
// RPC doesn't return parts. Read-only, safe to call from any auth'd context.
async function fetchExportableJobs(start, end) {
  const startIso = start instanceof Date ? start.toISOString() : start
  const endIso = end instanceof Date ? end.toISOString() : end
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      job_number,
      title,
      scheduled_start_time,
      created_at,
      assigned_to,
      vehicle:vehicles!inner ( owner_name, make, model, year, stock_number ),
      assigned_profile:user_profiles!jobs_assigned_to_fkey ( full_name ),
      job_parts ( quantity_used, unit_price, cost, product:products ( name, brand, category, unit_price, cost ) )
    `)
    .gte('scheduled_start_time', startIso)
    .lte('scheduled_start_time', endIso)
    .order('scheduled_start_time', { ascending: true })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function buildBdcRows(start, end) {
  const jobs = await fetchExportableJobs(start, end)
  return jobs.map(jobToBdcRow)
}

// CSV escape per RFC 4180: wrap in quotes if value contains comma, quote, or newline.
function csvCell(value) {
  if (value === null || value === undefined) return ''
  if (value === true) return 'TRUE'
  if (value === false) return 'FALSE'
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows) {
  const header = BDC_HEADERS.join(',')
  const body = rows.map((r) => BDC_HEADERS.map((h) => csvCell(r[h])).join(','))
  return [header, ...body].join('\r\n')
}

export function rowsToTsv(rows) {
  const header = BDC_HEADERS.join('\t')
  const body = rows.map((r) =>
    BDC_HEADERS.map((h) => {
      const v = r[h]
      if (v === true) return 'TRUE'
      if (v === false) return 'FALSE'
      return v === null || v === undefined ? '' : String(v).replace(/[\t\r\n]/g, ' ')
    }).join('\t')
  )
  return [header, ...body].join('\r\n')
}

// Trigger a browser download of `text` as `filename`. Works in jsdom-free
// environments only (real browser); guard at call sites.
export function downloadAsFile(text, filename, mime = 'text/csv;charset=utf-8') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([text], { type: mime })
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

export const __test__ = { classifyProduct, lastName, firstNameUpper, vehicleCode, fmtDate, csvCell }
