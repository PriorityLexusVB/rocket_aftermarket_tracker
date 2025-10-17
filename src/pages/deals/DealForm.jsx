// src/pages/deals/components/DealForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { productService } from '../../services/productService';
import { vendorService } from '../../services/vendorService';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const Field = ({ label, children, id, required = false, error }) => {
  const fieldId = id || `field-${Math.random()?.toString(36)?.substr(2, 9)}`;
  
  return (
    <div className="block">
      <label htmlFor={fieldId} className="block text-xs font-medium text-gray-600 mb-1 cursor-pointer select-none">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="h-11 min-h-[44px]"> {/* H5: Mobile tap target - 44px minimum */}
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
  
  // H2: Controlled inputs - proper state management with stable keys
  const [form, setForm] = useState(() => initialData || {
    title: '',
    description: '',
    vendor_id: null,
    vehicle_id: null,
    job_status: 'new',
    priority: 'normal',
    scheduled_start_time: '',
    scheduled_end_time: '',
    estimated_hours: '',
    estimated_cost: '',
    actual_cost: '',
    location: '',
    assigned_to: null,
    delivery_coordinator_id: null,
    customer_needs_loaner: false,
    customer_name: '', // H4: Ensure customer name is in form state
    lineItems: [{ 
      id: `new-${Date.now()}`, // H2: Stable key for new items
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
    }],
    // A3: FIXED - Include loaner fields in main form state
    loanerForm: {
      loaner_number: '',
      eta_return_date: '',
      notes: ''
    }
  });

  // Step 11: Add dropdown state for all required dropdowns
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesConsultants, setSalesConsultants] = useState([]);
  const [deliveryCoordinators, setDeliveryCoordinators] = useState([]);

  // Step 11: Load dropdown data from correct tables with proper filters
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        // Load vendors (existing)
        const vendorData = await vendorService?.getAll();
        setVendors(vendorData || []);

        // Load products (existing) 
        const productData = await productService?.getAllActive();
        setProducts(productData || []);

        // Step 11: Load Sales Consultants - user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true
        const { data: salesData, error: salesError } = await supabase?.from('user_profiles')?.select('id, full_name, email')?.eq('role', 'staff')?.eq('department', 'Sales Consultants')?.eq('is_active', true)?.order('full_name');

        if (!salesError) {
          setSalesConsultants(salesData || []);
        }

        // Step 11: Load Delivery Coordinators - user_profiles where role IN ('admin','manager') AND department='Delivery Coordinator' AND is_active=true
        const { data: coordData, error: coordError } = await supabase?.from('user_profiles')?.select('id, full_name, email')?.in('role', ['admin', 'manager'])?.eq('department', 'Delivery Coordinator')?.eq('is_active', true)?.order('full_name');

        if (!coordError) {
          setDeliveryCoordinators(coordData || []);
        }
      } catch (error) {
        console.error('Error loading dropdown data:', error);
      }
    };

    loadDropdownData();
  }, []);

  // A3: ENHANCED - Load existing loaner data when editing
  useEffect(() => {
    if (initialData) {
      const loadExistingLoanerData = async () => {
        if (initialData?.id && initialData?.customer_needs_loaner) {
          try {
            // Load active loaner assignment for this job
            const { data: loanerAssignment } = await supabase
              ?.from('loaner_assignments')
              ?.select('loaner_number, eta_return_date, notes')
              ?.eq('job_id', initialData?.id)
              ?.is('returned_at', null)
              ?.single();

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
              return;
            }
          } catch (error) {
            // No existing loaner assignment, use default
            console.log('No existing loaner assignment found');
          }
        }
        
        // Set form with initial data and default loaner form
        setForm(prev => ({ 
          ...prev, 
          ...initialData,
          loanerForm: prev?.loanerForm || {
            loaner_number: '',
            eta_return_date: '',
            notes: ''
          }
        }));
      };

      loadExistingLoanerData();
    }
  }, [initialData]);

  // Form validation logic - softened to allow incomplete line items
  const isFormValid = useMemo(() => {
    // Check if title is present (required field)
    if (!form?.title?.trim()) return false;
    
    // A3: Enhanced validation - if loaner is needed, loaner number is required
    if (form?.customer_needs_loaner && !form?.loanerForm?.loaner_number?.trim()) {
      return false;
    }
    
    return true;
  }, [form?.title, form?.customer_needs_loaner, form?.loanerForm?.loaner_number]);

  // H2: Controlled update functions with proper value handling
  const update = (patch) => setForm(prev => ({ ...prev, ...patch }));
  
  // A3: FIXED - Update loaner form within main form state
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
        id: newId, // H2: Stable unique key
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
    // A3: FIXED - Pass complete form data including loaner
    onSubmit?.(form);
  };

  return (
    <form onSubmit={submit} className="space-y-6 pb-20"> {/* H5: Bottom padding for mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* H1: Enhanced Field with proper ID binding */}
        <Field label="Title" required id="title-field" error={null}>
          <input 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.title || ''} 
            onChange={e=>update({ title: e?.target?.value })} 
            required
            aria-describedby="title-help"
          />
        </Field>

        {/* H1: Customer Name with proper binding */}
        <Field label="Customer Name" required id="customer-name-field" error={null}>
          <input 
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.customer_name || ''} 
            onChange={e=>update({ customer_name: e?.target?.value })} 
            placeholder="Enter customer name"
            required
          />
        </Field>

        {/* Step 11: Salesperson Dropdown - user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true */}
        <Field label="Salesperson" id="salesperson-field" error={null}>
          <select 
            data-testid="salesperson-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.assigned_to || ''} 
            onChange={e=>update({ assigned_to: e?.target?.value ? e?.target?.value : null })}
          >
            <option value="">Select salesperson</option>
            {salesConsultants?.map(sc => (
              <option key={sc?.id} value={sc?.id}>{sc?.full_name}</option>
            ))}
          </select>
        </Field>

        {/* Step 11: Delivery Coordinator Dropdown - user_profiles where role IN ('admin','manager') AND department='Delivery Coordinator' AND is_active=true */}
        <Field label="Delivery Coordinator" id="delivery-coordinator-field" error={null}>
          <select 
            data-testid="delivery-coordinator-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.delivery_coordinator_id || ''} 
            onChange={e=>update({ delivery_coordinator_id: e?.target?.value ? e?.target?.value : null })}
          >
            <option value="">Select delivery coordinator</option>
            {deliveryCoordinators?.map(dc => (
              <option key={dc?.id} value={dc?.id}>{dc?.full_name}</option>
            ))}
          </select>
        </Field>

        <Field label="Vendor" id="vendor-field" error={null}>
          <select 
            data-testid="vendor-select"
            className="w-full border rounded px-3 py-2 h-11" 
            value={form?.vendor_id || ''} 
            onChange={e=>update({ vendor_id: e?.target?.value ? Number(e?.target?.value) : null })}
          >
            <option value="">Select vendor</option>
            {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.name}</option>)}
          </select>
        </Field>

        <Field label="Status" id="status-field" error={null}>
          <select className="w-full border rounded px-3 py-2 h-11" value={form?.job_status} onChange={e=>update({ job_status: e?.target?.value })}>
            {['new','scheduled','in_progress','completed','canceled']?.map(s => <option key={s} value={s}>{s?.replace('_',' ')}</option>)}
          </select>
        </Field>
        
        <Field label="Priority" id="priority-field" error={null}>
          <select className="w-full border rounded px-3 py-2 h-11" value={form?.priority} onChange={e=>update({ priority: e?.target?.value })}>
            {['low','normal','high','urgent']?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        
        <Field label="Start time" id="start-time-field" error={null}>
          <input type="datetime-local" className="w-full border rounded px-3 py-2 h-11" value={form?.scheduled_start_time || ''} onChange={e=>update({ scheduled_start_time: e?.target?.value })} />
        </Field>
        
        <Field label="End time" id="end-time-field" error={null}>
          <input type="datetime-local" className="w-full border rounded px-3 py-2 h-11" value={form?.scheduled_end_time || ''} onChange={e=>update({ scheduled_end_time: e?.target?.value })} />
        </Field>
        
        <Field label="Estimated hours" id="estimated-hours-field" error={null}>
          <input type="number" step="0.1" className="w-full border rounded px-3 py-2 h-11" value={form?.estimated_hours || ''} onChange={e=>update({ estimated_hours: e?.target?.value })} />
        </Field>
        
        <Field label="Location" id="location-field" error={null}>
          <input className="w-full border rounded px-3 py-2 h-11" value={form?.location || ''} onChange={e=>update({ location: e?.target?.value })} />
        </Field>
        
        <div className="md:col-span-2">
          <Field label="Description" id="description-field" error={null}>
            <textarea rows={4} className="w-full border rounded px-3 py-2 h-11" value={form?.description} onChange={e=>update({ description: e?.target?.value })} />
          </Field>
        </div>

        {/* A2: Enhanced Customer Requirements with Loaner Fields */}
        <div className="md:col-span-2">
          <Field label="Customer Requirements" id="customer-requirements-field" error={null}>
            <div className="space-y-4">
              {/* H1: Proper label binding for loaner checkbox */}
              <label className="inline-flex items-center space-x-2 cursor-pointer h-11 min-h-[44px]">
                <input
                  id={`loaner-${form?.id || 'new'}`}
                  data-testid="loaner-checkbox"
                  type="checkbox"
                  checked={!!form?.customer_needs_loaner}
                  onChange={(e) => update({ customer_needs_loaner: e?.target?.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm select-none">Customer needs loaner vehicle</span>
              </label>
              
              {/* A2: Loaner fields revealed when checked */}
              {form?.customer_needs_loaner && (
                <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-4 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800">Loaner Assignment Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Loaner Number" required id="loaner-number-field" error={null}>
                      <input
                        className="w-full border rounded px-3 py-2 h-11"
                        value={form?.loanerForm?.loaner_number || ''}
                        onChange={(e) => updateLoaner({ loaner_number: e?.target?.value })}
                        placeholder="e.g., LOANER-001"
                        required={form?.customer_needs_loaner}
                      />
                    </Field>
                    
                    <Field label="ETA Return Date" id="eta-return-date-field" error={null}>
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2 h-11"
                        value={form?.loanerForm?.eta_return_date || ''}
                        onChange={(e) => updateLoaner({ eta_return_date: e?.target?.value })}
                        min={new Date()?.toISOString()?.split('T')?.[0]}
                      />
                    </Field>
                  </div>
                  
                  <Field label="Loaner Notes" id="loaner-notes-field" error={null}>
                    <textarea
                      rows={2}
                      className="w-full border rounded px-3 py-2 resize-none"
                      value={form?.loanerForm?.notes || ''}
                      onChange={(e) => updateLoaner({ notes: e?.target?.value })}
                      placeholder="Additional notes about the loaner assignment..."
                    />
                  </Field>
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Line Items</h3>
          {/* H3: Only disable during actual operations, not validation */}
          <button 
            type="button" 
            data-testid="add-line-item-btn"
            className="px-3 py-2 h-11 rounded border hover:bg-gray-50 disabled:opacity-50"
            onClick={addItem}
            disabled={saving} // H3: Only disable while saving
            aria-label="Add new line item"
          >
            Add Line Item
          </button>
        </div>
        
        <div className="space-y-3">
          {(form?.lineItems || [])?.map((item, idx) => {
            // H2: Use stable key - item.id or fallback to index
            const itemKey = item?.id || `item-${idx}`;
            
            return (
              <div key={itemKey} className="grid grid-cols-1 md:grid-cols-12 gap-3 border rounded p-3 bg-white">
                {/* H1: Product selection with proper labeling */}
                <div className="md:col-span-3">
                  <Field label="Product" id={`product-field-${itemKey}`} error={null}>
                    <select 
                      id={`product-${itemKey}`}
                      data-testid="product-select"
                      className="w-full border rounded px-3 py-2 h-11" 
                      value={item?.product_id || ''} 
                      onChange={e=>updateItem(idx, { product_id: e?.target?.value ? Number(e?.target?.value) : null })}
                      aria-describedby={`product-${itemKey}-help`}
                    >
                      <option value="">Select product</option>
                      {products?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                    </select>
                  </Field>
                </div>
                
                {/* H2: Price with controlled value */}
                <div className="md:col-span-2">
                  <Field label="Price" id={`price-field-${itemKey}`} error={null}>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full border rounded px-3 py-2 h-11" 
                      value={item?.unit_price ?? ''} 
                      onChange={e=>updateItem(idx, { unit_price: e?.target?.value })} 
                    />
                  </Field>
                </div>

                {/* Step 11: Vendor Dropdown - user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true */}
                <div className="md:col-span-2">
                  <Field label="Vendor" id={`vendor-field-${itemKey}`} error={null}>
                    <select className="w-full border rounded px-3 py-2 h-11" value={item?.vendor_id || ''} onChange={e=>updateItem(idx, { vendor_id: e?.target?.value ? Number(e?.target?.value) : null })}>
                      <option value="">—</option>
                      {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.name}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Step 11: Priority Dropdown - user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true */}
                <div className="md:col-span-2">
                  <Field label="Priority" id={`priority-field-${itemKey}`} error={null}>
                    <select className="w-full border rounded px-3 py-2 h-11" value={item?.priority || 'normal'} onChange={e=>updateItem(idx, { priority: e?.target?.value })}>
                      {['low','normal','high','urgent']?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="md:col-span-3 flex items-end justify-end">
                  <button 
                    type="button" 
                    className="px-3 py-2 h-11 rounded border text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-50" 
                    onClick={()=>removeItem(idx)}
                    disabled={saving} // H3: Only disable during save
                    aria-label="Remove line item"
                  >
                    Remove
                  </button>
                </div>
                
                {/* H1: Service location with enhanced radio button labeling */}
                <div className="md:col-span-12 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Service Location
                    </label>
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center space-x-2 cursor-pointer h-11 min-h-[44px]">
                        <input
                          id={`onsite-${itemKey}`}
                          data-testid="service-location-onsite"
                          type="radio"
                          name={`serviceLocation_${itemKey}`}
                          checked={!item?.isOffSite}
                          onChange={() => updateItem(idx, { isOffSite: false })}
                          className="h-5 w-5"
                        />
                        <span className="text-sm select-none">On-Site</span>
                      </label>
                      <label className="inline-flex items-center space-x-2 cursor-pointer h-11 min-h-[44px]">
                        <input
                          id={`offsite-${itemKey}`}
                          data-testid="service-location-offsite"
                          type="radio"
                          name={`serviceLocation_${itemKey}`}
                          checked={!!item?.isOffSite}
                          onChange={() => updateItem(idx, { isOffSite: true })}
                          className="h-5 w-5"
                        />
                        <span className="text-sm select-none">Off-Site</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* H1: Enhanced scheduling section with proper labeling */}
                <div className="md:col-span-12 mt-6 p-4 rounded-lg border bg-indigo-50 border-indigo-200">
                  <h5 className="font-semibold text-indigo-800 mb-3">Scheduling (per item)</h5>

                  <div className="flex items-center space-x-4 mb-4">
                    <label className="inline-flex items-center space-x-2 cursor-pointer h-11 min-h-[44px]">
                      <input
                        id={`sched-needed-${itemKey}`}
                        data-testid="scheduling-needed"
                        type="radio"
                        name={`requiresScheduling_${itemKey}`}
                        checked={!!item?.requiresScheduling}
                        onChange={() => updateItem(idx, { requiresScheduling: true, noScheduleReason: '' })}
                        className="h-5 w-5"
                      />
                      <span className="text-sm select-none">Needs scheduling</span>
                    </label>
                    <label className="inline-flex items-center space-x-2 cursor-pointer h-11 min-h-[44px]">
                      <input
                        id={`sched-none-${itemKey}`}
                        data-testid="scheduling-none"
                        type="radio"
                        name={`requiresScheduling_${itemKey}`}
                        checked={!item?.requiresScheduling}
                        onChange={() => updateItem(idx, { requiresScheduling: false, lineItemPromisedDate: '' })}
                        className="h-5 w-5"
                      />
                      <span className="text-sm select-none">No scheduling needed</span>
                    </label>
                  </div>

                  {/* H2: Controlled inputs for scheduling fields */}
                  {item?.requiresScheduling ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Promised Date" required id={`promised-date-field-${itemKey}`} error={null}>
                        <input
                          data-testid="promised-date-input"
                          type="date"
                          value={item?.lineItemPromisedDate || ''}
                          min={new Date()?.toISOString()?.split('T')?.[0]}
                          onChange={(e) => updateItem(idx, { lineItemPromisedDate: e?.target?.value })}
                          className="w-full p-3 text-sm rounded-lg border h-11"
                          required={item?.requiresScheduling}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Scheduling Notes" id={`scheduling-notes-field-${itemKey}`} error={null}>
                          <textarea
                            rows={3}
                            placeholder="Add any special instructions, requirements, or customer preferences for this scheduled service..."
                            className="w-full p-3 text-sm rounded-lg border resize-none"
                            onChange={(e) => updateItem(idx, { description: e?.target?.value })}
                            value={item?.description || ''}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : (
                    <Field label="Reason for no schedule" required id={`no-schedule-reason-field-${itemKey}`} error={null}>
                      <input
                        data-testid="no-schedule-reason-input"
                        type="text"
                        placeholder="e.g., installed at delivery, no appointment needed"
                        value={item?.noScheduleReason || ''}
                        onChange={(e) => updateItem(idx, { noScheduleReason: e?.target?.value })}
                        className="w-full p-3 text-sm rounded-lg border h-11"
                        required={!item?.requiresScheduling}
                      />
                    </Field>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end mt-3 text-sm text-gray-700">
          <div className="px-3 py-1 bg-gray-50 rounded border">Total: ${total}</div>
        </div>
      </div>
      
      {/* H3: Enhanced footer with proper disable states */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t bg-white sticky bottom-0 pointer-events-auto">
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
          disabled={saving || !form?.customer_name?.trim() || (form?.customer_needs_loaner && !form?.loanerForm?.loaner_number?.trim())} 
          className="px-4 py-2 h-11 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Create Deal')}
        </button>
        {/* A3: Enhanced validation messages */}
        {!form?.customer_name?.trim() && !saving && (
          <div className="text-xs text-red-600 ml-2" role="alert">
            Customer name is required to save
          </div>
        )}
        {form?.customer_needs_loaner && !form?.loanerForm?.loaner_number?.trim() && !saving && (
          <div className="text-xs text-red-600 ml-2" role="alert">
            Loaner number is required when loaner is needed
          </div>
        )}
      </div>
    </form>
  );
}