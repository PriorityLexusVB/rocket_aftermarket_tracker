import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import { jobService } from '../../services/jobService';
import dealService from '../../services/dealService';

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

  // NEW: State for dropdown options loaded from dealService
  const [productOptions, setProductOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

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
  const [pendingFocusIndex, setPendingFocusIndex] = useState(null);
  // Draft job id for immediate line-item persistence
  const [draftJobId, setDraftJobId] = useState(initialData?.deal?.id || null);
  
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

  // CHANGE 2 & 3: New state for scheduling functionality
  const [schedulingEnabled, setSchedulingEnabled] = useState({});

  // NEW: Load dropdown options using dealService methods
  useEffect(() => {
    let mounted = true;
    
    async function loadLookups() {
      try {
        const [products, vendors, staff] = await Promise.all([
          dealService?.getProducts?.() ?? [],
          dealService?.getVendors?.() ?? [],
          dealService?.getStaffByDepartment?.('Aftermarket') ?? []
        ]);
        
        if (!mounted) return;
        
        setProductOptions(products || []);
        setVendorOptions(vendors || []);
        setStaffOptions(staff || []);
      } catch (error) {
        console.error('Error loading dropdown options:', error);
        // Fallback to props if dealService fails
        if (mounted) {
          setProductOptions(products || []);
          setVendorOptions(vendors || []);
          setStaffOptions(salespeople || []);
        }
      }
    }
    
    loadLookups();
    
    return () => { 
      mounted = false; 
    };
  }, [products, vendors, salespeople]);

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

  // CHANGE 2 & 3: Toggle scheduling for individual line items
  const toggleScheduling = useCallback((index, enabled) => {
    setSchedulingEnabled(prev => ({
      ...prev,
      [index]: enabled
    }));
    
    // Auto-set promise date when scheduling is enabled
    if (enabled && !lineItems?.[index]?.promised_date) {
      const tomorrow = new Date();
      tomorrow?.setDate(tomorrow?.getDate() + 1);
      updateLineItem(index, 'promised_date', tomorrow?.toISOString()?.slice(0, 10));
    }
  }, [lineItems, updateLineItem]);

  // Update handleProductSelect to use productOptions instead of products prop
  const handleProductSelect = useCallback(async (itemIndex, productId) => {
    const product = productOptions?.find(p => p?.id === productId);
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
  }, [productOptions]);

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
        
        if (item?.service_type === 'off_site' && !item?.vendor_id) {
          newErrors[`lineItem_${index}_vendor`] = 'Vendor is required for off-site service';
        }
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
      if (vehicleData?.owner_name) {
        const parts = String(vehicleData?.owner_name)?.trim()?.split(' ');
        if (parts?.length) {
          customerData.customer_first_name = parts?.[0];
          customerData.customer_last_name = parts?.slice(1)?.join(' ') || customerData?.customer_last_name;
        }
      }
      
      newErrors.customer_first_name = 'Customer first name is required';
    }
    if (!customerData?.customer_last_name?.trim()) {
      newErrors.customer_last_name = 'Customer last name is required';
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    if (Object.keys(newErrors)?.length) {
      setErrors(prev => ({ ...prev, submit: 'Please fix the highlighted fields above.' }));
      return false;
    }
    return true;
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
        lineItems: lineItems?.map(item => {
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


  // Local save for a single line item (validates fields and marks as saved locally).
  const saveLineItem = useCallback((index) => {
    const item = lineItems?.[index];
    const errs = {};
    if (!item?.product_id) errs[`lineItem_${index}_product`] = 'Product is required';
    if (!item?.unit_price || Number(item?.unit_price) <= 0) errs[`lineItem_${index}_price`] = 'Valid unit price is required';
    if (item?.cost == null || Number(item?.cost) < 0) errs[`lineItem_${index}_cost`] = 'Valid cost is required';
    if (item?.service_type === 'off_site' && !item?.vendor_id) errs[`lineItem_${index}_vendor`] = 'Vendor is required for off-site service';
    if (!item?.promised_date) errs[`lineItem_${index}_promised_date`] = 'Promise date is required';

    if (Object.keys(errs)?.length) {
      setErrors(prev => ({ ...prev, ...errs }));
      return;
    }
    // Mark saved locally; persistence happens on full form submit
    const updated = [...lineItems];
    updated[index] = { ...item, _saved: true, _savedAt: new Date()?.toISOString() };
    setLineItems(updated);
  }, [lineItems]);
  // Persist a single line item immediately. In create-mode, creates a draft parent job first.
  const persistLineItem = useCallback(async (index) => {
    const item = lineItems?.[index];
    const errs = {};
    if (!item?.product_id) errs[`lineItem_${index}_product`] = 'Product is required';
    if (!item?.unit_price || Number(item?.unit_price) <= 0) errs[`lineItem_${index}_price`] = 'Valid unit price is required';
    if (item?.cost == null || Number(item?.cost) < 0) errs[`lineItem_${index}_cost`] = 'Valid cost is required';
    if (item?.service_type === 'off_site' && !item?.vendor_id) errs[`lineItem_${index}_vendor`] = 'Vendor is required for off-site service';
    if (!item?.promised_date) errs[`lineItem_${index}_promised_date`] = 'Promise date is required';
    if (Object.keys(errs)?.length) { setErrors(prev => ({ ...prev, ...errs })); return; }

    let jobId = draftJobId || initialData?.deal?.id || dealData?.id || null;

    // If no job yet and we're creating, make a draft parent job now
    if (!jobId && mode === 'create') {
      const vehicleLabel = [vehicleData?.year, vehicleData?.make, vehicleData?.model]?.filter(Boolean)?.join(' ');
      const name = `${customerData?.customer_first_name || ''} ${customerData?.customer_last_name || ''}`?.trim();
      const parentPayload = {
        title: `Deal for ${name || vehicleLabel || 'Customer'}`,
        description: dealData?.description || 'Sales transaction',
        vehicle_id: dealData?.vehicle_id || null,
        vehicle_label: vehicleLabel || null,
        stock_number: vehicleData?.stock_number || null,
        promised_date: item?.promised_date || dealData?.promised_date || null,
        job_status: dealData?.job_status || 'pending',
        priority: dealData?.priority || 'medium',
        customer_needs_loaner: dealData?.customer_needs_loaner || false,
        location: dealData?.vendor_id ? 'Off-Site' : 'In-House',
        vendor_id: dealData?.vendor_id || null
      };
      const created = await jobService?.createJob(parentPayload);
      if (created?.error || !created?.data?.id) { 
        setErrors(prev => ({ ...prev, submit: created?.error?.message || 'Failed to create draft deal' })); 
        return; 
      }
      jobId = created?.data?.id;
      setDraftJobId(jobId);
    }

    if (!jobId) { setErrors(prev => ({ ...prev, submit: 'No deal ID to attach line item to.' })); return; }

    const up = await jobService?.upsertLineItem(jobId, {
      id: item?.id || null,
      product_id: item?.product_id,
      unit_price: parseFloat(item?.unit_price || 0),
      quantity: 1
    });

    if (up?.error) { setErrors(prev => ({ ...prev, submit: up?.error?.message || 'Failed to save line item' })); return; }

    const savedId = up?.data?.id || null;
    const updated = [...lineItems];
    updated[index] = { ...item, id: savedId || item?.id, _saved: true, _savedAt: new Date()?.toISOString() };
    setLineItems(updated);
    // After saving, if this was the last item, add a fresh one and focus it
    if (index === updated?.length - 1) {
      addLineItem();
      setPendingFocusIndex(updated?.length);
    } else {
      setPendingFocusIndex(index + 1);
    }
  }, [lineItems, draftJobId, mode, dealData, vehicleData, customerData, initialData]);

  useEffect(() => {
    if (pendingFocusIndex != null) {
      const el = document?.getElementById?.(`line-item-${pendingFocusIndex}`);
      if (el && el?.scrollIntoView) el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingFocusIndex(null);
    }
  }, [pendingFocusIndex]);

  
  // Delete a line item (and its calendar job if persisted)
  const deleteLineItemLocal = useCallback(async (index) => {
    try {
      const item = lineItems?.[index];
      if (item?.id) {
        await jobService?.deleteLineItem(item?.id);
        await jobService?.removeLineItemCalendarJob(item?.id);
      }
      const updated = [...lineItems?.slice(0, index), ...lineItems?.slice(index + 1)];
      setLineItems(updated);
      if (updated?.length === 0) {
        addLineItem(); // keep one empty row
      }
    } catch (e) {
      setWarnings(prev => ([...(prev || []), e?.message || 'Failed to delete line item']));
    }
  }, [lineItems]);

  // CHANGE 5: Enhanced line item rendering with improved "Need to Schedule" visibility
  const renderLineItem = useCallback((item, index) => (
    <div key={`${item?.id || 'new'}-${index}`} className="border-2 border-gray-300 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-white space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800 flex items-center">
          <Icon name="Package" size={16} className="mr-2 text-blue-600" />
          Item #{index + 1}{item?._saved ? ' (Saved)' : ''}
        </span>
        <div className="flex items-center space-x-3">
          {!item?._saved && (
            <Button
              type="button"
              onClick={() => persistLineItem(index)}
              size="sm"
              variant="primary"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              <Icon name="Save" size={16} className="mr-2" />
              Save
            </Button>
          )}
          {lineItems?.length > 1 && (
            <Button
              type="button"
              onClick={() => deleteLineItemLocal(index)}
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
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Product *
          </label>
          <Select
            value={item?.product_id}
            onChange={(value) => handleProductSelect(index, value)}
            options={productOptions?.map(p => ({
              value: p?.id,
              label: `${p?.name} (${p?.op_code || 'No Code'}) - ${p?.unit_price}`
            })) || []}
            placeholder="Select product..."
            error={errors?.[`lineItem_${index}_product`]}
            disabled={!!item?._saved}
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
              label=""
              helperText=""
              className="text-base p-3"
              maxLength={undefined}
              style={{}}
              disabled={!!item?._saved}
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
              label=""
              helperText=""
              className="text-base p-3"
              maxLength={undefined}
              style={{}}
              disabled={!!item?._saved}
            />
          </div>
        </div>
      </div>

      {/* ENHANCED Service Configuration per line item */}
      <div className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-sm">
        <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
          <Icon name="Settings" size={16} className="mr-2" />
          Service Configuration
        </h4>

        {/* CHANGE 6: PROMINENT "Need to Schedule" bar with enhanced styling */}
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

          {/* CHANGE 7: Enhanced promise date section with better visibility */}
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
                    placeholder=""
                    className="border-2 border-purple-400 focus:border-purple-600 focus:ring-purple-500 text-base p-3"
                    label=""
                    helperText=""
                    maxLength={undefined}
                    style={{}}
                    disabled={!!item?._saved}
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
          <div>
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
              disabled={!!item?._saved}
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Vendor {item?.service_type === 'vendor' && '*'}
            </label>
            <Select
              value={item?.vendor_id || ''}
              onChange={(value) => updateLineItem(index, 'vendor_id', value || null)}
              options={[
                { value: '', label: 'None' },
                ...(vendorOptions?.map(v => ({
                  value: v?.id,
                  label: v?.name
                })) || [])
              ]}
              disabled={item?.service_type !== 'vendor' || !!item?._saved}
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
              label=""
              helperText=""
              className="text-base p-3"
              maxLength={undefined}
              style={{}}
              disabled={!!item?._saved}
            />
          </div>
        </div>

        {/* Enhanced loaner checkbox - positioned below service configuration */}
        <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
          <div className="flex items-center space-x-4">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id={`customer_needs_loaner_${index}`}
                checked={item?.customer_needs_loaner || false}
                onChange={(e) => updateLineItem(index, 'customer_needs_loaner', e?.target?.checked)}
                className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                disabled={!!item?._saved}
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
  ), [lineItems?.length, removeLineItem, handleProductSelect, updateLineItem, productOptions, vendorOptions, errors, schedulingEnabled, toggleScheduling]);

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        
        {/* Header with mode indicator - ENHANCED VISIBILITY */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div>
            <h3 className={`${themeClasses?.text} text-2xl font-bold mb-2`}>
              {mode === 'create' ? 'Create New Deal' : 'Edit Deal'}
              <span className="text-green-600 text-sm ml-3 px-2 py-1 bg-green-100 rounded-full font-semibold">
                ✓ Enhanced Layout
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

        {/* CHANGE 1: NEW Vehicle Entry Section - Enhanced spacing and layout */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
          <h4 className={`${themeClasses?.text} text-lg font-bold mb-4 uppercase tracking-wide flex items-center`}>
            <Icon name="Car" size={18} className="mr-2 text-blue-600" />
            Vehicle Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* CHANGE 2: Customer Information Section - Enhanced spacing */}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
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
                label=""
                helperText=""
                className="text-base p-3"
                maxLength={undefined}
                style={{}}
              />
            </div>
          </div>
        </div>

        {/* CHANGE 3: Dealer Representatives Section - Enhanced spacing */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
          <h4 className={`${themeClasses?.text} text-lg font-bold mb-4 uppercase tracking-wide flex items-center`}>
            <Icon name="Users" size={18} className="mr-2 text-blue-600" />
            Dealer Representatives Involved
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
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
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
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
              <label className={`${themeClasses?.text} block text-base font-semibold mb-2`}>
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

        {/* CHANGE 4: Enhanced Line Items Section with improved layout */}
        <div className={`${themeClasses?.card} p-6 rounded-xl border-2 shadow-md`}>
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
            {lineItems?.map((item, index) => (
              <div key={`item-container-${index}`} id={`line-item-${index}`}>
                {renderLineItem(item, index)}
              </div>
            ))}
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                onClick={addLineItem}
                size="lg"
                variant="outline"
                className="flex items-center bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 px-6 py-3"
              >
                <Icon name="Plus" size={16} className="mr-2" />
                Add Item
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