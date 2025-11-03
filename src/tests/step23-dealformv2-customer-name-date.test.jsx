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

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DealFormV2 from '../components/deals/DealFormV2.jsx';

// Mock Auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

// Mock Tenant hook
vi.mock('../hooks/useTenant', () => ({
  default: () => ({ orgId: 'test-org-id' }),
}));

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {},
}));

// Mock dropdown service
vi.mock('../services/dropdownService', () => ({
  getSalesConsultants: vi.fn(() => Promise.resolve([
    { id: 'sales-1', full_name: 'John Sales' }
  ])),
  getDeliveryCoordinators: vi.fn(() => Promise.resolve([
    { id: 'dc-1', full_name: 'Jane DC' }
  ])),
  getFinanceManagers: vi.fn(() => Promise.resolve([
    { id: 'fm-1', full_name: 'Bob Finance' }
  ])),
  getVendors: vi.fn(() => Promise.resolve([
    { id: 'vendor-1', name: 'Test Vendor', label: 'Test Vendor' }
  ])),
  getProducts: vi.fn(() => Promise.resolve([
    { id: 'prod-1', label: 'Test Product', unit_price: 100 }
  ])),
}));

// Mock deal service
vi.mock('../services/dealService', () => ({
  default: {
    createDeal: vi.fn(() => Promise.resolve({ id: 'new-deal-id' })),
    updateDeal: vi.fn(() => Promise.resolve({ id: 'updated-deal-id' })),
  },
}));

// Mock vehicle service
vi.mock('../services/vehicleService', () => ({
  vehicleService: {},
}));

// Mock form adapters
vi.mock('../components/deals/formAdapters', () => ({
  draftToCreatePayload: vi.fn((draft) => draft),
  draftToUpdatePayload: vi.fn((original, draft) => draft),
}));

