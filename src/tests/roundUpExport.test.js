import { describe, it, expect } from 'vitest'
import {
  jobToBdcRow,
  jobToBdcRowForVendor,
  getVendorSlicesForJob,
  rowsToCsv,
  rowsToTsv,
  suggestedFilename,
  __test__,
} from '../utils/roundUpExport'

describe('roundUpExport — internal helpers', () => {
  it('classifyProduct buckets the 6 production catalog products correctly', () => {
    const c = __test__.classifyProduct
    expect(c({ name: 'Exterior Protection', brand: 'Premium' })).toBe('EXTERIOR')
    expect(c({ name: 'Interior Protection', brand: 'Premium' })).toBe('INTERIOR')
    expect(c({ name: 'Windshield Protection', brand: 'SafeGuard' })).toBe('WINDSHIELD')
    expect(c({ name: 'Rust Guard', brand: 'RustShield' })).toBe('RG')
    expect(c({ name: 'EverNew 3yr', brand: 'EverNew' })).toBe('PACKAGE')
    expect(c({ name: 'EverNew 5yr', brand: 'EverNew' })).toBe('PACKAGE')
    expect(c(null)).toBe(null)
    expect(c({})).toBe('PACKAGE')
  })

  it('lastName returns uppercase last token', () => {
    expect(__test__.lastName('John Cochran')).toBe('COCHRAN')
    expect(__test__.lastName('Maria Del Mar Vega')).toBe('VEGA')
    expect(__test__.lastName('')).toBe('')
    expect(__test__.lastName(null)).toBe('')
  })

  it('firstNameUpper returns uppercase first token', () => {
    expect(__test__.firstNameUpper('Jeff Waugh')).toBe('JEFF')
    expect(__test__.firstNameUpper('cameron delaune')).toBe('CAMERON')
    expect(__test__.firstNameUpper('')).toBe('')
  })

  it('vehicleCode strips to model letters or year+model fallback', () => {
    expect(__test__.vehicleCode('Lexus', 'GX 470')).toBe('GX')
    expect(__test__.vehicleCode('Lexus', 'RX 350h')).toBe('RX')
    expect(__test__.vehicleCode('Lexus', 'NXh')).toBe('NXH')
    expect(__test__.vehicleCode('Chevrolet', '20 Impala')).toBe('20 IMPALA')
    expect(__test__.vehicleCode('Lexus', '')).toBe('LEXUS')
  })

  it('fmtDate produces M/D/YYYY for Excel parity', () => {
    expect(__test__.fmtDate('2026-01-08T15:00:00Z')).toMatch(/^1\/[78]\/2026$/)
    expect(__test__.fmtDate(new Date(2026, 0, 3))).toBe('1/3/2026')
    expect(__test__.fmtDate(null)).toBe('')
    expect(__test__.fmtDate('not-a-date')).toBe('')
  })

  it('csvCell escapes commas, quotes, and newlines', () => {
    const c = __test__.csvCell
    expect(c('plain')).toBe('plain')
    expect(c('a,b')).toBe('"a,b"')
    expect(c('a"b')).toBe('"a""b"')
    expect(c('line1\nline2')).toBe('"line1\nline2"')
    expect(c(true)).toBe('TRUE')
    expect(c(false)).toBe('FALSE')
    expect(c(null)).toBe('')
    expect(c(undefined)).toBe('')
    expect(c(123.45)).toBe('123.45')
  })
})

