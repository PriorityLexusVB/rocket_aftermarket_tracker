// PHASE 3: Line Item Management & Scheduling - ROLLBACK SALES/FINANCE FIELDS
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';


const DealForm = ({ 
  mode = 'create', // 'create' | 'edit'
  initialData = null, // { deal, items } for edit mode
  onSubmit,
  onCancel,
  vehicles = [],
  vendors = [],
  products = [],
  salespeople = [],
  deliveryCoordinators = [],
  financeManagers = []
}) => {
  const { themeClasses } = useTheme();
  const { user } = useAuth();

  // Enhanced vehicle data state with separate fields for NEW vehicle entry
  const [vehicleData, setVehicleData] = useState({
    new_used: 'new',
    stock_number: '',
    deal_number: '',  
    year: '',
    make: '',
    model: '',
    vin: '',
    color: '',
    mileage: ''
  });

  // Form state management with schema-accurate field mapping
  const [dealData, setDealData] = useState({
    description: '',
    vehicle_id: null,
    vendor_id: null,
    created_by: user?.id,
    delivery_coordinator_id: '',
    assigned_to: null, // Sales consultant
    finance_manager_id: null, // Finance manager
    job_status: 'pending',
    priority: 'medium',
    customer_needs_loaner: false,
    promised_date: '',
    estimated_cost: 0,
    estimated_hours: null,
    location: '',
    calendar_notes: ''
  });

  // Enhanced line items state with individual scheduling fields
  const [lineItems, setLineItems] = useState([]);
  
  // Enhanced customer data with first/last name and spouse
  const [customerData, setCustomerData] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    customer_email: '',
    spouse_name: ''
  });

  // Enhanced form state with scheduling validation
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [schedulingEnabled, setSchedulingEnabled] = useState({});
  
  // NEW: Individual line item save states
  const [savingLineItem, setSavingLineItem] = useState({});

  // Initialize form data for edit mode - Optimized with useEffect dependencies
  useEffect(() => {
    if (mode === 'edit' && initialData?.deal) {
      const { deal, items = [] } = initialData;
      
      if (deal?.vehicles) {
        const vehicle = deal?.vehicles;
        setVehicleData(prev => ({
          ...prev,
          new_used: 'used',
          stock_number: vehicle?.stock_number || '',
          deal_number: deal?.job_number || '',
          year: vehicle?.year?.toString() || '',
          make: vehicle?.make || '',
          model: vehicle?.model || '',
          vin: vehicle?.vin || '',
          color: vehicle?.color || '',
          mileage: vehicle?.mileage?.toString() || ''
        }));
      }
      
      setDealData(prev => ({
        ...prev,
        description: deal?.description || '',
        vehicle_id: deal?.vehicle_id || '',
        vendor_id: deal?.vendor_id,
        created_by: deal?.created_by || user?.id,
        delivery_coordinator_id: deal?.delivery_coordinator_id || '',
        assigned_to: deal?.assigned_to,
        finance_manager_id: deal?.finance_manager_id || null,
        job_status: deal?.job_status || 'pending',
        priority: deal?.priority || 'medium',
        customer_needs_loaner: deal?.customer_needs_loaner || false,
        promised_date: deal?.promised_date ? deal?.promised_date?.split('T')?.[0] : '',
        estimated_cost: deal?.estimated_cost || 0,
        estimated_hours: deal?.estimated_hours,
        location: deal?.location || '',
        calendar_notes: deal?.calendar_notes || ''
      }));

      const mappedItems = items?.map(item => ({
        id: item?.id,
        product_id: item?.product_id || item?.products?.id,
        name: item?.products?.name || item?.name,
        op_code: item?.products?.op_code,
        unit_price: parseFloat(item?.unit_price || item?.products?.unit_price || 0),
        cost: parseFloat(item?.products?.cost || 0),
        category: item?.products?.category,
        brand: item?.products?.brand,
        description: item?.products?.description,
        service_type: item?.service_type || 'in_house',
        vendor_id: item?.vendor_id || null,
        promised_date: item?.promised_date ? item?.promised_date?.split('T')?.[0] : '',
        customer_needs_loaner: item?.customer_needs_loaner || false,
        notes: item?.notes || ''
      }));
      setLineItems(mappedItems || []);

      if (deal?.transactions?.[0]) {
        const txn = deal?.transactions?.[0];
        const fullName = txn?.customer_name || '';
        const nameParts = fullName?.split(' ');
        setCustomerData(prev => ({
          ...prev,
          customer_first_name: nameParts?.[0] || '',
          customer_last_name: nameParts?.slice(1)?.join(' ') || '',
          customer_phone: txn?.customer_phone || '',
          customer_email: txn?.customer_email || '',
          spouse_name: txn?.spouse_name || ''
        }));
      } else if (deal?.vehicles) {
        const fullName = deal?.vehicles?.owner_name || '';
        const nameParts = fullName?.split(' ');
        setCustomerData(prev => ({
          ...prev,
          customer_first_name: nameParts?.[0] || '',
          customer_last_name: nameParts?.slice(1)?.join(' ') || '',
          customer_phone: deal?.vehicles?.owner_phone || '',
          customer_email: deal?.vehicles?.owner_email || '',
          spouse_name: ''
        }));
      }
    } else if (mode === 'create') {
      const today = new Date();
      setLineItems([{
        id: null,
        product_id: '',
        name: '',
        unit_price: 0,
        cost: 0,
        category: '',
        brand: '',
        description: '',
        service_type: 'in_house',
        vendor_id: null,
        promised_date: today?.toISOString()?.slice(0, 10),
        customer_needs_loaner: false,
        notes: ''
      }]);
    }
  }, [mode, initialData?.deal?.id, user?.id]);

  // Load vehicle details when selected - Debounced
  useEffect(() => {
    if (dealData?.vehicle_id) {
      const vehicle = vehicles?.find(v => v?.id === dealData?.vehicle_id);
      
      if (vehicle && !customerData?.customer_first_name) {
        const timer = setTimeout(() => {
          setCustomerData(prev => ({
            ...prev,
            customer_first_name: vehicle?.owner_name?.split(' ')?.[0] || '',
            customer_last_name: vehicle?.owner_name?.split(' ')?.slice(1)?.join(' ') || '',
            customer_phone: vehicle?.owner_phone || '',
            customer_email: vehicle?.owner_email || ''
          }));
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [dealData?.vehicle_id, vehicles, customerData?.customer_first_name]);

  // Auto-update service type and location based on vendor selection - Debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dealData?.vendor_id) {
        setDealData(prev => ({
          ...prev,
          service_type: 'vendor',
          location: vendors?.find(v => v?.id === dealData?.vendor_id)?.name || 'Off-Site'
        }));
      } else {
        setDealData(prev => ({
          ...prev,
          service_type: 'in_house',
          location: 'In-House Service Bay'
        }));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [dealData?.vendor_id, vendors]);

  // Enhanced line item management with individual service settings
  const addLineItem = useCallback(() => {
    const today = new Date();
    const newItem = {
      id: null,
      product_id: '',
      name: '',
      unit_price: 0,
      cost: 0,
      category: '',
      brand: '',
      description: '',
      service_type: 'in_house',
      vendor_id: null,
      promised_date: today?.toISOString()?.slice(0, 10),
      customer_needs_loaner: false,
      notes: ''
    };
    setLineItems(prev => [...prev, newItem]);
  }, []);

  const removeLineItem = useCallback((index) => {
    setLineItems(prev => prev?.filter((_, i) => i !== index));
  }, []);

  const updateLineItem = useCallback((index, field, value) => {
    setLineItems(prev => prev?.map((item, i) => {
      if (i !== index) return item;
      
      const updatedItem = { ...item, [field]: value };
      
      if (field === 'service_type') {
        if (value === 'vendor') {
          updatedItem.customer_needs_loaner = true;
        } else {
          updatedItem.vendor_id = null;
        }
      }
      
      return updatedItem;
    }));
    
    setErrors(prev => {
      const newErrors = { ...prev };
      const errorKey = `lineItem_${index}_${field}`;
      if (newErrors?.[errorKey]) {
        delete newErrors?.[errorKey];
      }
      return newErrors;
    });
  }, []);

  // NEW: Individual line item save function
  const saveLineItem = useCallback(async (index) => {
    const item = lineItems?.[index];
    if (!item?.product_id) return;

    setSavingLineItem(prev => ({ ...prev, [index]: true }));
    
    try {
      // Here you would call your individual item save service
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success feedback
      const itemElement = document.querySelector(`[data-item-index="${index}"]`);
      if (itemElement) {
        itemElement.style.background = 'linear-gradient(to right, #ecfdf5, #f0fdf4)';
        itemElement.style.borderColor = '#22c55e';
        setTimeout(() => {
          itemElement.style.background = '';
          itemElement.style.borderColor = '';
        }, 2000);
      }
      
      console.log('Line item saved:', item);
    } catch (error) {
      console.error('Error saving line item:', error);
    } finally {
      setSavingLineItem(prev => ({ ...prev, [index]: false }));
    }
  }, [lineItems]);

  const toggleScheduling = useCallback((index, enabled) => {
    setSchedulingEnabled(prev => ({
      ...prev,
      [index]: enabled
    }));
    
    if (enabled && !lineItems?.[index]?.promised_date) {
      const tomorrow = new Date();
      tomorrow?.setDate(tomorrow?.getDate() + 1);
      updateLineItem(index, 'promised_date', tomorrow?.toISOString()?.slice(0, 10));
    }
  }, [lineItems, updateLineItem]);

  const handleProductSelect = useCallback(async (itemIndex, productId) => {
    const product = products?.find(p => p?.id === productId);
    if (product) {
      setLineItems(prev => prev?.map((item, i) => {
        if (i !== itemIndex) return item;
        
        return {
          ...item,
          product_id: product?.id,
          name: product?.name,
          unit_price: parseFloat(product?.unit_price || 0),
          cost: parseFloat(product?.cost || 0),
          category: product?.category || '',
          brand: product?.brand || '',
          description: product?.description || ''
        };
      }));
    }
  }, [products]);

  const validateForm = () => {
    const newErrors = {};

    if (!vehicleData?.new_used) newErrors.new_used = 'New/Used selection is required';
    if (!vehicleData?.stock_number?.trim()) newErrors.stock_number = 'Stock # is required';
    if (!vehicleData?.deal_number?.trim()) newErrors.deal_number = 'Deal # is required';
    if (!vehicleData?.year) newErrors.year = 'Year is required';
    if (!vehicleData?.make?.trim()) newErrors.make = 'Make is required';
    if (!vehicleData?.model?.trim()) newErrors.model = 'Model is required';
    
    if (!dealData?.delivery_coordinator_id) newErrors.delivery_coordinator_id = 'Delivery coordinator is required';
    
    if (lineItems?.length === 0) {
      newErrors.lineItems = 'At least one line item is required';
    } else {
      lineItems?.forEach((item, index) => {
        if (!item?.product_id) {
          newErrors[`lineItem_${index}_product`] = 'Product is required';
        }
        if (!item?.unit_price || item?.unit_price <= 0) {
          newErrors[`lineItem_${index}_price`] = 'Valid unit price is required';
        }
        if (!item?.cost || item?.cost < 0) {
          newErrors[`lineItem_${index}_cost`] = 'Valid cost is required';
        }
      });
    }

    if (!customerData?.customer_first_name?.trim()) {
      newErrors.customer_first_name = 'Customer first name is required';
    }
    if (!customerData?.customer_last_name?.trim()) {
      newErrors.customer_last_name = 'Customer last name is required';
    }

    setErrors(newErrors);
    setWarnings({});
    return Object.keys(newErrors)?.length === 0;
  };

  const totalAmount = useMemo(() => {
    return lineItems?.reduce((sum, item) => 
      sum + parseFloat(item?.unit_price || 0), 0
    );
  }, [lineItems]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const startTime = today?.toISOString();

      const payload = {
        vehicle: {
          ...vehicleData,
          year: parseInt(vehicleData?.year),
          mileage: vehicleData?.mileage ? parseInt(vehicleData?.mileage) : null,
          owner_name: `${customerData?.customer_first_name} ${customerData?.customer_last_name}`?.trim(),
          owner_phone: customerData?.customer_phone,
          owner_email: customerData?.customer_email
        },
        deal: {
          ...dealData,
          estimated_cost: totalAmount
        },
        items: lineItems?.map(item => {
          const promiseDate = item?.promised_date ? new Date(item?.promised_date) : new Date();
          const endTime = promiseDate?.toISOString();

          return {
            id: item?.id,
            product_id: item?.product_id,
            unit_price: parseFloat(item?.unit_price || 0),
            service_type: item?.service_type,
            vendor_id: item?.vendor_id || null,
            promised_date: item?.promised_date || null,
            customer_needs_loaner: item?.customer_needs_loaner || false,
            notes: item?.notes || null,
            start_time: startTime,
            end_time: endTime
          };
        }),
        transaction: {
          customer_name: `${customerData?.customer_first_name} ${customerData?.customer_last_name}`?.trim(),
          customer_phone: customerData?.customer_phone,
          customer_email: customerData?.customer_email,
          spouse_name: customerData?.spouse_name,
          total_amount: totalAmount,
          subtotal: totalAmount,
          tax_amount: 0,
          notes: `Deal: ${vehicleData?.year} ${vehicleData?.make} ${vehicleData?.model}`
        }
      };

      await onSubmit?.(payload);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: error?.message || 'Failed to save deal' });
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Enhanced line item rendering with individual save buttons
  const renderLineItem = useCallback((item, index) => (
    <div key={`${item?.id || 'new'}-${index}`} data-item-index={index} className="border-2 border-gray-300 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-white space-y-6 relative z-10">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800 flex items-center">
          <Icon name="Package" size={16} className="mr-2 text-blue-600" />
          Item #{index + 1}
        </span>
        <div className="flex items-center space-x-3">
          {/* NEW: Individual Save Button */}
          <Button
            type="button"
            onClick={() => saveLineItem(index)}
            size="sm"
            variant="primary"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
            disabled={savingLineItem?.[index] || !item?.product_id}
          >
            {savingLineItem?.[index] ? (
              <>
                <Icon name="Loader2" size={14} className="mr-1 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <Icon name="Save" size={14} className="mr-1" />
                Save
              </>
            )}
          </Button>
          
          {lineItems?.length > 1 && (
            <Button
              type="button"
              onClick={() => removeLineItem(index)}
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
            >
              <Icon name="Trash2" size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Product Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative z-20">
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Product *
          </label>
          <Select
            value={item?.product_id}
            onChange={(value) => handleProductSelect(index, value)}
            options={products?.map(p => ({
              value: p?.id,
              label: `${p?.name} (${p?.op_code || 'No Code'}) - $${p?.unit_price}`
            })) || []}
            placeholder="Select product..."
            error={errors?.[`lineItem_${index}_product`]}
            className="relative z-20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Unit Price *
            </label>
            <Input
              value={item?.unit_price}
              onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e?.target?.value) || 0)}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              error={errors?.[`lineItem_${index}_price`]}
              className="text-base p-3"
              label=""
              helperText=""
              maxLength={10}
              style={{}}
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Cost
            </label>
            <Input
              value={item?.cost}
              onChange={(e) => updateLineItem(index, 'cost', parseFloat(e?.target?.value) || 0)}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              error={errors?.[`lineItem_${index}_cost`]}
              className="text-base p-3"
              label=""
              helperText=""
              maxLength={10}
              style={{}}
            />
          </div>
        </div>
      </div>

      {/* ENHANCED Service Configuration per line item with proper z-index */}
      <div className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-sm relative z-10">
        <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
          <Icon name="Settings" size={16} className="mr-2" />
          Service Configuration
        </h4>

        {/* "Need to Schedule" bar */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  id={`need_schedule_${index}`}
                  checked={schedulingEnabled?.[index] || false}
                  onChange={(e) => toggleScheduling(index, e?.target?.checked)}
                  className="w-6 h-6 text-purple-600 bg-white border-3 border-purple-400 rounded-lg focus:ring-purple-500 focus:ring-3 cursor-pointer"
                />
                {schedulingEnabled?.[index] && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Icon name="Check" size={16} className="text-purple-700 font-bold" />
                  </div>
                )}
              </div>
              <label htmlFor={`need_schedule_${index}`} className="text-lg font-bold text-purple-900 cursor-pointer">
                Need to Schedule
                {schedulingEnabled?.[index] && (
                  <span className="text-purple-700 ml-3 px-3 py-1 bg-purple-200 rounded-full font-bold text-sm">
                    ✓ SCHEDULING ACTIVE
                  </span>
                )}
              </label>
            </div>
            {schedulingEnabled?.[index] && (
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-purple-300">
                <Icon name="Calendar" size={16} className="text-purple-600" />
                <span className="font-bold text-purple-800">Promise Date Required</span>
              </div>
            )}
          </div>

          {schedulingEnabled?.[index] && (
            <div className="mt-4 pt-4 border-t-2 border-purple-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-lg font-bold text-purple-900 mb-2">
                    Promise Date *
                  </label>
                  <Input
                    value={item?.promised_date}
                    onChange={(e) => updateLineItem(index, 'promised_date', e?.target?.value)}
                    type="date"
                    className="border-2 border-purple-400 focus:border-purple-600 focus:ring-purple-500 text-base p-3"
                    label=""
                    helperText=""
                    maxLength={10}
                    style={{}}
                    placeholder=""
                  />
                </div>
                <div className="flex items-end">
                  <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-base text-purple-800">
                      <Icon name="Clock" size={16} className="text-purple-700" />
                      <span className="font-bold">Auto-scheduled when enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative z-20">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Service Type *
            </label>
            <Select
              value={item?.service_type}
              onChange={(value) => updateLineItem(index, 'service_type', value)}
              options={[
                { value: 'in_house', label: 'Done in house' },
                { value: 'vendor', label: 'Sent offsite' }
              ]}
              className="relative z-20"
            />
          </div>

          <div className="relative z-20">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Vendor {item?.service_type === 'vendor' && '*'}
            </label>
            <Select
              value={item?.vendor_id || ''}
              onChange={(value) => updateLineItem(index, 'vendor_id', value || null)}
              options={[
                { value: '', label: 'None' },
                ...(vendors?.map(v => ({
                  value: v?.id,
                  label: v?.name
                })) || [])
              ]}
              disabled={item?.service_type !== 'vendor'}
              className="relative z-20"
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Service Notes
            </label>
            <Input
              value={item?.notes || ''}
              onChange={(e) => updateLineItem(index, 'notes', e?.target?.value)}
              placeholder="Optional notes..."
              className="text-base p-3"
              label=""
              helperText=""
              maxLength={500}
              style={{}}
            />
          </div>
        </div>

        {/* Enhanced loaner checkbox */}
        <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
          <div className="flex items-center space-x-4">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id={`customer_needs_loaner_${index}`}
                checked={item?.customer_needs_loaner || false}
                onChange={(e) => updateLineItem(index, 'customer_needs_loaner', e?.target?.checked)}
                className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              {item?.customer_needs_loaner && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-green-200 rounded">
                  <Icon name="Check" size={14} className="text-blue-700 font-bold" />
                </div>
              )}
            </div>
            <label htmlFor={`customer_needs_loaner_${index}`} className="text-base font-semibold text-gray-800 cursor-pointer">
              Customer needs loaner
              {item?.customer_needs_loaner && (
                <span className="text-green-700 ml-3 px-2 py-1 bg-green-200 rounded-full font-bold text-sm">
                  ✓ ENABLED
                </span>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  ), [lineItems?.length, removeLineItem, handleProductSelect, updateLineItem, products, vendors, errors, schedulingEnabled, toggleScheduling, saveLineItem, savingLineItem]);

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div>
            <h3 className={`${themeClasses?.text} text-2xl font-bold mb-2`}>
              {mode === 'create' ? 'Create New Deal' : 'Edit Deal'}
              <span className="text-green-600 text-sm ml-3 px-2 py-1 bg-green-100 rounded-full font-semibold">
                ✓ Restored Sales & Finance
              </span>
            </h3>
            <p className={`${themeClasses?.textSecondary} text-base`}>
              Vehicle entry, customer info, dealer reps, and line items with individual scheduling
            </p>
          </div>
          <div className="flex items-center space-x-3 bg-white p-4 rounded-lg border-2 border-green-200">
            <Icon name="DollarSign" size={20} className="text-green-600" />
            <span className="text-green-600 font-bold text-2xl">
              ${totalAmount?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Vehicle Information Section */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
          <h4 className={`${themeClasses?.text} text-lg font-bold mb-4 uppercase tracking-wide flex items-center`}>
            <Icon name="Car" size={18} className="mr-2 text-blue-600" />
            Vehicle Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative z-30">
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                New/Used *
              </label>
              <Select
                value={vehicleData?.new_used}
                onChange={(value) => setVehicleData(prev => ({ ...prev, new_used: value }))}
                options={[
                  { value: 'new', label: 'New' },
                  { value: 'used', label: 'Used' }
                ]}
                error={errors?.new_used}
                className="relative z-30"
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Stock # *
              </label>
              <Input
                value={vehicleData?.stock_number}
                onChange={(e) => setVehicleData(prev => ({ ...prev, stock_number: e?.target?.value }))}
                placeholder="Stock number"
                error={errors?.stock_number}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Deal # *
              </label>
              <Input
                value={vehicleData?.deal_number}
                onChange={(e) => setVehicleData(prev => ({ ...prev, deal_number: e?.target?.value }))}
                placeholder="Deal number"
                error={errors?.deal_number}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Year *
              </label>
              <Input
                value={vehicleData?.year}
                onChange={(e) => setVehicleData(prev => ({ ...prev, year: e?.target?.value }))}
                type="number"
                min="1900"
                max={new Date()?.getFullYear() + 2}
                placeholder="2024"
                error={errors?.year}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={4}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Make *
              </label>
              <Input
                value={vehicleData?.make}
                onChange={(e) => setVehicleData(prev => ({ ...prev, make: e?.target?.value }))}
                placeholder="Ford, Toyota, etc."
                error={errors?.make}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Model *
              </label>
              <Input
                value={vehicleData?.model}
                onChange={(e) => setVehicleData(prev => ({ ...prev, model: e?.target?.value }))}
                placeholder="F-150, Camry, etc."
                error={errors?.model}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* Customer Information Section */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
          <h4 className={`${themeClasses?.text} text-lg font-bold mb-4 uppercase tracking-wide flex items-center`}>
            <Icon name="User" size={18} className="mr-2 text-blue-600" />
            Customer Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                First Name *
              </label>
              <Input
                value={customerData?.customer_first_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_first_name: e?.target?.value }))}
                placeholder="First name"
                error={errors?.customer_first_name}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Last Name *
              </label>
              <Input
                value={customerData?.customer_last_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_last_name: e?.target?.value }))}
                placeholder="Last name"
                error={errors?.customer_last_name}
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={50}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Phone Number
              </label>
              <Input
                value={customerData?.customer_phone}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_phone: e?.target?.value }))}
                placeholder="Customer phone"
                type="tel"
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={20}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Email
              </label>
              <Input
                value={customerData?.customer_email}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_email: e?.target?.value }))}
                placeholder="Customer email"
                type="email"
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={100}
                style={{}}
              />
            </div>

            <div className="md:col-span-2">
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Spouse
              </label>
              <Input
                value={customerData?.spouse_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, spouse_name: e?.target?.value }))}
                placeholder="Spouse name (optional)"
                className="text-base p-3"
                label=""
                helperText=""
                maxLength={100}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* REORDERED: Dealer Representatives Section - Delivery Coordinator First */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
          <h4 className={`${themeClasses?.text} text-lg font-bold mb-4 uppercase tracking-wide flex items-center`}>
            <Icon name="Users" size={18} className="mr-2 text-blue-600" />
            Dealer Representatives Involved
          </h4>
          
          {/* Debug info to show data availability */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs space-y-1">
              <p className="text-blue-700">
                <strong>Data Status:</strong> Sales: {salespeople?.length || 0} • Finance: {financeManagers?.length || 0} • Delivery: {deliveryCoordinators?.length || 0}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div style={{ position: 'relative', zIndex: 50 }}>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Delivery Coordinator *
              </label>
              <Select
                value={dealData?.delivery_coordinator_id}
                onChange={(value) => setDealData(prev => ({ ...prev, delivery_coordinator_id: value }))}
                options={[
                  { value: '', label: 'Select coordinator...' },
                  ...(deliveryCoordinators?.map(dc => ({
                    value: dc?.id,
                    label: dc?.full_name
                  })) || [])
                ]}
                placeholder="Select coordinator..."
                error={errors?.delivery_coordinator_id}
                style={{ position: 'relative', zIndex: 50 }}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 40 }}>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Sales Person
              </label>
              <Select
                value={dealData?.assigned_to || ''}
                onChange={(value) => setDealData(prev => ({ ...prev, assigned_to: value || null }))}
                options={[
                  { value: '', label: 'Select sales person...' },
                  ...(salespeople?.map(sp => ({
                    value: sp?.id,
                    label: sp?.full_name
                  })) || [])
                ]}
                placeholder="Select sales person..."
                style={{ position: 'relative', zIndex: 40 }}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 30 }}>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
                Finance Manager
              </label>
              <Select
                value={dealData?.finance_manager_id || ''}
                onChange={(value) => setDealData(prev => ({ ...prev, finance_manager_id: value || null }))}
                options={[
                  { value: '', label: 'Select finance manager...' },
                  ...(financeManagers?.map(fm => ({
                    value: fm?.id,
                    label: fm?.full_name
                  })) || [])
                ]}
                placeholder="Select finance manager..."
                style={{ position: 'relative', zIndex: 30 }}
              />
            </div>
          </div>
        </div>

        {/* UPDATED: Line Items Section with repositioned Add Item button */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md relative z-0`}>
          <div className="flex items-center justify-between mb-6">
            <h4 className={`${themeClasses?.text} text-lg font-bold uppercase tracking-wide flex items-center`}>
              <Icon name="ShoppingCart" size={18} className="mr-2 text-blue-600" />
              Line Items with Individual Settings ({lineItems?.length})
            </h4>
          </div>

          {errors?.lineItems && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
              <Icon name="AlertTriangle" size={16} className="inline mr-2" />
              {errors?.lineItems}
            </div>
          )}

          <div className="space-y-8">
            {lineItems?.map((item, index) => renderLineItem(item, index))}
            
            {/* REPOSITIONED: Add Item button after the last line item */}
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                onClick={addLineItem}
                size="lg"
                variant="outline"
                className="flex items-center bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 px-8 py-4 text-lg font-semibold"
              >
                <Icon name="Plus" size={18} className="mr-2" />
                + Add Item
              </Button>
            </div>
          </div>

          {/* Enhanced Total Display */}
          <div className="mt-8 pt-6 border-t-2 border-gray-300">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border-2 border-green-200">
              <div className="flex justify-between items-center mb-3">
                <span className={`${themeClasses?.text} text-xl font-bold`}>
                  Total Estimated Cost:
                </span>
                <span className="text-green-600 font-bold text-3xl">
                  ${totalAmount?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-base text-gray-700">
                <span className="flex items-center">
                  <Icon name="Package" size={16} className="mr-2" />
                  Line Items: {lineItems?.length}
                </span>
                <span className="flex items-center">
                  <Icon name="Car" size={16} className="mr-2" />
                  Requiring Loaner: {lineItems?.filter(item => item?.customer_needs_loaner)?.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Form Actions */}
        <div className="flex space-x-4 pt-6 border-t-2 border-gray-300">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="flex-1 py-4 text-lg"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="flex-1 py-4 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon name="Loader2" size={20} className="mr-3 animate-spin" />
                {mode === 'create' ? 'Creating Deal...' : 'Updating Deal...'}
              </>
            ) : (
              <>
                <Icon name={mode === 'create' ? 'Plus' : 'Save'} size={20} className="mr-3" />
                {mode === 'create' ? 'Create Deal' : 'Update Deal'}
              </>
            )}
          </Button>
        </div>

        {/* Enhanced Form-level errors */}
        {errors?.submit && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <Icon name="AlertTriangle" size={20} className="text-red-600" />
              <p className="text-red-800 text-base font-medium">{errors?.submit}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default DealForm;