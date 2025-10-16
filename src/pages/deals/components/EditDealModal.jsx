import React, { useEffect, useState } from 'react';
import { getDeal, updateDeal, deleteDeal, mapDbDealToForm } from '../../../services/dealService';
import { supabase } from '../../../lib/supabase';
import { useDealFormDropdowns } from '../../../hooks/useDropdownData';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import Icon from '../../../components/ui/Icon';



const EditDealModal = ({ isOpen, dealId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Enhanced dropdown data
  const {
    salesConsultants,
    deliveryCoordinators,
    vendors,
    products,
    loading: dropdownLoading,
    refresh: refreshDropdowns
  } = useDealFormDropdowns();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    job_status: 'draft',
    priority: 'medium',
    customer_needs_loaner: false,
    lineItems: []
  });

  // Load dropdown data when modal opens
  useEffect(() => {
    if (isOpen && !dropdownLoading) {
      refreshDropdowns();
    }
  }, [isOpen, refreshDropdowns, dropdownLoading]);

  // Load deal data
  useEffect(() => {
    if (isOpen && dealId) {
      loadDealData();
    }
  }, [isOpen, dealId]);

  const loadDealData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const deal = await getDeal(dealId);
      const formDeal = mapDbDealToForm(deal);

      // Get transaction data for customer info
      const { data: transaction } = await supabase?.from('transactions')?.select('customer_name, customer_phone, customer_email')?.eq('job_id', dealId)?.single();

      setFormData({
        ...formDeal,
        customerName: transaction?.customer_name || '',
        customerPhone: transaction?.customer_phone || '',
        customerEmail: transaction?.customer_email || '',
        lineItems: (formDeal?.lineItems || [])?.length > 0 ? formDeal?.lineItems : [createEmptyLineItem()]
      });
    } catch (err) {
      setError(`Failed to load deal: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createEmptyLineItem = () => ({
    product_id: null,
    unit_price: 0,
    quantity_used: 1,
    lineItemPromisedDate: '',
    requiresScheduling: false,
    noScheduleReason: '',
    isOffSite: false,
    description: ''
  });

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateLineItem = (index, updates) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev?.lineItems?.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    }));

    // Auto-populate price when product is selected
    if (updates?.product_id) {
      const selectedProduct = products?.find(p => p?.id === updates?.product_id);
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          lineItems: prev?.lineItems?.map((item, i) => 
            i === index 
              ? { 
                  ...item, 
                  unit_price: selectedProduct?.unitPrice || selectedProduct?.unit_price || item?.unit_price,
                  cost_price: selectedProduct?.cost || item?.cost_price
                } 
              : item
          )
        }));
      }
    }
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev?.lineItems, createEmptyLineItem()]
    }));
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev?.lineItems?.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate required fields
      if (!formData?.title?.trim()) {
        setError('Title is required');
        return;
      }

      if (!formData?.customerName?.trim()) {
        setError('Customer name is required');
        return;
      }

      // Validate line items with scheduling
      for (let i = 0; i < formData?.lineItems?.length; i++) {
        const item = formData?.lineItems?.[i];
        
        if (!item?.product_id) {
          setError(`Line item ${i + 1}: Product is required`);
          return;
        }

        if (item?.requiresScheduling && !item?.lineItemPromisedDate) {
          setError(`Line item ${i + 1}: Promised date is required when scheduling is needed`);
          return;
        }

        if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) {
          setError(`Line item ${i + 1}: Reason is required when no scheduling is needed`);
          return;
        }
      }

      // Update the deal
      await updateDeal(dealId, formData);
      
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(`Failed to save deal: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteDeal(dealId);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(`Failed to delete deal: ${err?.message}`);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Calculate total
  const calculateTotal = () => {
    return formData?.lineItems?.reduce((total, item) => {
      const price = parseFloat(item?.unit_price) || 0;
      const quantity = parseInt(item?.quantity_used) || 1;
      return total + (price * quantity);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Edit Deal</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
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
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-600">Loading deal...</div>
              </div>
            ) : (
              <>
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deal Title *
                    </label>
                    <Input
                      label=""
                      helperText=""
                      maxLength={255}
                      style={{}}
                      value={formData?.title}
                      onChange={(e) => updateFormData({ title: e?.target?.value })}
                      placeholder="Enter deal title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
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

                {/* Customer Needs Loaner */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="customer_needs_loaner"
                    checked={formData?.customer_needs_loaner}
                    onChange={(e) => updateFormData({ customer_needs_loaner: e?.target?.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="customer_needs_loaner" className="text-sm text-gray-700">
                    Customer needs loaner vehicle
                  </label>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
                    <Button
                      className=""
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
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                          {formData?.lineItems?.length > 1 && (
                            <Button
                              className="text-red-600 hover:text-red-800"
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
                              onChange={(value) => updateLineItem(index, { product_id: value ? parseInt(value) : null })}
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
                              label=""
                              helperText=""
                              maxLength={10}
                              style={{}}
                              type="number"
                              step="0.01"
                              value={item?.unit_price}
                              onChange={(e) => updateLineItem(index, { unit_price: parseFloat(e?.target?.value) || 0 })}
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quantity
                            </label>
                            <Input
                              label=""
                              helperText=""
                              maxLength={10}
                              style={{}}
                              type="number"
                              min="1"
                              value={item?.quantity_used}
                              onChange={(e) => updateLineItem(index, { quantity_used: parseInt(e?.target?.value) || 1 })}
                              placeholder="1"
                            />
                          </div>
                        </div>

                        {/* Service Location */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Location
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`serviceLocation_${index}`}
                                checked={!item?.isOffSite}
                                onChange={() => updateLineItem(index, { isOffSite: false })}
                                className="mr-2"
                              />
                              <span className="text-sm">🏠 On-Site</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`serviceLocation_${index}`}
                                checked={item?.isOffSite}
                                onChange={() => updateLineItem(index, { isOffSite: true })}
                                className="mr-2"
                              />
                              <span className="text-sm">🏢 Off-Site</span>
                            </label>
                          </div>
                        </div>

                        {/* Vendor Selection (if off-site) */}
                        {item?.isOffSite && (
                          <div className="mb-4">
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

                        {/* Scheduling */}
                        <div className="border rounded-lg p-3 bg-blue-50">
                          <h5 className="font-medium text-blue-900 mb-3">Scheduling</h5>
                          
                          <div className="flex space-x-4 mb-3">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`scheduling_${index}`}
                                checked={item?.requiresScheduling}
                                onChange={() => updateLineItem(index, { 
                                  requiresScheduling: true, 
                                  noScheduleReason: '' 
                                })}
                                className="mr-2"
                              />
                              <span className="text-sm">Needs scheduling</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`scheduling_${index}`}
                                checked={!item?.requiresScheduling}
                                onChange={() => updateLineItem(index, { 
                                  requiresScheduling: false, 
                                  lineItemPromisedDate: '' 
                                })}
                                className="mr-2"
                              />
                              <span className="text-sm">No scheduling needed</span>
                            </label>
                          </div>

                          {item?.requiresScheduling ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Promised Date *
                                </label>
                                <Input
                                  label=""
                                  helperText=""
                                  maxLength={255}
                                  style={{}}
                                  type="date"
                                  value={item?.lineItemPromisedDate}
                                  onChange={(e) => updateLineItem(index, { lineItemPromisedDate: e?.target?.value })}
                                  min={new Date()?.toISOString()?.split('T')?.[0]}
                                  placeholder=""
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Notes
                                </label>
                                <Input
                                  label=""
                                  helperText=""
                                  maxLength={500}
                                  style={{}}
                                  value={item?.description || ''}
                                  onChange={(e) => updateLineItem(index, { description: e?.target?.value })}
                                  placeholder="Special instructions..."
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for no schedule *
                              </label>
                              <Input
                                label=""
                                helperText=""
                                maxLength={255}
                                style={{}}
                                value={item?.noScheduleReason}
                                onChange={(e) => updateLineItem(index, { noScheduleReason: e?.target?.value })}
                                placeholder="e.g., installed at delivery, no appointment needed"
                              />
                            </div>
                          )}
                        </div>

                        {/* Line Total */}
                        <div className="text-right mt-3 text-sm text-gray-600">
                          Line Total: ${((item?.unit_price || 0) * (item?.quantity_used || 1))?.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Deal Total */}
                  <div className="flex justify-end mt-4">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <span className="font-medium text-gray-900">
                        Deal Total: ${calculateTotal()?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <Button
            className="text-red-600 border-red-300 hover:bg-red-50"
            variant="outline"
            onClick={() => setDeleteConfirm(true)}
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Delete Deal
          </Button>
          
          <div className="flex space-x-3">
            <Button className="" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
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
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Delete Deal</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this deal and all its line items? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditDealModal;