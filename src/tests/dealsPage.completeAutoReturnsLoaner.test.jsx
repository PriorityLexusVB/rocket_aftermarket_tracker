import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

import DealsPage from '../pages/deals/index.jsx'
import * as dealService from '../services/dealService'

vi.mock('../services/dealService', () => ({
  deleteDeal: vi.fn(),
  getAllDeals: vi.fn(),
  markLoanerReturned: vi.fn(),
}))

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

    updateStatusMock.mockResolvedValue({ data: null, error: null })

    dealService.getAllDeals.mockResolvedValue([
      {
        id: 'job-1',
        job_number: 'JOB-001',
        title: 'Test Deal',
        job_status: 'scheduled',
        customer_name: 'Customer',
        has_active_loaner: true,
        loaner_id: 'loaner-1',
        loaner_number: 'L-1',
        job_parts: [],
      },
    ])

    dealService.markLoanerReturned.mockResolvedValue(true)
    dealService.deleteDeal.mockResolvedValue(true)
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
      expect(dealService.markLoanerReturned).toHaveBeenCalledWith('loaner-1')
      expect(updateStatusMock).toHaveBeenCalledWith(
        'job-1',
        'completed',
        expect.objectContaining({ completed_at: expect.any(String) })
      )
    })

    const returnOrder = dealService.markLoanerReturned.mock.invocationCallOrder?.[0]
    const completeOrder = updateStatusMock.mock.invocationCallOrder?.[0]
    expect(returnOrder).toBeTypeOf('number')
    expect(completeOrder).toBeTypeOf('number')
    expect(returnOrder).toBeLessThan(completeOrder)
  })
})
