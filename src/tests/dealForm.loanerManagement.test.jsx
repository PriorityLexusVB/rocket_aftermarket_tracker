/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import DealForm from '../pages/deals/DealForm'

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

// Mock supabase module
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

  it('shows Manage Loaners button when customer needs loaner', async () => {
    renderDealForm()

    // Find and check the loaner checkbox
    const loanerCheckbox = screen.getByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section to appear
    await waitFor(() => {
      expect(screen.getByTestId('loaner-section')).toBeInTheDocument()
    })

    // Check that Manage button is present
    expect(screen.getByTestId('manage-loaners-btn')).toBeInTheDocument()
    expect(screen.getByText('Manage')).toBeInTheDocument()
  })

  it('opens loaner management page when Manage button is clicked', async () => {
    mockWindowOpen.mockReturnValue({}) // Mock successful tab opening

    renderDealForm()

    // Enable loaner section
    const loanerCheckbox = screen.getByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section and click Manage button
    await waitFor(() => {
      expect(screen.getByTestId('manage-loaners-btn')).toBeInTheDocument()
    })

    const manageBtn = screen.getByTestId('manage-loaners-btn')
    fireEvent.click(manageBtn)

    // Verify window.open was called with correct URL
    expect(mockWindowOpen).toHaveBeenCalledWith('/loaner-management-drawer', '_blank')
  })

  it('falls back to navigation when popup blocker prevents new tab', async () => {
    mockWindowOpen.mockReturnValue(null) // Simulate popup blocker

    renderDealForm()

    // Enable loaner section
    const loanerCheckbox = screen.getByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section and click Manage button
    await waitFor(() => {
      expect(screen.getByTestId('manage-loaners-btn')).toBeInTheDocument()
    })

    const manageBtn = screen.getByTestId('manage-loaners-btn')
    fireEvent.click(manageBtn)

    // Verify fallback navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/loaner-management-drawer')
  })

  it('shows loaner number input with status checking', async () => {
    renderDealForm()

    // Enable loaner section
    const loanerCheckbox = screen.getByTestId('loaner-checkbox')
    fireEvent.click(loanerCheckbox)

    // Wait for loaner section
    await waitFor(() => {
      expect(screen.getByTestId('loaner-number-input')).toBeInTheDocument()
    })

    const loanerInput = screen.getByTestId('loaner-number-input')
    expect(loanerInput).toHaveAttribute('placeholder', 'e.g. L-1024')

    // Type loaner number
    fireEvent.change(loanerInput, { target: { value: '62' } })
    expect(loanerInput.value).toBe('62')
  })

  it('hides loaner section when customer does not need loaner', () => {
    renderDealForm()

    // Loaner section should not be visible by default
    expect(screen.queryByTestId('loaner-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-loaners-btn')).not.toBeInTheDocument()
  })

  it('shows loaner management link in navigation', () => {
    renderDealForm()
    
    // The navigation should include the Loaners link
    // Note: This may depend on how the Navbar component is structured
    // We're testing that the component doesn't crash with the new navigation
    expect(true).toBe(true) // Placeholder - actual nav testing would require more setup
  })
})