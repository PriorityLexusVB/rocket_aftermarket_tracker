import { describe, it, expect, vi } from 'vitest'

/**
 * Regression test:
 * Some E2E/staging DBs may be missing `loaner_assignments.returned_at`.
 * getDeal() should retry without the `returned_at IS NULL` filter and still return loaner_number.
 */

vi.mock('../lib/supabase', () => {
  const missingReturnedAtError = {
    message: 'column loaner_assignments.returned_at does not exist',
    code: '42703',
  }

  const job = {
    id: 'job-1',
    created_at: new Date().toISOString(),
    title: 'E2E Job',
    description: 'desc',
    job_number: 'JOB-001',
    job_status: 'pending',
    job_parts: [],
    vehicle: null,
  }

  const loanerRow = {
    id: 'loaner-1',
    loaner_number: 'L-123',
    eta_return_date: null,
    notes: null,
  }

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from(table) {
      if (table === 'jobs') {
        return {
          select() {
            return {
              eq() {
                return {
                  single() {
                    return Promise.resolve({ data: job, error: null })
                  },
                  maybeSingle() {
                    return Promise.resolve({ data: job, error: null })
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'transactions') {
        return {
          select() {
            return {
              eq() {
                return {
                  single() {
                    return Promise.resolve({
                      data: {
                        customer_name: 'Test',
                        customer_phone: '',
                        customer_email: '',
                        total_amount: 0,
                      },
                      error: null,
                    })
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'loaner_assignments') {
        return {
          select() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: missingReturnedAtError })
                      },
                    }
                  },
                  maybeSingle() {
                    return Promise.resolve({ data: loanerRow, error: null })
                  },
                }
              },
            }
          },
        }
      }

      // default
      return {
        select() {
          return {
            limit() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
      }
    },
  }

  return { supabase }
})

describe('dealService.getDeal - loaner returned_at missing fallback', () => {
  it('returns loaner_number even when returned_at column is missing', async () => {
    const { getDeal } = await import('../services/dealService')
    const deal = await getDeal('job-1')
    expect(deal.loaner_number).toBe('L-123')
    expect(deal.has_active_loaner).toBe(true)
  })
})
