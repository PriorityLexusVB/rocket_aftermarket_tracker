import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client used by dealService
vi.mock('@/lib/supabase', () => {
  const calls = {
    jobs: { update: [] },
    transactions: { select: [], update: [], insert: [] },
    job_parts: { delete: [], insert: [] },
    loaner_assignments: { select: [], update: [], insert: [] },
    vehicles: { select: [], update: [] },
  }

  let existingTxn = null
  let loanerSelectRows = []
  let loanerUpdateResult = [{ id: 'loaner-1' }]
  let loanerInsertResult = [{ id: 'loaner-1' }]
  let loanerInsertError = null
  let loanerInsertErrorsQueue = []

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
    },
    from(table) {
      switch (table) {
        case 'jobs':
          return {
            update(payload) {
              calls.jobs.update.push(payload)
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        select() {
                          return {
                            async maybeSingle() {
                              return { data: { id: 'job-1', updated_at: new Date().toISOString() } }
                            },
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        case 'user_profiles':
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: null }
                    },
                  }
                },
              }
            },
          }
        case 'vehicles':
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: null }
                    },
                  }
                },
              }
            },
            update(data) {
              calls.vehicles.update.push(data)
              return {
                eq() {
                  return { error: null }
                },
              }
            },
          }
        case 'transactions':
          return {
            select() {
              return {
                eq() {
                  return {
                    limit() {
                      return {
                        async maybeSingle() {
                          // mimic supabase maybeSingle shape
                          return { data: existingTxn }
                        },
                      }
                    },
                  }
                },
              }
            },
            update(data) {
              calls.transactions.update.push(data)
              return {
                eq() {
                  return { error: null }
                },
              }
            },
            insert(rows) {
              calls.transactions.insert.push(rows)
              return { error: null }
            },
          }
        case 'job_parts':
          return {
            delete() {
              return {
                eq() {
                  calls.job_parts.delete.push(true)
                  return { error: null }
                },
              }
            },
            insert(rows) {
              calls.job_parts.insert.push(rows)
              return { error: null }
            },
          }
        case 'loaner_assignments':
          return {
            select() {
              return {
                eq() {
                  calls.loaner_assignments.select.push(true)

                  const run = async () => ({ data: loanerSelectRows, error: null })

                  return {
                    is() {
                      return {
                        async limit() {
                          return run()
                        },
                      }
                    },
                    async limit() {
                      return run()
                    },
                  }
                },
              }
            },
            update() {
              calls.loaner_assignments.update.push(true)
              return {
                eq() {
                  return {
                    async select() {
                      return { data: loanerUpdateResult, error: null }
                    },
                  }
                },
              }
            },
            insert(rows) {
              calls.loaner_assignments.insert.push(rows)
              return {
                async select() {
                  const nextError =
                    loanerInsertErrorsQueue.length > 0
                      ? loanerInsertErrorsQueue.shift()
                      : loanerInsertError
                  return { data: loanerInsertResult, error: nextError }
                },
              }
            },
          }
        default:
          return {}
      }
    },
    rpc() {
      return { error: null }
    },
    channel() {
      return { on() {}, subscribe() {} }
    },
    removeChannel() {},
    __calls: calls,
    __setExistingTxn(txn) {
      existingTxn = txn
    },
    __setLoanerSelectRows(next) {
      loanerSelectRows = next
    },
    __setLoanerUpdateResult(next) {
      loanerUpdateResult = next
    },
    __setLoanerInsertResult(next) {
      loanerInsertResult = next
    },
    __setLoanerInsertError(next) {
      loanerInsertError = next
    },
    __setLoanerInsertErrors(next) {
      loanerInsertErrorsQueue = Array.isArray(next) ? [...next] : []
    },
  }

  return { supabase }
})

// Import after mocking supabase
import * as dealService from '@/services/dealService.js'
import { supabase } from '@/lib/supabase'

