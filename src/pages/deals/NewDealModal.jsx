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
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  
  // Load dropdown data using custom hook
  const {
    salesConsultants,
    deliveryCoordinators,
    vendors,
    products,
    loading: dropdownLoading,
    refresh: refreshDropdowns
  } = useDealFormDropdowns();
  
  // Initial form state for dirty checking
  const initialFormState = {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    needsLoaner: false,
    assignedTo: null,
    deliveryCoordinator: null
  };

  // Customer form data
  const [customerData, setCustomerData] = useState(initialFormState);
  
  // Line items data  
  const [lineItems, setLineItems] = useState([]);

  // Dirty state tracking
  useEffect(() => {
    const hasChanges = 
      customerData?.customerName !== initialFormState?.customerName ||
      customerData?.customerPhone !== initialFormState?.customerPhone ||
      customerData?.customerEmail !== initialFormState?.customerEmail ||
      customerData?.needsLoaner !== initialFormState?.needsLoaner ||
      customerData?.assignedTo !== initialFormState?.assignedTo ||
      customerData?.deliveryCoordinator !== initialFormState?.deliveryCoordinator ||
      lineItems?.length > 0;
    
    setIsDirty(hasChanges);
  }, [customerData, lineItems]);

  // Load dropdown data when modal opens
  useEffect(() => {
    if (isOpen && !dropdownLoading) {
      refreshDropdowns();
    }
  }, [isOpen, refreshDropdowns, dropdownLoading]);

  // Enhanced loaner checkbox with mobile-friendly styling and click propagation handling
  const LoanerCheckbox = ({ checked, onChange }) => (
    <div 
      className="bg-slate-50 p-4 rounded-lg border"
      onClick={(e) => e?.stopPropagation()}
    >
      <label htmlFor="needs-loaner" className="inline-flex items-center gap-3 min-h-11 px-2 cursor-pointer">
        <input
          id="needs-loaner"
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => {
            e?.stopPropagation();
            onChange(e?.target?.checked);
          }}
          onClick={(e) => e?.stopPropagation()}
          className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="loaner-checkbox"
        />
        <span className="text-sm font-medium text-gray-700 select-none">
          Request loaner vehicle
        </span>
      </label>
    </div>
  );

  // Enhanced Service Type Radio with proper mobile accessibility
  const ServiceTypeRadio = ({ value, selectedValue, onChange, itemId, disabled = false }) => (
    <div className="flex space-x-6">
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`serviceType_${itemId}`}
          value="in_house"
          checked={selectedValue === 'in_house'}
          onChange={(e) => onChange(e?.target?.value)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="service-type-in-house"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">
          🏠 On-Site (In-House)
        </span>
      </label>
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`serviceType_${itemId}`}
          value="vendor"
          checked={selectedValue === 'vendor'}
          onChange={(e) => onChange(e?.target?.value)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="service-type-vendor"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">
          🏢 Off-Site (Vendor)
        </span>
      </label>
    </div>
  );

  // Enhanced Requires Scheduling Radio with mobile optimization
  const SchedulingRadio = ({ requiresScheduling, onChange, itemId, disabled = false }) => (
    <div className="flex space-x-6">
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`scheduling_${itemId}`}
          checked={requiresScheduling === true}
          onChange={() => onChange(true)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="requires-scheduling-yes"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">
          Needs Scheduling
        </span>
      </label>
      <label className="inline-flex items-center gap-2 min-h-11 px-2 cursor-pointer">
        <input
          type="radio"
          name={`scheduling_${itemId}`}
          checked={requiresScheduling === false}
          onChange={() => onChange(false)}
          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
          data-testid="requires-scheduling-no"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700 select-none">
          No Scheduling Needed
        </span>
      </label>
    </div>
  );

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

  // Update line item with proper boolean coercion
  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev?.map(item => {
      if (item?.id === id) {
        let updatedItem = { ...item, [field]: value };
        
        // Boolean coercion for specific fields
        if (field === 'requiresScheduling') {
          updatedItem.requiresScheduling = Boolean(value);
          // Clear paired fields correctly
          if (value === true) {
            updatedItem.noScheduleReason = '';
          } else {
            updatedItem.promisedDate = '';
          }
        }
        
        if (field === 'needsLoaner') {
          updatedItem.needsLoaner = Boolean(value);
        }
        
        return updatedItem;
      }
      return item;
    }));

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

  // Validation with improved error messages
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

  // Calculate total with loaner flag consolidation
  const calculateTotal = () => {
    return lineItems?.reduce((sum, item) => {
      return sum + (parseFloat(item?.unitPrice) || 0);
    }, 0);
  };

  // Compute consolidated loaner needs
  const getConsolidatedLoanerFlag = () => {
    const customerNeedsLoaner = Boolean(customerData?.needsLoaner);
    const itemsNeedLoaner = lineItems?.some(item => Boolean(item?.needsLoaner));
    return customerNeedsLoaner || itemsNeedLoaner;
  };

  // Handle save as draft with proper boolean coercion
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
          owner_name: customerData?.customerName?.trim(),
          owner_phone: customerData?.customerPhone?.trim() || null,
          owner_email: customerData?.customerEmail?.trim() || null,
          stock_number: `DRAFT-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      // Ensure proper boolean coercion
      const consolidatedLoaner = getConsolidatedLoanerFlag();

      // Create job as draft
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Draft Deal - ${customerData?.customerName?.trim()}`,
          description: `Draft deal for ${customerData?.customerName?.trim()}`,
          job_status: 'draft',
          priority: 'medium',
          service_type: 'in_house',
          vehicle_id: vehicle?.id,
          assigned_to: customerData?.assignedTo || user?.id,
          delivery_coordinator_id: customerData?.deliveryCoordinator || null,
          customer_needs_loaner: consolidatedLoaner,
          created_by: user?.id,
          estimated_cost: 0
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create transaction record with proper null handling
      const { error: transactionError } = await supabase?.from('transactions')?.upsert([{
          job_id: job?.id,
          vehicle_id: vehicle?.id,
          customer_name: customerData?.customerName?.trim(),
          customer_phone: customerData?.customerPhone?.trim() || null,
          customer_email: customerData?.customerEmail?.trim() || null,
          total_amount: 0,
          subtotal: 0,
          tax_amount: 0,
          transaction_status: 'pending'
        }], { onConflict: 'job_id' });

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

  // Handle create full deal with enhanced line item processing
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
          owner_name: customerData?.customerName?.trim(),
          owner_phone: customerData?.customerPhone?.trim() || null,
          owner_email: customerData?.customerEmail?.trim() || null,
          stock_number: `DEAL-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      const total = calculateTotal();
      const consolidatedLoaner = getConsolidatedLoanerFlag();

      // Determine service type from line items
      const hasVendorItems = lineItems?.some(item => item?.serviceType === 'vendor');
      const serviceType = hasVendorItems ? 'vendor' : 'in_house';
      
      // Get primary vendor if any
      const primaryVendor = lineItems?.find(item => item?.vendorId)?.vendorId || null;

      // Create job
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Deal - ${customerData?.customerName?.trim()}`,
          description: `Deal for ${customerData?.customerName?.trim()}`,
          job_status: 'pending',
          priority: 'medium',
          service_type: serviceType,
          vehicle_id: vehicle?.id,
          vendor_id: primaryVendor,
          assigned_to: customerData?.assignedTo || user?.id,
          delivery_coordinator_id: customerData?.deliveryCoordinator || null,
          customer_needs_loaner: consolidatedLoaner,
          created_by: user?.id,
          estimated_cost: total
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create job parts (line items) with proper boolean coercion
      const jobPartsData = lineItems?.map(item => ({
        job_id: job?.id,
        product_id: item?.productId,
        quantity_used: 1,
        unit_price: parseFloat(item?.unitPrice),
        is_off_site: item?.serviceType === 'vendor',
        requires_scheduling: Boolean(item?.requiresScheduling),
        promised_date: item?.requiresScheduling ? item?.promisedDate : null,
        no_schedule_reason: !item?.requiresScheduling ? item?.noScheduleReason : null
      }));

      const { error: jobPartsError } = await supabase?.from('job_parts')?.insert(jobPartsData);

      if (jobPartsError) throw jobPartsError;

      // Create/update transaction record
      const { error: transactionError } = await supabase?.from('transactions')?.upsert([{
          job_id: job?.id,
          vehicle_id: vehicle?.id,
          customer_name: customerData?.customerName?.trim(),
          customer_phone: customerData?.customerPhone?.trim() || null,
          customer_email: customerData?.customerEmail?.trim() || null,
          total_amount: total,
          subtotal: total,
          tax_amount: 0,
          transaction_status: 'pending'
        }], { onConflict: 'job_id' });

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
    setCustomerData(initialFormState);
    setLineItems([]);
    setError('');
    setIsDirty(false);
  };

  // Enhanced close handler with unsaved changes guard
  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      resetForm();
      onClose();
    }
  };

  const confirmClose = () => {
    setShowUnsavedWarning(false);
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Deal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentStep === 1 ? 'Customer Information' : 'Line Items & Service Configuration'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Progress indicator with enhanced styling */}
        <div className="px-6 py-4 bg-slate-50 flex-shrink-0 border-b">
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

        {/* Content with light theme styling */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {dropdownLoading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              Loading dropdown data...
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Mobile-first form layout */}
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

              {/* Vehicle Information Section - Visible on Mobile */}
              <div className="block bg-slate-50 p-4 rounded-lg border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Vehicle Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <input
                      type="number"
                      value={customerData?.vehicleYear || ''}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, vehicleYear: e?.target?.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="2024"
                      min="1900"
                      max={new Date()?.getFullYear() + 2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Make
                    </label>
                    <input
                      type="text"
                      value={customerData?.vehicleMake || ''}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, vehicleMake: e?.target?.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Toyota"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model
                    </label>
                    <input
                      type="text"
                      value={customerData?.vehicleModel || ''}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, vehicleModel: e?.target?.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Camry"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Number
                  </label>
                  <input
                    type="text"
                    value={customerData?.stockNumber || ''}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, stockNumber: e?.target?.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter stock number"
                  />
                </div>
              </div>

              {/* Enhanced loaner checkbox with click propagation handling */}
              <LoanerCheckbox
                checked={customerData?.needsLoaner}
                onChange={(checked) => setCustomerData(prev => ({ ...prev, needsLoaner: checked }))}
              />

              {/* Assigned to dropdown */}
              <div>
                <SearchableSelect
                  label="Assigned to"
                  options={salesConsultants}
                  value={customerData?.assignedTo}
                  onChange={(value) => setCustomerData(prev => ({ ...prev, assignedTo: value }))}
                  placeholder="Select sales consultant"
                  searchable={true}
                  clearable={true}
                />
              </div>

              {/* Delivery Coordinator dropdown */}
              <div>
                <SearchableSelect
                  label="Delivery Coordinator"
                  options={deliveryCoordinators}
                  value={customerData?.deliveryCoordinator}
                  onChange={(value) => setCustomerData(prev => ({ ...prev, deliveryCoordinator: value }))}
                  placeholder="Select delivery coordinator"
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
                  className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  aria-label="Add new line item"
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
                    <div key={item?.id} className="border rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                        <button
                          onClick={() => removeLineItem(item?.id)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
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

                      {/* Service Configuration with enhanced styling */}
                      <div className="bg-white rounded-lg p-4 border mb-4">
                        <h5 className="font-medium text-gray-900 mb-3">Service Configuration</h5>
                        
                        {/* Service Type with enhanced mobile radio buttons */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Type
                          </label>
                          <ServiceTypeRadio
                            selectedValue={item?.serviceType}
                            onChange={(value) => updateLineItem(item?.id, 'serviceType', value)}
                            itemId={item?.id}
                          />
                        </div>

                        {/* Vendor Selection (if off-site) */}
                        {item?.serviceType === 'vendor' && (
                          <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
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

                        {/* Scheduling with enhanced mobile radio buttons */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scheduling
                          </label>
                          <div className="space-y-3">
                            <SchedulingRadio
                              requiresScheduling={item?.requiresScheduling}
                              onChange={(value) => updateLineItem(item?.id, 'requiresScheduling', value)}
                              itemId={item?.id}
                            />

                            {item?.requiresScheduling ? (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
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

                  {/* Total with enhanced styling */}
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
        </div>

        {/* Footer with mobile-friendly buttons */}
        <div className="px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex space-x-3 w-full md:w-auto">
              {currentStep === 2 && (
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  className="w-full md:w-auto h-11"
                  aria-label="Go back to customer information step"
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex space-x-3 w-full md:w-auto">
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full md:w-auto h-11"
                aria-label="Cancel and close modal"
              >
                Cancel
              </Button>
              
              {currentStep === 1 && (
                <>
                  <Button
                    onClick={handleSaveDraft}
                    disabled={!validateStep1() || isSubmitting}
                    variant="outline"
                    className="w-full md:w-auto h-11 bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                    aria-label="Save deal as draft"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!validateStep1()}
                    className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-700"
                    aria-label="Proceed to line items step"
                  >
                    Add Line Items
                  </Button>
                </>
              )}

              {currentStep === 2 && (
                <Button
                  onClick={handleCreateDeal}
                  disabled={!validateStep1() || !validateStep2() || isSubmitting}
                  className="w-full md:w-auto h-11 bg-green-600 hover:bg-green-700"
                  aria-label="Create the deal with all line items"
                >
                  {isSubmitting ? 'Creating...' : 'Create Deal'}
                </Button>
              )}
            </div>
          </div>
        </div>

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
                  variant="outline"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="flex-1 h-11"
                  aria-label="Keep editing and return to form"
                >
                  Keep Editing
                </Button>
                <Button
                  onClick={confirmClose}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                  aria-label="Discard changes and close modal"
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}