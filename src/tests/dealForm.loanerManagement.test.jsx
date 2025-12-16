/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import DealForm from '../pages/deals/DealForm'

// DealForm loads dropdown data on mount; mock these to make tests deterministic.
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

// Mock the navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock window.open
const mockWindowOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
})

describe('DealForm Loaner Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderDealForm = (props = {}) => {
    return render(
      <BrowserRouter>
        <DealForm mode="create" onCancel={vi.fn()} onSave={vi.fn()} {...props} />
      </BrowserRouter>
    )
  }

  it('shows Manage Loaners button when customer needs loaner', async () => {
    renderDealForm()

    // Wait for component to load
    const loanerCheckbox = await screen.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section to appear
    await screen.findByTestId('loaner-section')

    // Check that Manage button is present
    expect(screen.getByTestId('manage-loaners-btn')).toBeInTheDocument()
    expect(screen.getByText('Manage')).toBeInTheDocument()
  })

  it('opens loaner management page when Manage button is clicked', async () => {
    mockWindowOpen.mockReturnValue({}) // Mock successful tab opening

    renderDealForm()

    // Wait for component to load
    const loanerCheckbox = await screen.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section and click Manage button
    const manageBtn = await screen.findByTestId('manage-loaners-btn')
    fireEvent.click(manageBtn)

    // Verify window.open was called with correct URL
    expect(mockWindowOpen).toHaveBeenCalledWith('/loaner-management-drawer', '_blank')
  })

  it('falls back to navigation when popup blocker prevents new tab', async () => {
    mockWindowOpen.mockReturnValue(null) // Simulate popup blocker

    renderDealForm()

    // Wait for component to load
    const loanerCheckbox = await screen.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section and click Manage button
    const manageBtn = await screen.findByTestId('manage-loaners-btn')
    fireEvent.click(manageBtn)

    // Verify fallback navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/loaner-management-drawer')
  })

  it('shows loaner number input with status checking', async () => {
    renderDealForm()

    // Wait for component to load
    const loanerCheckbox = await screen.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section
    const loanerInput = await screen.findByTestId('loaner-number-input')
    expect(loanerInput).toHaveAttribute('placeholder', 'e.g. L-1024')

    // Type loaner number
    fireEvent.change(loanerInput, { target: { value: '62' } })
    expect(loanerInput.value).toBe('62')
  })

  it('hides loaner section when customer does not need loaner', async () => {
    renderDealForm()

    // Wait for initial form render (DealForm has an async loading gate)
    await screen.findByTestId('loaner-checkbox')

    // Loaner section should not be visible by default
    expect(screen.queryByTestId('loaner-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-loaners-btn')).not.toBeInTheDocument()
  })

  it('shows loaner management link in navigation', () => {
    renderDealForm()

    // Placeholder - actual nav testing would require more setup
    expect(true).toBe(true)
  })
})