/**
 * Test: DealFormV2 customer name spacing fix
 *
 * This test verifies that:
 * 1. Customer names with spaces are preserved during typing
 * 2. The normalization useEffect doesn't interfere with user input
 * 3. titleCase is only applied on blur, not on every keystroke
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import DealFormV2 from '../components/deals/DealFormV2.jsx'

// Mock Auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '87654321-4321-4321-4321-210987654321' } }),
}))

// Mock Tenant hook with proper orgId
vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: '12345678-1234-1234-1234-123456789012', loading: false }),
}))

// Mock Supabase
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

// Mock dropdown service
vi.mock('../services/dropdownService', () => ({
  getSalesConsultants: vi.fn(() => Promise.resolve([])),
  getDeliveryCoordinators: vi.fn(() => Promise.resolve([])),
  getFinanceManagers: vi.fn(() => Promise.resolve([])),
  getVendors: vi.fn(() => Promise.resolve([])),
  getProducts: vi.fn(() => Promise.resolve([])),
}))

// Mock deal service
vi.mock('../services/dealService', () => ({
  default: {
    createDeal: vi.fn(() => Promise.resolve({ id: 'new-deal-id' })),
    findJobIdByJobNumber: vi.fn(() => Promise.resolve(null)),
  },
  getCapabilities: () => ({ jobPartsHasTimes: true }),
}))

// Mock vehicle service
vi.mock('../services/vehicleService', () => ({
  vehicleService: {
    checkVinExists: vi.fn(() => Promise.resolve(false)),
  },
}))

describe('DealFormV2 - Customer Name Spacing Fix', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should preserve spaces when typing customer name', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]

    // Type "Rob Brasco" character by character
    fireEvent.change(customerNameInput, { target: { value: 'R' } })
    expect(customerNameInput.value).toBe('R')

    fireEvent.change(customerNameInput, { target: { value: 'Ro' } })
    expect(customerNameInput.value).toBe('Ro')

    fireEvent.change(customerNameInput, { target: { value: 'Rob' } })
    expect(customerNameInput.value).toBe('Rob')

    fireEvent.change(customerNameInput, { target: { value: 'Rob ' } })
    expect(customerNameInput.value).toBe('Rob ')

    fireEvent.change(customerNameInput, { target: { value: 'Rob B' } })
    expect(customerNameInput.value).toBe('Rob B')

    fireEvent.change(customerNameInput, { target: { value: 'Rob Br' } })
    expect(customerNameInput.value).toBe('Rob Br')

    fireEvent.change(customerNameInput, { target: { value: 'Rob Bra' } })
    expect(customerNameInput.value).toBe('Rob Bra')

    fireEvent.change(customerNameInput, { target: { value: 'Rob Bras' } })
    expect(customerNameInput.value).toBe('Rob Bras')

    fireEvent.change(customerNameInput, { target: { value: 'Rob Brasc' } })
    expect(customerNameInput.value).toBe('Rob Brasc')

    fireEvent.change(customerNameInput, { target: { value: 'Rob Brasco' } })
    expect(customerNameInput.value).toBe('Rob Brasco')

    // Verify space is preserved
    expect(customerNameInput.value).toContain(' ')
  })

  it('should apply titleCase on blur', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]

    // Type lowercase name
    fireEvent.change(customerNameInput, { target: { value: 'rob brasco' } })
    expect(customerNameInput.value).toBe('rob brasco')

    // Trigger blur to apply titleCase
    fireEvent.blur(customerNameInput)

    await waitFor(() => {
      expect(customerNameInput.value).toBe('Rob Brasco')
    })
  })

  it('should not run normalization useEffect on every keystroke in create mode', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]

    // Type a name with space
    fireEvent.change(customerNameInput, { target: { value: 'John Doe' } })

    // Value should be exactly what was typed, no normalization yet
    expect(customerNameInput.value).toBe('John Doe')
  })

  it('should only normalize once when job data loads in edit mode', async () => {
    const mockJob = {
      id: 'test-job-id',
      customer_name: 'john doe', // lowercase
      job_number: 'JOB-001',
      deal_date: '2025-01-15',
      lineItems: [],
    }

    render(<DealFormV2 mode="edit" job={mockJob} onSave={mockOnSave} onCancel={mockOnCancel} />)

    // Wait for initial data to load and normalize
    await waitFor(() => {
      const input = screen.getAllByTestId('customer-name-input')[0]
      // Should be normalized to title case once
      expect(input.value).toBe('John Doe')
    })
  })
})
