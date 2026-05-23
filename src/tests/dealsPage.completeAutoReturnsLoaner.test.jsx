import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

import DealsPage from '../pages/deals/index.jsx'

// Wave XXVIII v2 fix: previously the inline `vi.mock(...)` factory created
// fresh `vi.fn()` instances every time it ran. With `pool: 'threads' +
// singleThread: true`, another test file's `vi.resetModules()` could
// trigger a re-evaluation of this factory mid-suite, producing a NEW
// `getAllDeals` mock instance that no longer carried the
// `.mockResolvedValue(...)` configured in beforeEach. Result: ~15%
// flake rate where `DealsPage` rendered with no deals, no Complete
// button appeared, and `findByLabelText('Complete job')` timed out.
//
// `vi.hoisted` runs ONCE before any imports and returns a stable object
// whose `vi.fn()` references survive factory re-evaluation.
const dealServiceMocks = vi.hoisted(() => ({
  deleteDeal: vi.fn(),
  getAllDeals: vi.fn(),
  markLoanerReturned: vi.fn(),
}))

vi.mock('../services/dealService', () => dealServiceMocks)

const updateStatusMock = vi.fn()
vi.mock('@/services/jobService', () => ({
  jobService: {
    updateStatus: (...args) => updateStatusMock(...args),
  },
}))

vi.mock('../components/ui/Navbar', () => ({
  default: () => null,
}))

vi.mock('../components/common/ExportButton', () => ({
  default: () => null,
}))

vi.mock('../pages/deals/components/EditDealModal.jsx', () => ({
  default: () => null,
}))

vi.mock('../hooks/useDropdownData', () => ({
  useDropdownData: () => ({
    getUserOptions: vi.fn().mockReturnValue([]),
    getVendorOptions: vi.fn().mockReturnValue([]),
    clearSearch: vi.fn(),
    error: null,
  }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}
vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toast,
}))

describe('DealsPage - complete auto-returns loaner', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()

    const currentDate = new Date()

    updateStatusMock.mockResolvedValue({ data: null, error: null })

    dealServiceMocks.getAllDeals.mockResolvedValue([
      {
        id: 'job-1',
        job_number: 'JOB-001',
        title: 'Test Deal',
        job_status: 'scheduled',
        created_at: currentDate,
        customer_name: 'Customer',
        has_active_loaner: true,
        loaner_id: 'loaner-1',
        loaner_number: 'L-1',
        job_parts: [],
      },
    ])

    dealServiceMocks.markLoanerReturned.mockResolvedValue(true)
    dealServiceMocks.deleteDeal.mockResolvedValue(true)
  })

  it('calls markLoanerReturned before completing', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <DealsPage />
      </BrowserRouter>
    )

    const completeBtn = await screen.findByLabelText('Complete job')
    await user.click(completeBtn)

    await waitFor(() => {
      expect(dealServiceMocks.markLoanerReturned).toHaveBeenCalledWith('loaner-1')
      expect(updateStatusMock).toHaveBeenCalledWith(
        'job-1',
        'completed',
        expect.objectContaining({ completed_at: expect.any(String) })
      )
    })

    const returnOrder = dealServiceMocks.markLoanerReturned.mock.invocationCallOrder?.[0]
    const completeOrder = updateStatusMock.mock.invocationCallOrder?.[0]
    expect(returnOrder).toBeTypeOf('number')
    expect(completeOrder).toBeTypeOf('number')
    expect(returnOrder).toBeLessThan(completeOrder)
  })
})
