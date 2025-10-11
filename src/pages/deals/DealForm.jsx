// PHASE 3: Line Item Management & Scheduling
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

  // CHANGE 1: Enhanced vehicle data state with separate fields for NEW vehicle entry
  const [vehicleData, setVehicleData] = useState({
    new_used: 'new', // New/Used selector
    stock_number: '', // Stock # field
    deal_number: '', // Deal # field  
    year: '',
    make: '',
    model: '',
    vin: '',
    color: '',
    mileage: ''
  });

  // Form state management with schema-accurate field mapping - REMOVED title field
  const [dealData, setDealData] = useState({
    description: '',
    vehicle_id: null, // Will be created/updated based on vehicleData
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

  // PHASE 3: Enhanced line items state with individual scheduling fields
  const [lineItems, setLineItems] = useState([]);
  
  // CHANGE 2: Enhanced customer data with first/last name and spouse
  const [customerData, setCustomerData] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    customer_email: '',
    spouse_name: '' // New spouse field
  });

  // PHASE 3: Enhanced form state with scheduling validation
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});

  // Initialize form data for edit mode - Optimized with useEffect dependencies
  useEffect(() => {
    if (mode === 'edit' && initialData?.deal) {
      const { deal, items = [] } = initialData;
      
      // CHANGE 1: Map vehicle data from deal's vehicle
      if (deal?.vehicles) {
        const vehicle = deal?.vehicles;
        setVehicleData(prev => ({
          ...prev,
          new_used: 'used', // Default, could be enhanced
          stock_number: vehicle?.stock_number || '',
          deal_number: deal?.job_number || '', // Use job_number as deal number
          year: vehicle?.year?.toString() || '',
          make: vehicle?.make || '',
          model: vehicle?.model || '',
          vin: vehicle?.vin || '',
          color: vehicle?.color || '',
          mileage: vehicle?.mileage?.toString() || ''
        }));
      }
      
      // Map deal data exactly from database structure - REMOVED title
      setDealData(prev => ({
        ...prev,
        description: deal?.description || '',
        vehicle_id: deal?.vehicle_id || '',
        vendor_id: deal?.vendor_id,
        created_by: deal?.created_by || user?.id,
        delivery_coordinator_id: deal?.delivery_coordinator_id || '',
        assigned_to: deal?.assigned_to, // Sales consultant
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

      // CHANGE 4: Enhanced line items mapping with individual service settings
      const mappedItems = items?.map(item => ({
        id: item?.id, // Existing item ID for updates
        product_id: item?.product_id || item?.products?.id,
        name: item?.products?.name || item?.name,
        op_code: item?.products?.op_code,
        unit_price: parseFloat(item?.unit_price || item?.products?.unit_price || 0),
        cost: parseFloat(item?.products?.cost || 0), // Add cost field
        // REMOVED: quantity_used field as requested
        category: item?.products?.category,
        brand: item?.products?.brand,
        description: item?.products?.description,
        // CHANGE 4: Individual service settings per line item
        service_type: item?.service_type || 'in_house',
        vendor_id: item?.vendor_id || null,
        promised_date: item?.promised_date ? item?.promised_date?.split('T')?.[0] : '',
        customer_needs_loaner: item?.customer_needs_loaner || false,
        notes: item?.notes || ''
      }));
      setLineItems(mappedItems || []);

      // CHANGE 2: Extract customer data with first/last name
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
          spouse_name: txn?.spouse_name || '' // If available
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
      // CHANGE 4: Enhanced create mode defaults with individual line item settings
      const today = new Date();

      setLineItems([{
        id: null, // New item
        product_id: '',
        name: '',
        unit_price: 0,
        cost: 0, // Add cost field - NO quantity
        category: '',
        brand: '',
        description: '',
        // Individual service settings per line item  
        service_type: 'in_house',
        vendor_id: null,
        promised_date: today?.toISOString()?.slice(0, 10),
        customer_needs_loaner: false,
        notes: ''
      }]);
    }
  }, [mode, initialData?.deal?.id, user?.id]); // Optimized dependencies

  // Load vehicle details when selected - Debounced
  useEffect(() => {
    if (dealData?.vehicle_id) {
      const vehicle = vehicles?.find(v => v?.id === dealData?.vehicle_id);
      
      // Auto-populate customer data from vehicle owner
      if (vehicle && !customerData?.customer_first_name) {
        const timer = setTimeout(() => {
          setCustomerData(prev => ({
            ...prev,
            customer_first_name: vehicle?.owner_name?.split(' ')?.[0] || '',
            customer_last_name: vehicle?.owner_name?.split(' ')?.slice(1)?.join(' ') || '',
            customer_phone: vehicle?.owner_phone || '',
            customer_email: vehicle?.owner_email || ''
          }));
        }, 100); // Small debounce to prevent rapid updates

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
    }, 100); // Debounce to prevent rapid updates

    return () => clearTimeout(timer);
  }, [dealData?.vendor_id, vendors]);

  // CHANGE 4: Enhanced line item management with individual service settings - Optimized callbacks
  const addLineItem = useCallback(() => {
    const today = new Date();

    const newItem = {
      id: null, // New item
      product_id: '',
      name: '',
      unit_price: 0,
      cost: 0, // Add cost field - NO quantity
      category: '',
      brand: '',
      description: '',
      // Individual service settings per line item  
      service_type: 'in_house',
      vendor_id: null,
      promised_date: today?.toISOString()?.slice(0, 10),
      customer_needs_loaner: false,
      notes: ''
    };
    setLineItems(prev => [...prev, newItem]);
  }, []);

  // Remove line item - Optimized callback
  const removeLineItem = useCallback((index) => {
    setLineItems(prev => prev?.filter((_, i) => i !== index));
  }, []);

  // CHANGE 4: Enhanced line item update with individual service settings - Optimized callback
  const updateLineItem = useCallback((index, field, value) => {
    setLineItems(prev => prev?.map((item, i) => {
      if (i !== index) return item;
      
      const updatedItem = { ...item, [field]: value };
      
      // Auto-update when service_type changes
      if (field === 'service_type') {
        if (value === 'vendor') {
          updatedItem.customer_needs_loaner = true; // Suggest loaner for vendor work
        } else {
          updatedItem.vendor_id = null;
        }
      }
      
      return updatedItem;
    }));
    
    // Clear field-specific errors when user fixes them
    setErrors(prev => {
      const newErrors = { ...prev };
      const errorKey = `lineItem_${index}_${field}`;
      if (newErrors?.[errorKey]) {
        delete newErrors?.[errorKey];
      }
      return newErrors;
    });
  }, []);

  // Load product details when selected - Optimized callback
  const handleProductSelect = useCallback(async (itemIndex, productId) => {
    const product = products?.find(p => p?.id === productId);
    if (product) {
      // Batch all updates to prevent multiple re-renders
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

  // CHANGE 1,2: Updated form validation for new structure
  const validateForm = () => {
    const newErrors = {};
    const newWarnings = {};

    // CHANGE 1: Vehicle validation for NEW entry
    if (!vehicleData?.new_used) newErrors.new_used = 'New/Used selection is required';
    if (!vehicleData?.stock_number?.trim()) newErrors.stock_number = 'Stock # is required';
    if (!vehicleData?.deal_number?.trim()) newErrors.deal_number = 'Deal # is required';
    if (!vehicleData?.year) newErrors.year = 'Year is required';
    if (!vehicleData?.make?.trim()) newErrors.make = 'Make is required';
    if (!vehicleData?.model?.trim()) newErrors.model = 'Model is required';
    
    // Required dealer representatives - UPDATED field names
    if (!dealData?.delivery_coordinator_id) newErrors.delivery_coordinator_id = 'Delivery coordinator is required';
    if (!dealData?.assigned_to) newErrors.assigned_to = 'Sales consultant is required';
    if (!dealData?.finance_manager_id) newErrors.finance_manager_id = 'Finance manager is required';
    
    // Line items validation
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

    // CHANGE 2: Customer validation with first/last name
    if (!customerData?.customer_first_name?.trim()) {
      newErrors.customer_first_name = 'Customer first name is required';
    }
    if (!customerData?.customer_last_name?.trim()) {
      newErrors.customer_last_name = 'Customer last name is required';
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    return Object.keys(newErrors)?.length === 0;
  };

  // Calculate totals - NO quantity multiplication - Memoized for performance
  const totalAmount = useMemo(() => {
    return lineItems?.reduce((sum, item) => 
      sum + parseFloat(item?.unit_price || 0), 0
    );
  }, [lineItems]);

  // CHANGE 4: Updated form submission with individual line item settings
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Get today's date for automatic start time
      const today = new Date();
      const startTime = today?.toISOString();

      // CHANGE 1,2,4: Enhanced payload with new structure
      const payload = {
        // Vehicle data (create/update vehicle record)
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
          // NO title field - removed as requested
        },
        items: lineItems?.map(item => {
          // Calculate automatic end time based on promise date
          const promiseDate = item?.promised_date ? new Date(item?.promised_date) : new Date();
          const endTime = promiseDate?.toISOString();

          return {
            id: item?.id, // For updates, null for new items
            product_id: item?.product_id,
            unit_price: parseFloat(item?.unit_price || 0),
            // Individual service settings
            service_type: item?.service_type,
            vendor_id: item?.vendor_id || null,
            promised_date: item?.promised_date || null,
            customer_needs_loaner: item?.customer_needs_loaner || false,
            notes: item?.notes || null,
            // Automatic start/end times
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

  // PHASE 3: Simplified line item rendering - Optimized with useCallback
  const renderLineItem = useCallback((item, index) => (
    <div key={`${item?.id || 'new'}-${index}`} className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          Item #{index + 1}
        </span>
        <div className="flex items-center space-x-2">
          {lineItems?.length > 1 && (
            <Button
              type="button"
              onClick={() => removeLineItem(index)}
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
            >
              <Icon name="Trash2" size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Product Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              label=""
              helperText=""
              maxLength={undefined}
              style={{}}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              label=""
              helperText=""
              maxLength={undefined}
              style={{}}
            />
          </div>
        </div>
      </div>

      {/* Simplified service configuration per line item */}
      <div className="bg-white border border-blue-200 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
          <Icon name="Settings" size={14} className="mr-2" />
          Service Configuration
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Type *
            </label>
            <Select
              value={item?.service_type}
              onChange={(value) => updateLineItem(index, 'service_type', value)}
              options={[
                { value: 'in_house', label: 'Done in house' },
                { value: 'vendor', label: 'Sent offsite' }
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promise Date (Auto End Date)
            </label>
            <Input
              value={item?.promised_date}
              onChange={(e) => updateLineItem(index, 'promised_date', e?.target?.value)}
              type="date"
              placeholder=""
              label=""
              helperText=""
              maxLength={undefined}
              style={{}}
            />
          </div>
        </div>

        {/* Simplified loaner checkbox - no return tracking */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id={`customer_needs_loaner_${index}`}
                checked={item?.customer_needs_loaner || false}
                onChange={(e) => updateLineItem(index, 'customer_needs_loaner', e?.target?.checked)}
                className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              {/* Enhanced visibility when checked */}
              {item?.customer_needs_loaner && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-green-100 rounded">
                  <Icon name="Check" size={12} className="text-blue-600" />
                </div>
              )}
            </div>
            <label htmlFor={`customer_needs_loaner_${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
              Customer needs loaner
              {item?.customer_needs_loaner && (
                <span className="text-green-600 ml-2 font-semibold">✓ Enabled</span>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  ), [lineItems?.length, removeLineItem, handleProductSelect, updateLineItem, products, vendors, errors]);

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        
        {/* Header with mode indicator */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`${themeClasses?.text} text-lg font-semibold`}>
              {mode === 'create' ? 'Create New Deal' : 'Edit Deal'}
              <span className="text-green-600 text-sm ml-2">ResizeObserver Fixed</span>
            </h3>
            <p className={`${themeClasses?.textSecondary} text-sm`}>
              Vehicle entry, customer info, dealer reps, and simplified line items
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Icon name="DollarSign" size={16} className="text-green-600" />
            <span className="text-green-600 font-bold text-lg">
              ${totalAmount?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* CHANGE 1: NEW Vehicle Entry Section - No searching, just entry */}
        <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
          <h4 className={`${themeClasses?.text} text-sm font-semibold mb-3 uppercase tracking-wide`}>
            Vehicle Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
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
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Stock # *
              </label>
              <Input
                value={vehicleData?.stock_number}
                onChange={(e) => setVehicleData(prev => ({ ...prev, stock_number: e?.target?.value }))}
                placeholder="Stock number"
                error={errors?.stock_number}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Deal # *
              </label>
              <Input
                value={vehicleData?.deal_number}
                onChange={(e) => setVehicleData(prev => ({ ...prev, deal_number: e?.target?.value }))}
                placeholder="Deal number"
                error={errors?.deal_number}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
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
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Make *
              </label>
              <Input
                value={vehicleData?.make}
                onChange={(e) => setVehicleData(prev => ({ ...prev, make: e?.target?.value }))}
                placeholder="Ford, Toyota, etc."
                error={errors?.make}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Model *
              </label>
              <Input
                value={vehicleData?.model}
                onChange={(e) => setVehicleData(prev => ({ ...prev, model: e?.target?.value }))}
                placeholder="F-150, Camry, etc."
                error={errors?.model}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* CHANGE 2: Customer Information Section - First/Last name, spouse */}
        <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
          <h4 className={`${themeClasses?.text} text-sm font-semibold mb-3 uppercase tracking-wide`}>
            Customer Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                First Name *
              </label>
              <Input
                value={customerData?.customer_first_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_first_name: e?.target?.value }))}
                placeholder="First name"
                error={errors?.customer_first_name}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Last Name *
              </label>
              <Input
                value={customerData?.customer_last_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_last_name: e?.target?.value }))}
                placeholder="Last name"
                error={errors?.customer_last_name}
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Phone Number
              </label>
              <Input
                value={customerData?.customer_phone}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_phone: e?.target?.value }))}
                placeholder="Customer phone"
                type="tel"
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Email
              </label>
              <Input
                value={customerData?.customer_email}
                onChange={(e) => setCustomerData(prev => ({ ...prev, customer_email: e?.target?.value }))}
                placeholder="Customer email"
                type="email"
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>

            <div className="md:col-span-2">
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Spouse
              </label>
              <Input
                value={customerData?.spouse_name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, spouse_name: e?.target?.value }))}
                placeholder="Spouse name (optional)"
                label=""
                helperText=""
                maxLength={undefined}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* CHANGE 3: Dealer Representatives Section */}
        <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
          <h4 className={`${themeClasses?.text} text-sm font-semibold mb-3 uppercase tracking-wide`}>
            Dealer Representatives Involved
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Delivery Coordinator *
              </label>
              <Select
                value={dealData?.delivery_coordinator_id}
                onChange={(value) => setDealData(prev => ({ ...prev, delivery_coordinator_id: value }))}
                options={deliveryCoordinators?.map(dc => ({
                  value: dc?.id,
                  label: dc?.full_name
                })) || []}
                placeholder="Select coordinator..."
                error={errors?.delivery_coordinator_id}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Sales Consultant *
              </label>
              <Select
                value={dealData?.assigned_to}
                onChange={(value) => setDealData(prev => ({ ...prev, assigned_to: value }))}
                options={salespeople?.map(sp => ({
                  value: sp?.id,
                  label: sp?.full_name
                })) || []}
                placeholder="Select sales consultant..."
                error={errors?.assigned_to}
              />
            </div>

            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-1`}>
                Finance Manager *
              </label>
              <Select
                value={dealData?.finance_manager_id}
                onChange={(value) => setDealData(prev => ({ ...prev, finance_manager_id: value }))}
                options={financeManagers?.map(fm => ({
                  value: fm?.id,
                  label: fm?.full_name
                })) || []}
                placeholder="Select finance manager..."
                error={errors?.finance_manager_id}
              />
            </div>
          </div>
        </div>

        {/* CHANGE 4: Line Items Section - Service type, vendor, promise date per item */}
        <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`${themeClasses?.text} text-sm font-semibold uppercase tracking-wide`}>
              Line Items with Individual Settings ({lineItems?.length})
            </h4>
            <Button
              type="button"
              onClick={addLineItem}
              size="sm"
              variant="ghost"
              className="flex items-center"
            >
              <Icon name="Plus" size={14} className="mr-1" />
              Add Item
            </Button>
          </div>

          {errors?.lineItems && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {errors?.lineItems}
            </div>
          )}

          <div className="space-y-6">
            {lineItems?.map((item, index) => renderLineItem(item, index))}
          </div>

          {/* Total Display */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className={`${themeClasses?.text} font-semibold`}>
                Total Estimated Cost:
              </span>
              <span className="text-green-600 font-bold text-xl">
                ${totalAmount?.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1 text-sm text-gray-600">
              <span>Line Items: {lineItems?.length}</span>
              <span>Requiring Loaner: {lineItems?.filter(item => item?.customer_needs_loaner)?.length}</span>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex space-x-3 pt-4 border-t">
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              <>
                <Icon name={mode === 'create' ? 'Plus' : 'Save'} size={16} className="mr-2" />
                {mode === 'create' ? 'Create Deal' : 'Update Deal'}
              </>
            )}
          </Button>
        </div>

        {/* Form-level errors */}
        {errors?.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Icon name="AlertTriangle" size={16} className="text-red-600" />
              <p className="text-red-800 text-sm">{errors?.submit}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default DealForm;