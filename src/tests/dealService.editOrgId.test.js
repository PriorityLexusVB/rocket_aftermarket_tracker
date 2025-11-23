/**
 * Test suite for org_id preservation in edit deal flow
 * Validates that org_id is properly mapped from database to form and back
 */

import { describe, it, expect } from 'vitest'
import { mapDbDealToForm } from '../services/dealService'

describe('dealService - org_id preservation in edit flow', () => {
  const mockOrgId = '123e4567-e89b-12d3-a456-426614174000'
  const mockJobId = 'job-123'

  const mockDbDeal = {
    id: mockJobId,
    org_id: mockOrgId,
    job_number: 'JOB-001',
    customer_name: 'John Doe',
    title: '2024 Lexus RX350',
    description: 'Regular service',
    vehicle_id: 'vehicle-1',
    vendor_id: null,
    assigned_to: 'user-1',
    job_status: 'pending',
    priority: 'medium',
    customer_needs_loaner: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    vehicle: {
      id: 'vehicle-1',
      stock_number: 'STK-001',
      year: 2024,
      make: 'Lexus',
      model: 'RX350',
    },
    job_parts: [
      {
        id: 'part-1',
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
        promised_date: '2024-01-20',
        requires_scheduling: true,
        is_off_site: false,
      },
    ],
  }

  it('should include org_id when mapping DB deal to form', () => {
    const formData = mapDbDealToForm(mockDbDeal)

    expect(formData).toBeDefined()
    expect(formData.org_id).toBe(mockOrgId)
    expect(formData.org_id).not.toBeNull()
    expect(formData.org_id).not.toBeUndefined()
  })

  it('should preserve org_id alongside other critical fields', () => {
    const formData = mapDbDealToForm(mockDbDeal)

    // Verify org_id is included
    expect(formData.org_id).toBe(mockOrgId)

    // Verify other critical fields are also present
    expect(formData.id).toBe(mockJobId)
    expect(formData.job_number).toBe('JOB-001')
    expect(formData.customer_name).toBe('John Doe')
    expect(formData.updated_at).toBe('2024-01-15T10:00:00Z')
  })

  it('should handle null org_id gracefully', () => {
    const dealWithoutOrgId = {
      ...mockDbDeal,
      org_id: null,
    }

    const formData = mapDbDealToForm(dealWithoutOrgId)

    expect(formData).toBeDefined()
    expect(formData.org_id).toBeNull()
  })

  it('should handle undefined org_id gracefully', () => {
    const dealWithoutOrgId = {
      ...mockDbDeal,
    }
    delete dealWithoutOrgId.org_id

    const formData = mapDbDealToForm(dealWithoutOrgId)

    expect(formData).toBeDefined()
    expect(formData.org_id).toBeUndefined()
  })

  it('should include org_id in mapped form for edit flow end-to-end', () => {
    // Simulate the edit flow:
    // 1. Fetch deal from database (has org_id)
    const dbDeal = mockDbDeal

    // 2. Map to form data
    const formData = mapDbDealToForm(dbDeal)

    // 3. Verify org_id is preserved for update
    expect(formData.org_id).toBe(mockOrgId)

    // 4. Simulate user editing (org_id should remain)
    const editedFormData = {
      ...formData,
      customer_name: 'Jane Doe', // User changed name
    }

    // 5. Verify org_id still present after edit
    expect(editedFormData.org_id).toBe(mockOrgId)
  })

  it('should map all required fields for complete edit flow', () => {
    const formData = mapDbDealToForm(mockDbDeal)

    // Critical fields for RLS and business logic
    expect(formData.org_id).toBe(mockOrgId)
    expect(formData.id).toBe(mockJobId)
    expect(formData.updated_at).toBeDefined()

    // Customer fields
    // NOTE: Both snake_case and camelCase provided for backward compatibility
    // with different parts of the codebase. Consider standardizing in the future.
    expect(formData.customer_name).toBe('John Doe')
    expect(formData.customerName).toBe('John Doe')

    // Vehicle fields
    expect(formData.stock_number).toBe('STK-001')
    expect(formData.stockNumber).toBe('STK-001')

    // Line items
    expect(formData.lineItems).toHaveLength(1)
    expect(formData.lineItems[0].product_id).toBe('prod-1')
  })
})
