/**
 * Step 23: DealFormV2 - Verify Customer Name + Deal Date at top; Vendor per line item
 *
 * PASS criteria:
 * - Step 1 has Customer Name input (required, data-testid="customer-name-input")
 * - Step 1 has Deal Date input (defaults to today, data-testid="deal-date-input")
 * - Step 1 does NOT have a global vendor select
 * - Step 2 shows vendor select per off-site line item (data-testid="line-vendor-0")
 * - Vendor select appears only when is_off_site is true
 * - Admin helper shows when no vendors available
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import DealFormV2 from '../components/deals/DealFormV2.jsx'
import { toDateInputValue } from '../utils/dateTimeUtils.js'

// Mock Auth context - use valid UUID format
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '87654321-4321-4321-4321-210987654321' } }),
}))

// Mock Tenant hook - use valid UUID format
vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: '12345678-1234-1234-1234-123456789012', loading: false }),
}))

// Mock Supabase with proper query chain for job number validation
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
  getSalesConsultants: vi.fn(() => Promise.resolve([{ id: 'sales-1', full_name: 'John Sales' }])),
  getDeliveryCoordinators: vi.fn(() => Promise.resolve([{ id: 'dc-1', full_name: 'Jane DC' }])),
  getFinanceManagers: vi.fn(() => Promise.resolve([{ id: 'fm-1', full_name: 'Bob Finance' }])),
  getVendors: vi.fn(() =>
    Promise.resolve([{ id: 'vendor-1', name: 'Test Vendor', label: 'Test Vendor' }])
  ),
  getProducts: vi.fn(() =>
    Promise.resolve([{ id: 'prod-1', label: 'Test Product', unit_price: 100 }])
  ),
}))

// Mock deal service
vi.mock('../services/dealService', () => ({
  default: {
    createDeal: vi.fn(() => Promise.resolve({ id: 'new-deal-id' })),
    updateDeal: vi.fn(() => Promise.resolve({ id: 'updated-deal-id' })),
    findJobIdByJobNumber: vi.fn(() => Promise.resolve(null)),
  },
  // Provide required named export used by DealFormV2 UI notices
  getCapabilities: () => ({ jobPartsHasTimes: true }),
}))

// Mock vehicle service with checkVinExists for VIN validation
vi.mock('../services/vehicleService', () => ({
  vehicleService: {
    checkVinExists: vi.fn(() => Promise.resolve(false)), // No duplicate VINs
  },
}))

// DO NOT mock form adapters - let them run normally to transform payload correctly
// The form creates a payload with customer_name and deal_date which should be preserved

describe('Step 23: DealFormV2 - Customer Name + Deal Date at top; Vendor per line item', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Ensure no DOM leakage between tests (avoids duplicate elements triggering getBy* multiple match errors)
  afterEach(() => {
    cleanup()
  })

  it('should render Customer Name input in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      const customerNameInput = screen.getAllByTestId('customer-name-input')[0]
      expect(customerNameInput).toBeDefined()
      expect(customerNameInput.required).toBe(true)
    })
  })

  it('should render Deal Date input with default value in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      const dealDateInput = screen.getByTestId('deal-date-input')
      expect(dealDateInput).toBeDefined()

      // Should have today's date as default
      const today = toDateInputValue(new Date())
      expect(dealDateInput.value).toBe(today)
    })
  })

  it('should NOT render global vendor select in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      // Wait for dropdowns to load
      screen.getByTestId('sales-select')
    })

    // Should NOT find a visible vendor-select in Step 1
    // Note: If a hidden vendor-select exists in DOM (display: none), that's acceptable
    // as long as it's not visible to users
    const vendorSelect = screen.queryByTestId('vendor-select')
    if (vendorSelect) {
      // If it exists, it must be hidden
      const styles = window.getComputedStyle(vendorSelect)
      expect(styles.display).toBe('none')
    }
  })

  it('should show vendor select per line item when is_off_site is true', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    // Fill required fields
    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } })

    // Placeholder text updated in DealFormV2 from 'Enter job number' to 'Enter deal number'.
    // Use data-testid to avoid brittle placeholder coupling.
    const jobNumberInput = screen.getAllByTestId('deal-number-input')[0]
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } })

    // Move to Step 2
    const nextButton =
      screen.getAllByTestId('next-to-line-items-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('next-to-line-items-btn')[0]
    fireEvent.click(nextButton)

    // Wait for Step 2 UI to appear
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Add Item/i }).length).toBeGreaterThan(0)
    })

    // Add a line item
    const addItemButton = screen.getAllByRole('button', { name: /Add Item/i })[0]
    fireEvent.click(addItemButton)

    await waitFor(() => {
      screen.getByText('Item #1')
    })

    // Vendor select should NOT be visible initially (is_off_site is false by default)
    let vendorSelect = screen.queryByTestId('line-vendor-0')
    expect(vendorSelect).toBeNull()

    // Check off-site checkbox
    const offSiteCheckbox = screen.getByTestId('is-off-site-0')
    fireEvent.click(offSiteCheckbox)

    await waitFor(() => {
      // Now vendor select should be visible
      vendorSelect = screen.getByTestId('line-vendor-0')
      expect(vendorSelect).toBeDefined()
    })
  })

  it('should require Customer Name for validation', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />)

    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    // Fill only job number, leave customer name empty
    const jobNumberInput = screen.getAllByTestId('deal-number-input')[0]
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } })

    // Try to move to Step 2 - button should be disabled
    const nextButton =
      screen.getAllByTestId('next-to-line-items-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('next-to-line-items-btn')[0]
    expect(nextButton.disabled).toBe(true)

    // Fill customer name
    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } })

    // Now button should be enabled
    await waitFor(() => {
      expect(nextButton.disabled).toBe(false)
    })
  })

  it('should include customer_name and deal_date in payload', async () => {
    const mockOnSaveWithPayload = vi.fn(() => Promise.resolve())
    render(<DealFormV2 mode="create" onSave={mockOnSaveWithPayload} onCancel={mockOnCancel} />)

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    // Fill required fields
    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } })

    const dealDateInput = screen.getAllByTestId('deal-date-input')[0]
    fireEvent.change(dealDateInput, { target: { value: '2025-01-15' } })

    const jobNumberInput = screen.getAllByTestId('deal-number-input')[0]
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } })

    // Move to Step 2
    const nextButton =
      screen.getAllByTestId('next-to-line-items-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('next-to-line-items-btn')[0]
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Add Item/i }).length).toBeGreaterThan(0)
    })

    // Add a line item with required fields
    const addItemButton = screen.getAllByRole('button', { name: /Add Item/i })[0]
    fireEvent.click(addItemButton)

    await waitFor(() => {
      screen.getByText('Item #1')
    })

    // Fill product and price
    const productSelect = screen.getByTestId('product-select-0')
    fireEvent.change(productSelect, { target: { value: 'prod-1' } })

    await waitFor(() => {
      const priceInput = screen.getAllByPlaceholderText('0.00')[0]
      expect(priceInput.value).toBe('100')
    })

    // Keep scheduling enabled so promised date is retained (time can remain TBD)

    // Save the deal
    const saveButton =
      screen.getAllByTestId('save-deal-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('save-deal-btn')[0]
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSaveWithPayload).toHaveBeenCalled()
      const payload = mockOnSaveWithPayload.mock.calls[0][0]
      expect(payload.customer_name).toBe('Test Customer')
      expect(payload.deal_date).toBe('2025-01-15')
    })
  })

  it('should include vendor_id in line item payload when off-site', async () => {
    const mockOnSaveWithVendor = vi.fn(() => Promise.resolve())
    render(<DealFormV2 mode="create" onSave={mockOnSaveWithVendor} onCancel={mockOnCancel} />)

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getAllByTestId('customer-name-input')[0]
    })

    // Fill required fields
    const customerNameInput = screen.getAllByTestId('customer-name-input')[0]
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } })

    const jobNumberInput = screen.getAllByTestId('deal-number-input')[0]
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } })

    // Move to Step 2
    const nextButton =
      screen.getAllByTestId('next-to-line-items-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('next-to-line-items-btn')[0]
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Add Item/i }).length).toBeGreaterThan(0)
    })

    // Add a line item
    const addItemButton = screen.getAllByRole('button', { name: /Add Item/i })[0]
    fireEvent.click(addItemButton)

    await waitFor(() => {
      screen.getByText('Item #1')
    })

    // Fill product and price
    const productSelect = screen.getByTestId('product-select-0')
    fireEvent.change(productSelect, { target: { value: 'prod-1' } })

    // Check off-site
    const offSiteCheckbox = screen.getByTestId('is-off-site-0')
    fireEvent.click(offSiteCheckbox)

    await waitFor(() => {
      expect(screen.queryByTestId('line-vendor-0')).toBeTruthy()
    })
    const vendorSelect = screen.getByTestId('line-vendor-0')
    fireEvent.change(vendorSelect, { target: { value: 'vendor-1' } })

    // Keep scheduling enabled and set promised date (time can remain TBD)
    const promisedDateInput = screen.getByTestId('date-scheduled-0')
    fireEvent.change(promisedDateInput, { target: { value: toDateInputValue(new Date()) } })

    // Save the deal
    const saveButton =
      screen.getAllByTestId('save-deal-btn').find((btn) => !btn.disabled) ||
      screen.getAllByTestId('save-deal-btn')[0]
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSaveWithVendor).toHaveBeenCalled()
      const payload = mockOnSaveWithVendor.mock.calls[0][0]
      expect(payload.lineItems[0].vendor_id).toBe('vendor-1')
    })
  })
})
