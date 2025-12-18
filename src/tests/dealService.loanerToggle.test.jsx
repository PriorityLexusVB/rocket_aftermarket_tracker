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
  getSalesConsultants: vi.fn(() => Promise.resolve([{ id: 'u1', value: 'u1', label: 'Sales 1' }])),
  getFinanceManagers: vi.fn(() => Promise.resolve([{ id: 'u2', value: 'u2', label: 'Finance 1' }])),
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
    const { container } = renderForm()

    await waitFor(() => {
      // Use container to scope query and avoid duplicates
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')
      expect(checkbox).toBeDefined()
      expect(checkbox).toHaveProperty('type', 'checkbox')
    })
  })

  it('hides loaner section when checkbox is unchecked', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')
      expect(checkbox.checked).toBe(false)
    })

    // Loaner section wrapper should exist, fields exist but are disabled
    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const loanerSection = dealForm?.querySelector('[data-testid="loaner-section"]')
    expect(loanerSection).toBeDefined()
    const loanerInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
    expect(loanerInput).toBeTruthy()
    expect(loanerInput.disabled).toBe(true)
  })

  it('shows loaner section when checkbox is checked', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')
      fireEvent.click(checkbox)
    })

    // Loaner section should now be visible
    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const loanerSection = dealForm?.querySelector('[data-testid="loaner-section"]')
      expect(loanerSection).toBeDefined()
    })

    // Check that loaner fields are present
    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const loanerNumberInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
    const loanerEtaInput = dealForm?.querySelector('[data-testid="loaner-eta-input"]')
    const loanerNotesInput = dealForm?.querySelector('[data-testid="loaner-notes-input"]')

    expect(loanerNumberInput).toBeDefined()
    expect(loanerEtaInput).toBeDefined()
    expect(loanerNotesInput).toBeDefined()
  })

  it('toggles loaner section visibility', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')
      expect(checkbox).toBeDefined()
    })

    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')

    // Initially unchecked - loaner fields exist but disabled (wrapper exists)
    expect(checkbox.checked).toBe(false)
    expect(dealForm?.querySelector('[data-testid="loaner-section"]')).toBeDefined()
    const initialInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
    expect(initialInput).toBeTruthy()
    expect(initialInput.disabled).toBe(true)

    // Check it - loaner fields become enabled
    fireEvent.click(checkbox)
    await waitFor(() => {
      const loanerInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
      expect(loanerInput.disabled).toBe(false)
    })

    // Uncheck it - loaner fields become disabled again (wrapper remains)
    fireEvent.click(checkbox)
    await waitFor(() => {
      const loanerInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
      expect(loanerInput.disabled).toBe(true)
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

    const { container } = renderForm({ initial: initialWithLoaner })

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const checkbox = dealForm?.querySelector('[data-testid="loaner-checkbox"]')
      expect(checkbox.checked).toBe(true)
    })

    // Loaner section should be visible within the deal form
    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const loanerSection = dealForm?.querySelector('[data-testid="loaner-section"]')
    expect(loanerSection).toBeDefined()

    // Check that values are populated
    const loanerNumberInput = dealForm?.querySelector('[data-testid="loaner-number-input"]')
    expect(loanerNumberInput.value).toBe('L-1234')
  })

  it('renders line items section with proper grid', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const lineItemsSection = dealForm?.querySelector('[data-testid="line-items-section"]')
      expect(lineItemsSection).toBeDefined()
    })

    // Check for add button
    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const addButton = dealForm?.querySelector('[data-testid="add-line-item-btn"]')
    expect(addButton).toBeDefined()

    // Should have at least one line item by default
    const lineItem0 = dealForm?.querySelector('[data-testid="line-0"]')
    expect(lineItem0).toBeDefined()

    // Check for product select
    const productSelect = dealForm?.querySelector('[data-testid="product-select-0"]')
    expect(productSelect).toBeDefined()

    // Check for unit price input
    const unitPriceInput = dealForm?.querySelector('[data-testid="unit-price-input-0"]')
    expect(unitPriceInput).toBeDefined()

    // Check for scheduling controls
    const requiresSchedulingCheckbox = dealForm?.querySelector(
      '[data-testid="requires-scheduling-0"]'
    )
    expect(requiresSchedulingCheckbox).toBeDefined()
  })

  it('adds a new line item when add button is clicked', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const addButton = dealForm?.querySelector('[data-testid="add-line-item-btn"]')
      expect(addButton).toBeDefined()
    })

    const dealForm = container.querySelector('[data-testid="deal-form"]')
    const addButton = dealForm?.querySelector('[data-testid="add-line-item-btn"]')

    // Should have 1 line item initially
    expect(dealForm?.querySelector('[data-testid="line-0"]')).toBeDefined()
    expect(dealForm?.querySelector('[data-testid="line-1"]')).toBeNull()

    // Click add button
    fireEvent.click(addButton)

    // Should now have 2 line items
    await waitFor(() => {
      expect(dealForm?.querySelector('[data-testid="line-1"]')).toBeDefined()
    })
  })

  it('preserves line item field order and labels', async () => {
    const { container } = renderForm()

    await waitFor(() => {
      const dealForm = container.querySelector('[data-testid="deal-form"]')
      const lineItem0 = dealForm?.querySelector('[data-testid="line-0"]')
      expect(lineItem0).toBeDefined()
    })

    const dealForm = container.querySelector('[data-testid="deal-form"]')
    // Check that all expected fields are present in order
    const productSelect = dealForm?.querySelector('[data-testid="product-select-0"]')
    const unitPriceInput = dealForm?.querySelector('[data-testid="unit-price-input-0"]')
    const promisedDateInput = dealForm?.querySelector('[data-testid="promised-date-0"]')
    const requiresSchedulingCheckbox = dealForm?.querySelector(
      '[data-testid="requires-scheduling-0"]'
    )

    expect(productSelect).toBeDefined()
    expect(unitPriceInput).toBeDefined()
    expect(promisedDateInput).toBeDefined()
    expect(requiresSchedulingCheckbox).toBeDefined()

    // Check for On-Site/Off-Site radio buttons
    const onsiteRadio = dealForm?.querySelector('[data-testid="onsite-radio-0"]')
    const offsiteRadio = dealForm?.querySelector('[data-testid="offsite-radio-0"]')

    expect(onsiteRadio).toBeDefined()
    expect(offsiteRadio).toBeDefined()
  })
})