describe('dealService pure transforms', () => {
  it('mapFormToDb preserves explicit title when provided', () => {
    const input = {
      title: 'Custom Deal Title - EDITED',
      vehicle_description: '2024 Toyota Camry',
      lineItems: [],
    }

    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('Custom Deal Title - EDITED')
  })

  it('mapFormToDb uses vehicle_description with TitleCase when no explicit title', () => {
    const input = {
      vehicle_description: '2024 toyota camry',
      lineItems: [],
    }

    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('2024 Toyota Camry')
  })

  it('mapFormToDb generates fallback title when no title or vehicle_description', () => {
    const input = {
      job_number: 'JOB-123',
      lineItems: [],
    }

    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('Deal JOB-123')
  })

  it('mapFormToDb ignores generic titles in favor of vehicle_description', () => {
    const input = {
      title: 'Deal JOB-456',
      vehicle_description: '2023 Honda Accord',
      lineItems: [],
    }

    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('2023 Honda Accord')
  })

  it('mapDbDealToForm derives vehicle_description from title when not present', () => {
    const dbDeal = {
      id: '123',
      title: '2024 BMW X5',
      vehicle: { year: 2024, make: 'BMW', model: 'X5' },
      job_parts: [],
    }

    const formDeal = dealService.mapDbDealToForm(dbDeal)
    expect(formDeal.vehicle_description).toBe('2024 BMW X5')
    expect(formDeal.title).toBe('2024 BMW X5')
  })

  it('mapDbDealToForm uses vehicle fields when title is generic', () => {
    const dbDeal = {
      id: '123',
      title: 'Deal JOB-789',
      vehicle: { year: 2025, make: 'Tesla', model: 'Model 3' },
      job_parts: [],
    }

    const formDeal = dealService.mapDbDealToForm(dbDeal)
    expect(formDeal.vehicle_description).toBe('2025 Tesla Model 3')
  })

  it('mapFormToDb normalizes snake/camel fields and enforces reason when not scheduling', () => {
    const input = {
      description: 'Test',
      customer_phone: '555-123-4567',
      customerPhone: '(555)123-4567',
      lineItems: [
        {
          product_id: 'p1',
          quantity_used: 2,
          unit_price: 10,
          requiresScheduling: false,
          noScheduleReason: 'customer not available',
        },
        {
          product_id: 'p2',
          quantity_used: 1,
          unit_price: 5,
          requires_scheduling: true,
        },
      ],
    }

    const { normalizedLineItems, jobParts, customerPhone } = dealService.mapFormToDb(input)

    expect(normalizedLineItems).toHaveLength(2)
    expect(normalizedLineItems[0]).toMatchObject({
      product_id: 'p1',
      quantity_used: 2,
      unit_price: 10,
      requires_scheduling: false,
      no_schedule_reason: 'customer not available',
      requiresScheduling: false,
      noScheduleReason: 'customer not available',
    })
    expect(normalizedLineItems[1]).toMatchObject({
      product_id: 'p2',
      quantity_used: 1,
      unit_price: 5,
      requires_scheduling: true,
      requiresScheduling: true,
    })

    expect(jobParts).toEqual([
      expect.objectContaining({ product_id: 'p1', quantity: 2, unit_price: 10, total_price: 20 }),
      expect.objectContaining({ product_id: 'p2', quantity: 1, unit_price: 5, total_price: 5 }),
    ])

    // phone is mirrored and lightly normalized by form layer; service returns as-is
    expect(typeof customerPhone).toBe('string')
  })

  it('mapFormToDb preserves job_parts UUID ids for stable sync updates', () => {
    const uuid = '58a6f225-c870-483f-9c6a-931d3816b91a'
    const input = {
      lineItems: [
        {
          id: uuid,
          product_id: 'p1',
          quantity_used: 1,
          unit_price: 25,
          requires_scheduling: true,
          promised_date: '2025-12-26',
        },
        {
          id: 'temp-job-0',
          product_id: 'p2',
          quantity_used: 1,
          unit_price: 10,
          requires_scheduling: true,
          promised_date: '2025-12-27',
        },
      ],
    }

    const { normalizedLineItems } = dealService.mapFormToDb(input)
    expect(normalizedLineItems[0].id).toBe(uuid)
    expect(normalizedLineItems[1].id).toBeNull()
  })

  it('mapFormToDb throws when non-scheduled item missing reason', () => {
    const bad = {
      lineItems: [{ product_id: 'p1', requiresScheduling: false, noScheduleReason: '' }],
    }
    expect(() => dealService.mapFormToDb(bad)).toThrow(/must include a reason/i)
  })

  it('toJobPartRows defaults promised_date when requiresScheduling and none provided', () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = dealService.toJobPartRows('j1', [
      { product_id: 'p1', requiresScheduling: true },
      { product_id: 'p2', requiresScheduling: false, noScheduleReason: 'n/a' },
    ])

    expect(rows).toHaveLength(2)
    const r1 = rows[0]
    expect(r1.product_id).toBe('p1')
    expect(r1.requires_scheduling).toBe(true)
    expect(r1.promised_date).toBeTypeOf('string')
    expect(r1.promised_date).toBe(today)

    const r2 = rows[1]
    expect(r2.requires_scheduling).toBe(false)
    expect(r2.no_schedule_reason).toBe('n/a')
  })
})

