import React, { useEffect, useMemo, useState } from 'react'
import { getDeal, updateDeal, deleteDeal, mapDbDealToForm } from '../../../services/dealService'
import { supabase } from '../../../lib/supabase'
import { useDealFormDropdowns } from '../../../hooks/useDropdownData'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Icon from '../../../components/ui/Icon'

const EditDealModal = ({ isOpen, dealId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [initialFormData, setInitialFormData] = useState(null)
  const [loanerAssignment, setLoanerAssignment] = useState(null)
  const [loanerForm, setLoanerForm] = useState({
    loaner_number: '',
    eta_return_date: '',
    notes: '',
  })

  // Enhanced dropdown data
  const {
    // Use pre-formatted option arrays so labels/ids match SearchableSelect expectations
    salesConsultantOptions,
    deliveryCoordinatorOptions,
    financeManagerOptions,
    vendorOptions: vendors,
    productOptions: products,
    loading: dropdownLoading,
    refresh: refreshDropdowns,
  } = useDealFormDropdowns()

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    job_status: 'draft',
    priority: 'medium',
    customer_needs_loaner: false,
    assignedTo: null,
    deliveryCoordinator: null,
    financeManager: null,
    lineItems: [],
  })

  // Dirty state tracking
  useEffect(() => {
    if (initialFormData) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialFormData)
      setIsDirty(hasChanges)
    }
  }, [formData, initialFormData])

  // Load dropdown data when the modal opens (non-blocking; hook caches results)
  useEffect(() => {
    if (isOpen) {
      try {
        refreshDropdowns?.()
      } catch {}
    }
  }, [isOpen, refreshDropdowns])

  // Load deal data
  useEffect(() => {
    if (isOpen && dealId) {
      loadDealData()
    }
  }, [isOpen, dealId])

  // Simplified Loaner Checkbox (native behavior; single-click reliable)
  const LoanerCheckbox = ({ checked, onChange }) => (
    <div className="bg-slate-50 p-4 rounded-lg border">
      <label
        htmlFor="customer_needs_loaner"
        className="inline-flex items-center gap-3 min-h-11 px-2 cursor-pointer"
      >
        <input
          id="customer_needs_loaner"
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => onChange(Boolean(e?.target?.checked))}
          className="w-5 h-5 accent-blue-600 appearance-auto border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="loaner-checkbox"
        />
        <span className="text-sm font-medium text-gray-700 select-none">
          Customer needs loaner vehicle
        </span>
      </label>
    </div>
  )

  // Enhanced Service Type Radio with proper mobile accessibility
  const ServiceTypeRadio = ({ value, selectedValue, onChange, itemIndex, disabled = false }) => (
    <div className="flex space-x-6">
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`serviceLocation_${itemIndex}`}
          value="in_house"
          checked={!selectedValue}
          onChange={() => onChange(false)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="service-type-in-house"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">🏠 On-Site</span>
      </label>
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`serviceLocation_${itemIndex}`}
          value="vendor"
          checked={selectedValue}
          onChange={() => onChange(true)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="service-type-vendor"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">🏢 Off-Site</span>
      </label>
    </div>
  )

  // Enhanced Scheduling Radio with mobile optimization
  const SchedulingRadio = ({ requiresScheduling, onChange, itemIndex, disabled = false }) => (
    <div className="flex space-x-6">
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`scheduling_${itemIndex}`}
          checked={requiresScheduling === true}
          onChange={() => onChange(true)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="requires-scheduling-yes"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">Needs scheduling</span>
      </label>
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`scheduling_${itemIndex}`}
          checked={requiresScheduling === false}
          onChange={() => onChange(false)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="requires-scheduling-no"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">No scheduling needed</span>
      </label>
    </div>
  )

  const loadDealData = async () => {
    try {
      setLoading(true)
      setError('')

      const deal = await getDeal(dealId)
      const formDeal = mapDbDealToForm(deal)

      // Get transaction data for customer info
      const { data: transaction } = await supabase
        ?.from('transactions')
        ?.select('customer_name, customer_phone, customer_email')
        ?.eq('job_id', dealId)
        ?.single()

      // Load active loaner assignment (if any)
      let activeLoaner = null
      try {
        const { data: la } = await supabase
          ?.from('loaner_assignments')
          ?.select('id, loaner_number, eta_return_date, returned_at')
          ?.eq('job_id', dealId)
          ?.is('returned_at', null)
          ?.limit(1)
        activeLoaner = Array.isArray(la) ? la[0] : la
      } catch (_) {
        // ignore
      }

      const loadedFormData = {
        ...formDeal,
        customerName: transaction?.customer_name || '',
        customerPhone: transaction?.customer_phone || '',
        customerEmail: transaction?.customer_email || '',
        lineItems:
          (formDeal?.lineItems || [])?.length > 0 ? formDeal?.lineItems : [createEmptyLineItem()],
      }

      setFormData(loadedFormData)
      setInitialFormData(JSON.parse(JSON.stringify(loadedFormData))) // Deep copy for comparison
      setLoanerAssignment(activeLoaner || null)

      // Initialize loaner form
      if (activeLoaner) {
        setLoanerForm({
          loaner_number: activeLoaner?.loaner_number || '',
          eta_return_date: activeLoaner?.eta_return_date || '',
          notes: activeLoaner?.notes || '',
        })
      } else {
        // Default ETA to the latest scheduled promised_date among line items (if any)
        const dates = (loadedFormData?.lineItems || [])
          .filter((li) => li?.requiresScheduling && li?.lineItemPromisedDate)
          .map((li) => new Date(li.lineItemPromisedDate).getTime())
        const latest = dates?.length ? new Date(Math.max(...dates)) : null
        setLoanerForm((prev) => ({
          ...prev,
          eta_return_date: latest ? latest.toISOString().split('T')[0] : '',
        }))
      }
    } catch (err) {
      setError(`Failed to load deal: ${err?.message}`)
    } finally {
      setLoading(false)
    }
  }

  const createEmptyLineItem = () => ({
    product_id: null,
    unit_price: 0,
    quantity_used: 1,
    lineItemPromisedDate: '',
    requiresScheduling: false,
    noScheduleReason: '',
    isOffSite: false,
    description: '',
  })

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const updateLineItem = (index, updates) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev?.lineItems?.map((item, i) => {
        if (i === index) {
          let updatedItem = { ...item, ...updates }

          // Boolean coercion and paired field clearing
          if ('requiresScheduling' in updates) {
            updatedItem.requiresScheduling = Boolean(updates?.requiresScheduling)
            if (updates?.requiresScheduling === true) {
              updatedItem.noScheduleReason = ''
            } else {
              updatedItem.lineItemPromisedDate = ''
            }
          }

          if ('isOffSite' in updates) {
            updatedItem.isOffSite = Boolean(updates?.isOffSite)
            if (!updates?.isOffSite) {
              updatedItem.vendorId = ''
            }
          }

          return updatedItem
        }
        return item
      }),
    }))

    // Auto-populate price when product is selected
    if (updates?.product_id) {
      const selectedProduct = products?.find((p) => p?.id === updates?.product_id)
      if (selectedProduct) {
        setFormData((prev) => ({
          ...prev,
          lineItems: prev?.lineItems?.map((item, i) =>
            i === index
              ? {
                  ...item,
                  unit_price:
                    selectedProduct?.unitPrice || selectedProduct?.unit_price || item?.unit_price,
                  cost_price: selectedProduct?.cost || item?.cost_price,
                }
              : item
          ),
        }))
      }
    }
  }

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [...prev?.lineItems, createEmptyLineItem()],
    }))
  }

  const removeLineItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev?.lineItems?.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      if (!formData?.customerName?.trim()) {
        setError('Customer name is required')
        return
      }

      // Validate line items with scheduling
      for (let i = 0; i < formData?.lineItems?.length; i++) {
        const item = formData?.lineItems?.[i]

        if (!item?.product_id) {
          setError(`Line item ${i + 1}: Product is required`)
          return
        }

        if (item?.requiresScheduling && !item?.lineItemPromisedDate) {
          setError(`Line item ${i + 1}: Promised date is required when scheduling is needed`)
          return
        }

        if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) {
          setError(`Line item ${i + 1}: Reason is required when no scheduling is needed`)
          return
        }

        if (item?.isOffSite && !item?.vendorId) {
          setError(`Line item ${i + 1}: Vendor is required for off-site service`)
          return
        }
      }

      // Update the deal with proper boolean coercion
      const updatedFormData = {
        ...formData,
        customer_needs_loaner: Boolean(formData?.customer_needs_loaner),
        lineItems: formData?.lineItems?.map((item) => ({
          ...item,
          requiresScheduling: Boolean(item?.requiresScheduling),
          isOffSite: Boolean(item?.isOffSite),
          unit_price: parseFloat(item?.unit_price) || 0,
          quantity_used: parseInt(item?.quantity_used) || 1,
        })),
      }

      // Include inline loaner form (optional) for assignment upsert
      await updateDeal(dealId, { ...updatedFormData, loanerForm })

      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(`Failed to save deal: ${err?.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await deleteDeal(dealId)
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(`Failed to delete deal: ${err?.message}`)
    } finally {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  // Enhanced close handler with unsaved changes guard
  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedWarning(true)
    } else {
      onClose()
    }
  }

  const confirmClose = () => {
    setShowUnsavedWarning(false)
    onClose()
  }

  // Calculate total with guard for NaN
  const calculateTotal = () => {
    return (
      formData?.lineItems?.reduce((total, item) => {
        const price = parseFloat(item?.unit_price) || 0
        const quantity = parseInt(item?.quantity_used) || 1
        return total + price * quantity
      }, 0) || 0
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header with enhanced styling */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50">
          <h2 className="text-xl font-semibold text-gray-900">Edit Deal</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content with light theme */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6 bg-white">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            )}

            {dropdownLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-blue-800 text-sm">Loading dropdown data...</div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="text-gray-600">Loading deal...</div>
                <button
                  type="button"
                  onClick={() => {
                    loadDealData()
                    try {
                      refreshDropdowns?.()
                    } catch {}
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Having trouble? Retry load
                </button>
              </div>
            ) : (
              <>
                {/* Basic Info with mobile-first layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <Select
                      value={formData?.job_status}
                      onChange={(e) => updateFormData({ job_status: e?.target?.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name *
                    </label>
                    <Input
                      id="customer-name"
                      aria-label="Customer name input"
                      label=""
                      helperText=""
                      maxLength={255}
                      style={{}}
                      value={formData?.customerName}
                      onChange={(e) => updateFormData({ customerName: e?.target?.value })}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Phone
                    </label>
                    <Input
                      id="customer-phone"
                      aria-label="Customer phone input"
                      label=""
                      helperText=""
                      maxLength={20}
                      style={{}}
                      value={formData?.customerPhone}
                      onChange={(e) => updateFormData({ customerPhone: e?.target?.value })}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Email
                    </label>
                    <Input
                      id="customer-email"
                      aria-label="Customer email input"
                      label=""
                      helperText=""
                      maxLength={255}
                      style={{}}
                      type="email"
                      value={formData?.customerEmail}
                      onChange={(e) => updateFormData({ customerEmail: e?.target?.value })}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <Select
                      value={formData?.priority}
                      onChange={(e) => updateFormData({ priority: e?.target?.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </div>
                </div>

                {/* Vehicle Information Section - Visible on Mobile and Desktop */}
                <div className="block bg-slate-50 p-4 rounded-lg border">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Vehicle Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                      <Input
                        id="vehicle-year"
                        aria-label="Vehicle year input"
                        label=""
                        helperText=""
                        maxLength={4}
                        style={{}}
                        type="number"
                        value={formData?.vehicleYear || ''}
                        onChange={(e) => updateFormData({ vehicleYear: e?.target?.value })}
                        placeholder="2024"
                        min="1900"
                        max={new Date()?.getFullYear() + 2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
                      <Input
                        id="vehicle-make"
                        aria-label="Vehicle make input"
                        label=""
                        helperText=""
                        maxLength={50}
                        style={{}}
                        value={formData?.vehicleMake || ''}
                        onChange={(e) => updateFormData({ vehicleMake: e?.target?.value })}
                        placeholder="Toyota"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                      <Input
                        id="vehicle-model"
                        aria-label="Vehicle model input"
                        label=""
                        helperText=""
                        maxLength={50}
                        style={{}}
                        value={formData?.vehicleModel || ''}
                        onChange={(e) => updateFormData({ vehicleModel: e?.target?.value })}
                        placeholder="Camry"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stock Number
                    </label>
                    <Input
                      id="vehicle-stock"
                      aria-label="Vehicle stock number input"
                      label=""
                      helperText=""
                      maxLength={20}
                      style={{}}
                      value={formData?.stockNumber || ''}
                      onChange={(e) => updateFormData({ stockNumber: e?.target?.value })}
                      placeholder="Enter stock number"
                    />
                  </div>
                </div>

                {/* Customer Needs Loaner with enhanced styling and click propagation */}
                <div className="space-y-3">
                  <LoanerCheckbox
                    checked={formData?.customer_needs_loaner}
                    onChange={(checked) => {
                      updateFormData({ customer_needs_loaner: checked })
                      if (checked) {
                        // If turning on and ETA empty, default to latest scheduled promised date
                        if (!loanerForm?.eta_return_date) {
                          const dates = (formData?.lineItems || [])
                            .filter((li) => li?.requiresScheduling && li?.lineItemPromisedDate)
                            .map((li) => new Date(li.lineItemPromisedDate).getTime())
                          const latest = dates?.length ? new Date(Math.max(...dates)) : null
                          if (latest) {
                            setLoanerForm((prev) => ({
                              ...prev,
                              eta_return_date: latest.toISOString().split('T')[0],
                            }))
                          }
                        }
                      }
                    }}
                  />
                  {/* Current Loaner summary (mirrors Deals page badge) */}
                  {loanerAssignment && (
                    <div className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                      🚗 Loaner #{loanerAssignment?.loaner_number}
                      {loanerAssignment?.eta_return_date && (
                        <span className="ml-1">
                          • due{' '}
                          {new Date(loanerAssignment?.eta_return_date)?.toLocaleDateString(
                            'en-US',
                            { month: 'short', day: 'numeric' }
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline Loaner editor */}
                  {formData?.customer_needs_loaner && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border rounded-lg p-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loaner Number
                        </label>
                        <Input
                          id="loaner-number"
                          aria-label="Loaner number"
                          value={loanerForm?.loaner_number || ''}
                          onChange={(e) =>
                            setLoanerForm((prev) => ({ ...prev, loaner_number: e?.target?.value }))
                          }
                          placeholder="e.g. 1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ETA Return Date
                        </label>
                        <Input
                          id="loaner-eta"
                          aria-label="Loaner ETA"
                          type="date"
                          value={loanerForm?.eta_return_date || ''}
                          onChange={(e) =>
                            setLoanerForm((prev) => ({
                              ...prev,
                              eta_return_date: e?.target?.value,
                            }))
                          }
                          min={new Date()?.toISOString()?.split('T')?.[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <Input
                          id="loaner-notes"
                          aria-label="Loaner notes"
                          value={loanerForm?.notes || ''}
                          onChange={(e) =>
                            setLoanerForm((prev) => ({ ...prev, notes: e?.target?.value }))
                          }
                          placeholder="Optional notes"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Dealer Representatives */}
                <div className="bg-slate-50 p-4 rounded-lg border">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Dealer Representatives</h4>

                  {/* Sales Consultant */}
                  <div className="mb-4" data-testid="sales-select">
                    <SearchableSelect
                      label="Sales Consultant"
                      options={salesConsultantOptions}
                      value={formData?.assignedTo}
                      onChange={(value) => updateFormData({ assignedTo: value })}
                      placeholder="Select sales consultant"
                      searchable={true}
                      clearable={true}
                    />
                  </div>

                  {/* Delivery Coordinator */}
                  <div className="mb-4" data-testid="delivery-select">
                    <SearchableSelect
                      label="Delivery Coordinator"
                      options={deliveryCoordinatorOptions}
                      value={formData?.deliveryCoordinator}
                      onChange={(value) => updateFormData({ deliveryCoordinator: value })}
                      placeholder="Select delivery coordinator"
                      searchable={true}
                      clearable={true}
                    />
                  </div>

                  {/* Finance Manager */}
                  <div data-testid="finance-select">
                    <SearchableSelect
                      label="Finance Manager"
                      options={financeManagerOptions}
                      value={formData?.financeManager}
                      onChange={(value) => updateFormData({ financeManager: value })}
                      placeholder="Select finance manager"
                      searchable={true}
                      clearable={true}
                      helperText="Optional - does not block saves"
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
                    <Button
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      aria-label="Add line item"
                      variant="outline"
                      size="sm"
                      onClick={addLineItem}
                    >
                      <Icon name="Plus" size={16} className="mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {formData?.lineItems?.map((item, index) => (
                      <div key={index} className="border rounded-xl p-4 bg-slate-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                          {formData?.lineItems?.length > 1 && (
                            <Button
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              aria-label="Remove line item"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <SearchableSelect
                              label="Product *"
                              options={products}
                              value={item?.product_id || ''}
                              onChange={(value) =>
                                updateLineItem(index, {
                                  product_id: value ? parseInt(value) : null,
                                })
                              }
                              placeholder="Select product"
                              searchable={true}
                              clearable={true}
                              groupBy="category"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unit Price *
                            </label>
                            <Input
                              id={`unit-price-${index}`}
                              aria-label="Unit price input"
                              label=""
                              helperText=""
                              maxLength={10}
                              style={{}}
                              type="number"
                              step="0.01"
                              value={item?.unit_price}
                              onChange={(e) =>
                                updateLineItem(index, {
                                  unit_price: parseFloat(e?.target?.value) || 0,
                                })
                              }
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quantity
                            </label>
                            <Input
                              id={`quantity-${index}`}
                              aria-label="Quantity input"
                              label=""
                              helperText=""
                              maxLength={10}
                              style={{}}
                              type="number"
                              min="1"
                              value={item?.quantity_used}
                              onChange={(e) =>
                                updateLineItem(index, {
                                  quantity_used: parseInt(e?.target?.value) || 1,
                                })
                              }
                              placeholder="1"
                            />
                          </div>
                        </div>

                        {/* Service Location with enhanced radio buttons */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Location
                          </label>
                          <ServiceTypeRadio
                            selectedValue={item?.isOffSite}
                            onChange={(value) => updateLineItem(index, { isOffSite: value })}
                            itemIndex={index}
                          />
                        </div>

                        {/* Vendor Selection (if off-site) */}
                        {item?.isOffSite && (
                          <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <SearchableSelect
                              label="Vendor *"
                              options={vendors}
                              value={item?.vendorId || ''}
                              onChange={(value) => updateLineItem(index, { vendorId: value })}
                              placeholder="Select vendor"
                              searchable={true}
                              clearable={true}
                              groupBy="specialty"
                            />
                          </div>
                        )}

                        {/* Scheduling with enhanced styling */}
                        <div className="bg-white rounded-lg p-4 border">
                          <h5 className="font-medium text-gray-900 mb-3">Scheduling</h5>

                          <div className="mb-3">
                            <SchedulingRadio
                              requiresScheduling={item?.requiresScheduling}
                              onChange={(value) =>
                                updateLineItem(index, { requiresScheduling: value })
                              }
                              itemIndex={index}
                            />
                          </div>

                          {item?.requiresScheduling ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Promised Date *
                                </label>
                                <Input
                                  id={`promised-date-${index}`}
                                  aria-label="Promised date input"
                                  label=""
                                  helperText=""
                                  maxLength={255}
                                  style={{}}
                                  type="date"
                                  value={item?.lineItemPromisedDate}
                                  onChange={(e) =>
                                    updateLineItem(index, {
                                      lineItemPromisedDate: e?.target?.value,
                                    })
                                  }
                                  min={new Date()?.toISOString()?.split('T')?.[0]}
                                  placeholder=""
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Notes
                                </label>
                                <Input
                                  id={`notes-${index}`}
                                  aria-label="Notes input"
                                  label=""
                                  helperText=""
                                  maxLength={500}
                                  style={{}}
                                  value={item?.description || ''}
                                  onChange={(e) =>
                                    updateLineItem(index, { description: e?.target?.value })
                                  }
                                  placeholder="Special instructions..."
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for no schedule *
                              </label>
                              <Input
                                id={`no-schedule-reason-${index}`}
                                aria-label="No schedule reason input"
                                label=""
                                helperText=""
                                maxLength={255}
                                style={{}}
                                value={item?.noScheduleReason}
                                onChange={(e) =>
                                  updateLineItem(index, { noScheduleReason: e?.target?.value })
                                }
                                placeholder="e.g., installed at delivery, no appointment needed"
                              />
                            </div>
                          )}
                        </div>

                        {/* Line Total with NaN guard */}
                        <div className="text-right mt-3 text-sm text-gray-600">
                          Line Total: $
                          {(
                            (parseFloat(item?.unit_price) || 0) *
                            (parseInt(item?.quantity_used) || 1)
                          )?.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Deal Total with enhanced styling */}
                  <div className="flex justify-end mt-4">
                    <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
                      <span className="font-medium text-green-900">
                        Deal Total: ${calculateTotal()?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer with mobile-friendly buttons */}
        <div className="flex flex-col md:flex-row items-center justify-between p-6 border-t bg-slate-50 gap-3">
          <Button
            className="w-full md:w-auto h-11 text-red-600 border-red-300 hover:bg-red-50"
            aria-label="Delete deal"
            variant="outline"
            onClick={() => setDeleteConfirm(true)}
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Delete Deal
          </Button>

          <div className="flex space-x-3 w-full md:w-auto">
            <Button
              className="w-full md:w-auto h-11"
              aria-label="Cancel editing"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-700"
              aria-label="Save changes"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Delete Deal</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this deal and all its line items? This action cannot
                be undone.
              </p>
              <div className="flex space-x-3">
                <Button
                  className="flex-1 h-11"
                  aria-label="Cancel deletion"
                  variant="outline"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                  aria-label="Confirm deletion"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning Modal */}
        {showUnsavedWarning && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Unsaved Changes</h3>
              <p className="text-gray-600 mb-6">
                You have unsaved changes. Are you sure you want to close and discard your changes?
              </p>
              <div className="flex space-x-3">
                <Button
                  className="flex-1 h-11"
                  aria-label="Keep editing"
                  variant="outline"
                  onClick={() => setShowUnsavedWarning(false)}
                >
                  Keep Editing
                </Button>
                <Button
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                  aria-label="Discard changes"
                  onClick={confirmClose}
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EditDealModal