describe('jobToBdcRow', () => {
  it('produces the 13-column BDC shape from a fully-joined job', () => {
    const job = {
      scheduled_start_time: '2026-01-07T15:00:00Z',
      vehicle: { owner_name: 'Aaron Dow', make: 'Lexus', model: 'TX 350', year: 2025 },
      assigned_profile: { full_name: 'Reid Carter' },
      job_parts: [
        { quantity_used: 1, unit_price: 1500, total_price: 1500, product: { name: 'Exterior Protection', brand: 'Premium', cost: 600 } },
        { quantity_used: 1, unit_price: 1200, total_price: 1200, product: { name: 'Interior Protection', brand: 'Premium', cost: 500 } },
        { quantity_used: 1, unit_price: 800, total_price: 800, product: { name: 'Rust Guard', brand: 'RustShield', cost: 400 } },
        { quantity_used: 1, unit_price: 894, total_price: 894, product: { name: 'Window Tint Film', brand: 'FILM', cost: 323 } },
      ],
    }
    const row = jobToBdcRow(job)
    expect(row.CUSTOMER).toBe('DOW')
    expect(row.VEHICLE).toBe('TX')
    expect(row.EXTERIOR).toBe(true)
    expect(row.INTERIOR).toBe(true)
    expect(row.WINDSHIELD).toBe(false)
    expect(row.RG).toBe(true)
    expect(row['ADDITIONAL PACKAGE']).toBe('FILM')
    expect(row.PRICE).toBe('4394.00')
    expect(row.COST).toBe('1823.00')
    expect(row.GROSS).toBe('2571.00')
    expect(row.SALES).toBe('REID')
    expect(row.TRACKING).toBe('')
  })

  it('handles a deal with no job_parts (price/cost blank, all booleans false)', () => {
    const row = jobToBdcRow({
      scheduled_start_time: '2026-01-09T12:00:00Z',
      vehicle: { owner_name: 'Sam Dillie', make: 'Lexus', model: 'NXh', year: 2026 },
      assigned_profile: { full_name: 'Tony Chen' },
      job_parts: [],
    })
    expect(row.CUSTOMER).toBe('DILLIE')
    expect(row.VEHICLE).toBe('NXH')
    expect(row.EXTERIOR).toBe(false)
    expect(row.RG).toBe(false)
    expect(row.PRICE).toBe('')
    expect(row.COST).toBe('')
    expect(row.GROSS).toBe('')
    expect(row.SALES).toBe('TONY')
  })

  it('aggregates multiple PACKAGE-class brands into a comma-separated list', () => {
    const row = jobToBdcRow({
      scheduled_start_time: '2026-01-10T10:00:00Z',
      vehicle: { owner_name: 'Pat Thompson', make: 'Chevrolet', model: 'Impala', year: 2020 },
      assigned_profile: { full_name: 'Ron Hill' },
      job_parts: [
        { quantity_used: 1, unit_price: 999, total_price: 999, product: { name: 'EverNew 3yr', brand: 'EverNew', cost: 300 } },
        { quantity_used: 1, unit_price: 496, total_price: 496, product: { name: 'Window Tint Film', brand: 'FILM', cost: 249 } },
      ],
    })
    const pkg = row['ADDITIONAL PACKAGE'].split(', ').sort().join(', ')
    expect(pkg).toBe('EVERNEW, FILM')
    expect(row.SALES).toBe('RON')
  })
})

