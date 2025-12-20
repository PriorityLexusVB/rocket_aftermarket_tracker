import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllDeals, getDeal } from '../services/dealService'

/**
 * Supabase mock that supports the query shapes used by:
 * - getAllDeals: jobs.select().in().order(), transactions.select().in(), loaner_assignments.select().in().is()
 * - getDeal: jobs.select().eq().maybeSingle(), transactions.select().eq().single(), loaner_assignments.select().eq().is().maybeSingle()
 * - Preflight probe: job_parts.select().limit()
 */
vi.mock('../lib/supabase', () => {
  const state = {
    jobs: [],
    transactions: [],
    loaners: [],
  }

  const makeResult = (data, error = null) => ({ data, error })

  const byColumn = (rows, column, value) =>
    rows.filter((row) => {
      const v = row?.[column]
      if (value === null) return v === null || v === undefined
      return v === value
    })

  const buildChain = (table, rows) => {
    const selectData = () => rows

    const makeInChain = (data) => ({
      order() {
        return Promise.resolve(makeResult(data))
      },
      is(column, value) {
        const filtered = byColumn(data, column, value)
        return Promise.resolve(makeResult(filtered))
      },
      then(resolve, reject) {
        return Promise.resolve(makeResult(data)).then(resolve, reject)
      },
    })

    const makeEqChain = (data) => ({
      single() {
        return Promise.resolve(makeResult(data[0] || null))
      },
      maybeSingle() {
        return Promise.resolve(makeResult(data[0] || null))
      },
      is(column, value) {
        const filtered = byColumn(data, column, value)
        return {
          maybeSingle() {
            return Promise.resolve(makeResult(filtered[0] || null))
          },
          then(resolve, reject) {
            return Promise.resolve(makeResult(filtered[0] || null)).then(resolve, reject)
          },
        }
      },
      then(resolve, reject) {
        return Promise.resolve(makeResult(data[0] || null)).then(resolve, reject)
      },
    })

    return {
      select() {
        const data = selectData()
        return {
          limit() {
            return Promise.resolve(makeResult(data.slice(0, 1)))
          },
          in() {
            return makeInChain(data)
          },
          eq(column, value) {
            const filtered = byColumn(data, column, value)
            return makeEqChain(filtered)
          },
          order() {
            return Promise.resolve(makeResult(data))
          },
          is(column, value) {
            const filtered = byColumn(data, column, value)
            return Promise.resolve(makeResult(filtered))
          },
          then(resolve, reject) {
            return Promise.resolve(makeResult(data)).then(resolve, reject)
          },
        }
      },
    }
  }

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from(table) {
      if (table === 'jobs') return buildChain(table, state.jobs)
      if (table === 'transactions') return buildChain(table, state.transactions)
      if (table === 'loaner_assignments') return buildChain(table, state.loaners)
      if (table === 'job_parts') return buildChain(table, [])
      return buildChain(table, [])
    },
    __state: state,
  }

  return { supabase }
})

import { supabase } from '../lib/supabase'

const resetFixtures = () => {
  supabase.__state.jobs.length = 0
  supabase.__state.transactions.length = 0
  supabase.__state.loaners.length = 0
}

const baseJob = {
  id: 'job-1',
  job_number: 'JOB-001',
  title: 'Test Deal',
  job_status: 'pending',
  created_at: '2025-01-15T10:00:00Z',
}

beforeEach(() => {
  resetFixtures()
})

describe('dealService total_amount fallback', () => {
  it('falls back to summing job_parts when transactions are missing (getAllDeals)', async () => {
    supabase.__state.jobs.push({
      ...baseJob,
      job_parts: [
        { id: 'part-1', product_id: 'prod-1', unit_price: 25, quantity_used: 1 },
      ],
    })

    const deals = await getAllDeals()
    expect(deals).toHaveLength(1)
    expect(deals[0].total_amount).toBe(25)
  })

  it('falls back when transaction total_amount is invalid', async () => {
    supabase.__state.jobs.push({
      ...baseJob,
      id: 'job-2',
      job_number: 'JOB-002',
      job_parts: [{ id: 'part-2', product_id: 'prod-2', unit_price: 10, quantity_used: 2 }],
    })
    supabase.__state.transactions.push({
      job_id: 'job-2',
      total_amount: 'NaN',
      customer_name: 'X',
      customer_phone: '',
      customer_email: '',
    })

    const deals = await getAllDeals()
    const deal = deals.find((d) => d.id === 'job-2')
    expect(deal.total_amount).toBe(20)
  })

  it('supports quantity/price fallback field names', async () => {
    supabase.__state.jobs.push({
      ...baseJob,
      id: 'job-3',
      job_number: 'JOB-003',
      job_parts: [{ id: 'part-3', product_id: 'prod-3', price: 7.5, quantity: 3 }],
    })

    const deals = await getAllDeals()
    const deal = deals.find((d) => d.id === 'job-3')
    expect(deal.total_amount).toBeCloseTo(22.5)
  })

  it('handles empty or non-numeric job_parts safely', async () => {
    supabase.__state.jobs.push({
      ...baseJob,
      id: 'job-4',
      job_number: 'JOB-004',
      job_parts: [
        { id: 'p1', product_id: 'prod-4', unit_price: 'abc', quantity_used: 'xyz' },
        { id: 'p2', product_id: 'prod-5', unit_price: 0, quantity_used: 0 },
      ],
    })

    const deals = await getAllDeals()
    const deal = deals.find((d) => d.id === 'job-4')
    expect(deal.total_amount).toBe(0)
  })

  it('getDeal falls back to job_parts when transaction is missing', async () => {
    const job = {
      ...baseJob,
      id: 'job-5',
      job_number: 'JOB-005',
      job_parts: [{ id: 'part-5', product_id: 'prod-5', unit_price: 12, quantity_used: 2 }],
    }
    supabase.__state.jobs.push(job)

    const deal = await getDeal('job-5')
    expect(deal.total_amount).toBe(24)
  })
})
