import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DealForm from '../pages/deals/DealForm.jsx'

vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: '12345678-1234-1234-1234-123456789012', loading: false }),
}))

vi.mock('../hooks/useLogger', () => ({
  useLogger: () => ({
    logFormSubmission: () => {},
    logError: () => {},
  }),
}))

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: () => {},
    error: () => {},
  }),
}))

vi.mock('../services/dropdownService', () => ({
  getVendors: vi.fn(() => Promise.resolve([])),
  getProducts: vi.fn(() => Promise.resolve([])),
  getSalesConsultants: vi.fn(() => Promise.resolve([])),
  getFinanceManagers: vi.fn(() => Promise.resolve([])),
  getDeliveryCoordinators: vi.fn(() => Promise.resolve([])),
  getUserProfiles: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../services/tenantService', () => ({
  listVendorsByOrg: vi.fn(() => Promise.resolve([])),
  listProductsByOrg: vi.fn(() => Promise.resolve([])),
  listStaffByOrg: vi.fn(() => Promise.resolve([])),
}))

describe('DealForm promised_date normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('normalizes ISO promised_date to YYYY-MM-DD for date input', async () => {
    render(
      <MemoryRouter>
        <DealForm
          mode="edit"
          initial={{
            id: 'job-1',
            job_number: 'J123',
            lineItems: [
              {
                product_id: 'prod-1',
                unit_price: 10,
                quantity_used: 1,
                promised_date: '2026-01-15T00:00:00.000Z',
                requires_scheduling: true,
                is_off_site: false,
              },
            ],
          }}
          onSave={vi.fn(async () => ({ id: 'job-1' }))}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    )

    // The inline line-item date input in DealForm should receive a strict YYYY-MM-DD
    const dateInput = await screen.findByTestId('promised-date-0')
    expect(dateInput.value).toBe('2026-01-15')
  })
})
