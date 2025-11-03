// src/components/deals/DealFormV2.jsx
// Shared two-step wizard form for Create and Edit modes
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import useTenant from '../../hooks/useTenant'
import dealService from '../../services/dealService'
import { draftToCreatePayload, draftToUpdatePayload } from './formAdapters'
import { vehicleService } from '../../services/vehicleService'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import {
  getSalesConsultants,
  getDeliveryCoordinators,
  getFinanceManagers,
  getVendors,
  getProducts,
} from '../../services/dropdownService'

export default function DealFormV2({ mode = 'create', job = null, onSave, onCancel }) {
  const { user } = useAuth()
  const { orgId } = useTenant() || {}
  const loanerRef = useRef(null)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Customer, 2 = Line Items
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Dropdown state
  const [dropdownData, setDropdownData] = useState({
    salesConsultants: [],
    deliveryCoordinators: [],
    financeManagers: [],
    vendors: [],
    products: [],
    loading: true,
    error: null,
  })

  // Customer form data
  const [customerData, setCustomerData] = useState({
    jobNumber: job?.job_number || '',
    stockNumber: job?.stock_number || '',
    customerMobile: job?.customer_mobile || '',
    vendorId: job?.vendor_id || null,
    description: job?.description || '',
    assignedTo: job?.assigned_to || null,
    deliveryCoordinator: job?.delivery_coordinator_id || null,
    financeManager: job?.finance_manager_id || null,
    needsLoaner: Boolean(job?.customer_needs_loaner),
    loanerNumber: job?.loaner_number || '',
  })

  // Line items data
  const [lineItems, setLineItems] = useState(
    job?.lineItems?.length
      ? job.lineItems
      : []
  )

  // Load dropdown data
  const loadDropdownData = async () => {
    try {
      setDropdownData((prev) => ({ ...prev, loading: true, error: null }))

      const [sales, dc, finance, vendorsOpts, productsOpts] = await Promise.all([
        getSalesConsultants().catch(() => []),
        getDeliveryCoordinators().catch(() => []),
        getFinanceManagers().catch(() => []),
        getVendors({ activeOnly: true }).catch(() => []),
        getProducts({ activeOnly: true }).catch(() => []),
      ])

      setDropdownData({
        salesConsultants: sales,
        deliveryCoordinators: dc,
        financeManagers: finance,
        vendors: vendorsOpts,
        products: productsOpts?.map((p) => ({ ...p, unitPrice: p?.unit_price })),
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error('Failed to load dropdown data:', err)
      setDropdownData((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load dropdown data.',
      }))
    }
  }

  useEffect(() => {
    loadDropdownData()
  }, [])

  // Native select component
  const MobileSelect = ({ label, options, value, onChange, placeholder, testId, helpLink }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e?.target?.value || null)}
        className="bg-white border border-gray-300 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        disabled={dropdownData?.loading}
        data-testid={testId}
      >
        <option value="">{placeholder}</option>
        {options?.map((option) => (
          <option key={option?.id} value={option?.id}>
            {option?.full_name || option?.label || option?.name}
          </option>
        ))}
      </select>
      {helpLink && (
        <p className="mt-2 text-xs text-slate-500">
          {helpLink}
        </p>
      )}
      {!helpLink && options?.length === 0 && !dropdownData?.loading && (
        <p className="mt-1 text-xs text-gray-500">
          No {label?.toLowerCase()} found yet. Add it in Admin.
        </p>
      )}
    </div>
  )

  // Add new line item
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        unitPrice: '',
        requiresScheduling: true,
        promisedDate: '',
        noScheduleReason: '',
        isOffSite: false,
      },
    ])
  }

  // Update line item
  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev?.map((item) => {
        if (item?.id === id) {
          let updatedItem = { ...item, [field]: value }

          if (field === 'requiresScheduling') {
            if (value === true) {
              updatedItem.noScheduleReason = ''
            } else {
              updatedItem.promisedDate = ''
            }
          }

          return updatedItem
        }
        return item
      })
    )

    // Auto-populate price when product is selected
    if (field === 'productId' && value) {
      const selectedProduct = dropdownData?.products?.find((p) => p?.id === value)
      if (selectedProduct) {
        setLineItems((prev) =>
          prev?.map((item) =>
            item?.id === id ? { ...item, unitPrice: selectedProduct?.unitPrice || '' } : item
          )
        )
      }
    }
  }

  // Remove line item
  const removeLineItem = (id) => {
    setLineItems((prev) => prev?.filter((item) => item?.id !== id))
  }

  // Validation
  const validateStep1 = () => {
    return customerData?.jobNumber?.trim()?.length > 0
  }

  const validateStep2 = () => {
    if (lineItems?.length === 0) return false

    return lineItems?.every((item) => {
      if (!item?.productId || !item?.unitPrice) return false
      if (item?.requiresScheduling && !item?.promisedDate) return false
      if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) return false
      return true
    })
  }

  // Calculate total
  const calculateTotal = () => {
    return lineItems?.reduce((sum, item) => {
      return sum + (parseFloat(item?.unitPrice) || 0)
    }, 0)
  }

  // Handle save
  const handleSave = async () => {
    if (!validateStep1() || !validateStep2()) {
      setError('Please complete all required fields')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        job_number: customerData?.jobNumber?.trim(),
        stock_number: customerData?.stockNumber?.trim() || null,
        customer_mobile: customerData?.customerMobile?.trim() || null,
        vendor_id: customerData?.vendorId || null,
        description: customerData?.description?.trim() || null,
        assigned_to: customerData?.assignedTo || user?.id,
        delivery_coordinator_id: customerData?.deliveryCoordinator || null,
        finance_manager_id: customerData?.financeManager || null,
        customer_needs_loaner: Boolean(customerData?.needsLoaner),
        loaner_number: customerData?.needsLoaner ? customerData?.loanerNumber?.trim() || null : null,
        lineItems: lineItems.map((item) => ({
          product_id: item?.productId,
          quantity_used: 1,
          unit_price: parseFloat(item?.unitPrice || 0),
          promised_date: item?.requiresScheduling ? item?.promisedDate : null,
          requires_scheduling: Boolean(item?.requiresScheduling),
          no_schedule_reason: !item?.requiresScheduling ? item?.noScheduleReason : null,
          is_off_site: Boolean(item?.isOffSite),
        })),
      }

      if (onSave) {
        await onSave(payload)
      } else {
        // Fallback: use dealService directly
        if (mode === 'edit' && job?.id) {
          const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
          const adapted = useV2 ? draftToUpdatePayload({ id: job.id }, payload) : payload
          await dealService.updateDeal(job.id, adapted)
        } else {
          const useV2 = import.meta.env?.VITE_DEAL_FORM_V2 === 'true'
          const adapted = useV2 ? draftToCreatePayload(payload) : payload
          await dealService.createDeal(adapted)
        }
      }

      if (onCancel) onCancel()
    } catch (err) {
      setError(`Failed to save: ${err?.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      {/* Progress indicator */}
      <div className="mb-6 flex items-center space-x-4">
        <div
          className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            1
          </div>
          <span className="font-medium">Customer</span>
        </div>
        <div className="flex-1 h-px bg-gray-300"></div>
        <div
          className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            2
          </div>
          <span className="font-medium">Line Items</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1: Customer */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deal / Job # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerData?.jobNumber}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, jobNumber: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Stock #
              </label>
              <input
                type="text"
                value={customerData?.stockNumber}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, stockNumber: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter stock number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Mobile
              </label>
              <input
                type="tel"
                value={customerData?.customerMobile}
                onChange={(e) =>
                  setCustomerData((prev) => ({ ...prev, customerMobile: e?.target?.value }))
                }
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MobileSelect
              label="Vendor"
              options={dropdownData?.vendors}
              value={customerData?.vendorId}
              onChange={(value) =>
                setCustomerData((prev) => ({ ...prev, vendorId: value }))
              }
              placeholder="Select vendor (optional)"
              testId="vendor-select"
              helpLink={
                dropdownData?.vendors?.length === 0 && (
                  <>
                    No vendors available. Check{' '}
                    <a className="underline" href="/admin?section=vendors">
                      Admin → Vendors
                    </a>{' '}
                    to add or attach vendors.
                  </>
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={customerData?.description}
              onChange={(e) =>
                setCustomerData((prev) => ({ ...prev, description: e?.target?.value }))
              }
              className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MobileSelect
              label="Sales"
              options={dropdownData?.salesConsultants}
              value={customerData?.assignedTo}
              onChange={(value) =>
                setCustomerData((prev) => ({ ...prev, assignedTo: value }))
              }
              placeholder="Select sales consultant"
              testId="sales-select"
            />

            <MobileSelect
              label="Finance"
              options={dropdownData?.financeManagers}
              value={customerData?.financeManager}
              onChange={(value) =>
                setCustomerData((prev) => ({ ...prev, financeManager: value }))
              }
              placeholder="Select finance manager"
              testId="finance-select"
            />

            <MobileSelect
              label="Delivery Coordinator"
              options={dropdownData?.deliveryCoordinators}
              value={customerData?.deliveryCoordinator}
              onChange={(value) =>
                setCustomerData((prev) => ({ ...prev, deliveryCoordinator: value }))
              }
              placeholder="Select delivery coordinator"
              testId="delivery-select"
              helpLink={
                <span>
                  Need to edit coordinators?{' '}
                  <a data-testid="admin-link-delivery" className="underline" href="/admin?section=staff">
                    Open Admin
                  </a>
                </span>
              }
            />
          </div>

          {/* Loaner checkbox */}
          <section className="flex items-center gap-3">
            <input
              id="needsLoaner"
              data-testid="loaner-checkbox"
              className="h-5 w-5 accent-blue-600 appearance-auto"
              type="checkbox"
              checked={customerData?.needsLoaner}
              onChange={(e) => {
                setCustomerData((prev) => ({ ...prev, needsLoaner: e.target.checked }))
                if (e.target.checked) {
                  setTimeout(() => loanerRef?.current?.focus?.(), 0)
                }
              }}
            />
            <label htmlFor="needsLoaner" className="text-sm text-slate-800">
              Customer needs loaner
            </label>
          </section>

          {customerData?.needsLoaner && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Loaner #</label>
                <input
                  ref={loanerRef}
                  data-testid="loaner-number-input"
                  className="mt-1 input-mobile w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter loaner vehicle number"
                  value={customerData?.loanerNumber ?? ''}
                  onChange={(e) => setCustomerData((prev) => ({ ...prev, loanerNumber: e.target.value }))}
                  required
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Line Items */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
            <Button
              onClick={addLineItem}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 h-11"
            >
              <Icon name="Plus" size={16} />
              <span>Add Item</span>
            </Button>
          </div>

          {lineItems?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-slate-50 rounded-lg border-2 border-dashed border-gray-300">
              <Icon name="Package" size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No line items added yet</p>
              <p className="text-sm">Click "Add Item" to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lineItems?.map((item, index) => (
                <div
                  key={item?.id}
                  className="border rounded-xl p-4 bg-slate-50 border-slate-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                    <button
                      onClick={() => removeLineItem(item?.id)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item?.productId || ''}
                        onChange={(e) =>
                          updateLineItem(item?.id, 'productId', e?.target?.value)
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg text-base"
                        data-testid={`product-select-${index}`}
                      >
                        <option value="">Select product</option>
                        {dropdownData?.products?.map((product) => (
                          <option key={product?.id} value={product?.id}>
                            {product?.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item?.unitPrice}
                        onChange={(e) =>
                          updateLineItem(item?.id, 'unitPrice', e?.target?.value)
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item?.isOffSite}
                        onChange={(e) =>
                          updateLineItem(item?.id, 'isOffSite', e?.target?.checked)
                        }
                        className="h-5 w-5 accent-blue-600"
                        data-testid={`is-off-site-${index}`}
                      />
                      <span className="text-sm">Off-Site (Vendor)</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item?.requiresScheduling}
                        onChange={(e) =>
                          updateLineItem(item?.id, 'requiresScheduling', e?.target?.checked)
                        }
                        className="h-5 w-5 accent-blue-600"
                        data-testid={`requires-scheduling-${index}`}
                      />
                      <span className="text-sm">Requires Scheduling</span>
                    </label>

                    {item?.requiresScheduling ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Promised Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={item?.promisedDate}
                          onChange={(e) =>
                            updateLineItem(item?.id, 'promisedDate', e?.target?.value)
                          }
                          min={new Date()?.toISOString()?.split('T')?.[0]}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reason for No Schedule <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item?.noScheduleReason}
                          onChange={(e) =>
                            updateLineItem(item?.id, 'noScheduleReason', e?.target?.value)
                          }
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="e.g., installed at delivery"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-green-700">
                    ${calculateTotal()?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex justify-between">
        <div className="flex space-x-3">
          {currentStep === 2 && (
            <Button onClick={() => setCurrentStep(1)} variant="outline">
              ← Back
            </Button>
          )}
        </div>

        <div className="flex space-x-3">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>

          {currentStep === 1 && (
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!validateStep1()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="save-deal-btn"
            >
              Add Line Items →
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              onClick={handleSave}
              disabled={!validateStep1() || !validateStep2() || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="save-deal-btn"
            >
              {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Deal' : 'Create Deal'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
