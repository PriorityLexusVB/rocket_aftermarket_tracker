import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Calendar, User, MapPin, AlertTriangle, Plus, Trash2, Car, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { toUTC } from '../../../lib/time';
import { Checkbox } from '../../../components/ui/Checkbox';

const CreateModal = ({ 
  initialData, 
  onClose, 
  onSuccess, 
  vendors, 
  onStockSearch, 
  onSMSEnqueue 
}) => {
  // Customer Section
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  // Vehicle Section  
  const [vehicleData, setVehicleData] = useState({
    stock_number: '', // FIRST field
    year: '',
    make: '',
    model: '',
    new_used: 'used', // New/Used toggle
    customer_needs_loaner: false // Loaner checkbox with visible checkmark
  });

  // Staff Assignment
  const [staffData, setStaffData] = useState({
    sales_person: '',
    delivery_coordinator: '',
    finance_manager: ''
  });

  // Date Section
  const [dateData, setDateData] = useState({
    todays_date: format(new Date(), "yyyy-MM-dd"),
    promised_date: ''
  });

  // Line Items Section
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      product_id: '',
      product_name: '',
      sold_price: '',
      cost: '',
      profit: 0,
      off_site_work: false,
      vendor_id: '',
      promised_date: ''
    }
  ]);

  // Notes
  const [notes, setNotes] = useState('');

  // Other states
  const [vehicleSuggestions, setVehicleSuggestions] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [staffMembers, setStaffMembers] = useState({
    sales_people: [],
    delivery_coordinators: [],
    finance_managers: [],
    managers: []
  });
  
  const stockInputRef = useRef(null);

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadStaffMembers();
    
    if (initialData?.startTime && initialData?.endTime) {
      setDateData(prev => ({
        ...prev,
        promised_date: format(new Date(initialData.startTime), "yyyy-MM-dd")
      }));
    }
    
    // Focus on stock number field (FIRST field)
    if (stockInputRef?.current) {
      stockInputRef?.current?.focus();
    }
  }, [initialData]);

  // Load products for dropdown
  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        ?.from('products')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Load staff members by department
  const loadStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('full_name');

      if (error) throw error;
      
      const staff = data || [];
      setStaffMembers({
        sales_people: staff?.filter(s => s?.department === 'Sales'),
        delivery_coordinators: staff?.filter(s => s?.department === 'Delivery Coordinator'),
        finance_managers: staff?.filter(s => s?.department === 'Finance Manager'),
        managers: staff?.filter(s => s?.department === 'General Manager')
      });
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  // Stock-first vehicle search with exact match priority
  const handleStockSearch = async (query) => {
    if (!query?.trim() || query?.length < 2) {
      setVehicleSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // First try exact stock match
      const { data: exactMatch } = await supabase
        ?.from('vehicles')
        ?.select('*')
        ?.ilike('stock_number', query)
        ?.limit(1);

      if (exactMatch && exactMatch?.length > 0) {
        const vehicle = exactMatch?.[0];
        handleVehicleSelect(vehicle);
        return;
      }

      // Fallback to partial search (stock-first ordering)
      const { data: partialMatches } = await supabase
        ?.from('vehicles')
        ?.select('*')
        ?.or(`stock_number.ilike.%${query}%,vin.ilike.%${query}%,owner_name.ilike.%${query}%`)
        ?.order('stock_number')
        ?.limit(20);

      setVehicleSuggestions(partialMatches || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Vehicle search error:', error);
      setError('Failed to search vehicles');
    }
  };

  // Debounced stock search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleStockSearch(vehicleData?.stock_number);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [vehicleData?.stock_number]);

  // Handle vehicle selection
  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleData(prev => ({
      ...prev,
      stock_number: vehicle?.stock_number || '',
      year: vehicle?.year || '',
      make: vehicle?.make || '',
      model: vehicle?.model || ''
    }));
    
    // Auto-fill customer data
    setCustomerData({
      name: vehicle?.owner_name || '',
      phone: vehicle?.owner_phone || '',
      email: vehicle?.owner_email || ''
    });
    
    setShowSuggestions(false);
  };

  // Calculate profit for line item
  const calculateProfit = (soldPrice, cost) => {
    const sold = parseFloat(soldPrice) || 0;
    const costValue = parseFloat(cost) || 0;
    return sold - costValue;
  };

  // Add new line item
  const addLineItem = () => {
    const newItem = {
      id: lineItems?.length + 1,
      product_id: '',
      product_name: '',
      sold_price: '',
      cost: '',
      profit: 0,
      off_site_work: false,
      vendor_id: '',
      promised_date: ''
    };
    setLineItems([...lineItems, newItem]);
  };

  // Remove line item
  const removeLineItem = (index) => {
    if (lineItems?.length > 1) {
      setLineItems(lineItems?.filter((_, i) => i !== index));
    }
  };

  // Update line item
  const updateLineItem = (index, field, value) => {
    const updated = lineItems?.map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value };
        
        // Recalculate profit when sold price or cost changes
        if (field === 'sold_price' || field === 'cost') {
          newItem.profit = calculateProfit(
            field === 'sold_price' ? value : item?.sold_price,
            field === 'cost' ? value : item?.cost
          );
        }
        
        // Clear vendor when off-site is unchecked
        if (field === 'off_site_work' && !value) {
          newItem.vendor_id = '';
        }

        return newItem;
      }
      return item;
    });
    setLineItems(updated);
  };

  // Form validation
  const validateForm = () => {
    // Required fields validation
    if (!vehicleData?.stock_number) {
      throw new Error('Stock Number is required');
    }
    
    if (!customerData?.name) {
      throw new Error('Customer Name is required');
    }
    
    if (!vehicleData?.year || !vehicleData?.make || !vehicleData?.model) {
      throw new Error('Year, Make, and Model are required');
    }
    
    if (!dateData?.promised_date) {
      throw new Error('Promised Date is required');
    }

    // Validate line items
    for (let i = 0; i < lineItems?.length; i++) {
      const item = lineItems?.[i];
      if (!item?.product_name) {
        throw new Error(`Line item ${i + 1}: Product Name is required`);
      }
      if (!item?.sold_price) {
        throw new Error(`Line item ${i + 1}: Sold Price is required`);
      }
      if (!item?.cost) {
        throw new Error(`Line item ${i + 1}: Cost is required`);
      }
    }

    return true;
  };

  // Form submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    try {
      validateForm();

      // Create or get vehicle record
      let vehicleId = selectedVehicle?.id;
      if (!vehicleId) {
        // Create new vehicle record
        const { data: newVehicle, error: vehicleError } = await supabase
          ?.from('vehicles')
          ?.insert([{
            stock_number: vehicleData?.stock_number,
            year: parseInt(vehicleData?.year),
            make: vehicleData?.make,
            model: vehicleData?.model,
            owner_name: customerData?.name,
            owner_phone: customerData?.phone || null,
            owner_email: customerData?.email || null,
            vehicle_status: 'active'
          }])
          ?.select()
          ?.single();

        if (vehicleError) throw vehicleError;
        vehicleId = newVehicle?.id;
      }

      // Create jobs for each line item
      const jobPromises = lineItems?.map(async (item, index) => {
        // Create separate job for off-site work
        const isOffSite = item?.off_site_work;
        
        const jobData = {
          title: `${vehicleData?.stock_number}: ${item?.product_name}`,
          description: `${vehicleData?.new_used === 'new' ? 'New' : 'Used'} ${vehicleData?.year} ${vehicleData?.make} ${vehicleData?.model}`,
          vehicle_id: vehicleId,
          vendor_id: isOffSite ? item?.vendor_id : null,
          scheduled_start_time: initialData?.startTime ? toUTC(new Date(initialData?.startTime)) : null,
          scheduled_end_time: initialData?.endTime ? toUTC(new Date(initialData?.endTime)) : null,
          promised_date: item?.promised_date || dateData?.promised_date,
          job_status: 'pending',
          service_type: isOffSite ? 'off_site' : 'in_house',
          priority: 'medium',
          customer_needs_loaner: vehicleData?.customer_needs_loaner,
          assigned_to: staffData?.sales_person || null,
          delivery_coordinator_id: staffData?.delivery_coordinator || null,
          estimated_cost: parseFloat(item?.cost),
          color_code: isOffSite ? '#f97316' : '#22c55e', // Orange for off-site, green for on-site
          calendar_notes: notes
        };

        const { data: job, error: jobError } = await supabase
          ?.from('jobs')
          ?.insert([jobData])
          ?.select()
          ?.single();

        if (jobError) throw jobError;

        // Create job_parts entry for line item
        const { error: partsError } = await supabase
          ?.from('job_parts')
          ?.insert([{
            job_id: job?.id,
            product_id: item?.product_id || null,
            unit_price: parseFloat(item?.sold_price),
            quantity_used: 1
          }]);

        if (partsError) throw partsError;

        return job;
      });

      const jobs = await Promise.all(jobPromises);

      // Enqueue SMS notifications
      for (const job of jobs) {
        if (job?.vendor_id) {
          await onSMSEnqueue(job?.id, 'NEW');
        }
        await onSMSEnqueue(job?.id, 'BOOKED');
      }

      onSuccess();
    } catch (error) {
      console.error('Create deal error:', error);
      setError(error?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Deal Creation Form</h3>
              <p className="text-sm text-gray-600 mt-1">
                Single scrollable form - Stock Number first, all sections visible
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col max-h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Vehicle Section - Stock Number FIRST */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2" />
                Vehicle Section
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* FIRST FIELD - Stock Number - Made Smaller (1/3 width) */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Stock Number
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      ref={stockInputRef}
                      type="text"
                      value={vehicleData?.stock_number}
                      onChange={(e) => {
                        setVehicleData(prev => ({ ...prev, stock_number: e?.target?.value }));
                        if (!e?.target?.value) {
                          setSelectedVehicle(null);
                        }
                      }}
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter Stock # - exact match first, then partial..."
                      required
                    />
                  </div>

                  {/* Vehicle Suggestions */}
                  {showSuggestions && vehicleSuggestions?.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {vehicleSuggestions?.map((vehicle) => (
                        <button
                          key={vehicle?.id}
                          type="button"
                          onClick={() => handleVehicleSelect(vehicle)}
                          className="w-full text-left p-4 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-blue-600">
                            Stock: {vehicle?.stock_number || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-700">
                            {vehicle?.year} {vehicle?.make} {vehicle?.model}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Empty divs to maintain grid layout and spacing */}
                <div></div>
                <div></div>

                {/* Year, Make, Model - All Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Year
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2030"
                    value={vehicleData?.year}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, year: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Make
                  </label>
                  <input
                    type="text"
                    value={vehicleData?.make}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, make: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Model
                  </label>
                  <input
                    type="text"
                    value={vehicleData?.model}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, model: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* New/Used Toggle with Clear Visual */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New/Used</label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setVehicleData(prev => ({ ...prev, new_used: 'new' }))}
                      className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                        vehicleData?.new_used === 'new' ?'bg-white text-blue-600 shadow-sm' :'text-gray-600'
                      }`}
                    >
                      New
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleData(prev => ({ ...prev, new_used: 'used' }))}
                      className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                        vehicleData?.new_used === 'used' ?'bg-white text-blue-600 shadow-sm' :'text-gray-600'
                      }`}
                    >
                      Used
                    </button>
                  </div>
                </div>

                {/* Empty div to maintain spacing */}
                <div></div>

                {/* Customer Needs Loaner Vehicle - Proper UI Library Checkbox */}
                <div className="md:col-span-3">
                  <Checkbox
                    checked={vehicleData?.customer_needs_loaner}
                    onChange={(checked) => setVehicleData(prev => ({ 
                      ...prev, 
                      customer_needs_loaner: checked 
                    }))}
                    label="Customer Needs Loaner Vehicle"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Customer Section */}
            <div className="bg-green-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Customer Section
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerData?.name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, name: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={customerData?.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={customerData?.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Staff Assignment */}
            <div className="bg-purple-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Staff Assignment
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Person
                  </label>
                  <select
                    value={staffData?.sales_person}
                    onChange={(e) => setStaffData(prev => ({ ...prev, sales_person: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Sales Person</option>
                    {staffMembers?.sales_people?.map((staff) => (
                      <option key={staff?.id} value={staff?.id}>
                        {staff?.full_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">General Sales Manager does not appear here</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Coordinator
                  </label>
                  <select
                    value={staffData?.delivery_coordinator}
                    onChange={(e) => setStaffData(prev => ({ ...prev, delivery_coordinator: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Delivery Coordinator</option>
                    {staffMembers?.delivery_coordinators?.map((staff) => (
                      <option key={staff?.id} value={staff?.id}>
                        {staff?.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Finance Manager
                  </label>
                  <select
                    value={staffData?.finance_manager}
                    onChange={(e) => setStaffData(prev => ({ ...prev, finance_manager: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Finance Manager</option>
                    {staffMembers?.finance_managers?.map((staff) => (
                      <option key={staff?.id} value={staff?.id}>
                        {staff?.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Date Section */}
            <div className="bg-yellow-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Date Section
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Today's Date (auto-filled, editable)
                  </label>
                  <input
                    type="date"
                    value={dateData?.todays_date}
                    onChange={(e) => setDateData(prev => ({ ...prev, todays_date: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Promised Date (no time component)
                  </label>
                  <input
                    type="date"
                    value={dateData?.promised_date}
                    onChange={(e) => setDateData(prev => ({ ...prev, promised_date: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="bg-indigo-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Line Items
                </span>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Line Item</span>
                </button>
              </h4>
              
              {lineItems?.map((item, index) => (
                <div key={item?.id} className="bg-white p-4 rounded-lg border-2 border-indigo-200 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-medium text-gray-900">Line Item #{index + 1}</h5>
                    {lineItems?.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Product Name Dropdown - Remove "Add New" option */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="text-red-500">*</span> Product Name
                      </label>
                      <select
                        value={item?.product_id}
                        onChange={(e) => {
                          const selectedProduct = products?.find(p => p?.id === e?.target?.value);
                          updateLineItem(index, 'product_id', e?.target?.value);
                          updateLineItem(index, 'product_name', selectedProduct?.name || '');
                          updateLineItem(index, 'cost', selectedProduct?.cost || '');
                          updateLineItem(index, 'sold_price', selectedProduct?.unit_price || '');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select Product</option>
                        {products?.map((product) => (
                          <option key={product?.id} value={product?.id}>
                            {product?.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sold Price (required) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="text-red-500">*</span> Sold Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item?.sold_price}
                        onChange={(e) => updateLineItem(index, 'sold_price', e?.target?.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    {/* Cost (required) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="text-red-500">*</span> Cost
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item?.cost}
                        onChange={(e) => updateLineItem(index, 'cost', e?.target?.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    {/* Profit (auto-calculated, read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profit (auto-calculated)
                      </label>
                      <input
                        type="text"
                        value={`$${item?.profit?.toFixed(2) || '0.00'}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* Off-Site Work Checkbox with Visible Checkmark */}
                    <div>
                      <Checkbox
                        checked={item?.off_site_work}
                        onChange={(checked) => updateLineItem(index, 'off_site_work', checked)}
                        label="Off-Site Work"
                        className="text-sm"
                      />
                    </div>

                    {/* Vendor Dropdown (only when Off-Site is checked) */}
                    {item?.off_site_work && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Vendor
                        </label>
                        <select
                          value={item?.vendor_id}
                          onChange={(e) => updateLineItem(index, 'vendor_id', e?.target?.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Vendor</option>
                          {vendors?.map((vendor) => (
                            <option key={vendor?.id} value={vendor?.id}>
                              {vendor?.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Per-line Promised Date (optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Per-line Promised Date (optional)
                      </label>
                      <input
                        type="date"
                        value={item?.promised_date}
                        onChange={(e) => updateLineItem(index, 'promised_date', e?.target?.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes Section */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Notes</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                rows="4"
                placeholder="Free text area for additional notes and details..."
              />
            </div>
          </div>

          {/* Footer - Single Save Deal Button */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields | 
                Form saves via single Save Deal button
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors font-medium"
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>}
                  <span>{loading ? 'Saving Deal...' : 'Save Deal'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;