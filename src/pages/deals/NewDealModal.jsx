import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useDealFormDropdowns } from '../../hooks/useDropdownData';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import SearchableSelect from '../../components/ui/SearchableSelect';

export default function NewDealModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1); // 1 = Customer, 2 = Line Items
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Load dropdown data using custom hook
  const {
    salesConsultants,
    deliveryCoordinators,
    vendors,
    products,
    loading: dropdownLoading,
    refresh: refreshDropdowns
  } = useDealFormDropdowns();
  
  // Customer form data
  const [customerData, setCustomerData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    needsLoaner: false
  });

  // Line items data  
  const [lineItems, setLineItems] = useState([]);

  // Load dropdown data when modal opens
  useEffect(() => {
    if (isOpen && !dropdownLoading) {
      refreshDropdowns();
    }
  }, [isOpen, refreshDropdowns, dropdownLoading]);

  // Add new line item
  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: Date.now(), // Temporary ID for tracking
      productId: '',
      unitPrice: '',
      costPrice: '',
      serviceType: 'in_house', // in_house or vendor
      vendorId: '',
      requiresScheduling: true,
      promisedDate: '',
      noScheduleReason: '',
      serviceNotes: '',
      needsLoaner: false
    }]);
  };

  // Update line item
  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev?.map(item => 
      item?.id === id ? { ...item, [field]: value } : item
    ));

    // Auto-populate price when product is selected
    if (field === 'productId' && value) {
      const selectedProduct = products?.find(p => p?.id === value);
      if (selectedProduct) {
        setLineItems(prev => prev?.map(item => 
          item?.id === id 
            ? { 
                ...item, 
                unitPrice: selectedProduct?.unitPrice || selectedProduct?.unit_price || '',
                costPrice: selectedProduct?.cost || ''
              } 
            : item
        ));
      }
    }
  };

  // Remove line item
  const removeLineItem = (id) => {
    setLineItems(prev => prev?.filter(item => item?.id !== id));
  };

  // Validation
  const validateStep1 = () => {
    return customerData?.customerName?.trim()?.length > 0;
  };

  const validateStep2 = () => {
    if (lineItems?.length === 0) return false;
    
    return lineItems?.every(item => {
      // Product and price required
      if (!item?.productId || !item?.unitPrice) return false;
      
      // If requires scheduling, need promised date
      if (item?.requiresScheduling && !item?.promisedDate) return false;
      
      // If no scheduling, need reason
      if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) return false;
      
      // If vendor service type, need vendor selected  
      if (item?.serviceType === 'vendor' && !item?.vendorId) return false;
      
      return true;
    });
  };

  // Calculate total
  const calculateTotal = () => {
    return lineItems?.reduce((sum, item) => {
      return sum + (parseFloat(item?.unitPrice) || 0);
    }, 0);
  };

  // Handle save as draft
  const handleSaveDraft = async () => {
    if (!validateStep1()) {
      setError('Customer name is required to save draft');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create vehicle record
      const { data: vehicle, error: vehicleError } = await supabase?.from('vehicles')?.insert([{
          year: new Date()?.getFullYear(),
          make: 'TBD',
          model: 'TBD', 
          owner_name: customerData?.customerName,
          owner_phone: customerData?.customerPhone,
          owner_email: customerData?.customerEmail,
          stock_number: `DRAFT-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      // Create job as draft
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Draft Deal - ${customerData?.customerName}`,
          description: `Draft deal for ${customerData?.customerName}`,
          job_status: 'draft',
          priority: 'medium',
          service_type: 'in_house',
          vehicle_id: vehicle?.id,
          assigned_to: salesConsultants?.[0]?.id || user?.id,
          delivery_coordinator_id: deliveryCoordinators?.[0]?.id,
          customer_needs_loaner: customerData?.needsLoaner,
          created_by: user?.id,
          estimated_cost: 0
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create transaction record
      const { error: transactionError } = await supabase?.from('transactions')?.insert([{
          job_id: job?.id,
          vehicle_id: vehicle?.id,
          customer_name: customerData?.customerName,
          customer_phone: customerData?.customerPhone,
          customer_email: customerData?.customerEmail,
          total_amount: 0,
          subtotal: 0,
          tax_amount: 0,
          transaction_status: 'pending'
        }]);

      if (transactionError) throw transactionError;

      onSuccess?.();
      resetForm();
      onClose();

    } catch (err) {
      setError(`Failed to save draft: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle create full deal
  const handleCreateDeal = async () => {
    if (!validateStep1() || !validateStep2()) {
      setError('Please complete all required fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create vehicle record
      const { data: vehicle, error: vehicleError } = await supabase?.from('vehicles')?.insert([{
          year: new Date()?.getFullYear(),
          make: 'TBD',
          model: 'TBD',
          owner_name: customerData?.customerName,
          owner_phone: customerData?.customerPhone,
          owner_email: customerData?.customerEmail,
          stock_number: `DEAL-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      const total = calculateTotal();

      // Create job
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Deal - ${customerData?.customerName}`,
          description: `Deal for ${customerData?.customerName}`,
          job_status: 'pending',
          priority: 'medium',
          service_type: lineItems?.some(item => item?.serviceType === 'vendor') ? 'vendor' : 'in_house',
          vehicle_id: vehicle?.id,
          vendor_id: lineItems?.find(item => item?.vendorId)?.vendorId || null,
          assigned_to: salesConsultants?.[0]?.id || user?.id,
          delivery_coordinator_id: deliveryCoordinators?.[0]?.id,
          customer_needs_loaner: customerData?.needsLoaner || lineItems?.some(item => item?.needsLoaner),
          created_by: user?.id,
          estimated_cost: total
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create job parts (line items)
      const jobPartsData = lineItems?.map(item => ({
        job_id: job?.id,
        product_id: item?.productId,
        quantity_used: 1,
        unit_price: parseFloat(item?.unitPrice),
        is_off_site: item?.serviceType === 'vendor',
        requires_scheduling: item?.requiresScheduling,
        promised_date: item?.promisedDate || null,
        no_schedule_reason: item?.noScheduleReason || null
      }));

      const { error: jobPartsError } = await supabase?.from('job_parts')?.insert(jobPartsData);

      if (jobPartsError) throw jobPartsError;

      // Create transaction record
      const { error: transactionError } = await supabase?.from('transactions')?.insert([{
          job_id: job?.id,
          vehicle_id: vehicle?.id,
          customer_name: customerData?.customerName,
          customer_phone: customerData?.customerPhone,
          customer_email: customerData?.customerEmail,
          total_amount: total,
          subtotal: total,
          tax_amount: 0,
          transaction_status: 'pending'
        }]);

      if (transactionError) throw transactionError;

      onSuccess?.();
      resetForm();
      onClose();

    } catch (err) {
      setError(`Failed to create deal: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setCustomerData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      needsLoaner: false
    });
    setLineItems([]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Deal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentStep === 1 ? 'Customer Information' : 'Line Items & Service Configuration'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <span className="font-medium">Customer</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <span className="font-medium">Line Items</span>
            </div>
          </div>
        </div>

        {/* Content - Changed to flex-1 and overflow-y-auto without height restriction */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {dropdownLoading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
              Loading dropdown data...
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerData?.customerName}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, customerName: e?.target?.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={customerData?.customerPhone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, customerPhone: e?.target?.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter customer phone"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={customerData?.customerEmail}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, customerEmail: e?.target?.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter customer email"
                />
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={customerData?.needsLoaner}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, needsLoaner: e?.target?.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Customer needs loaner vehicle</span>
                </label>
              </div>

              {/* Added Assigned to field for step 1 */}
              <div>
                <SearchableSelect
                  label="Assigned to..."
                  options={salesConsultants}
                  value=""
                  onChange={() => {}}
                  placeholder="Select sales consultant"
                  searchable={true}
                  clearable={true}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
                <Button
                  onClick={addLineItem}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Icon name="Plus" size={16} />
                  <span>Add Item</span>
                </Button>
              </div>

              {lineItems?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Icon name="Package" size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No line items added yet</p>
                  <p className="text-sm">Click "Add Item" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems?.map((item, index) => (
                    <div key={item?.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                        <button
                          onClick={() => removeLineItem(item?.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      </div>

                      {/* Product and Price */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <SearchableSelect
                            label="Product *"
                            options={products}
                            value={item?.productId}
                            onChange={(value) => updateLineItem(item?.id, 'productId', value)}
                            placeholder="Select product"
                            searchable={true}
                            clearable={true}
                            groupBy="category"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Unit Price *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item?.unitPrice}
                            onChange={(e) => updateLineItem(item?.id, 'unitPrice', e?.target?.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cost (Optional)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item?.costPrice}
                            onChange={(e) => updateLineItem(item?.id, 'costPrice', e?.target?.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Service Configuration */}
                      <div className="bg-white rounded-lg p-4 border mb-4">
                        <h5 className="font-medium text-gray-900 mb-3">Service Configuration</h5>
                        
                        {/* Service Type */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Type
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name={`serviceType_${item?.id}`}
                                value="in_house"
                                checked={item?.serviceType === 'in_house'}
                                onChange={(e) => updateLineItem(item?.id, 'serviceType', e?.target?.value)}
                                className="text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="text-sm">🏠 On-Site (In-House)</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name={`serviceType_${item?.id}`}
                                value="vendor"
                                checked={item?.serviceType === 'vendor'}
                                onChange={(e) => updateLineItem(item?.id, 'serviceType', e?.target?.value)}
                                className="text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="text-sm">🏢 Off-Site (Vendor)</span>
                            </label>
                          </div>
                        </div>

                        {/* Vendor Selection (if off-site) */}
                        {item?.serviceType === 'vendor' && (
                          <div className="mb-4">
                            <SearchableSelect
                              label="Vendor *"
                              options={vendors}
                              value={item?.vendorId}
                              onChange={(value) => updateLineItem(item?.id, 'vendorId', value)}
                              placeholder="Select vendor"
                              searchable={true}
                              clearable={true}
                              groupBy="specialty"
                            />
                          </div>
                        )}

                        {/* Scheduling */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scheduling
                          </label>
                          <div className="space-y-3">
                            <div className="flex space-x-4">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`scheduling_${item?.id}`}
                                  checked={item?.requiresScheduling}
                                  onChange={() => updateLineItem(item?.id, 'requiresScheduling', true)}
                                  className="text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm">Needs Scheduling</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`scheduling_${item?.id}`}
                                  checked={!item?.requiresScheduling}
                                  onChange={() => updateLineItem(item?.id, 'requiresScheduling', false)}
                                  className="text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm">No Scheduling Needed</span>
                              </label>
                            </div>

                            {item?.requiresScheduling ? (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Promised Date *
                                </label>
                                <input
                                  type="date"
                                  value={item?.promisedDate}
                                  onChange={(e) => updateLineItem(item?.id, 'promisedDate', e?.target?.value)}
                                  min={new Date()?.toISOString()?.split('T')?.[0]}
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Reason for No Schedule *
                                </label>
                                <input
                                  type="text"
                                  value={item?.noScheduleReason}
                                  onChange={(e) => updateLineItem(item?.id, 'noScheduleReason', e?.target?.value)}
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., installed at delivery, no appointment needed"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Service Notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Notes
                          </label>
                          <textarea
                            rows={2}
                            value={item?.serviceNotes}
                            onChange={(e) => updateLineItem(item?.id, 'serviceNotes', e?.target?.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Special instructions, customer preferences, etc."
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${calculateTotal()?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex space-x-3">
              {currentStep === 2 && (
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  className=""
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleClose}
                variant="outline"
                className=""
              >
                Cancel
              </Button>
              
              {currentStep === 1 && (
                <>
                  <Button
                    onClick={handleSaveDraft}
                    disabled={!validateStep1() || isSubmitting}
                    variant="outline"
                    className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!validateStep1()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Add Details & Line Items
                  </Button>
                </>
              )}

              {currentStep === 2 && (
                <Button
                  onClick={handleCreateDeal}
                  disabled={!validateStep1() || !validateStep2() || isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? 'Creating...' : 'Create Deal'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}