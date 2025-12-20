import { describe, it, expect, vi } from 'vitest'
import { getAllDeals } from '../services/dealService'

vi.mock('../lib/supabase', () => {
  const jobs = [
    {
      id: 'job-1',
      job_number: 'JOB-001',
      title: 'Test Deal',
      job_status: 'pending',
      created_at: '2025-01-15T10:00:00Z',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 25,
          quantity_used: 1,
          requires_scheduling: true,
          promised_date: '2025-01-20',
        },
      ],
    },
  ]

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from(table) {
      if (table === 'jobs') {
        const selectResult = { data: jobs, error: null }
        const selectWrapper = {
          ...selectResult,
          limit() {
            return Promise.resolve(selectResult)
          },
          in() {
            return {
              order() {
                return Promise.resolve(selectResult)
              },
            }
          },
          eq() {
            return {
              single() {
                return Promise.resolve({ data: jobs[0], error: null })
              },
            }
          },
          then(resolve, reject) {
            return Promise.resolve(selectResult).then(resolve, reject)
          },
        }
        return {
          select() {
            return selectWrapper
          },
        }
      }

      if (table === 'transactions') {
        const selectResult = { data: [], error: null }
        const selectWrapper = {
          ...selectResult,
          in() {
            return Promise.resolve(selectResult)
          },
          then(resolve, reject) {
            return Promise.resolve(selectResult).then(resolve, reject)
          },
        }
        return {
          select() {
            return selectWrapper
          },
        }
      }

      if (table === 'loaner_assignments') {
        const selectResult = { data: [], error: null }
        const selectWrapper = {
          ...selectResult,
          in() {
            return Promise.resolve(selectResult)
          },
          then(resolve, reject) {
            return Promise.resolve(selectResult).then(resolve, reject)
          },
        }
        return {
          select() {
            return selectWrapper
          },
        }
      }

      if (table === 'job_parts') {
        const selectResult = { data: [], error: null }
        const selectWrapper = {
          ...selectResult,
          limit() {
            return Promise.resolve(selectResult)
          },
          then(resolve, reject) {
            return Promise.resolve(selectResult).then(resolve, reject)
          },
        }
        return {
          select() {
            return selectWrapper
          },
        }
      }

      return {
        select() {
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }

  return { supabase }
})

describe('dealService total_amount fallback', () => {
  it('falls back to summing job_parts when transactions are missing', async () => {
    const deals = await getAllDeals()
    expect(deals).toHaveLength(1)
    expect(deals[0].total_amount).toBe(25)
  })
})
