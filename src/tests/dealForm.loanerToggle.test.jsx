// Ensure VITE_DEAL_FORM_V2 is set before any imports
Object.defineProperty(import.meta.env, 'VITE_DEAL_FORM_V2', {
  value: 'true',
  writable: true,
  configurable: true,
  enumerable: true,
});

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DealForm from '../pages/deals/DealForm'

// Mock dependencies
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

vi.mock('../hooks/useTenant', () => ({
  default: vi.fn(() => ({ orgId: 'test-org-123' })),
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

vi.mock('../components/common/UnsavedChangesGuard', () => ({
  default: () => null,
}))

vi.mock('../config/ui', () => ({
  UI_FLAGS: {},
}))

describe('DealForm V2 - Loaner Toggle', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Set V2 flag using Object.defineProperty for compatibility with Vitest
    Object.defineProperty(import.meta.env, 'VITE_DEAL_FORM_V2', {
      value: 'true',
      writable: true,
      configurable: true,
      enumerable: true,
    })
  })

  it('Create mode: toggle on shows loaner section, toggle off hides and clears fields', async () => {
    const { BrowserRouter } = await import('react-router-dom')
    const { container } = render(
      <BrowserRouter>
        <DealForm mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />
      </BrowserRouter>
    )

    // Wait for component to load
    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    // Initially, loaner checkbox should be unchecked
    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')
    expect(loanerCheckbox.checked).toBe(false)

    // Loaner section wrapper should exist, but fields should not be visible
    expect(container.querySelector('[data-testid="loaner-section"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeNull()

    // Toggle loaner checkbox ON
    fireEvent.click(loanerCheckbox)
    expect(loanerCheckbox.checked).toBe(true)

    // Loaner fields should now be visible
    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeTruthy()
    })

    // Fill in some loaner data
    const loanerNumberInput = container.querySelector('[data-testid="loaner-number-input"]')
    const loanerEtaInput = container.querySelector('[data-testid="loaner-eta-input"]')
    const loanerNotesInput = container.querySelector('[data-testid="loaner-notes-input"]')

    fireEvent.change(loanerNumberInput, { target: { value: 'L-1024' } })
    fireEvent.change(loanerEtaInput, { target: { value: '2025-11-15' } })
    fireEvent.change(loanerNotesInput, { target: { value: 'Test notes' } })

    expect(loanerNumberInput.value).toBe('L-1024')
    expect(loanerEtaInput.value).toBe('2025-11-15')
    expect(loanerNotesInput.value).toBe('Test notes')

    // Toggle loaner checkbox OFF
    fireEvent.click(loanerCheckbox)
    expect(loanerCheckbox.checked).toBe(false)

    // Loaner fields should be hidden (but wrapper still exists)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeNull()
    })

    // Toggle back ON to verify fields were cleared
    fireEvent.click(loanerCheckbox)
    expect(loanerCheckbox.checked).toBe(true)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeTruthy()
    })

    // Fields should be empty now (V2 behavior)
    const clearedLoanerNumber = container.querySelector('[data-testid="loaner-number-input"]')
    const clearedLoanerEta = container.querySelector('[data-testid="loaner-eta-input"]')
    const clearedLoanerNotes = container.querySelector('[data-testid="loaner-notes-input"]')

    expect(clearedLoanerNumber.value).toBe('')
    expect(clearedLoanerEta.value).toBe('')
    expect(clearedLoanerNotes.value).toBe('')
  })

  it('Edit mode: toggle off with existing loaner data hides section and clears payload', async () => {
    const { BrowserRouter } = await import('react-router-dom')
    const initialData = {
      id: 'deal-123',
      updated_at: '2025-10-30T12:00:00Z',
      job_number: 'JOB-001',
      customer_needs_loaner: true,
      loanerForm: {
        loaner_number: 'L-9999',
        eta_return_date: '2025-11-20',
        notes: 'Existing loaner',
      },
      lineItems: [
        {
          product_id: 'prod-1',
          quantity_used: 1,
          unit_price: 100,
          promised_date: '2025-11-01',
          requires_scheduling: true,
          no_schedule_reason: '',
          is_off_site: false,
        },
      ],
    }

    const { container } = render(
      <BrowserRouter>
        <DealForm mode="edit" initial={initialData} onSave={mockOnSave} onCancel={mockOnCancel} />
      </BrowserRouter>
    )

    // Wait for component to load
    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    // Loaner checkbox should be checked
    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')
    expect(loanerCheckbox.checked).toBe(true)

    // Loaner section should be visible with existing data
    expect(container.querySelector('[data-testid="loaner-section"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="loaner-number-input"]').value).toBe('L-9999')
    expect(container.querySelector('[data-testid="loaner-eta-input"]').value).toBe('2025-11-20')
    expect(container.querySelector('[data-testid="loaner-notes-input"]').value).toBe(
      'Existing loaner'
    )

    // Toggle loaner checkbox OFF
    fireEvent.click(loanerCheckbox)
    expect(loanerCheckbox.checked).toBe(false)

    // Loaner fields should be hidden (but wrapper still exists)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeNull()
    })

    // Submit the form and verify loaner data is cleared in payload
    const saveButton = container.querySelector('[data-testid="save-deal-btn"]')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })

    const savedPayload = mockOnSave.mock.calls[0][0]

    // V2 behavior: customer_needs_loaner should be false
    expect(savedPayload.customer_needs_loaner).toBe(false)

    // Loaner form should either be null or have empty fields
    if (savedPayload.loanerForm) {
      expect(savedPayload.loanerForm.loaner_number).toBe('')
      expect(savedPayload.loanerForm.eta_return_date).toBeFalsy()
      expect(savedPayload.loanerForm.notes).toBe('')
    }
  })

  it('Create mode with flag OFF: legacy behavior (no field clearing)', async () => {
    const { BrowserRouter } = await import('react-router-dom')
    // Disable V2 flag using Object.defineProperty for compatibility with Vitest
    Object.defineProperty(import.meta.env, 'VITE_DEAL_FORM_V2', {
      value: 'false',
      writable: true,
      configurable: true,
      enumerable: true,
    })

    const { container } = render(
      <BrowserRouter>
        <DealForm mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />
      </BrowserRouter>
    )

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')

    // Toggle ON
    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeTruthy()
    })

    // Fill in data
    const loanerNumberInput = container.querySelector('[data-testid="loaner-number-input"]')
    fireEvent.change(loanerNumberInput, { target: { value: 'L-5555' } })
    expect(loanerNumberInput.value).toBe('L-5555')

    // Toggle OFF
    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeNull()
    })

    // Toggle back ON
    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeTruthy()
    })

    // Legacy behavior: field should still have the value (not cleared)
    const persistedLoanerNumber = container.querySelector('[data-testid="loaner-number-input"]')
    expect(persistedLoanerNumber.value).toBe('L-5555')
  })
})
