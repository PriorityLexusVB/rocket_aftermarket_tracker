// src/pages/deals/components/DealForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { productService } from '../../services/productService';
import { vendorService } from '../../services/vendorService';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
    {children}
  </label>
);

export default function DealForm({ mode='create', initialData=null, onSubmit, onCancel, saving=false }) {
  const { themeClasses } = useTheme();
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
    assigned_to: null, // Salesperson
    delivery_coordinator_id: null, // Delivery Coordinator
    customer_needs_loaner: false,
    lineItems: [{ 
      part_name: '', 
      sku: '', 
      quantity_used: 1, 
      unit_price: 0, 
      notes: '',
      isOffSite: false,
      needsLoaner: false,
      requiresScheduling: true,
      lineItemPromisedDate: '',
      noScheduleReason: '',
      description: ''
    }]
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

  useEffect(() => {
    if (initialData) setForm(prev => ({ ...prev, ...initialData }));
  }, [initialData]);

  // Form validation logic - softened to allow incomplete line items
  const isFormValid = useMemo(() => {
    // Check if title is present (required field)
    if (!form?.title?.trim()) return false;
    
    // Removed strict scheduling validation - line items can be incomplete
    // This allows saving drafts with incomplete scheduling information
    
    return true;
  }, [form?.title, form?.lineItems]);

  const update = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const updateItem = (idx, patch) => setForm(prev => ({
    ...prev,
    lineItems: prev?.lineItems?.map((it,i) => i===idx ? { ...it, ...patch } : it)
  }));
  const addItem = () => setForm(prev => ({ 
    ...prev, 
    lineItems: [...prev?.lineItems, { 
      part_name: '', 
      sku: '', 
      quantity_used: 1, 
      unit_price: 0, 
      notes: '',
      isOffSite: false,
      needsLoaner: false,
      requiresScheduling: true,
      lineItemPromisedDate: '',
      noScheduleReason: '',
      description: ''
    }] 
  }));
  const removeItem = (idx) => setForm(prev => ({ ...prev, lineItems: prev?.lineItems?.filter((_,i)=>i!==idx) }));

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

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Title">
          <input className="w-full border rounded px-3 py-2" value={form?.title} onChange={e=>update({ title: e?.target?.value })} required />
        </Field>

        {/* Step 11: Add Customer Name field */}
        <Field label="Customer Name">
          <input 
            className="w-full border rounded px-3 py-2" 
            value={form?.customer_name || ''} 
            onChange={e=>update({ customer_name: e?.target?.value })} 
            placeholder="Enter customer name"
          />
        </Field>

        {/* Step 11: Salesperson Dropdown - user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true */}
        <Field label="Salesperson">
          <select 
            data-testid="salesperson-select"
            className="w-full border rounded px-3 py-2" 
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
        <Field label="Delivery Coordinator">
          <select 
            data-testid="delivery-coordinator-select"
            className="w-full border rounded px-3 py-2" 
            value={form?.delivery_coordinator_id || ''} 
            onChange={e=>update({ delivery_coordinator_id: e?.target?.value ? e?.target?.value : null })}
          >
            <option value="">Select delivery coordinator</option>
            {deliveryCoordinators?.map(dc => (
              <option key={dc?.id} value={dc?.id}>{dc?.full_name}</option>
            ))}
          </select>
        </Field>

        <Field label="Vendor">
          <select 
            data-testid="vendor-select"
            className="w-full border rounded px-3 py-2" 
            value={form?.vendor_id || ''} 
            onChange={e=>update({ vendor_id: e?.target?.value ? Number(e?.target?.value) : null })}
          >
            <option value="">Select vendor</option>
            {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.name}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select className="w-full border rounded px-3 py-2" value={form?.job_status} onChange={e=>update({ job_status: e?.target?.value })}>
            {['new','scheduled','in_progress','completed','canceled']?.map(s => <option key={s} value={s}>{s?.replace('_',' ')}</option>)}
          </select>
        </Field>
        
        <Field label="Priority">
          <select className="w-full border rounded px-3 py-2" value={form?.priority} onChange={e=>update({ priority: e?.target?.value })}>
            {['low','normal','high','urgent']?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        
        <Field label="Start time">
          <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form?.scheduled_start_time || ''} onChange={e=>update({ scheduled_start_time: e?.target?.value })} />
        </Field>
        
        <Field label="End time">
          <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form?.scheduled_end_time || ''} onChange={e=>update({ scheduled_end_time: e?.target?.value })} />
        </Field>
        
        <Field label="Estimated hours">
          <input type="number" step="0.1" className="w-full border rounded px-3 py-2" value={form?.estimated_hours || ''} onChange={e=>update({ estimated_hours: e?.target?.value })} />
        </Field>
        
        <Field label="Location">
          <input className="w-full border rounded px-3 py-2" value={form?.location || ''} onChange={e=>update({ location: e?.target?.value })} />
        </Field>
        
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea rows={4} className="w-full border rounded px-3 py-2" value={form?.description} onChange={e=>update({ description: e?.target?.value })} />
          </Field>
        </div>

        {/* Step 11: Customer Needs Loaner - Global Checkbox */}
        <div className="md:col-span-2">
          <Field label="Customer Requirements">
            <label className="inline-flex items-center space-x-2">
              <input
                data-testid="loaner-checkbox"
                type="checkbox"
                checked={!!form?.customer_needs_loaner}
                onChange={(e) => update({ customer_needs_loaner: e?.target?.checked })}
              />
              <span className="text-sm">Customer needs loaner vehicle</span>
            </label>
          </Field>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Line Items</h3>
          <button 
            type="button" 
            data-testid="add-line-item-btn"
            className="px-3 py-2 rounded border hover:bg-gray-50"
            onClick={addItem}
            disabled={!form?.customer_name?.trim() || !form?.title?.trim()}
          >
            Add Line Item
          </button>
        </div>
        <div className="space-y-3">
          {(form?.lineItems || [])?.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 border rounded p-3 bg-white">
              <div className="md:col-span-3">
                <Field label="Product">
                  <select 
                    data-testid="product-select"
                    className="w-full border rounded px-3 py-2" 
                    value={it?.product_id || ''} 
                    onChange={e=>updateItem(idx, { product_id: e?.target?.value ? Number(e?.target?.value) : null })}
                  >
                    <option value="">Select product</option>
                    {products?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Price">
                  <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={it?.unit_price ?? 0} onChange={e=>updateItem(idx, { unit_price: e?.target?.value })} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Vendor">
                  <select className="w-full border rounded px-3 py-2" value={it?.vendor_id || ''} onChange={e=>updateItem(idx, { vendor_id: e?.target?.value ? Number(e?.target?.value) : null })}>
                    <option value="">—</option>
                    {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Priority">
                  <select className="w-full border rounded px-3 py-2" value={it?.priority || 'normal'} onChange={e=>updateItem(idx, { priority: e?.target?.value })}>
                    {['low','normal','high','urgent']?.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="md:col-span-3 flex items-end justify-end">
                <button type="button" className="px-3 py-2 rounded border text-red-700 border-red-300 hover:bg-red-50" onClick={()=>removeItem(idx)}>Remove</button>
              </div>
              
              {/* Service location (On-Site vs Off-Site) */}
              <div className="md:col-span-12 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                    Service Location
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center space-x-2">
                      <input
                        data-testid="service-location-onsite"
                        type="radio"
                        name={`serviceLocation_${idx}`}
                        checked={!it?.isOffSite}
                        onChange={() => updateItem(idx, { isOffSite: false })}
                      />
                      <span className="text-sm">On-Site</span>
                    </label>
                    <label className="inline-flex items-center space-x-2">
                      <input
                        data-testid="service-location-offsite"
                        type="radio"
                        name={`serviceLocation_${idx}`}
                        checked={!!it?.isOffSite}
                        onChange={() => updateItem(idx, { isOffSite: true })}
                      />
                      <span className="text-sm">Off-Site</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {it?.vendor_id && !it?.isOffSite ? 'Vendor selected but service is On-Site' : 'Choosing Off-Site doesn\'t force a vendor, but if a vendor is picked we\'ll assume Off-Site.'}
                  </p>
                </div>

                {/* Individual line item loaner - removed per Step 11 requirements (global loaner only) */}
              </div>

              {/* Per-line-item Scheduling */}
              <div className="md:col-span-12 mt-6 p-4 rounded-lg border bg-indigo-50 border-indigo-200">
                <h5 className="font-semibold text-indigo-800 mb-3">Scheduling (per item)</h5>

                <div className="flex items-center space-x-4 mb-4">
                  <label className="inline-flex items-center space-x-2">
                    <input
                      data-testid="scheduling-needed"
                      type="radio"
                      name={`requiresScheduling_${idx}`}
                      checked={!!it?.requiresScheduling}
                      onChange={() => updateItem(idx, { requiresScheduling: true, noScheduleReason: '' })}
                    />
                    <span className="text-sm">Needs scheduling</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input
                      data-testid="scheduling-none"
                      type="radio"
                      name={`requiresScheduling_${idx}`}
                      checked={!it?.requiresScheduling}
                      onChange={() => updateItem(idx, { requiresScheduling: false, lineItemPromisedDate: '' })}
                    />
                    <span className="text-sm">No scheduling needed</span>
                  </label>
                </div>

                {it?.requiresScheduling ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                        Promised Date *
                      </label>
                      <input
                        data-testid="promised-date-input"
                        type="date"
                        value={it?.lineItemPromisedDate || ''}
                        min={new Date()?.toISOString()?.split('T')?.[0]}
                        onChange={(e) => updateItem(idx, { lineItemPromisedDate: e?.target?.value })}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                        Scheduling Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Add any special instructions, requirements, or customer preferences for this scheduled service..."
                        className={`w-full p-3 text-sm rounded-lg border resize-none ${themeClasses?.input}`}
                        onChange={(e) => updateItem(idx, { description: e?.target?.value })}
                        value={it?.description || ''}
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Examples: "Customer prefers morning appointments", "Requires loaner pickup", "Special access instructions"
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Reason for no schedule *
                    </label>
                    <input
                      data-testid="no-schedule-reason-input"
                      type="text"
                      placeholder="e.g., installed at delivery, no appointment needed"
                      value={it?.noScheduleReason || ''}
                      onChange={(e) => updateItem(idx, { noScheduleReason: e?.target?.value })}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end mt-3 text-sm text-gray-700">
          <div className="px-3 py-1 bg-gray-50 rounded border">Total: ${total}</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button type="button" className="px-4 py-2 rounded border hover:bg-gray-50" onClick={onCancel}>Cancel</button>
        <button 
          type="submit" 
          data-testid="save-deal-btn"
          disabled={saving || !form?.customer_name?.trim()} 
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Create Deal')}
        </button>
        {!form?.customer_name?.trim() && !saving && (
          <div className="text-xs text-red-600 ml-2">
            Customer name is required to save
          </div>
        )}
      </div>
    </form>
  );
}