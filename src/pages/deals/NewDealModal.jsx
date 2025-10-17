import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

export default function NewDealModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1); // 1 = Customer, 2 = Line Items
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  
  // ✅ FIXED: Enhanced dropdown state with comprehensive error handling and retry logic
  const [dropdownData, setDropdownData] = useState({
    salesConsultants: [],
    deliveryCoordinators: [],
    financeManagers: [],
    vendors: [],
    products: [],
    loading: true,
    error: null,
    retryCount: 0
  });
  
  // Initial form state for dirty checking
  const initialFormState = {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    needsLoaner: false,
    assignedTo: null,
    deliveryCoordinator: null,
    financeManager: null,
    vehicleYear: new Date()?.getFullYear(),
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    stockNumber: ''
  };

  // Customer form data
  const [customerData, setCustomerData] = useState(initialFormState);
  
  // Line items data  
  const [lineItems, setLineItems] = useState([]);

  // ✅ FIXED: Enhanced dropdown data loading with comprehensive error handling and retry logic
  const loadDropdownData = async (retryCount = 0) => {
    try {
      setDropdownData(prev => ({ ...prev, loading: true, error: null, retryCount }));

      // Load all dropdown data with individual error handling and proper department filtering
      const [salesResult, dcResult, financeResult, vendorsResult, productsResult] = await Promise.allSettled([
        // Sales Consultants - exact department match
        supabase
          ?.from('user_profiles')
          ?.select('id, full_name, email, department, role, is_active')
          ?.eq('is_active', true)
          ?.eq('department', 'Sales Consultants')
          ?.eq('role', 'staff')
          ?.order('full_name'),
        
        // Delivery Coordinators - exact department match with broader role filtering
        supabase
          ?.from('user_profiles')
          ?.select('id, full_name, email, department, role, is_active')
          ?.eq('is_active', true)
          ?.eq('department', 'Delivery Coordinator')
          ?.in('role', ['admin', 'manager'])
          ?.order('full_name'),
        
        // Finance Managers - exact department match
        supabase
          ?.from('user_profiles')
          ?.select('id, full_name, email, department, role, is_active')
          ?.eq('is_active', true)
          ?.eq('department', 'Finance Manager')
          ?.eq('role', 'staff')
          ?.order('full_name'),
        
        // Active Vendors
        supabase
          ?.from('vendors')
          ?.select('id, name, specialty, email, phone, is_active')
          ?.eq('is_active', true)
          ?.order('name'),
        
        // Active Products
        supabase
          ?.from('products')
          ?.select('id, name, category, unit_price, cost, brand, is_active')
          ?.eq('is_active', true)
          ?.order('name')
      ]);

      // Process results with comprehensive error handling
      const salesConsultants = salesResult?.status === 'fulfilled' && !salesResult?.value?.error 
        ? salesResult?.value?.data || [] 
        : [];
      
      const deliveryCoordinators = dcResult?.status === 'fulfilled' && !dcResult?.value?.error 
        ? dcResult?.value?.data || [] 
        : [];
      
      const financeManagers = financeResult?.status === 'fulfilled' && !financeResult?.value?.error 
        ? financeResult?.value?.data || [] 
        : [];
      
      const vendors = vendorsResult?.status === 'fulfilled' && !vendorsResult?.value?.error 
        ? (vendorsResult?.value?.data || [])?.map(vendor => ({
            id: vendor?.id,
            value: vendor?.id,
            label: `${vendor?.name}${vendor?.specialty ? ` - ${vendor?.specialty}` : ''}`,
            name: vendor?.name,
            specialty: vendor?.specialty
          }))
        : [];
      
      const products = productsResult?.status === 'fulfilled' && !productsResult?.value?.error 
        ? (productsResult?.value?.data || [])?.map(product => ({
            id: product?.id,
            value: product?.id,
            label: `${product?.name}${product?.brand ? ` - ${product?.brand}` : ''}`,
            name: product?.name,
            category: product?.category,
            unitPrice: product?.unit_price,
            cost: product?.cost
          }))
        : [];

      setDropdownData({
        salesConsultants,
        deliveryCoordinators,
        financeManagers,
        vendors,
        products,
        loading: false,
        error: null,
        retryCount
      });

    } catch (err) {
      console.error('Failed to load dropdown data:', err);
      
      // Retry logic for network failures
      if (retryCount < 2 && (err?.message?.includes('fetch') || err?.message?.includes('network'))) {
        setTimeout(() => loadDropdownData(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      setDropdownData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dropdown data. Please check your connection and try again.',
        retryCount
      }));
    }
  };

  // ✅ FIXED: Enhanced loaner checkbox with proper mobile accessibility and boolean handling
  const LoanerCheckbox = ({ checked, onChange }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
      <label 
        htmlFor="needs-loaner-modal" 
        className="flex items-center gap-3 cursor-pointer select-none"
      >
        <input
          id="needs-loaner-modal"
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => {
            const isChecked = Boolean(e?.target?.checked);
            onChange(isChecked);
          }}
          className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        />
        <span className="text-sm font-medium text-gray-700">
          Customer needs loaner vehicle
        </span>
      </label>
      <p className="text-xs text-gray-500 mt-2 ml-8">
        Check this if the customer requires a loaner vehicle during service
      </p>
    </div>
  );

  // ✅ FIXED: Enhanced native select component with better error handling
  const MobileSelect = ({ label, options, value, onChange, placeholder, required = false, helpText }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e?.target?.value || null)}
        className="bg-white border border-gray-300 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        disabled={dropdownData?.loading}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options?.map(option => (
          <option key={option?.id} value={option?.id}>
            {option?.full_name || option?.label || option?.name}
          </option>
        ))}
      </select>
      {helpText && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
      {options?.length === 0 && !dropdownData?.loading && (
        <p className="mt-1 text-xs text-red-500">
          No {label?.toLowerCase()} found. Please check your database connection.
        </p>
      )}
    </div>
  );

  // Dirty state tracking
  useEffect(() => {
    const hasChanges = 
      customerData?.customerName !== initialFormState?.customerName ||
      customerData?.customerPhone !== initialFormState?.customerPhone ||
      customerData?.customerEmail !== initialFormState?.customerEmail ||
      customerData?.needsLoaner !== initialFormState?.needsLoaner ||
      customerData?.assignedTo !== initialFormState?.assignedTo ||
      customerData?.deliveryCoordinator !== initialFormState?.deliveryCoordinator ||
      customerData?.financeManager !== initialFormState?.financeManager ||
      lineItems?.length > 0;
    
    setIsDirty(hasChanges);
  }, [customerData, lineItems]);

  // Load dropdown data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDropdownData();
    }
  }, [isOpen]);

  // Add new line item
  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: Date.now(),
      productId: '',
      unitPrice: '',
      serviceType: 'in_house',
      vendorId: '',
      requiresScheduling: true,
      promisedDate: '',
      noScheduleReason: '',
      serviceNotes: ''
    }]);
  };

  // Update line item
  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev?.map(item => {
      if (item?.id === id) {
        let updatedItem = { ...item, [field]: value };
        
        if (field === 'requiresScheduling') {
          if (value === true) {
            updatedItem.noScheduleReason = '';
          } else {
            updatedItem.promisedDate = '';
          }
        }
        
        return updatedItem;
      }
      return item;
    }));

    // Auto-populate price when product is selected
    if (field === 'productId' && value) {
      const selectedProduct = dropdownData?.products?.find(p => p?.id === value);
      if (selectedProduct) {
        setLineItems(prev => prev?.map(item => 
          item?.id === id 
            ? { ...item, unitPrice: selectedProduct?.unitPrice || '' } 
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
      if (!item?.productId || !item?.unitPrice) return false;
      if (item?.requiresScheduling && !item?.promisedDate) return false;
      if (!item?.requiresScheduling && !item?.noScheduleReason?.trim()) return false;
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
          year: customerData?.vehicleYear || new Date()?.getFullYear(),
          make: customerData?.vehicleMake || 'TBD',
          model: customerData?.vehicleModel || 'TBD',
          owner_name: customerData?.customerName?.trim(),
          owner_phone: customerData?.customerPhone?.trim() || null,
          owner_email: customerData?.customerEmail?.trim() || null,
          stock_number: customerData?.stockNumber?.trim() || `DRAFT-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      // Create job as draft
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Draft Deal - ${customerData?.customerName?.trim()}`,
          description: `Draft deal for ${customerData?.customerName?.trim()}`,
          job_status: 'draft',
          service_type: 'in_house',
          vehicle_id: vehicle?.id,
          assigned_to: customerData?.assignedTo || user?.id,
          delivery_coordinator_id: customerData?.deliveryCoordinator || null,
          finance_manager_id: customerData?.financeManager || null,
          customer_needs_loaner: Boolean(customerData?.needsLoaner),
          created_by: user?.id,
          estimated_cost: 0
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create transaction record
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
          year: customerData?.vehicleYear || new Date()?.getFullYear(),
          make: customerData?.vehicleMake || 'TBD',
          model: customerData?.vehicleModel || 'TBD',
          owner_name: customerData?.customerName?.trim(),
          owner_phone: customerData?.customerPhone?.trim() || null,
          owner_email: customerData?.customerEmail?.trim() || null,
          stock_number: customerData?.stockNumber?.trim() || `DEAL-${Date.now()}`,
          vehicle_status: 'active',
          created_by: user?.id
        }])?.select()?.single();

      if (vehicleError) throw vehicleError;

      const total = calculateTotal();
      const hasVendorItems = lineItems?.some(item => item?.serviceType === 'vendor');
      const serviceType = hasVendorItems ? 'vendor' : 'in_house';
      const primaryVendor = lineItems?.find(item => item?.vendorId)?.vendorId || null;

      // Create job
      const { data: job, error: jobError } = await supabase?.from('jobs')?.insert([{
          title: `Deal - ${customerData?.customerName?.trim()}`,
          description: `Deal for ${customerData?.customerName?.trim()}`,
          job_status: 'pending',
          service_type: serviceType,
          vehicle_id: vehicle?.id,
          vendor_id: primaryVendor,
          assigned_to: customerData?.assignedTo || user?.id,
          delivery_coordinator_id: customerData?.deliveryCoordinator || null,
          finance_manager_id: customerData?.financeManager || null,
          customer_needs_loaner: Boolean(customerData?.needsLoaner),
          created_by: user?.id,
          estimated_cost: total
        }])?.select()?.single();

      if (jobError) throw jobError;

      // Create job parts (line items) with proper field mapping
      const jobPartsData = lineItems?.map(item => ({
        job_id: job?.id,
        product_id: item?.productId,
        quantity_used: 1,
        unit_price: parseFloat(item?.unitPrice),
        total_price: parseFloat(item?.unitPrice), // Add total_price for consistency
        is_off_site: item?.serviceType === 'vendor',
        requires_scheduling: Boolean(item?.requiresScheduling),
        promised_date: item?.requiresScheduling ? item?.promisedDate : null,
        no_schedule_reason: !item?.requiresScheduling ? item?.noScheduleReason : null,
        description: item?.serviceNotes || null
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

        {/* Progress indicator */}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <strong>Error:</strong> {error}
                </div>
                <button 
                  onClick={() => setError('')}
                  className="text-red-600 hover:text-red-800 ml-2"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>
          )}

          {dropdownData?.loading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              <div className="flex items-center">
                <Icon name="Loader" size={16} className="mr-2 animate-spin" />
                Loading dropdown data...
              </div>
            </div>
          )}

          {dropdownData?.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <strong>Error:</strong> {dropdownData?.error}
                </div>
                <button 
                  onClick={() => loadDropdownData()}
                  className="text-blue-600 hover:text-blue-800 ml-2 text-xs underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerData?.customerName}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, customerName: e?.target?.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter customer name"
                    required
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
                    className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter customer email"
                />
              </div>

              {/* Vehicle Information */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
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
                      className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter stock number (optional)"
                  />
                </div>
              </div>

              {/* ✅ FIXED: Enhanced loaner checkbox with proper mobile functionality */}
              <LoanerCheckbox
                checked={customerData?.needsLoaner}
                onChange={(checked) => {
                  setCustomerData(prev => ({ ...prev, needsLoaner: Boolean(checked) }));
                }}
              />

              {/* ✅ FIXED: Dealer Representatives with working dropdowns */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Dealer Representatives</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <MobileSelect
                    label="Sales Consultant"
                    options={dropdownData?.salesConsultants}
                    value={customerData?.assignedTo}
                    onChange={(value) => setCustomerData(prev => ({ ...prev, assignedTo: value }))}
                    placeholder="Select sales consultant (optional)"
                    helpText="Choose the sales consultant responsible for this deal"
                  />

                  <MobileSelect
                    label="Delivery Coordinator"
                    options={dropdownData?.deliveryCoordinators}
                    value={customerData?.deliveryCoordinator}
                    onChange={(value) => setCustomerData(prev => ({ ...prev, deliveryCoordinator: value }))}
                    placeholder="Select delivery coordinator (optional)"
                    helpText="Choose the delivery coordinator for this deal"
                  />

                  <MobileSelect
                    label="Finance Manager"
                    options={dropdownData?.financeManagers}
                    value={customerData?.financeManager}
                    onChange={(value) => setCustomerData(prev => ({ ...prev, financeManager: value }))}
                    placeholder="Select finance manager (optional)"
                    helpText="Choose the finance manager for this deal"
                  />
                </div>
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
                    <div key={item?.id} className="border rounded-xl p-4 bg-slate-50 border-slate-200">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item?.productId || ''}
                            onChange={(e) => updateLineItem(item?.id, 'productId', e?.target?.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                            required
                          >
                            <option value="">Select product</option>
                            {dropdownData?.products?.map(product => (
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
                            onChange={(e) => updateLineItem(item?.id, 'unitPrice', e?.target?.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>

                      {/* Service Configuration */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200 mb-4">
                        <h5 className="font-medium text-gray-900 mb-3">Service Configuration</h5>
                        
                        {/* Service Type */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Type
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`serviceType_${item?.id}`}
                                value="in_house"
                                checked={item?.serviceType === 'in_house'}
                                onChange={(e) => updateLineItem(item?.id, 'serviceType', e?.target?.value)}
                                className="mr-2 cursor-pointer"
                              />
                              🏠 On-Site (In-House)
                            </label>
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`serviceType_${item?.id}`}
                                value="vendor"
                                checked={item?.serviceType === 'vendor'}
                                onChange={(e) => updateLineItem(item?.id, 'serviceType', e?.target?.value)}
                                className="mr-2 cursor-pointer"
                              />
                              🏢 Off-Site (Vendor)
                            </label>
                          </div>
                        </div>

                        {/* Vendor Selection */}
                        {item?.serviceType === 'vendor' && (
                          <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Vendor <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={item?.vendorId || ''}
                              onChange={(e) => updateLineItem(item?.id, 'vendorId', e?.target?.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                              required
                            >
                              <option value="">Select vendor</option>
                              {dropdownData?.vendors?.map(vendor => (
                                <option key={vendor?.id} value={vendor?.id}>
                                  {vendor?.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Scheduling */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scheduling
                          </label>
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`scheduling_${item?.id}`}
                                  checked={item?.requiresScheduling === true}
                                  onChange={() => updateLineItem(item?.id, 'requiresScheduling', true)}
                                  className="mr-2 cursor-pointer"
                                />
                                Needs Scheduling
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`scheduling_${item?.id}`}
                                  checked={item?.requiresScheduling === false}
                                  onChange={() => updateLineItem(item?.id, 'requiresScheduling', false)}
                                  className="mr-2 cursor-pointer"
                                />
                                No Scheduling Needed
                              </label>
                            </div>

                            {item?.requiresScheduling ? (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Promised Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={item?.promisedDate}
                                  onChange={(e) => updateLineItem(item?.id, 'promisedDate', e?.target?.value)}
                                  min={new Date()?.toISOString()?.split('T')?.[0]}
                                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required
                                />
                              </div>
                            ) : (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Reason for No Schedule <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={item?.noScheduleReason}
                                  onChange={(e) => updateLineItem(item?.id, 'noScheduleReason', e?.target?.value)}
                                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., installed at delivery, no appointment needed"
                                  required
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
                            className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Special instructions, customer preferences, etc."
                          />
                        </div>
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
                    <div className="text-sm text-gray-600 mt-1">
                      {lineItems?.length} item{lineItems?.length !== 1 ? 's' : ''} added
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex-shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex space-x-3 w-full md:w-auto">
              {currentStep === 2 && (
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  className="w-full md:w-auto h-11"
                >
                  ← Back
                </Button>
              )}
            </div>

            <div className="flex space-x-3 w-full md:w-auto">
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full md:w-auto h-11"
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
                  >
                    {isSubmitting ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!validateStep1()}
                    className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-700"
                  >
                    Add Line Items →
                  </Button>
                </>
              )}

              {currentStep === 2 && (
                <Button
                  onClick={handleCreateDeal}
                  disabled={!validateStep1() || !validateStep2() || isSubmitting}
                  className="w-full md:w-auto h-11 bg-green-600 hover:bg-green-700"
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
                >
                  Keep Editing
                </Button>
                <Button
                  onClick={confirmClose}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
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