describe('jobToBdcRowForVendor — multi-vendor slicing (Wave XXX-H)', () => {
  // Helper: build a deal with line items going to up to 3 destinations.
  // VENDOR_X = "Tint Shop", VENDOR_Y = "Wheels Shop", null = In-House.
  const VENDOR_X = '11111111-1111-1111-1111-111111111111'
  const VENDOR_Y = '22222222-2222-2222-2222-222222222222'

  const multiVendorJob = {
    scheduled_start_time: '2026-01-08T15:00:00Z',
    vehicle: { owner_name: 'Aaron Dow', make: 'Lexus', model: 'TX 350', year: 2025 },
    assigned_profile: { full_name: 'Reid Carter' },
    // The job-level vendor is one of the line vendors (the default in the form).
    vendor_id: VENDOR_X,
    vendor_name: 'Tint Shop',
    job_parts: [
      // Line A — Tint at Vendor X
      {
        quantity_used: 1,
        unit_price: 500,
        total_price: 500,
        vendor_id: VENDOR_X,
        is_off_site: true,
        product: { name: 'Window Tint Film', brand: 'FILM', cost: 200 },
      },
      // Line B — Wheels at Vendor Y
      {
        quantity_used: 1,
        unit_price: 800,
        total_price: 800,
        vendor_id: VENDOR_Y,
        is_off_site: true,
        product: { name: 'EverNew 5yr', brand: 'EverNew', cost: 300 },
      },
      // Line C — Paint sealant done in-house
      {
        quantity_used: 1,
        unit_price: 1500,
        total_price: 1500,
        vendor_id: null,
        is_off_site: false,
        product: { name: 'Exterior Protection', brand: 'Premium', cost: 600 },
      },
    ],
  }

  it('jobToBdcRowForVendor(X) counts ONLY Vendor X line items', () => {
    const row = jobToBdcRowForVendor(multiVendorJob, VENDOR_X)
    expect(row.CUSTOMER).toBe('DOW')
    expect(row.PRICE).toBe('500.00') // Only the Tint line (500), not 800 or 1500
    expect(row.COST).toBe('200.00')
    expect(row.GROSS).toBe('300.00')
    expect(row.EXTERIOR).toBe(false) // The exterior line is in-house, NOT Vendor X
    expect(row['ADDITIONAL PACKAGE']).toBe('FILM') // Only Tint's package
  })

  it('jobToBdcRowForVendor(Y) counts ONLY Vendor Y line items', () => {
    const row = jobToBdcRowForVendor(multiVendorJob, VENDOR_Y)
    expect(row.PRICE).toBe('800.00') // Only the wheels line
    expect(row.COST).toBe('300.00')
    expect(row.GROSS).toBe('500.00')
    expect(row['ADDITIONAL PACKAGE']).toBe('EVERNEW') // Only Wheels' package
    expect(row.EXTERIOR).toBe(false)
  })

  it('jobToBdcRowForVendor(null) — In-House slice — counts only in-house line items', () => {
    const row = jobToBdcRowForVendor(multiVendorJob, null)
    expect(row.PRICE).toBe('1500.00') // Only the paint sealant line
    expect(row.EXTERIOR).toBe(true) // Paint sealant classifies as EXTERIOR
    expect(row['ADDITIONAL PACKAGE']).toBe('') // No package brands in this slice
  })

  it('jobToBdcRow (whole-job) still aggregates ALL line items (backward compat)', () => {
    const row = jobToBdcRow(multiVendorJob)
    expect(row.PRICE).toBe('2800.00') // 500 + 800 + 1500
    expect(row.COST).toBe('1100.00') // 200 + 300 + 600
    expect(row.GROSS).toBe('1700.00')
    expect(row.EXTERIOR).toBe(true) // From the in-house line
    // PACKAGE has both FILM and EVERNEW; order is insertion-order
    const pkg = row['ADDITIONAL PACKAGE'].split(', ').sort().join(', ')
    expect(pkg).toBe('EVERNEW, FILM')
  })

  it('getVendorSlicesForJob returns every distinct destination (vendor ids + null for in-house)', () => {
    const slices = getVendorSlicesForJob(multiVendorJob)
    // Slice set is unordered — compare as sets.
    expect(new Set(slices)).toEqual(new Set([VENDOR_X, VENDOR_Y, null]))
  })

  it('getVendorSlicesForJob — legacy single-vendor job with no per-line tags falls back to job vendor', () => {
    const legacyJob = {
      vendor_id: VENDOR_X,
      vendor_name: 'Tint Shop',
      job_parts: [
        // Untagged line — no vendor_id, no is_off_site flag
        { quantity_used: 1, unit_price: 500, total_price: 500, product: { name: 'Tint' } },
      ],
    }
    const slices = getVendorSlicesForJob(legacyJob)
    expect(slices).toEqual([VENDOR_X])
  })

  it('jobToBdcRowForVendor falls back to job-level vendor for legacy untagged lines', () => {
    // Pre-XXX-H line with NULL vendor_id, NULL is_off_site — was always part of
    // the job-level vendor's slice before per-line tagging shipped. Ensure
    // backward compat: when queried for job's vendor, it appears.
    const legacyJob = {
      scheduled_start_time: '2026-01-08T10:00:00Z',
      vehicle: { owner_name: 'Sam Dillie', make: 'Lexus', model: 'NXh', year: 2026 },
      assigned_profile: { full_name: 'Tony Chen' },
      vendor_id: VENDOR_X,
      vendor_name: 'Tint Shop',
      job_parts: [
        {
          quantity_used: 1,
          unit_price: 700,
          total_price: 700,
          // vendor_id: undefined (legacy)
          // is_off_site: undefined (legacy)
          product: { name: 'Window Tint Film', brand: 'FILM', cost: 250 },
        },
      ],
    }
    const row = jobToBdcRowForVendor(legacyJob, VENDOR_X)
    expect(row.PRICE).toBe('700.00')
    expect(row['ADDITIONAL PACKAGE']).toBe('FILM')
  })

  it('partBelongsToVendor — explicit in-house line is excluded from any vendor slice', () => {
    const inHousePart = { vendor_id: null, is_off_site: false }
    expect(__test__.partBelongsToVendor(inHousePart, VENDOR_X, VENDOR_X)).toBe(false)
    expect(__test__.partBelongsToVendor(inHousePart, null, VENDOR_X)).toBe(true)
  })
})

