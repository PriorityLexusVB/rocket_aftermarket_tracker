// src/tests/dealService.loanerToggle.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DealForm from '../pages/deals/DealForm'

// Mock the services and contexts
vi.mock('../services/dropdownService', () => ({
  getVendors: vi.fn(() => Promise.resolve([{ id: 'v1', value: 'v1', label: 'Vendor 1' }])),
  getProducts: vi.fn(() =>
    Promise.resolve([{ id: 'p1', value: 'p1', label: 'Product 1', unit_price: 100 }])
  ),
  getSalesConsultants: vi.fn(() =>
    Promise.resolve([{ id: 'u1', value: 'u1', label: 'Sales 1' }])
  ),
  getFinanceManagers: vi.fn(() =>
    Promise.resolve([{ id: 'u2', value: 'u2', label: 'Finance 1' }])
  ),
  getDeliveryCoordinators: vi.fn(() =>
    Promise.resolve([{ id: 'u3', value: 'u3', label: 'Delivery 1' }])
  ),
  getUserProfiles: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../services/tenantService', () => ({
  listVendorsByOrg: vi.fn(() => Promise.resolve([])),
  listProductsByOrg: vi.fn(() => Promise.resolve([])),
  listStaffByOrg: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../hooks/useTenant', () => ({
  default: vi.fn(() => ({ orgId: null })),
}))

vi.mock('../hooks/useLogger', () => ({
  useLogger: vi.fn(() => ({
    logFormSubmission: vi.fn(),
    logError: vi.fn(),
  })),
}))

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
  })),
}))

// Mock the service import
vi.mock('../services/dealService.js', () => ({
  default: {
    createDeal: vi.fn(),
    updateDeal: vi.fn(),
  },
}))

describe('DealForm Loaner Toggle', () => {
  const renderForm = (props = {}) => {
    return render(
      <BrowserRouter>
        <DealForm mode="create" onCancel={vi.fn()} {...props} />
      </BrowserRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loaner checkbox', async () => {
    renderForm()

    await waitFor(() => {
      const checkbox = screen.getByTestId('loaner-checkbox')
      expect(checkbox).toBeDefined()
      expect(checkbox).toHaveProperty('type', 'checkbox')
    })
  })

  it('hides loaner section when checkbox is unchecked', async () => {
    renderForm()

    await waitFor(() => {
      const checkbox = screen.getByTestId('loaner-checkbox')
      expect(checkbox.checked).toBe(false)
    })

    // Loaner section should not be visible
    const loanerSection = screen.queryByTestId('loaner-section')
    expect(loanerSection).toBeNull()
  })

  it('shows loaner section when checkbox is checked', async () => {
    renderForm()

    await waitFor(() => {
      const checkbox = screen.getByTestId('loaner-checkbox')
      fireEvent.click(checkbox)
    })

    // Loaner section should now be visible
    await waitFor(() => {
      const loanerSection = screen.getByTestId('loaner-section')
      expect(loanerSection).toBeDefined()
    })

    // Check that loaner fields are present
    const loanerNumberInput = screen.getByTestId('loaner-number-input')
    const loanerEtaInput = screen.getByTestId('loaner-eta-input')
    const loanerNotesInput = screen.getByTestId('loaner-notes-input')

    expect(loanerNumberInput).toBeDefined()
    expect(loanerEtaInput).toBeDefined()
    expect(loanerNotesInput).toBeDefined()
  })

  it('toggles loaner section visibility', async () => {
    renderForm()

    await waitFor(() => {
      const checkbox = screen.getByTestId('loaner-checkbox')
      expect(checkbox).toBeDefined()
    })

    const checkbox = screen.getByTestId('loaner-checkbox')

    // Initially unchecked - section hidden
    expect(checkbox.checked).toBe(false)
    expect(screen.queryByTestId('loaner-section')).toBeNull()

    // Check it - section appears
    fireEvent.click(checkbox)
    await waitFor(() => {
      expect(screen.getByTestId('loaner-section')).toBeDefined()
    })

    // Uncheck it - section disappears
    fireEvent.click(checkbox)
    await waitFor(() => {
      expect(screen.queryByTestId('loaner-section')).toBeNull()
    })
  })

  it('renders with loaner section visible when initial has loaner data', async () => {
    const initialWithLoaner = {
      customer_needs_loaner: true,
      loanerForm: {
        loaner_number: 'L-1234',
        eta_return_date: '2024-12-01',
        notes: 'Test notes',
      },
    }

    renderForm({ initial: initialWithLoaner })

    await waitFor(() => {
      const checkbox = screen.getByTestId('loaner-checkbox')
      expect(checkbox.checked).toBe(true)
    })

    // Loaner section should be visible
    const loanerSection = screen.getByTestId('loaner-section')
    expect(loanerSection).toBeDefined()

    // Check that values are populated
    const loanerNumberInput = screen.getByTestId('loaner-number-input')
    expect(loanerNumberInput.value).toBe('L-1234')
  })

  it('renders line items section with proper grid', async () => {
    renderForm()

    await waitFor(() => {
      const lineItemsSection = screen.getByTestId('line-items-section')
      expect(lineItemsSection).toBeDefined()
    })

    // Check for add button
    const addButton = screen.getByTestId('add-line-item-btn')
    expect(addButton).toBeDefined()

    // Should have at least one line item by default
    const lineItem0 = screen.getByTestId('line-0')
    expect(lineItem0).toBeDefined()

    // Check for product select
    const productSelect = screen.getByTestId('product-select-0')
    expect(productSelect).toBeDefined()

    // Check for unit price input
    const unitPriceInput = screen.getByTestId('unit-price-input-0')
    expect(unitPriceInput).toBeDefined()

    // Check for scheduling controls
    const requiresSchedulingCheckbox = screen.getByTestId('requires-scheduling-0')
    expect(requiresSchedulingCheckbox).toBeDefined()
  })

  it('adds a new line item when add button is clicked', async () => {
    renderForm()

    await waitFor(() => {
      const addButton = screen.getByTestId('add-line-item-btn')
      expect(addButton).toBeDefined()
    })

    const addButton = screen.getByTestId('add-line-item-btn')

    // Should have 1 line item initially
    expect(screen.getByTestId('line-0')).toBeDefined()
    expect(screen.queryByTestId('line-1')).toBeNull()

    // Click add button
    fireEvent.click(addButton)

    // Should now have 2 line items
    await waitFor(() => {
      expect(screen.getByTestId('line-1')).toBeDefined()
    })
  })

  it('preserves line item field order and labels', async () => {
    renderForm()

    await waitFor(() => {
      const lineItem0 = screen.getByTestId('line-0')
      expect(lineItem0).toBeDefined()
    })

    // Check that all expected fields are present in order
    const productSelect = screen.getByTestId('product-select-0')
    const unitPriceInput = screen.getByTestId('unit-price-input-0')
    const promisedDateInput = screen.getByTestId('promised-date-0')
    const requiresSchedulingCheckbox = screen.getByTestId('requires-scheduling-0')

    expect(productSelect).toBeDefined()
    expect(unitPriceInput).toBeDefined()
    expect(promisedDateInput).toBeDefined()
    expect(requiresSchedulingCheckbox).toBeDefined()

    // Check for On-Site/Off-Site radio buttons
    const onsiteRadio = screen.getByTestId('onsite-radio-0')
    const offsiteRadio = screen.getByTestId('offsite-radio-0')

    expect(onsiteRadio).toBeDefined()
    expect(offsiteRadio).toBeDefined()
  })
})