describe('dealService loaner actions', () => {
  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('cap_loanerAssignmentsOrgId')
    }

    // reset recorded calls for isolation
    supabase.__calls.loaner_assignments.select.length = 0
    supabase.__calls.loaner_assignments.update.length = 0
    supabase.__calls.loaner_assignments.insert.length = 0

    supabase.__setLoanerSelectRows([])
    supabase.__setLoanerUpdateResult([{ id: 'loaner-1' }])
    supabase.__setLoanerInsertResult([{ id: 'loaner-1' }])
    supabase.__setLoanerInsertError(null)
    supabase.__setLoanerInsertErrors([])
  })

  it('markLoanerReturned throws when update affects 0 rows', async () => {
    supabase.__setLoanerUpdateResult([])
    await expect(dealService.markLoanerReturned('loaner-1')).rejects.toThrow(/0 rows updated/i)
  })

  it('saveLoanerAssignment throws when update affects 0 rows', async () => {
    vi.spyOn(dealService, 'getOrgContext').mockResolvedValue({ org_id: 'org-1' })

    supabase.__setLoanerSelectRows([{ id: 'loaner-1' }])
    supabase.__setLoanerUpdateResult([])

    await expect(
      dealService.saveLoanerAssignment('job-1', { loaner_number: 'L-123', eta_return_date: null })
    ).rejects.toThrow(/0 rows updated/i)
  })

  it('saveLoanerAssignment throws when insert affects 0 rows', async () => {
    vi.spyOn(dealService, 'getOrgContext').mockResolvedValue({ org_id: 'org-1' })

    supabase.__setLoanerSelectRows([])
    supabase.__setLoanerInsertResult([])

    await expect(
      dealService.saveLoanerAssignment('job-1', { loaner_number: 'L-123', eta_return_date: null })
    ).rejects.toThrow(/0 rows inserted/i)
  })

  it('saveLoanerAssignment omits org_id by default (avoids PGRST204)', async () => {
    vi.spyOn(dealService, 'getOrgContext').mockResolvedValue({ org_id: 'org-1' })

    supabase.__setLoanerSelectRows([])

    await expect(
      dealService.saveLoanerAssignment('job-1', {
        loaner_number: 'L-123',
        eta_return_date: null,
        org_id: 'org-1',
      })
    ).resolves.toBe(true)

    const inserts = supabase.__calls.loaner_assignments.insert
    expect(inserts.length).toBeGreaterThanOrEqual(1)

    const lastInsert = inserts[inserts.length - 1]
    expect(lastInsert[0]).toMatchObject({
      job_id: 'job-1',
      loaner_number: 'L-123',
    })
    expect(lastInsert[0]).not.toHaveProperty('org_id')
  })
})

