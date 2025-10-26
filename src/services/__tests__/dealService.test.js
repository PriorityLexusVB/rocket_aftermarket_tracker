import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client used by dealService
vi.mock('@/lib/supabase', () => {
  const calls = {
    jobs: { update: [] },
    transactions: { select: [], update: [], insert: [] },
    job_parts: { delete: [], insert: [] },
    loaner_assignments: { select: [], update: [], insert: [] },
  }

  let existingTxn = null

  const supabase = {
    from(table) {
      switch (table) {
        case 'jobs':
          return {
            update(payload) {
              calls.jobs.update.push(payload)
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
                  return {
                    is() {
                      return {
                        async single() {
                          return { data: null }
                        },
                      }
                    },
                  }
                },
              }
            },
            update() {
              calls.loaner_assignments.update.push(true)
              return {
                eq() {
                  return { error: null }
                },
              }
            },
            insert() {
              calls.loaner_assignments.insert.push(true)
              return { error: null }
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
  }

  return { supabase }
})

// Import after mocking supabase
import * as dealService from '../dealService.js'
import { supabase } from '@/lib/supabase'

describe('dealService pure transforms', () => {
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

  it('inserts a transaction when none exists', async () => {
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

  it('updates the existing transaction when one exists', async () => {
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
