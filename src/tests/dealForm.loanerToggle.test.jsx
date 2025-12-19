import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
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
    // Default to V2 enabled for each test
    Object.defineProperty(import.meta.env, 'VITE_DEAL_FORM_V2', {
      value: 'true',
      writable: true,
      configurable: true,
      enumerable: true,
    })
  })

  const renderCreateForm = (props = {}) =>
    render(
      <BrowserRouter>
        <DealForm mode="create" onSave={mockOnSave} onCancel={mockOnCancel} {...props} />
      </BrowserRouter>
    )

  it('Create mode: loaner section toggles enabled state and clears when off (V2)', async () => {
    const { container } = renderCreateForm()

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')
    const loanerSection = container.querySelector('[data-testid="loaner-section"]')

    expect(loanerCheckbox.checked).toBe(false)
    expect(loanerSection?.getAttribute('aria-disabled')).toBe('true')
    expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeDisabled()
    expect(container.querySelector('[data-testid="loaner-eta-input"]')).toBeDisabled()
    expect(container.querySelector('[data-testid="loaner-notes-input"]')).toBeDisabled()

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const enabledSection = container.querySelector('[data-testid="loaner-section"]')
      expect(enabledSection?.getAttribute('aria-disabled')).toBe('false')
    })

    const loanerNumberInput = container.querySelector('[data-testid="loaner-number-input"]')
    const loanerEtaInput = container.querySelector('[data-testid="loaner-eta-input"]')
    const loanerNotesInput = container.querySelector('[data-testid="loaner-notes-input"]')

    fireEvent.change(loanerNumberInput, { target: { value: 'L-1024' } })
    fireEvent.change(loanerEtaInput, { target: { value: '2025-11-15' } })
    fireEvent.change(loanerNotesInput, { target: { value: 'Test notes' } })

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const disabledSection = container.querySelector('[data-testid="loaner-section"]')
      expect(disabledSection?.getAttribute('aria-disabled')).toBe('true')
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeDisabled()
      expect(container.querySelector('[data-testid="loaner-eta-input"]')).toBeDisabled()
      expect(container.querySelector('[data-testid="loaner-notes-input"]')).toBeDisabled()
      expect(container.querySelector('[data-testid="loaner-number-input"]')?.value).toBe('')
      expect(container.querySelector('[data-testid="loaner-eta-input"]')?.value).toBe('')
      expect(container.querySelector('[data-testid="loaner-notes-input"]')?.value).toBe('')
    })
  })

  it('Edit mode: toggle off with existing loaner data hides section and clears payload', async () => {
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

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')
    expect(loanerCheckbox.checked).toBe(true)

    expect(container.querySelector('[data-testid="loaner-section"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="loaner-number-input"]')?.value).toBe('L-9999')
    expect(container.querySelector('[data-testid="loaner-eta-input"]')?.value).toBe('2025-11-20')
    expect(container.querySelector('[data-testid="loaner-notes-input"]')?.value).toBe(
      'Existing loaner'
    )

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const disabledSection = container.querySelector('[data-testid="loaner-section"]')
      expect(disabledSection?.getAttribute('aria-disabled')).toBe('true')
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeDisabled()
      expect(container.querySelector('[data-testid="loaner-number-input"]')?.value).toBe('')
      expect(container.querySelector('[data-testid="loaner-eta-input"]')?.value).toBe('')
      expect(container.querySelector('[data-testid="loaner-notes-input"]')?.value).toBe('')
    })

    const saveButton = container.querySelector('[data-testid="save-deal-btn"]')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })

    const savedPayload = mockOnSave.mock.calls[0][0]
    expect(savedPayload.customer_needs_loaner).toBe(false)

    if (savedPayload.loanerForm) {
      expect(savedPayload.loanerForm.loaner_number).toBe('')
      expect(savedPayload.loanerForm.eta_return_date).toBeFalsy()
      expect(savedPayload.loanerForm.notes).toBe('')
    }
  })

  it('Create mode with flag OFF: legacy behavior keeps values even when disabled', async () => {
    Object.defineProperty(import.meta.env, 'VITE_DEAL_FORM_V2', {
      value: 'false',
      writable: true,
      configurable: true,
      enumerable: true,
    })

    const { container } = renderCreateForm()

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="loaner-checkbox"]')).toBeTruthy()
      },
      { timeout: 2000 }
    )

    const loanerCheckbox = container.querySelector('[data-testid="loaner-checkbox"]')

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const enabledInput = container.querySelector('[data-testid="loaner-number-input"]')
      expect(enabledInput).not.toBeDisabled()
    })

    const loanerNumberInput = container.querySelector('[data-testid="loaner-number-input"]')
    fireEvent.change(loanerNumberInput, { target: { value: 'L-5555' } })
    expect(loanerNumberInput.value).toBe('L-5555')

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const disabledSection = container.querySelector('[data-testid="loaner-section"]')
      expect(disabledSection?.getAttribute('aria-disabled')).toBe('true')
      expect(container.querySelector('[data-testid="loaner-number-input"]')).toBeDisabled()
    })

    fireEvent.click(loanerCheckbox)

    await waitFor(() => {
      const enabledInput = container.querySelector('[data-testid="loaner-number-input"]')
      expect(enabledInput).not.toBeDisabled()
    })

    expect(container.querySelector('[data-testid="loaner-number-input"]')?.value).toBe('L-5555')
  })
})
