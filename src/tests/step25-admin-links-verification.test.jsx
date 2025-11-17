/**
 * Step 25: Admin links verification - Ensure all staff dropdowns have "Open Admin" links
 * 
 * Goal: Verify that Sales, Finance, and Delivery Coordinator dropdowns all have
 * consistent "Open Admin" links for editing staff.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'
import DealFormV2 from '../components/deals/DealFormV2'

// Mock dependencies
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: 'test-org' }),
}))

vi.mock('../services/dropdownService', () => ({
  getSalesConsultants: vi.fn(() =>
    Promise.resolve([
      { id: 'sales-1', full_name: 'John Doe', label: 'John Doe' },
      { id: 'sales-2', full_name: 'Jane Smith', label: 'Jane Smith' },
    ])
  ),
  getFinanceManagers: vi.fn(() =>
    Promise.resolve([
      { id: 'fin-1', full_name: 'Bob Finance', label: 'Bob Finance' },
      { id: 'fin-2', full_name: 'Alice Money', label: 'Alice Money' },
    ])
  ),
  getDeliveryCoordinators: vi.fn(() =>
    Promise.resolve([
      { id: 'dc-1', full_name: 'Tom Delivery', label: 'Tom Delivery' },
      { id: 'dc-2', full_name: 'Sue Coordinator', label: 'Sue Coordinator' },
    ])
  ),
  getVendors: vi.fn(() => Promise.resolve([])),
  getProducts: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../services/vehicleService', () => ({
  vehicleService: {
    searchVehicles: vi.fn(() => Promise.resolve([])),
  },
}))

describe('Step 25: Admin links verification for staff dropdowns', () => {
  it('should display "Open Admin" link for Sales Consultant', async () => {
    render(
      <BrowserRouter>
        <DealFormV2 mode="create" onSave={vi.fn()} onCancel={vi.fn()} />
      </BrowserRouter>
    )

    // Wait for dropdowns to load
    await screen.findByTestId('sales-select')

    // Check for the admin link
    const adminLink = screen.getByTestId('admin-link-sales')
    expect(adminLink).toBeDefined()
    expect(adminLink.textContent).toContain('Open Admin')
    expect(adminLink.getAttribute('href')).toBe('/admin/staff')
  })

  it('should display "Open Admin" link for Finance Manager', async () => {
    render(
      <BrowserRouter>
        <DealFormV2 mode="create" onSave={vi.fn()} onCancel={vi.fn()} />
      </BrowserRouter>
    )

    // Wait for dropdowns to load
    await screen.findByTestId('finance-select')

    // Check for the admin link
    const adminLink = screen.getByTestId('admin-link-finance')
    expect(adminLink).toBeDefined()
    expect(adminLink.textContent).toContain('Open Admin')
    expect(adminLink.getAttribute('href')).toBe('/admin/staff')
  })

  it('should display "Open Admin" link for Delivery Coordinator', async () => {
    render(
      <BrowserRouter>
        <DealFormV2 mode="create" onSave={vi.fn()} onCancel={vi.fn()} />
      </BrowserRouter>
    )

    // Wait for dropdowns to load
    await screen.findByTestId('delivery-select')

    // Check for the admin link
    const adminLink = screen.getByTestId('admin-link-delivery')
    expect(adminLink).toBeDefined()
    expect(adminLink.textContent).toContain('Open Admin')
    expect(adminLink.getAttribute('href')).toBe('/admin/staff')
  })

  it('should have all three admin links present simultaneously', async () => {
    render(
      <BrowserRouter>
        <DealFormV2 mode="create" onSave={vi.fn()} onCancel={vi.fn()} />
      </BrowserRouter>
    )

    // Wait for dropdowns to load
    await screen.findByTestId('sales-select')

    // Check that all three admin links are present
    const salesLink = screen.getByTestId('admin-link-sales')
    const financeLink = screen.getByTestId('admin-link-finance')
    const deliveryLink = screen.getByTestId('admin-link-delivery')

    expect(salesLink).toBeDefined()
    expect(financeLink).toBeDefined()
    expect(deliveryLink).toBeDefined()

    // All should link to the same admin staff page
    expect(salesLink.getAttribute('href')).toBe('/admin/staff')
    expect(financeLink.getAttribute('href')).toBe('/admin/staff')
    expect(deliveryLink.getAttribute('href')).toBe('/admin/staff')
  })
})
