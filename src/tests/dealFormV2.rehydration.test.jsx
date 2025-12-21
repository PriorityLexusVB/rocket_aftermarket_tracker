import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import DealFormV2 from '../components/deals/DealFormV2.jsx'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '87654321-4321-4321-4321-210987654321' } }),
}))

vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: '12345678-1234-1234-1234-123456789012', loading: false }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}))

vi.mock('../services/dropdownService', () => ({
  getSalesConsultants: vi.fn(() => Promise.resolve([{ id: 'sales-1', full_name: 'John Sales' }])),
  getDeliveryCoordinators: vi.fn(() => Promise.resolve([{ id: 'dc-1', full_name: 'Jane DC' }])),
  getFinanceManagers: vi.fn(() => Promise.resolve([{ id: 'fm-1', full_name: 'Bob Finance' }])),
  getVendors: vi.fn(() =>
    Promise.resolve([{ id: 'vendor-1', name: 'Test Vendor', label: 'Test Vendor' }])
  ),
  getProducts: vi.fn(() =>
    Promise.resolve([
      { id: 'prod-a', label: 'Product A', unit_price: 100 },
      { id: 'prod-b', label: 'Product B', unit_price: 200 },
    ])
  ),
}))

vi.mock('../services/dealService', () => ({
  default: {
    createDeal: vi.fn(() => Promise.resolve({ id: 'new-deal-id' })),
    updateDeal: vi.fn(() => Promise.resolve({ id: 'updated-deal-id' })),
  },
  getCapabilities: () => ({ jobPartsHasTimes: true }),
}))

vi.mock('../services/vehicleService', () => ({
  vehicleService: {
    checkVinExists: vi.fn(() => Promise.resolve(false)),
  },
}))

describe('DealFormV2 - Edit rehydration', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rehydrates line items when job prop updates for same id (no user edits)', async () => {
    const jobId = 'job-123'

    const initialJob = {
      id: jobId,
      org_id: '12345678-1234-1234-1234-123456789012',
      customer_name: 'Test Customer',
      deal_date: '2025-01-01',
      job_number: 'TEST-001',
      updated_at: '2025-01-01T00:00:00.000Z',
      lineItems: [
        {
          id: 'part-1',
          product_id: 'prod-a',
          productId: 'prod-a',
          unit_price: 100,
          unitPrice: 100,
          requires_scheduling: true,
          requiresScheduling: true,
        },
      ],
    }

    const updatedJob = {
      ...initialJob,
      updated_at: '2025-01-02T00:00:00.000Z',
      lineItems: [
        {
          ...initialJob.lineItems[0],
          product_id: 'prod-b',
          productId: 'prod-b',
          unit_price: 200,
          unitPrice: 200,
        },
      ],
    }

    const { rerender } = render(
      <DealFormV2 mode="edit" job={initialJob} onSave={onSave} onCancel={onCancel} />
    )

    // Wait for step 1 controls (dropdowns loaded)
    await waitFor(() => {
      expect(screen.getByTestId('next-to-line-items-btn')).toBeDefined()
    })

    // Navigate to line items step
    fireEvent.click(screen.getByTestId('next-to-line-items-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('product-select-0')).toBeDefined()
    })

    expect(screen.getByTestId('product-select-0').value).toBe('prod-a')

    // Rerender with refreshed job snapshot for same id
    rerender(<DealFormV2 mode="edit" job={updatedJob} onSave={onSave} onCancel={onCancel} />)

    await waitFor(() => {
      expect(screen.getByTestId('product-select-0').value).toBe('prod-b')
    })
  })
})
