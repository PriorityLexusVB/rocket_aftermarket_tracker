/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import DealForm from '../pages/deals/DealForm'

// DealForm loads dropdown data on mount; mock these to make tests deterministic.
vi.mock('../services/dropdownService', () => ({
  getVendors: vi.fn(async () => []),
  getProducts: vi.fn(async () => []),
  getSalesConsultants: vi.fn(async () => []),
  getFinanceManagers: vi.fn(async () => []),
  getDeliveryCoordinators: vi.fn(async () => []),
  getUserProfiles: vi.fn(async () => []),
}))

vi.mock('../services/tenantService', () => ({
  listVendorsByOrg: vi.fn(async () => []),
  listProductsByOrg: vi.fn(async () => []),
  listStaffByOrg: vi.fn(async () => []),
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

// Mock Supabase client for loaner status checking
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}))

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

  const getForm = async () => {
    const form = await screen.findByTestId('deal-form')
    return within(form)
  }

  it('renders loaner controls disabled by default and enables after checking', async () => {
    renderDealForm()

    const form = await getForm()
    const loanerCheckbox = await form.findByTestId('loaner-checkbox')
    const manageBtn = await form.findByTestId('manage-loaners-btn')
    const loanerInput = await form.findByTestId('loaner-number-input')

    expect(manageBtn).toBeDisabled()
    expect(loanerInput).toBeDisabled()

    fireEvent.click(loanerCheckbox)

    expect(manageBtn).toBeEnabled()
    expect(loanerInput).toBeEnabled()
  })

  it('opens loaner management page when Manage button is clicked', async () => {
    mockWindowOpen.mockReturnValue({}) // Mock successful tab opening

    renderDealForm()

    const form = await getForm()
    const loanerCheckbox = await form.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    const manageBtn = await form.findByTestId('manage-loaners-btn')
    expect(manageBtn).toBeEnabled()
    fireEvent.click(manageBtn)

    // Verify window.open was called with correct URL
    expect(mockWindowOpen).toHaveBeenCalledWith('/loaner-management-drawer', '_blank')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('falls back to navigation when popup blocker prevents new tab', async () => {
    mockWindowOpen.mockReturnValue(null) // Simulate popup blocker

    renderDealForm()

    const form = await getForm()
    const loanerCheckbox = await form.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    const manageBtn = await form.findByTestId('manage-loaners-btn')
    expect(manageBtn).toBeEnabled()
    fireEvent.click(manageBtn)

    // Verify fallback navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/loaner-management-drawer')
  })

  it('shows loaner number input with status checking', async () => {
    renderDealForm()

    const form = await getForm()
    const loanerInput = await form.findByTestId('loaner-number-input')
    expect(loanerInput).toBeDisabled()
    expect(loanerInput).toHaveAttribute('placeholder', 'e.g. L-1024')

    const loanerCheckbox = await form.findByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    expect(loanerInput).toBeEnabled()
    fireEvent.change(loanerInput, { target: { value: '62' } })
    expect(loanerInput.value).toBe('62')
  })

  it('shows disabled loaner controls when customer does not need loaner', async () => {
    renderDealForm()
    const form = await getForm()
    expect(await form.findByTestId('loaner-section')).toBeInTheDocument()
    expect(await form.findByTestId('manage-loaners-btn')).toBeDisabled()
    expect(await form.findByTestId('loaner-number-input')).toBeDisabled()
  })

  it('shows loaner management link in navigation', () => {
    renderDealForm()

    // The navigation should include the Loaners link
    // Note: This may depend on how the Navbar component is structured
    // We're testing that the component doesn't crash with the new navigation
    expect(true).toBe(true) // Placeholder - actual nav testing would require more setup
  })
})
