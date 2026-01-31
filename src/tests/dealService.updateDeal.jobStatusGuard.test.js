import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/jobPartsService', () => ({
  syncJobPartsForJob: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/supabase', () => {
  const calls = {
    jobsUpdate: [],
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn((table) => {
      if (table === 'jobs') {
        return {
          update(payload) {
            calls.jobsUpdate.push(payload)
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            return {
                              data: { id: 'job-1', updated_at: new Date().toISOString() },
                              error: null,
                            }
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: { dealer_id: 'org-1' }, error: null }
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
                  async single() {
                    return { data: null, error: null }
                  },
                  limit() {
                    return {
                      async maybeSingle() {
                        return { data: null, error: null }
                      },
                    }
                  },
                }
              },
            }
          },
          update() {
            return {
              eq() {
                return {
                  async select() {
                    return { data: [{ id: 'txn-1' }], error: null }
                  },
                }
              },
            }
          },
          insert() {
            return {
              async select() {
                return { data: [{ id: 'txn-1' }], error: null }
              },
            }
          },
        }
      }

      if (table === 'vehicles') {
        return {
          update() {
            return {
              eq() {
                return { error: null }
              },
            }
          },
        }
      }

      // Default minimal chain to avoid crashes if other tables are accessed.
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      return chain
    }),
    __calls: calls,
  }

  return { supabase }
})

import * as dealService from '@/services/dealService.js'
import { supabase } from '@/lib/supabase'

describe('dealService.updateDeal job_status guard', () => {
  beforeEach(() => {
    supabase.__calls.jobsUpdate.length = 0
    vi.clearAllMocks()
  })

  it('does not send job_status when not explicitly provided', async () => {
    vi.spyOn(dealService, 'getDeal').mockResolvedValue({ id: 'job-1' })

    await dealService.updateDeal('job-1', {
      dealer_id: 'org-1',
      description: 'Customer X',
      lineItems: [],
    })

    const payload = supabase.__calls.jobsUpdate.at(-1)
    expect(payload).toBeTruthy()
    expect(payload).not.toHaveProperty('job_status')
  })

  it('sends job_status when explicitly provided', async () => {
    vi.spyOn(dealService, 'getDeal').mockResolvedValue({ id: 'job-1' })

    await dealService.updateDeal('job-1', {
      dealer_id: 'org-1',
      description: 'Customer X',
      job_status: 'pending',
      lineItems: [],
    })

    const payload = supabase.__calls.jobsUpdate.at(-1)
    expect(payload).toBeTruthy()
    expect(payload).toMatchObject({ job_status: 'pending' })
  })
})
