// src/pages/deals/components/DealForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  getDeliveryCoordinators, 
  getSalesConsultants, 
  getFinanceManagers, 
  getProducts, 
  getVendors 
} from '../../services/dropdownService';

const Field = ({ label, children, id, required = false, error }) => {
  const fieldId = id || `field-${Math.random()?.toString(36)?.substr(2, 9)}`;
  
  return (
    <div className="block">
      <label htmlFor={fieldId} className="block text-xs font-medium text-gray-600 mb-1 cursor-pointer select-none">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="h-11 min-h-[44px]">
        {React.cloneElement(children, { id: fieldId, className: `${children?.props?.className} ${error ? 'border-red-300' : ''}` })}
      </div>
      {error && (
        <div className="text-xs text-red-600 mt-1" role="alert" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
};

export default function DealForm({ mode='create', initialData=null, onSubmit, onCancel, saving=false }) {
  const { themeClasses } = useTheme();
  
  // Form state management with customer_name added to match schema
  const [form, setForm] = useState(() => initialData || {
    title: '',
    description: '',
    vendor_id: null,
    vehicle_id: null,
    job_status: 'pending',  // Updated to match schema enum default
    priority: 'medium',     // Updated to match schema enum default
    scheduled_start_time: '',
    scheduled_end_time: '',
    estimated_hours: '',
    estimated_cost: '',
    actual_cost: '',
    location: '',
    assigned_to: null,
    delivery_coordinator_id: null,
    finance_manager_id: null,
    customer_needs_loaner: false,
    customer_name: '',      // Added to match jobs table requirement
    lineItems: [{ 
      id: `new-${Date.now()}`,
      product_id: null,     // Updated to match job_parts table
      quantity_used: 1,     // Updated to match job_parts table
      unit_price: 0,        // Updated to match job_parts table
      notes: '',
      isOffSite: false,
      requiresScheduling: true,
      lineItemPromisedDate: '',
      noScheduleReason: '',
      description: ''
    }],
    loanerForm: {
      loaner_number: '',
      eta_return_date: '',
      notes: ''
    }
  });

  // Enhanced dropdown state with better error handling
  const [dropdownData, setDropdownData] = useState({
    vendors: [],
    products: [], 
    salesConsultants: [],
    deliveryCoordinators: [],
    financeManagers: []
  });
  
  const [loading, setLoading] = useState({
    vendors: false,
    products: false,
    salesConsultants: false,
    deliveryCoordinators: false,
    financeManagers: false
  });
  
  const [errors, setErrors] = useState({});

  // Enhanced dropdown data loading with comprehensive error handling
  useEffect(() => {
    const loadAllDropdownData = async () => {
      setLoading({
        vendors: true,
        products: true,
        salesConsultants: true,
        deliveryCoordinators: true,
        financeManagers: true
      });

      try {
        // Load all dropdown data in parallel with individual error handling
        const results = await Promise.allSettled([
          getVendors(),
          getProducts(),
          getSalesConsultants(),
          getDeliveryCoordinators(),
          getFinanceManagers()
        ]);

        const [vendorsResult, productsResult, salesResult, deliveryResult, financeResult] = results;

        // Process results with fallbacks for failed requests
        const newDropdownData = {
          vendors: vendorsResult?.status === 'fulfilled' ? (vendorsResult?.value || []) : [],
          products: productsResult?.status === 'fulfilled' ? (productsResult?.value || []) : [],
          salesConsultants: salesResult?.status === 'fulfilled' ? (salesResult?.value || []) : [],
          deliveryCoordinators: deliveryResult?.status === 'fulfilled' ? (deliveryResult?.value || []) : [],
          financeManagers: financeResult?.status === 'fulfilled' ? (financeResult?.value || []) : []
        };

        const newErrors = {};

        // Track any failures for user feedback
        if (vendorsResult?.status === 'rejected') {
          newErrors.vendors = 'Failed to load vendors';
          console.log('Failed to load vendors:', vendorsResult?.reason);
        }
        if (productsResult?.status === 'rejected') {
          newErrors.products = 'Failed to load products';
          console.log('Failed to load products:', productsResult?.reason);
        }
        if (salesResult?.status === 'rejected') {
          newErrors.salesConsultants = 'Failed to load sales consultants';
          console.log('Failed to load sales consultants:', salesResult?.reason);
        }
        if (deliveryResult?.status === 'rejected') {
          newErrors.deliveryCoordinators = 'Failed to load delivery coordinators';
          console.log('Failed to load delivery coordinators:', deliveryResult?.reason);
        }
        if (financeResult?.status === 'rejected') {
          newErrors.financeManagers = 'Failed to load finance managers';
          console.log('Failed to load finance managers:', financeResult?.reason);
        }

        setDropdownData(newDropdownData);
        setErrors(newErrors);

      } catch (error) {
        console.log('Unexpected error loading dropdown data:', error);
        setErrors({
          global: 'Failed to load form data. Please refresh the page.'
        });
      } finally {
        setLoading({
          vendors: false,
          products: false,
          salesConsultants: false,
          deliveryCoordinators: false,
          financeManagers: false
        });
      }
    };

    loadAllDropdownData();
  }, []);

  // Enhanced loaner data loading that matches database schema
  useEffect(() => {
    if (initialData?.id && initialData?.customer_needs_loaner) {
      const loadExistingLoanerData = async () => {
        try {
          const { supabase } = await import('../../lib/supabase');
          
          // Query loaner_assignments table for existing assignment
          const { data: loanerAssignment, error } = await supabase
            ?.from('loaner_assignments')
            ?.select('loaner_number, eta_return_date, notes')
            ?.eq('job_id', initialData?.id)
            ?.is('returned_at', null)  // Only get active assignments
            ?.single();

          if (error && error?.code !== 'PGRST116') {
            console.log('Error loading loaner assignment:', error);
            return;
          }

          if (loanerAssignment) {
            setForm(prev => ({
              ...prev,
              ...initialData,
              loanerForm: {
                loaner_number: loanerAssignment?.loaner_number || '',
                eta_return_date: loanerAssignment?.eta_return_date || '',
                notes: loanerAssignment?.notes || ''
              }
            }));
          } else {
            // No existing assignment, set up empty form
            setForm(prev => ({ 
              ...prev, 
              ...initialData,
              loanerForm: {
                loaner_number: '',
                eta_return_date: '',
                notes: ''
              }
            }));
          }
        } catch (error) {
          console.log('Failed to load loaner data:', error);
          // Continue with empty loaner form
          setForm(prev => ({ 
            ...prev, 
            ...initialData,
            loanerForm: {
              loaner_number: '',
              eta_return_date: '',
              notes: ''
            }
          }));
        }
      };

      loadExistingLoanerData();
    } else if (initialData) {
      // No loaner needed or new form, just set initial data
      setForm(prev => ({ 
        ...prev, 
        ...initialData,
        loanerForm: prev?.loanerForm || {
          loaner_number: '',
          eta_return_date: '',
          notes: ''
        }
      }));
    }
  }, [initialData]);

  // Enhanced form validation that matches database constraints
  const isFormValid = useMemo(() => {
    // Required field: title (NOT NULL in jobs table)
    if (!form?.title?.trim()) return false;
    
    // Conditional validation: loaner requirements
    if (form?.customer_needs_loaner && !form?.loanerForm?.loaner_number?.trim()) {
      return false;
    }
    
    return true;
  }, [form?.title, form?.customer_needs_loaner, form?.loanerForm?.loaner_number]);

  // Form update functions
  const update = (patch) => setForm(prev => ({ ...prev, ...patch }));
  
  const updateLoaner = (patch) => setForm(prev => ({
    ...prev,
    loanerForm: { ...prev?.loanerForm, ...patch }
  }));
  
  const updateItem = (idx, patch) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev?.lineItems?.map((it, i) => 
        i === idx ? { ...it, ...patch } : it
      )
    }));
  };

  const addItem = () => {
    const newId = `new-${Date.now()}-${Math.random()?.toString(36)?.substr(2, 9)}`;
    setForm(prev => ({ 
      ...prev, 
      lineItems: [...prev?.lineItems, { 
        id: newId,
        part_name: '', 
        sku: '', 
        quantity_used: 1, 
        unit_price: 0, 
        notes: '',
        isOffSite: false,
        requiresScheduling: true,
        lineItemPromisedDate: '',
        noScheduleReason: '',
        description: ''
      }] 
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({ 
      ...prev, 
      lineItems: prev?.lineItems?.filter((_, i) => i !== idx) 
    }));
  };

  const total = useMemo(() => {
    return (form?.lineItems || [])?.reduce((sum, it) => {
      const q = Number(it?.quantity_used || 0);
      const p = Number(it?.unit_price || 0);
      return sum + (q*p);
    }, 0)?.toFixed(2);
  }, [form?.lineItems]);

  const submit = (e) => {
    e?.preventDefault();
    onSubmit?.(form);
  };

  // Render loading states for dropdowns
  const renderDropdownOptions = (items, loadingKey, errorKey, defaultText, renderOption) => {
    if (loading?.[loadingKey]) {
      return <option value="">Loading...</option>;
    }
    
    if (errors?.[errorKey]) {
      return <option value="">Error loading data</option>;
    }

    if (!items || !Array.isArray(items) || items?.length === 0) {
      return <option value="">No data available</option>;
    }

    return (
      <>
        <option value="">{defaultText}</option>
        {items?.map(renderOption)}
      </>
    );
  };

  return (
    <form onSubmit={(e) => { e?.preventDefault(); onSubmit?.(form); }} className="space-y-6 pb-20">
      {/* Global error display */}
      {errors?.global && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {errors?.global}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title - Required field matching jobs.title */}
        <Field label="Title" required id="title-field" error="">
          <input 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.title || ''} 
            onChange={e => setForm(prev => ({ ...prev, title: e?.target?.value }))} 
            placeholder="Enter deal title"
            required
          />
        </Field>

        {/* Customer Name - Maps to job description or customer context */}
        <Field label="Customer Name" id="customer-name-field" error="">
          <input 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.customer_name || ''} 
            onChange={e => setForm(prev => ({ ...prev, customer_name: e?.target?.value }))} 
            placeholder="Enter customer name"
          />
        </Field>

        {/* Salesperson - Maps to jobs.assigned_to */}
        <Field label="Salesperson" id="salesperson-field" error="">
          <select 
            data-testid="salesperson-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.assigned_to || ''} 
            onChange={e => setForm(prev => ({ 
              ...prev, 
              assigned_to: e?.target?.value ? e?.target?.value : null 
            }))}
          >
            {renderDropdownOptions(
              dropdownData?.salesConsultants,
              'salesConsultants',
              'salesConsultants',
              'Select salesperson',
              (sc) => <option key={sc?.id} value={sc?.id}>{sc?.full_name}</option>
            )}
          </select>
          {errors?.salesConsultants && (
            <div className="text-xs text-red-600 mt-1">{errors?.salesConsultants}</div>
          )}
        </Field>

        {/* Finance Manager - Maps to jobs.finance_manager_id */}
        <Field label="Finance Manager" id="finance-manager-field" error="">
          <select 
            data-testid="finance-manager-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.finance_manager_id || ''} 
            onChange={e => setForm(prev => ({ 
              ...prev, 
              finance_manager_id: e?.target?.value ? e?.target?.value : null 
            }))}
          >
            {renderDropdownOptions(
              dropdownData?.financeManagers,
              'financeManagers',
              'financeManagers',
              'Select finance manager',
              (fm) => <option key={fm?.id} value={fm?.id}>{fm?.full_name}</option>
            )}
          </select>
          {errors?.financeManagers && (
            <div className="text-xs text-red-600 mt-1">{errors?.financeManagers}</div>
          )}
        </Field>

        {/* Delivery Coordinator - Maps to jobs.delivery_coordinator_id */}
        <Field label="Delivery Coordinator" id="delivery-coordinator-field" error="">
          <select 
            data-testid="delivery-coordinator-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.delivery_coordinator_id || ''} 
            onChange={e => setForm(prev => ({ 
              ...prev, 
              delivery_coordinator_id: e?.target?.value ? e?.target?.value : null 
            }))}
          >
            {renderDropdownOptions(
              dropdownData?.deliveryCoordinators,
              'deliveryCoordinators',
              'deliveryCoordinators',
              'Select delivery coordinator',
              (dc) => <option key={dc?.id} value={dc?.id}>{dc?.full_name}</option>
            )}
          </select>
          {errors?.deliveryCoordinators && (
            <div className="text-xs text-red-600 mt-1">{errors?.deliveryCoordinators}</div>
          )}
        </Field>

        {/* Vendor - Maps to jobs.vendor_id */}
        <Field label="Vendor" id="vendor-field" error="">
          <select 
            data-testid="vendor-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.vendor_id || ''} 
            onChange={e => setForm(prev => ({ 
              ...prev, 
              vendor_id: e?.target?.value ? e?.target?.value : null 
            }))}
          >
            {renderDropdownOptions(
              dropdownData?.vendors,
              'vendors',
              'vendors',
              'Select vendor',
              (v) => <option key={v?.id} value={v?.id}>{v?.name}</option>
            )}
          </select>
          {errors?.vendors && (
            <div className="text-xs text-red-600 mt-1">{errors?.vendors}</div>
          )}
        </Field>

        {/* Status - Maps to jobs.job_status enum */}
        <Field label="Status" id="status-field" error="">
          <select 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.job_status || 'pending'} 
            onChange={e => setForm(prev => ({ ...prev, job_status: e?.target?.value }))}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="scheduled">Scheduled</option>
            <option value="quality_check">Quality Check</option>
            <option value="delivered">Delivered</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
        
        {/* Priority - Maps to jobs.priority enum */}
        <Field label="Priority" id="priority-field" error="">
          <select 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.priority || 'medium'} 
            onChange={e => setForm(prev => ({ ...prev, priority: e?.target?.value }))}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        
        {/* Scheduling Fields - Map to jobs table columns */}
        <Field label="Start time" id="start-time-field" error="">
          <input 
            type="datetime-local" 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.scheduled_start_time || ''} 
            onChange={e => setForm(prev => ({ ...prev, scheduled_start_time: e?.target?.value }))} 
          />
        </Field>
        
        <Field label="End time" id="end-time-field" error="">
          <input 
            type="datetime-local" 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.scheduled_end_time || ''} 
            onChange={e => setForm(prev => ({ ...prev, scheduled_end_time: e?.target?.value }))} 
          />
        </Field>
        
        <Field label="Estimated hours" id="estimated-hours-field" error="">
          <input 
            type="number" 
            step="0.1" 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.estimated_hours || ''} 
            onChange={e => setForm(prev => ({ ...prev, estimated_hours: e?.target?.value }))} 
          />
        </Field>
        
        <Field label="Location" id="location-field" error="">
          <input 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.location || ''} 
            onChange={e => setForm(prev => ({ ...prev, location: e?.target?.value }))} 
          />
        </Field>
        
        {/* Description - Maps to jobs.description */}
        <div className="md:col-span-2">
          <Field label="Description" id="description-field" error="">
            <textarea 
              rows={4} 
              className="w-full border rounded px-3 py-2" 
              value={form?.description || ''} 
              onChange={e => setForm(prev => ({ ...prev, description: e?.target?.value }))} 
              placeholder="Enter deal description"
            />
          </Field>
        </div>

        {/* Customer Loaner Requirements - Maps to jobs.customer_needs_loaner and loaner_assignments table */}
        <div className="md:col-span-2">
          <Field label="Customer Requirements" id="customer-requirements-field" error="">
            <div className="space-y-4">
              <label className="inline-flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form?.customer_needs_loaner}
                  onChange={(e) => setForm(prev => ({ 
                    ...prev, 
                    customer_needs_loaner: e?.target?.checked 
                  }))}
                  className="h-5 w-5"
                />
                <span className="text-sm">Customer needs loaner vehicle</span>
              </label>
              
              {form?.customer_needs_loaner && (
                <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-4 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800">Loaner Assignment Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Loaner Number - Maps to loaner_assignments.loaner_number */}
                    <Field label="Loaner Number" required id="loaner-number-field" error="">
                      <input
                        className="w-full border rounded px-3 py-2 h-11"
                        value={form?.loanerForm?.loaner_number || ''}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          loanerForm: { ...prev?.loanerForm, loaner_number: e?.target?.value }
                        }))}
                        placeholder="e.g., LOANER-001"
                        required={form?.customer_needs_loaner}
                      />
                    </Field>
                    
                    {/* ETA Return Date - Maps to loaner_assignments.eta_return_date */}
                    <Field label="ETA Return Date" id="eta-return-date-field" error="">
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2 h-11"
                        value={form?.loanerForm?.eta_return_date || ''}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          loanerForm: { ...prev?.loanerForm, eta_return_date: e?.target?.value }
                        }))}
                        min={new Date()?.toISOString()?.split('T')?.[0]}
                      />
                    </Field>
                  </div>
                  
                  {/* Loaner Notes - Maps to loaner_assignments.notes */}
                  <Field label="Loaner Notes" id="loaner-notes-field" error="">
                    <textarea
                      rows={2}
                      className="w-full border rounded px-3 py-2 resize-none"
                      value={form?.loanerForm?.notes || ''}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        loanerForm: { ...prev?.loanerForm, notes: e?.target?.value }
                      }))}
                      placeholder="Additional notes about the loaner assignment..."
                    />
                  </Field>
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>

      {/* Line Items Section - Maps to job_parts table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Line Items</h3>
          <button 
            type="button" 
            data-testid="add-line-item-btn"
            className="px-3 py-2 h-11 rounded border hover:bg-gray-50 disabled:opacity-50"
            onClick={() => {
              const newId = `new-${Date.now()}-${Math.random()?.toString(36)?.substr(2, 9)}`;
              setForm(prev => ({ 
                ...prev, 
                lineItems: [...(prev?.lineItems || []), { 
                  id: newId,
                  product_id: null,
                  quantity_used: 1,
                  unit_price: 0,
                  notes: '',
                  isOffSite: false,
                  requiresScheduling: true,
                  lineItemPromisedDate: '',
                  noScheduleReason: '',
                  description: ''
                }] 
              }));
            }}
            disabled={saving}
          >
            Add Line Item
          </button>
        </div>
        
        <div className="space-y-3">
          {(form?.lineItems || [])?.map((item, idx) => {
            const itemKey = item?.id || `item-${idx}`;
            
            return (
              <div key={itemKey} className="grid grid-cols-1 md:grid-cols-12 gap-3 border rounded p-3 bg-white">
                {/* Product Selection - Maps to job_parts.product_id */}
                <div className="md:col-span-3">
                  <Field label="Product" id={`product-field-${itemKey}`} error="">
                    <select 
                      data-testid="product-select"
                      className="w-full border rounded px-3 py-2 h-11" 
                      value={item?.product_id || ''} 
                      onChange={e => {
                        const productId = e?.target?.value ? e?.target?.value : null;
                        const selectedProduct = dropdownData?.products?.find(p => p?.id === productId);
                        
                        setForm(prev => ({
                          ...prev,
                          lineItems: prev?.lineItems?.map((it, i) => 
                            i === idx ? { 
                              ...it, 
                              product_id: productId,
                              unit_price: selectedProduct?.unit_price || it?.unit_price || 0
                            } : it
                          )
                        }));
                      }}
                    >
                      {renderDropdownOptions(
                        dropdownData?.products,
                        'products',
                        'products',
                        'Select product',
                        (p) => <option key={p?.id} value={p?.id}>{p?.name}</option>
                      )}
                    </select>
                  </Field>
                </div>

                {/* Quantity - Maps to job_parts.quantity_used */}
                <div className="md:col-span-2">
                  <Field label="Quantity" id={`quantity-field-${itemKey}`} error="">
                    <input 
                      type="number" 
                      min="1"
                      className="w-full border rounded px-3 py-2 h-11" 
                      value={item?.quantity_used || 1} 
                      onChange={e => setForm(prev => ({
                        ...prev,
                        lineItems: prev?.lineItems?.map((it, i) => 
                          i === idx ? { ...it, quantity_used: parseInt(e?.target?.value) || 1 } : it
                        )
                      }))}
                    />
                  </Field>
                </div>
                
                {/* Unit Price - Maps to job_parts.unit_price */}
                <div className="md:col-span-2">
                  <Field label="Unit Price" id={`price-field-${itemKey}`} error="">
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      className="w-full border rounded px-3 py-2 h-11" 
                      value={item?.unit_price || 0} 
                      onChange={e => setForm(prev => ({
                        ...prev,
                        lineItems: prev?.lineItems?.map((it, i) => 
                          i === idx ? { ...it, unit_price: parseFloat(e?.target?.value) || 0 } : it
                        )
                      }))}
                    />
                  </Field>
                </div>

                {/* Total Price Display */}
                <div className="md:col-span-2 flex items-end">
                  <div className="w-full p-2 bg-gray-50 rounded border text-center">
                    Total: ${((item?.quantity_used || 1) * (item?.unit_price || 0))?.toFixed(2)}
                  </div>
                </div>

                {/* Remove Button */}
                <div className="md:col-span-3 flex items-end justify-end">
                  <button 
                    type="button" 
                    className="px-3 py-2 h-11 rounded border text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-50" 
                    onClick={() => setForm(prev => ({ 
                      ...prev, 
                      lineItems: prev?.lineItems?.filter((_, i) => i !== idx) 
                    }))}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>

                {/* Service Location and Scheduling Options */}
                <div className="md:col-span-12 mt-4 space-y-4 p-4 bg-gray-50 rounded">
                  {/* Service Location */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Service Location</label>
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`serviceLocation_${itemKey}`}
                          checked={!item?.isOffSite}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            lineItems: prev?.lineItems?.map((it, i) => 
                              i === idx ? { ...it, isOffSite: false } : it
                            )
                          }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">On-Site</span>
                      </label>
                      <label className="inline-flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`serviceLocation_${itemKey}`}
                          checked={!!item?.isOffSite}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            lineItems: prev?.lineItems?.map((it, i) => 
                              i === idx ? { ...it, isOffSite: true } : it
                            )
                          }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Off-Site</span>
                      </label>
                    </div>
                  </div>

                  {/* Scheduling Options */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Scheduling</label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-4">
                        <label className="inline-flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`scheduling_${itemKey}`}
                            checked={!!item?.requiresScheduling}
                            onChange={() => setForm(prev => ({
                              ...prev,
                              lineItems: prev?.lineItems?.map((it, i) => 
                                i === idx ? { ...it, requiresScheduling: true, noScheduleReason: '' } : it
                              )
                            }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Needs scheduling</span>
                        </label>
                        <label className="inline-flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`scheduling_${itemKey}`}
                            checked={!item?.requiresScheduling}
                            onChange={() => setForm(prev => ({
                              ...prev,
                              lineItems: prev?.lineItems?.map((it, i) => 
                                i === idx ? { ...it, requiresScheduling: false, lineItemPromisedDate: '' } : it
                              )
                            }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">No scheduling needed</span>
                        </label>
                      </div>

                      {item?.requiresScheduling ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label="Promised Date" required id={`promised-date-field-${itemKey}`} error="">
                            <input
                              type="date"
                              value={item?.lineItemPromisedDate || ''}
                              min={new Date()?.toISOString()?.split('T')?.[0]}
                              onChange={(e) => setForm(prev => ({
                                ...prev,
                                lineItems: prev?.lineItems?.map((it, i) => 
                                  i === idx ? { ...it, lineItemPromisedDate: e?.target?.value } : it
                                )
                              }))}
                              className="w-full p-3 text-sm rounded-lg border h-11"
                              required={item?.requiresScheduling}
                            />
                          </Field>
                          <Field label="Scheduling Notes" id={`scheduling-notes-field-${itemKey}`} error="">
                            <textarea
                              rows={2}
                              placeholder="Special instructions or requirements..."
                              className="w-full p-3 text-sm rounded-lg border resize-none"
                              value={item?.description || ''}
                              onChange={(e) => setForm(prev => ({
                                ...prev,
                                lineItems: prev?.lineItems?.map((it, i) => 
                                  i === idx ? { ...it, description: e?.target?.value } : it
                                )
                              }))}
                            />
                          </Field>
                        </div>
                      ) : (
                        <Field label="Reason for no schedule" required id={`no-schedule-reason-field-${itemKey}`} error="">
                          <input
                            type="text"
                            placeholder="e.g., installed at delivery, no appointment needed"
                            value={item?.noScheduleReason || ''}
                            onChange={(e) => setForm(prev => ({
                              ...prev,
                              lineItems: prev?.lineItems?.map((it, i) => 
                                i === idx ? { ...it, noScheduleReason: e?.target?.value } : it
                              )
                            }))}
                            className="w-full p-3 text-sm rounded-lg border h-11"
                            required={!item?.requiresScheduling}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Summary */}
        <div className="flex items-center justify-end mt-3 text-sm text-gray-700">
          <div className="px-3 py-1 bg-gray-50 rounded border">
            Total: ${(form?.lineItems || [])?.reduce((sum, item) => {
              return sum + ((item?.quantity_used || 1) * (item?.unit_price || 0));
            }, 0)?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t bg-white sticky bottom-0">
        <button 
          type="button" 
          className="px-4 py-2 h-11 rounded border hover:bg-gray-50 disabled:opacity-50" 
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          data-testid="save-deal-btn"
          disabled={saving || !isFormValid} 
          className="px-4 py-2 h-11 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Create Deal')}
        </button>
        
        {/* Validation Messages */}
        {!isFormValid && !saving && (
          <div className="text-xs text-red-600 ml-2" role="alert">
            {!form?.title?.trim() 
              ? 'Title is required' 
              : form?.customer_needs_loaner && !form?.loanerForm?.loaner_number?.trim() 
              ? 'Loaner number is required when loaner is needed' :'Please complete required fields'
            }
          </div>
        )}
      </div>
    </form>
  );
}