describe('rowsToCsv / rowsToTsv', () => {
  it('emits the canonical 13-column header in order', () => {
    const csv = rowsToCsv([])
    expect(csv).toBe('DATE,CUSTOMER,VEHICLE,EXTERIOR,INTERIOR,WINDSHIELD,RG,ADDITIONAL PACKAGE,PRICE,COST,GROSS,SALES,TRACKING')
    const tsv = rowsToTsv([])
    expect(tsv.split('\t').length).toBe(13)
  })

  it('serializes booleans as TRUE/FALSE (Excel parity)', () => {
    const csv = rowsToCsv([
      {
        DATE: '1/7/2026',
        CUSTOMER: 'DOW',
        VEHICLE: 'TX',
        EXTERIOR: true,
        INTERIOR: true,
        WINDSHIELD: false,
        RG: true,
        'ADDITIONAL PACKAGE': 'FILM',
        PRICE: '4394.00',
        COST: '1823.00',
        GROSS: '2571.00',
        SALES: 'REID',
        TRACKING: 'NEXT WED',
      },
    ])
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('1/7/2026,DOW,TX,TRUE,TRUE,FALSE,TRUE,FILM,4394.00,1823.00,2571.00,REID,NEXT WED')
  })

  it('quotes fields containing commas', () => {
    const csv = rowsToCsv([
      { DATE: '', CUSTOMER: 'O\'BRIEN, JR', VEHICLE: '', EXTERIOR: false, INTERIOR: false, WINDSHIELD: false, RG: false, 'ADDITIONAL PACKAGE': 'EVERNEW, FILM', PRICE: '', COST: '', GROSS: '', SALES: '', TRACKING: '' },
    ])
    expect(csv.split('\r\n')[1]).toContain('"O\'BRIEN, JR"')
    expect(csv.split('\r\n')[1]).toContain('"EVERNEW, FILM"')
  })
})

describe('suggestedFilename', () => {
  it('embeds the type label and YYYYMMDD', () => {
    const d = new Date(2026, 0, 7)
    expect(suggestedFilename('daily', d)).toBe('roundup-day-20260107.csv')
    expect(suggestedFilename('weekly', d)).toBe('roundup-week-20260107.csv')
    expect(suggestedFilename('monthly', d)).toBe('roundup-month-20260107.csv')
  })

  it('falls back to today on bad date', () => {
    const f = suggestedFilename('daily', new Date('not-real'))
    expect(f).toMatch(/^roundup-day-\d{8}\.csv$/)
  })
})