describe('dealService.updateDeal transaction upsert behavior', () => {
  beforeEach(() => {
    // reset recorded calls
    supabase.__calls.jobs.update.length = 0
    supabase.__calls.transactions.select.length = 0
    supabase.__calls.transactions.update.length = 0
    supabase.__calls.transactions.insert.length = 0
    supabase.__calls.job_parts.delete.length = 0
    supabase.__calls.job_parts.insert.length = 0
    supabase.__setExistingTxn(null)
  })

  // Note: These skipped tests require deeper Supabase mocks to cover the full updateDeal chain
  // (e.g. supabase.from('jobs').update().eq().eq().select().maybeSingle()).
  // Deferred intentionally; tracked in the repo's deferred tasks doc under "Test Enhancement".

  it.skip('inserts a transaction when none exists', async () => {
    const id = 'job-1'
    const spy = vi.spyOn(dealService, 'getDeal').mockResolvedValue({ id })

    await dealService.updateDeal(id, {
      description: 'x',
      lineItems: [{ product_id: 'p1', quantity_used: 1, unit_price: 2, requires_scheduling: true }],
    })

    expect(supabase.__calls.jobs.update.length).toBe(1)
    expect(supabase.__calls.transactions.update.length).toBe(0)
    expect(supabase.__calls.transactions.insert.length).toBe(1)
    expect(supabase.__calls.job_parts.delete.length).toBe(1)
    expect(supabase.__calls.job_parts.insert.length).toBe(1)

    spy.mockRestore()
  })

  it.skip('updates the existing transaction when one exists', async () => {
    const id = 'job-2'
    supabase.__setExistingTxn({ id: 'txn-1', transaction_number: 'TXN-123' })
    const spy = vi.spyOn(dealService, 'getDeal').mockResolvedValue({ id })

    await dealService.updateDeal(id, {
      description: 'x',
      lineItems: [{ product_id: 'p2', quantity_used: 3, unit_price: 7, requires_scheduling: true }],
    })

    expect(supabase.__calls.jobs.update.length).toBe(1)
    expect(supabase.__calls.transactions.update.length).toBe(1)
    expect(supabase.__calls.transactions.insert.length).toBe(0)

    spy.mockRestore()
  })
})

describe('dealService vendor mapping', () => {
  it('mapFormToDb includes vendor_id in line items when provided', () => {
    const input = {
      lineItems: [
        {
          product_id: 'p1',
          vendor_id: 'v1',
          quantity_used: 1,
          unit_price: 100,
          is_off_site: true,
          requires_scheduling: true,
        },
      ],
    }

    const { normalizedLineItems, jobParts } = dealService.mapFormToDb(input)
    expect(normalizedLineItems[0].vendor_id).toBe('v1')
    expect(normalizedLineItems[0].vendorId).toBe('v1')
    expect(jobParts[0].vendor_id).toBe('v1')
  })

  it('mapFormToDb handles null vendor_id gracefully', () => {
    const input = {
      lineItems: [
        {
          product_id: 'p1',
          vendor_id: null,
          quantity_used: 1,
          unit_price: 100,
          is_off_site: false,
          requires_scheduling: true,
        },
      ],
    }

    const { normalizedLineItems } = dealService.mapFormToDb(input)
    expect(normalizedLineItems[0].vendor_id).toBeNull()
  })

  it('toJobPartRows includes vendor_id in output rows', () => {
    const rows = dealService.toJobPartRows('job-1', [
      {
        product_id: 'p1',
        vendor_id: 'v2',
        quantity_used: 2,
        unit_price: 50,
        requires_scheduling: true,
      },
    ])

    expect(rows[0].vendor_id).toBe('v2')
  })
})
