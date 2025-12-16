import { describe, expect, it } from 'vitest'
import { filterTestCustomersKeepFirst } from '../services/dealService'

describe('filterTestCustomersKeepFirst', () => {
  it('keeps only the first test-like deal while retaining real deals in order', () => {
    const deals = [
      { id: 't1', customer_name: 'Test Customer', job_number: 'JOB-TEST-001' },
      { id: 'r1', customer_name: 'Real Customer', job_number: 'JOB-REAL-001' },
      { id: 't2', customer_name: 'Sample Data', title: 'Demo Wrap' },
      { id: 't3', customer_email: 'example@test.com', description: 'E2E check' },
    ]

    const result = filterTestCustomersKeepFirst(deals)

    expect(result.map((d) => d.id)).toEqual(['t1', 'r1'])
  })

  it('returns all deals unchanged when no test markers are present', () => {
    const deals = [
      { id: 'a', customer_name: 'Alice Smith' },
      { id: 'b', customer_name: 'Bob Johnson', job_number: 'JOB-123' },
    ]

    const result = filterTestCustomersKeepFirst(deals)

    expect(result.map((d) => d.id)).toEqual(['a', 'b'])
  })
})