describe('Step 23: DealFormV2 - Customer Name + Deal Date at top; Vendor per line item', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Customer Name input in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />);

    await waitFor(() => {
      const customerNameInput = screen.getByTestId('customer-name-input');
      expect(customerNameInput).toBeDefined();
      expect(customerNameInput.required).toBe(true);
    });
  });

  it('should render Deal Date input with default value in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />);

    await waitFor(() => {
      const dealDateInput = screen.getByTestId('deal-date-input');
      expect(dealDateInput).toBeDefined();
      
      // Should have today's date as default
      const today = new Date().toISOString().slice(0, 10);
      expect(dealDateInput.value).toBe(today);
    });
  });

  it('should NOT render global vendor select in Step 1', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />);

    await waitFor(() => {
      // Wait for dropdowns to load
      screen.getByTestId('sales-select');
    });

    // Should NOT find vendor-select in Step 1
    const vendorSelect = screen.queryByTestId('vendor-select');
    expect(vendorSelect).toBeNull();
  });

  it('should show vendor select per line item when is_off_site is true', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getByTestId('customer-name-input');
    });

    // Fill required fields
    const customerNameInput = screen.getByTestId('customer-name-input');
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } });

    const jobNumberInput = screen.getByPlaceholderText('Enter job number');
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } });

    // Move to Step 2
    const nextButton = screen.getByTestId('save-deal-btn');
    fireEvent.click(nextButton);

    // Wait for Step 2 UI to appear
    await waitFor(() => {
      screen.getByRole('button', { name: /Add Item/i });
    });

    // Add a line item
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await waitFor(() => {
      screen.getByText('Item #1');
    });

    // Vendor select should NOT be visible initially (is_off_site is false by default)
    let vendorSelect = screen.queryByTestId('line-vendor-0');
    expect(vendorSelect).toBeNull();

    // Check off-site checkbox
    const offSiteCheckbox = screen.getByTestId('is-off-site-0');
    fireEvent.click(offSiteCheckbox);

    await waitFor(() => {
      // Now vendor select should be visible
      vendorSelect = screen.getByTestId('line-vendor-0');
      expect(vendorSelect).toBeDefined();
    });
  });

  it('should require Customer Name for validation', async () => {
    render(<DealFormV2 mode="create" onSave={mockOnSave} onCancel={mockOnCancel} />);

    await waitFor(() => {
      screen.getByTestId('customer-name-input');
    });

    // Fill only job number, leave customer name empty
    const jobNumberInput = screen.getByPlaceholderText('Enter job number');
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } });

    // Try to move to Step 2 - button should be disabled
    const nextButton = screen.getByTestId('save-deal-btn');
    expect(nextButton.disabled).toBe(true);

    // Fill customer name
    const customerNameInput = screen.getByTestId('customer-name-input');
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } });

    // Now button should be enabled
    await waitFor(() => {
      expect(nextButton.disabled).toBe(false);
    });
  });

  it('should include customer_name and deal_date in payload', async () => {
    const mockOnSaveWithPayload = vi.fn(() => Promise.resolve());
    render(<DealFormV2 mode="create" onSave={mockOnSaveWithPayload} onCancel={mockOnCancel} />);

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getByTestId('customer-name-input');
    });

    // Fill required fields
    const customerNameInput = screen.getByTestId('customer-name-input');
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } });

    const dealDateInput = screen.getByTestId('deal-date-input');
    fireEvent.change(dealDateInput, { target: { value: '2025-01-15' } });

    const jobNumberInput = screen.getByPlaceholderText('Enter job number');
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } });

    // Move to Step 2
    const nextButton = screen.getByTestId('save-deal-btn');
    fireEvent.click(nextButton);

    await waitFor(() => {
      screen.getByRole('button', { name: /Add Item/i });
    });

    // Add a line item with required fields
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await waitFor(() => {
      screen.getByText('Item #1');
    });

    // Fill product and price
    const productSelect = screen.getByTestId('product-select-0');
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    await waitFor(() => {
      const priceInput = screen.getAllByPlaceholderText('0.00')[0];
      expect(priceInput.value).toBe('100');
    });

    // Uncheck requires scheduling and provide reason
    const requiresSchedulingCheckbox = screen.getByTestId('requires-scheduling-0');
    fireEvent.click(requiresSchedulingCheckbox);

    await waitFor(() => {
      const reasonInput = screen.getByPlaceholderText('e.g., installed at delivery');
      fireEvent.change(reasonInput, { target: { value: 'Test reason' } });
    });

    // Save the deal
    const saveButton = screen.getByText('Create Deal');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSaveWithPayload).toHaveBeenCalled();
      const payload = mockOnSaveWithPayload.mock.calls[0][0];
      expect(payload.customer_name).toBe('Test Customer');
      expect(payload.deal_date).toBe('2025-01-15');
    });
  });

  it('should include vendor_id in line item payload when off-site', async () => {
    const mockOnSaveWithVendor = vi.fn(() => Promise.resolve());
    render(<DealFormV2 mode="create" onSave={mockOnSaveWithVendor} onCancel={mockOnCancel} />);

    // Wait for Step 1 to load
    await waitFor(() => {
      screen.getByTestId('customer-name-input');
    });

    // Fill required fields
    const customerNameInput = screen.getByTestId('customer-name-input');
    fireEvent.change(customerNameInput, { target: { value: 'Test Customer' } });

    const jobNumberInput = screen.getByPlaceholderText('Enter job number');
    fireEvent.change(jobNumberInput, { target: { value: 'JOB-001' } });

    // Move to Step 2
    const nextButton = screen.getByTestId('save-deal-btn');
    fireEvent.click(nextButton);

    await waitFor(() => {
      screen.getByRole('button', { name: /Add Item/i });
    });

    // Add a line item
    const addItemButton = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addItemButton);

    await waitFor(() => {
      screen.getByText('Item #1');
    });

    // Fill product and price
    const productSelect = screen.getByTestId('product-select-0');
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    // Check off-site
    const offSiteCheckbox = screen.getByTestId('is-off-site-0');
    fireEvent.click(offSiteCheckbox);

    await waitFor(() => {
      const vendorSelect = screen.getByTestId('line-vendor-0');
      fireEvent.change(vendorSelect, { target: { value: 'vendor-1' } });
    });

    // Uncheck requires scheduling and provide reason
    const requiresSchedulingCheckbox = screen.getByTestId('requires-scheduling-0');
    fireEvent.click(requiresSchedulingCheckbox);

    await waitFor(() => {
      const reasonInput = screen.getByPlaceholderText('e.g., installed at delivery');
      fireEvent.change(reasonInput, { target: { value: 'Test reason' } });
    });

    // Save the deal
    const saveButton = screen.getByText('Create Deal');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSaveWithVendor).toHaveBeenCalled();
      const payload = mockOnSaveWithVendor.mock.calls[0][0];
      expect(payload.lineItems[0].vendor_id).toBe('vendor-1');
    });
  });
});
