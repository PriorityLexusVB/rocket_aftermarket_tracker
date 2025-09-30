import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { DollarSign, TrendingUp, Package, BarChart3, Calendar, Search, Filter, Download, Plus, ShoppingCart, FileText, Users, Settings, Eye, Edit, Trash2, X, Save, User, Car, Wrench, Clock, Star, Phone, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { vehicleService } from '../../services/vehicleService';
import vendorService from '../../services/vendorService';
import productService from '../../services/productService';

const DealsPage = () => {
  const [view, setView] = useState('table');
  const [workOrders, setWorkOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [loading, setLoading] = useState(true);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    avgProfit: 0,
    inHousePercentage: 0,
    completedJobs: 0
  });

  // Enhanced New Sale Modal State
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [vendorAssignments, setVendorAssignments] = useState({});
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Enhanced Vehicle Search State
  const [vehicleSearchType, setVehicleSearchType] = useState('stock');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleSearchResults, setVehicleSearchResults] = useState([]);
  const [isSearchingVehicles, setIsSearchingVehicles] = useState(false);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [newVehicleData, setNewVehicleData] = useState({
    stock_number: '',
    vin: '',
    year: '',
    make: '',
    model: '',
    color: '',
    mileage: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    license_plate: ''
  });

  // Add New Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    category: '',
    unit_price: '',
    description: '',
    brand: '',
    quantity_in_stock: ''
  });
  const [isSavingNewProduct, setIsSavingNewProduct] = useState(false);

  // Add New Vendor Modal State
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: '',
    phone: '',
    email: '',
    contact_person: '',
    specialty: '',
    rating: '',
    address: '',
    notes: ''
  });
  const [isSavingNewVendor, setIsSavingNewVendor] = useState(false);

  // Real data state
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadWorkOrders();
  }, [dateRange, statusFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load all necessary data in parallel
      const [vendorsData, productsData, vehiclesData] = await Promise.all([
        vendorService?.getAllVendors(),
        productService?.getAllProducts(),
        vehicleService?.getVehicles()
      ]);

      setVendors(vendorsData || []);
      setProducts(productsData || []);
      setVehicles(vehiclesData?.data || []);
    } catch (error) {
      setError(`Failed to load initial data: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      
      let query = supabase?.from('jobs')?.select(`
          *,
          vehicles (stock_number, year, make, model, color, vin, owner_name, owner_phone),
          vendors (name, phone, email, specialty, rating),
          job_parts (
            id,
            products (name, unit_price, category)
          ),
          transactions (
            total_amount,
            subtotal,
            tax_amount,
            transaction_status
          )
        `)?.order('created_at', { ascending: false });

      if (dateRange?.start) {
        query = query?.gte('created_at', dateRange?.start);
      }
      if (dateRange?.end) {
        query = query?.lte('created_at', dateRange?.end + 'T23:59:59');
      }

      if (statusFilter !== 'all') {
        query = query?.eq('job_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        setError(`Failed to load work orders: ${error?.message}`);
        return;
      }

      setWorkOrders(data || []);
      calculateKPIs(data || []);
    } catch (error) {
      setError(`Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.`);
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (orders) => {
    const completedOrders = orders?.filter(order => order?.job_status === 'completed');
    const totalRevenue = completedOrders?.reduce((sum, order) => {
      const transaction = order?.transactions?.[0];
      return sum + (transaction?.total_amount || order?.estimated_cost || 0);
    }, 0);

    const avgProfit = completedOrders?.length > 0 ? totalRevenue / completedOrders?.length : 0;
    
    const inHouseJobs = orders?.filter(order => !order?.vendor_id)?.length;
    const inHousePercentage = orders?.length > 0 ? (inHouseJobs / orders?.length) * 100 : 0;

    setKpis({
      totalRevenue,
      avgProfit,
      inHousePercentage,
      completedJobs: completedOrders?.length
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'scheduled': 'bg-blue-100 text-blue-800 border-blue-300',
      'in_progress': 'bg-purple-100 text-purple-800 border-purple-300',
      'quality_check': 'bg-orange-100 text-orange-800 border-orange-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors?.[status] || colors?.pending;
  };

  // Enhanced Vehicle Search Functions using real Supabase data
  const searchVehicles = async () => {
    setIsSearchingVehicles(true);
    setVehicleSearchResults([]);
    
    try {
      let searchResults = [];

      if (vehicleSearchType === 'stock' && vehicleSearchQuery?.trim()) {
        // Search by stock number
        const { data, error } = await supabase
          ?.from('vehicles')
          ?.select('*')
          ?.ilike('stock_number', `%${vehicleSearchQuery?.trim()}%`);
          
        if (!error) {
          searchResults = data || [];
        }
      } else if (vehicleSearchType === 'vin' && vehicleSearchQuery?.trim()) {
        // Search by VIN
        const { data, error } = await supabase
          ?.from('vehicles')
          ?.select('*')
          ?.ilike('vin', `%${vehicleSearchQuery?.trim()}%`);
          
        if (!error) {
          searchResults = data || [];
        }
      } else if (vehicleSearchType === 'make_model' && vehicleSearchQuery?.trim()) {
        // Search by make/model
        const { data, error } = await supabase
          ?.from('vehicles')
          ?.select('*')
          ?.or(`make.ilike.%${vehicleSearchQuery?.trim()}%,model.ilike.%${vehicleSearchQuery?.trim()}%`);
          
        if (!error) {
          searchResults = data || [];
        }
      }

      setVehicleSearchResults(searchResults);
    } catch (error) {
      setError(`Vehicle search failed: ${error?.message}`);
    } finally {
      setIsSearchingVehicles(false);
    }
  };

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleSearchResults([]);
    setVehicleSearchQuery('');
    
    // Auto-populate customer info if available
    if (vehicle?.owner_name) {
      setCustomerData({
        name: vehicle?.owner_name,
        phone: vehicle?.owner_phone || '',
        email: vehicle?.owner_email || ''
      });
    }
  };

  const handleAddNewVehicle = async () => {
    if (newVehicleData?.year && newVehicleData?.make && newVehicleData?.model) {
      try {
        const vehicleData = {
          stock_number: newVehicleData?.stock_number || `STK-${new Date()?.getFullYear()}-${String(Date.now())?.slice(-3)}`,
          vin: newVehicleData?.vin?.toUpperCase() || `NEW${Date.now()}`,
          year: parseInt(newVehicleData?.year),
          make: newVehicleData?.make,
          model: newVehicleData?.model,
          color: newVehicleData?.color || '',
          mileage: parseInt(newVehicleData?.mileage) || 0,
          owner_name: newVehicleData?.owner_name || '',
          owner_phone: newVehicleData?.owner_phone || '',
          owner_email: newVehicleData?.owner_email || '',
          license_plate: newVehicleData?.license_plate || '',
          vehicle_status: 'active'
        };

        const { data: newVehicle, error } = await vehicleService?.createVehicle(vehicleData);
        
        if (error) {
          setError(`Failed to create vehicle: ${error?.message}`);
          return;
        }

        if (newVehicle) {
          handleVehicleSelect(newVehicle);
          
          // Reset form
          setNewVehicleData({
            stock_number: '',
            vin: '',
            year: '',
            make: '',
            model: '',
            color: '',
            mileage: '',
            owner_name: '',
            owner_phone: '',
            owner_email: '',
            license_plate: ''
          });
          setShowAddVehicleForm(false);
        }
      } catch (error) {
        setError(`Failed to create vehicle: ${error?.message}`);
      }
    }
  };

  // Add missing function declarations
  const handleAddNewProduct = async () => {
    if (newProductData?.name && newProductData?.unit_price) {
      try {
        setIsSavingNewProduct(true);

        const productData = {
          name: newProductData?.name,
          category: newProductData?.category || 'Aftermarket',
          unit_price: parseFloat(newProductData?.unit_price),
          description: newProductData?.description || '',
          brand: newProductData?.brand || 'Generic',
          quantity_in_stock: parseInt(newProductData?.quantity_in_stock) || 1,
          stock_status: parseInt(newProductData?.quantity_in_stock) > 10 ? 'in_stock' : 'low',
          is_active: true
        };

        const { data: newProduct, error } = await productService?.createProduct(productData);
        
        if (error) {
          setError(`Failed to create product: ${error?.message}`);
          return;
        }

        if (newProduct) {
          // Add to products list
          setProducts(prev => [...prev, newProduct]);
          
          // Auto-select the new product
          setSelectedProducts(prev => [...prev, newProduct]);
          
          // Reset form
          setNewProductData({
            name: '',
            category: '',
            unit_price: '',
            description: '',
            brand: '',
            quantity_in_stock: ''
          });
          setShowAddProductModal(false);
        }
      } catch (error) {
        setError(`Failed to create product: ${error?.message}`);
      } finally {
        setIsSavingNewProduct(false);
      }
    }
  };

  const handleAddNewVendor = async () => {
    if (newVendorData?.name && newVendorData?.phone) {
      try {
        setIsSavingNewVendor(true);

        const vendorData = {
          name: newVendorData?.name,
          phone: newVendorData?.phone,
          email: newVendorData?.email || '',
          contact_person: newVendorData?.contact_person || '',
          specialty: newVendorData?.specialty || 'General',
          rating: parseFloat(newVendorData?.rating) || 0,
          address: newVendorData?.address || '',
          notes: newVendorData?.notes || '',
          is_active: true
        };

        const { data: newVendor, error } = await vendorService?.createVendor(vendorData);
        
        if (error) {
          setError(`Failed to create vendor: ${error?.message}`);
          return;
        }

        if (newVendor) {
          // Add to vendors list
          setVendors(prev => [...prev, newVendor]);
          
          // Reset form
          setNewVendorData({
            name: '',
            phone: '',
            email: '',
            contact_person: '',
            specialty: '',
            rating: '',
            address: '',
            notes: ''
          });
          setShowAddVendorModal(false);
        }
      } catch (error) {
        setError(`Failed to create vendor: ${error?.message}`);
      } finally {
        setIsSavingNewVendor(false);
      }
    }
  };

  const handleProductToggle = (product, isSelected) => {
    if (isSelected) {
      setSelectedProducts(prev => [...prev, product]);
    } else {
      setSelectedProducts(prev => prev?.filter(p => p?.id !== product?.id));
      // Remove vendor assignment when product is deselected
      setVendorAssignments(prev => {
        const updated = { ...prev };
        delete updated?.[product?.id];
        return updated;
      });
    }
  };

  const handleVendorAssign = (productId, vendor) => {
    setVendorAssignments(prev => ({
      ...prev,
      [productId]: vendor
    }));
  };

  const calculateTotals = () => {
    const totalPrice = selectedProducts?.reduce((sum, product) => sum + (product?.unit_price || 0), 0);
    const totalCost = selectedProducts?.reduce((sum, product) => sum + ((product?.unit_price || 0) * 0.6), 0); // Assume 40% margin
    const totalProfit = totalPrice - totalCost;
    
    return { totalPrice, totalCost, totalProfit };
  };

  const handleSaveTransaction = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const { totalPrice, totalCost, totalProfit } = calculateTotals();
      
      // Create job first
      const jobData = {
        title: `Aftermarket Services - ${selectedVehicle?.year} ${selectedVehicle?.make} ${selectedVehicle?.model}`,
        description: `Services: ${selectedProducts?.map(p => p?.name)?.join(', ')}`,
        vehicle_id: selectedVehicle?.id,
        job_status: 'scheduled',
        priority: 'medium',
        estimated_cost: totalPrice,
        scheduled_start_time: `${scheduledDate}T${scheduledTime}:00`,
        scheduled_end_time: `${scheduledDate}T${parseInt(scheduledTime?.split(':')?.[0]) + 4}:00:00`, // Assume 4 hours
        calendar_notes: notes,
        vendor_id: selectedProducts?.length > 0 ? vendorAssignments?.[selectedProducts?.[0]?.id]?.id : null
      };

      const { data: newJob, error: jobError } = await supabase
        ?.from('jobs')
        ?.insert([jobData])
        ?.select()
        ?.single();

      if (jobError) {
        setError(`Failed to create job: ${jobError?.message}`);
        return;
      }

      // Create job parts
      if (selectedProducts?.length > 0 && newJob?.id) {
        const jobParts = selectedProducts?.map(product => ({
          job_id: newJob?.id,
          product_id: product?.id
        }));

        const { error: partsError } = await supabase
          ?.from('job_parts')
          ?.insert(jobParts);

        if (partsError) {
          setError(`Failed to create job parts: ${partsError?.message}`);
        }
      }

      // Create transaction
      if (newJob?.id) {
        const transactionData = {
          job_id: newJob?.id,
          vehicle_id: selectedVehicle?.id,
          customer_name: customerData?.name,
          customer_email: customerData?.email || null,
          customer_phone: customerData?.phone || null,
          subtotal: totalPrice,
          tax_amount: totalPrice * 0.08, // 8% tax
          total_amount: totalPrice * 1.08,
          transaction_status: 'pending',
          notes: notes
        };

        const { error: transactionError } = await supabase
          ?.from('transactions')
          ?.insert([transactionData]);

        if (transactionError) {
          setError(`Failed to create transaction: ${transactionError?.message}`);
        }
      }

      // Success
      alert(`Sale saved successfully!\nJob Number: ${newJob?.job_number}\nTotal: $${totalPrice?.toFixed(2)}\nProfit: $${totalProfit?.toFixed(2)}`);
      
      handleResetForm();
      setShowNewSaleModal(false);
      loadWorkOrders(); // Refresh the list
    } catch (error) {
      setError(`Error saving transaction: ${error?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    setCustomerData({ name: '', email: '', phone: '' });
    setSelectedVehicle(null);
    setSelectedProducts([]);
    setVendorAssignments({});
    setScheduledDate(format(new Date(), 'yyyy-MM-dd'));
    setScheduledTime('09:00');
    setNotes('');
    setVehicleSearchQuery('');
    setVehicleSearchResults([]);
    setShowAddVehicleForm(false);
    setNewVehicleData({
      stock_number: '',
      vin: '',
      year: '',
      make: '',
      model: '',
      color: '',
      mileage: '',
      owner_name: '',
      owner_phone: '',
      owner_email: '',
      license_plate: ''
    });
  };

  const handleCreateNewSale = () => {
    handleResetForm();
    setShowNewSaleModal(true);
  };

  const handleQuickAdd = () => {
    handleResetForm();
    setShowQuickAddModal(true);
  };

  const handleViewDeal = (deal) => {
    setSelectedDeal(deal);
  };

  const handleEditDeal = (deal) => {
    setSelectedDeal(deal);
    setShowNewSaleModal(true);
  };

  const handleDeleteDeal = async (dealId) => {
    if (confirm('Are you sure you want to delete this deal?')) {
      try {
        const { error } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);
        if (error) {
          setError(`Failed to delete deal: ${error?.message}`);
        } else {
          loadWorkOrders();
        }
      } catch (error) {
        setError(`Failed to delete deal: ${error?.message}`);
      }
    }
  };

  const handleScheduleJob = async (jobId) => {
    try {
      const { error } = await supabase?.from('jobs')?.update({ 
          job_status: 'scheduled',
          scheduled_start_time: new Date()?.toISOString()
        })?.eq('id', jobId);

      if (error) {
        setError(`Failed to schedule job: ${error?.message}`);
      } else {
        loadWorkOrders();
      }
    } catch (error) {
      setError(`Failed to schedule job: ${error?.message}`);
    }
  };

  const handleCompleteJob = async (jobId) => {
    try {
      const { error } = await supabase?.from('jobs')?.update({ 
          job_status: 'completed',
          completed_at: new Date()?.toISOString()
        })?.eq('id', jobId);

      if (error) {
        setError(`Failed to complete job: ${error?.message}`);
      } else {
        loadWorkOrders();
      }
    } catch (error) {
      setError(`Failed to complete job: ${error?.message}`);
    }
  };

  const filteredOrders = workOrders?.filter(order => {
    if (!searchQuery) return true;
    
    const searchTerm = searchQuery?.toLowerCase();
    return (order?.title?.toLowerCase()?.includes(searchTerm) ||
    order?.job_number?.toLowerCase()?.includes(searchTerm) ||
    order?.vehicles?.stock_number?.toLowerCase()?.includes(searchTerm) || 
    order?.vehicles?.owner_name?.toLowerCase()?.includes(searchTerm));
  });

  const canSave = customerData?.name && selectedVehicle && selectedProducts?.length > 0;

  // Step validation
  const isStepComplete = (step) => {
    switch (step) {
      case 1: return customerData?.name?.trim() !== '';
      case 2: return selectedVehicle !== null;
      case 3: return selectedProducts?.length > 0;
      case 4: return Object.keys(vendorAssignments)?.length === selectedProducts?.length;
      default: return false;
    }
  };

  if (loading && workOrders?.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mx-6 mt-4 flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Enhanced Header with All Awesome Features */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Aftermarket Sales Hub</h1>
            
            {/* Enhanced Date Range */}
            <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateRange?.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e?.target?.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange?.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e?.target?.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Enhanced Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search stock #, customer, VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-72 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e?.target?.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="quality_check">Quality Check</option>
              <option value="completed">Completed</option>
            </select>

            {/* Enhanced Sales Action Buttons */}
            <button
              onClick={handleQuickAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 shadow-sm transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Quick Add</span>
            </button>

            <button
              onClick={handleCreateNewSale}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Sale</span>
            </button>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  view === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  view === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Kanban
              </button>
            </div>

            <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2 shadow-sm transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced KPI Cards with Real Data */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-green-50 rounded-lg p-4 cursor-pointer hover:bg-green-100 transition-colors border border-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-700">Total Revenue</span>
              </div>
              <FileText className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-900 mt-2">
              ${kpis?.totalRevenue?.toLocaleString()}
            </div>
            <div className="text-xs text-green-600 mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Real-time data
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-700">Avg Profit</span>
              </div>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-2">
              ${kpis?.avgProfit?.toFixed(0)}
            </div>
            <div className="text-xs text-blue-600 mt-1">Per deal closed</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 cursor-pointer hover:bg-purple-100 transition-colors border border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="w-5 h-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-purple-700">% In-House</span>
              </div>
              <Settings className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-2">
              {kpis?.inHousePercentage?.toFixed(1)}%
            </div>
            <div className="text-xs text-purple-600 mt-1">vs outsourced work</div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 cursor-pointer hover:bg-orange-100 transition-colors border border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-orange-700">Completed</span>
              </div>
              <TrendingUp className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-900 mt-2">
              {kpis?.completedJobs}
            </div>
            <div className="text-xs text-orange-600 mt-1">This period</div>
          </div>
        </div>
      </div>

      {/* Content with Real Supabase Data */}
      <div className="flex-1 overflow-hidden">
        {view === 'table' ? (
          <div className="h-full overflow-auto p-6">
            <div className="bg-white rounded-lg shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehicle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders?.map((order) => (
                      <tr key={order?.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{order?.title}</div>
                          <div className="text-sm text-gray-500">{order?.job_number}</div>
                          {order?.description && (
                            <div className="text-xs text-gray-400 mt-1">{order?.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            Stock: {order?.vehicles?.stock_number || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order?.vehicles?.year} {order?.vehicles?.make} {order?.vehicles?.model}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order?.vehicles?.owner_name}</div>
                          <div className="text-sm text-gray-500">{order?.vehicles?.owner_phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order?.vendors?.name || 'In-House'}</div>
                          {order?.vendors?.specialty && (
                            <div className="text-sm text-gray-500">{order?.vendors?.specialty}</div>
                          )}
                          {order?.vendors?.rating && (
                            <div className="text-xs text-yellow-600 flex items-center">
                              <Star className="w-3 h-3 mr-1" fill="currentColor" />
                              {order?.vendors?.rating}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(order?.job_status)}`}>
                            {order?.job_status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">
                            ${(order?.transactions?.[0]?.total_amount || order?.estimated_cost || 0)?.toLocaleString()}
                          </div>
                          {order?.job_parts?.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {order?.job_parts?.length} items
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDeal(order)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditDeal(order)}
                              className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                              title="Edit Deal"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {order?.job_status === 'pending' && (
                              <button
                                onClick={() => handleScheduleJob(order?.id)}
                                className="text-green-600 hover:text-green-900 px-2 py-1 text-xs rounded border border-green-300 hover:bg-green-50 transition-colors"
                              >
                                Schedule
                              </button>
                            )}
                            {(order?.job_status === 'in_progress' || order?.job_status === 'quality_check') && (
                              <button
                                onClick={() => handleCompleteJob(order?.id)}
                                className="text-green-600 hover:text-green-900 px-2 py-1 text-xs rounded border border-green-300 hover:bg-green-50 transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDeal(order?.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Delete Deal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          // Enhanced Kanban View with Real Data
          <div className="h-full p-6">
            <div className="grid grid-cols-6 gap-4 h-full">
              {['pending', 'scheduled', 'in_progress', 'quality_check', 'completed', 'cancelled']?.map(status => (
                <div key={status} className="bg-gray-100 rounded-lg shadow-sm">
                  <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {status?.replace('_', ' ')}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {filteredOrders?.filter(order => order?.job_status === status)?.length} deals
                        </span>
                      </div>
                      {status === 'pending' && (
                        <button
                          onClick={handleCreateNewSale}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Add New Sale"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-3 h-96 overflow-y-auto">
                    {filteredOrders?.filter(order => order?.job_status === status)?.map(order => (
                        <div
                          key={order?.id}
                          className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md group transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900 mb-1">{order?.title}</div>
                              <div className="text-xs text-gray-500 mb-2">{order?.job_number}</div>
                              {order?.vehicles && (
                                <div className="text-xs text-blue-600 mb-2 flex items-center">
                                  <Car className="w-3 h-3 mr-1" />
                                  Stock: {order?.vehicles?.stock_number} • {order?.vehicles?.year} {order?.vehicles?.make}
                                </div>
                              )}
                              {order?.vendors && (
                                <div className="text-xs text-purple-600 mb-2 flex items-center">
                                  <Users className="w-3 h-3 mr-1" />
                                  {order?.vendors?.name}
                                </div>
                              )}
                              <div className="text-xs text-gray-600 flex items-center justify-between">
                                <span className="font-medium flex items-center">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  ${(order?.transactions?.[0]?.total_amount || order?.estimated_cost || 0)?.toLocaleString()}
                                </span>
                                {order?.job_parts?.length > 0 && (
                                  <span className="text-gray-400 flex items-center">
                                    <Package className="w-3 h-3 mr-1" />
                                    {order?.job_parts?.length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e?.stopPropagation();
                                  handleViewDeal(order);
                                }}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e?.stopPropagation();
                                  handleEditDeal(order);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-50 transition-colors"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={handleQuickAdd}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all group"
          title="Quick Add Sale"
        >
          <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={handleCreateNewSale}
          className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 hover:shadow-xl transition-all group"
          title="Create New Sale"
        >
          <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={() => {
            loadInitialData();
            loadWorkOrders();
          }}
          className="bg-gray-600 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 hover:shadow-xl transition-all group"
          title="Refresh Data"
        >
          <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-300" />
        </button>
      </div>

      {/* Comprehensive Enhanced New Sale Modal with Real Supabase Integration */}
      {showNewSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* Enhanced Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedDeal ? 'Edit Deal' : 'Create New Aftermarket Sale'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Complete aftermarket sale with stock number lookup, calendar scheduling, and vendor assignment</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleResetForm}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={handleSaveTransaction}
                  disabled={!canSave || isSaving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save Sale'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowNewSaleModal(false);
                    handleResetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Enhanced Progress Indicator with Steps */}
              <div className="mb-8">
                <div className="flex items-center space-x-4 text-sm mb-4">
                  <div className={`flex items-center space-x-2 ${isStepComplete(1) ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isStepComplete(1) ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300'}`}>
                      {isStepComplete(1) ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-medium">Customer Info</span>
                  </div>
                  <div className="w-8 h-px bg-gray-300"></div>
                  <div className={`flex items-center space-x-2 ${isStepComplete(2) ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isStepComplete(2) ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300'}`}>
                      {isStepComplete(2) ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Car className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-medium">Vehicle & Stock #</span>
                  </div>
                  <div className="w-8 h-px bg-gray-300"></div>
                  <div className={`flex items-center space-x-2 ${isStepComplete(3) ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isStepComplete(3) ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300'}`}>
                      {isStepComplete(3) ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Wrench className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-medium">Services ({selectedProducts?.length})</span>
                  </div>
                  <div className="w-8 h-px bg-gray-300"></div>
                  <div className={`flex items-center space-x-2 ${isStepComplete(4) ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isStepComplete(4) ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300'}`}>
                      {isStepComplete(4) ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-medium">Vendors ({Object.keys(vendorAssignments)?.length})</span>
                  </div>
                  <div className="w-8 h-px bg-gray-300"></div>
                  <div className={`flex items-center space-x-2 ${scheduledDate && scheduledTime ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${scheduledDate && scheduledTime ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300'}`}>
                      {scheduledDate && scheduledTime ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-medium">Schedule</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(([isStepComplete(1), isStepComplete(2), isStepComplete(3), isStepComplete(4), scheduledDate && scheduledTime]?.filter(Boolean)?.length) / 5) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Form Content Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column - Main Form */}
                <div className="xl:col-span-2 space-y-6">
                  
                  {/* Enhanced Customer Information */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
                        <p className="text-sm text-gray-600">Enter customer details for this aftermarket sale</p>
                      </div>
                      {isStepComplete(1) && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                        <input
                          type="text"
                          placeholder="John Smith"
                          value={customerData?.name}
                          onChange={(e) => setCustomerData(prev => ({ ...prev, name: e?.target?.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          placeholder="customer@email.com"
                          value={customerData?.email}
                          onChange={(e) => setCustomerData(prev => ({ ...prev, email: e?.target?.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={customerData?.phone}
                          onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e?.target?.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Vehicle Selection with Real Stock Number Lookup */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Search className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Vehicle Selection & Stock Number Lookup</h3>
                          <p className="text-sm text-gray-600">Search by stock number, VIN, or make/model</p>
                        </div>
                        {isStepComplete(2) && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <button
                        onClick={() => setShowAddVehicleForm(!showAddVehicleForm)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Vehicle</span>
                      </button>
                    </div>

                    {/* Add New Vehicle Form with Real Supabase Integration */}
                    {showAddVehicleForm && (
                      <div className="mb-6 p-6 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-medium text-gray-900 flex items-center">
                            <Plus className="w-5 h-5 mr-2 text-green-600" />
                            Add New Vehicle to Database
                          </h4>
                          <button
                            onClick={() => setShowAddVehicleForm(false)}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Stock Number</label>
                            <input
                              type="text"
                              placeholder="STK-2025-001 (auto-generated if blank)"
                              value={newVehicleData?.stock_number}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, stock_number: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">VIN Number</label>
                            <input
                              type="text"
                              placeholder="17-character VIN"
                              maxLength={17}
                              value={newVehicleData?.vin}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, vin: e?.target?.value?.toUpperCase() }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Year *</label>
                            <input
                              type="number"
                              min="1980"
                              max="2025"
                              placeholder="2025"
                              value={newVehicleData?.year}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, year: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Make *</label>
                            <input
                              type="text"
                              placeholder="Honda, Toyota, Ford, etc."
                              value={newVehicleData?.make}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, make: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model *</label>
                            <input
                              type="text"
                              placeholder="Civic, Camry, F-150, etc."
                              value={newVehicleData?.model}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, model: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <input
                              type="text"
                              placeholder="Red, Blue, White, etc."
                              value={newVehicleData?.color}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, color: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Mileage</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="50000"
                              value={newVehicleData?.mileage}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, mileage: e?.target?.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">License Plate</label>
                            <input
                              type="text"
                              placeholder="ABC-123"
                              value={newVehicleData?.license_plate}
                              onChange={(e) => setNewVehicleData(prev => ({ ...prev, license_plate: e?.target?.value?.toUpperCase() }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                            <User className="w-4 h-4 mr-2" />
                            Vehicle Owner Information
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                              <input
                                type="text"
                                placeholder="John Smith"
                                value={newVehicleData?.owner_name}
                                onChange={(e) => setNewVehicleData(prev => ({ ...prev, owner_name: e?.target?.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Owner Phone</label>
                              <input
                                type="tel"
                                placeholder="(555) 123-4567"
                                value={newVehicleData?.owner_phone}
                                onChange={(e) => setNewVehicleData(prev => ({ ...prev, owner_phone: e?.target?.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Owner Email</label>
                              <input
                                type="email"
                                placeholder="owner@email.com"
                                value={newVehicleData?.owner_email}
                                onChange={(e) => setNewVehicleData(prev => ({ ...prev, owner_email: e?.target?.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => setShowAddVehicleForm(false)}
                            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddNewVehicle}
                            disabled={!newVehicleData?.year || !newVehicleData?.make || !newVehicleData?.model}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Vehicle</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search Type Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search Method</label>
                      <select
                        value={vehicleSearchType}
                        onChange={(e) => setVehicleSearchType(e?.target?.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                      >
                        <option value="stock">Search by Stock Number</option>
                        <option value="vin">Search by VIN</option>
                        <option value="make_model">Search by Make/Model</option>
                      </select>
                    </div>

                    {/* Real Vehicle Search */}
                    <div className="flex space-x-3 mb-4">
                      <input
                        type="text"
                        placeholder={
                          vehicleSearchType === 'stock' ? 'Enter stock number (e.g., ST2025001)' :
                          vehicleSearchType === 'vin'? 'Enter VIN number' : 'Enter make and model'
                        }
                        value={vehicleSearchQuery}
                        onChange={(e) => setVehicleSearchQuery(e?.target?.value?.toUpperCase())}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                        onKeyPress={(e) => e?.key === 'Enter' && searchVehicles()}
                      />
                      <button
                        onClick={searchVehicles}
                        disabled={isSearchingVehicles}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                      >
                        {isSearchingVehicles ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span>Search</span>
                      </button>
                    </div>

                    {/* Enhanced Search Results from Real Database */}
                    {vehicleSearchResults?.length > 0 && (
                      <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-900">Search Results</h4>
                          <span className="text-xs text-gray-500">{vehicleSearchResults?.length} vehicles found</span>
                        </div>
                        {vehicleSearchResults?.map((vehicle) => (
                          <div
                            key={vehicle?.id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedVehicle?.id === vehicle?.id
                                ? 'border-green-500 bg-green-50' :'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                            onClick={() => handleVehicleSelect(vehicle)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 flex items-center">
                                  <Car className="w-4 h-4 mr-2 text-green-600" />
                                  {vehicle?.year} {vehicle?.make} {vehicle?.model}
                                  {selectedVehicle?.id === vehicle?.id && (
                                    <CheckCircle className="w-4 h-4 ml-2 text-green-600" />
                                  )}
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mt-2">
                                  <div className="flex items-center">
                                    <span className="font-medium">Stock:</span>
                                    <span className="ml-1 font-mono">{vehicle?.stock_number || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="font-medium">VIN:</span>
                                    <span className="ml-1 font-mono">{vehicle?.vin?.slice(-6) || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="font-medium">Color:</span>
                                    <span className="ml-1">{vehicle?.color || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="font-medium">Miles:</span>
                                    <span className="ml-1">{vehicle?.mileage?.toLocaleString() || 'N/A'}</span>
                                  </div>
                                </div>
                                {vehicle?.owner_name && (
                                  <div className="text-sm text-gray-600 mt-2 flex items-center">
                                    <User className="w-4 h-4 mr-1" />
                                    <span className="font-medium">Owner:</span>
                                    <span className="ml-1">{vehicle?.owner_name} - {vehicle?.owner_phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Vehicle Summary */}
                    {selectedVehicle && (
                      <div className="p-4 bg-white border-2 border-green-300 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <Car className="w-5 h-5 text-green-600" />
                          <h4 className="font-medium text-gray-900">Selected Vehicle</h4>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Vehicle:</span>
                            <p className="font-medium text-gray-900">
                              {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Stock #:</span>
                            <p className="font-medium text-gray-900 font-mono">{selectedVehicle?.stock_number || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">VIN:</span>
                            <p className="font-medium text-gray-900 font-mono">{selectedVehicle?.vin || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Mileage:</span>
                            <p className="font-medium text-gray-900">{selectedVehicle?.mileage?.toLocaleString() || 'N/A'} mi</p>
                          </div>
                        </div>
                        {selectedVehicle?.owner_name && (
                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-600" />
                            <span className="text-gray-600">Owner:</span>
                            <p className="font-medium text-gray-900 ml-1">
                              {selectedVehicle?.owner_name}
                            </p>
                            {selectedVehicle?.owner_phone && (
                              <>
                                <Phone className="w-4 h-4 mx-2 text-gray-600" />
                                <p className="text-gray-900">{selectedVehicle?.owner_phone}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Enhanced Product/Service Selection with Real Database Products */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Aftermarket Services & Products</h3>
                        <p className="text-sm text-gray-600">Select services and products ({selectedProducts?.length} selected)</p>
                      </div>
                      {isStepComplete(3) && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {products?.map((product) => {
                        const isSelected = selectedProducts?.some(p => p?.id === product?.id);
                        return (
                          <div
                            key={product?.id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-green-500 bg-green-50' :'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                            }`}
                            onClick={() => handleProductToggle(product, !isSelected)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{product?.name}</h4>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-green-600">${product?.unit_price?.toFixed(2)}</span>
                                {isSelected && (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{product?.category}</p>
                            <p className="text-xs text-gray-500 mb-2">{product?.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Brand: {product?.brand || 'Generic'}</span>
                              <div className="flex items-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  product?.stock_status === 'low' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  Stock: {product?.quantity_in_stock || 0}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                              Vendor: {product?.vendor_name || 'N/A'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enhanced Vendor Assignment with Real Database Vendors */}
                  {selectedProducts?.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-lg p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Vendor Assignment & Scheduling</h3>
                          <p className="text-sm text-gray-600">Assign qualified vendors to each service</p>
                        </div>
                        {isStepComplete(4) && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="space-y-4">
                        {selectedProducts?.map((product) => {
                          const assignedVendor = vendorAssignments?.[product?.id];
                          // Filter vendors by specialty match
                          const availableVendors = vendors?.filter(vendor => 
                            vendor?.specialty && product?.category && 
                            (vendor?.specialty?.toLowerCase()?.includes(product?.category?.toLowerCase()) ||
                             product?.category?.toLowerCase()?.includes(vendor?.specialty?.toLowerCase()) ||
                             vendor?.is_active === true)
                          ) || vendors?.filter(v => v?.is_active) || [];
                          
                          return (
                            <div key={product?.id} className="p-4 border border-gray-200 rounded-lg bg-white">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                  <Wrench className="w-4 h-4 mr-2 text-purple-600" />
                                  {product?.name}
                                </h4>
                                {assignedVendor && (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Vendor Assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <select
                                  value={assignedVendor?.id || ''}
                                  onChange={(e) => {
                                    const vendor = vendors?.find(v => v?.id === e?.target?.value);
                                    handleVendorAssign(product?.id, vendor);
                                  }}
                                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                                >
                                  <option value="">Select Vendor</option>
                                  {availableVendors?.map((vendor) => (
                                    <option key={vendor?.id} value={vendor?.id}>
                                      {vendor?.name} {vendor?.rating ? `(${vendor?.rating}⭐)` : ''} - {vendor?.specialty || 'General'}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setShowAddVendorModal(true)}
                                  className="px-3 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                                  title="Add New Vendor"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              {assignedVendor && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center">
                                      <Star className="w-4 h-4 mr-1 text-yellow-400" />
                                      <span className="text-gray-600">Rating:</span>
                                      <p className="font-medium ml-1">{assignedVendor?.rating}⭐</p>
                                    </div>
                                    <div className="flex items-center">
                                      <Phone className="w-4 h-4 mr-1 text-green-600" />
                                      <span className="text-gray-600">Phone:</span>
                                      <p className="font-medium ml-1">{assignedVendor?.phone || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center">
                                      <User className="w-4 h-4 mr-1 text-blue-600" />
                                      <span className="text-gray-600">Contact:</span>
                                      <p className="font-medium ml-1">{assignedVendor?.contact_person || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center">
                                      <Settings className="w-4 h-4 mr-1 text-purple-600" />
                                      <span className="text-gray-600">Specialty:</span>
                                      <p className="font-medium ml-1">{assignedVendor?.specialty || 'General'}</p>
                                    </div>
                                  </div>
                                  {assignedVendor?.notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <span className="text-sm text-gray-600">Notes:</span>
                                      <p className="text-sm text-gray-800 mt-1">{assignedVendor?.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Calendar/Scheduling */}
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Schedule Service Appointment</h3>
                        <p className="text-sm text-gray-600">Set date and time for service completion</p>
                      </div>
                      {scheduledDate && scheduledTime && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Service Date
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e?.target?.value)}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Service Time
                        </label>
                        <select
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e?.target?.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        >
                          <option value="09:00">9:00 AM</option>
                          <option value="10:00">10:00 AM</option>
                          <option value="11:00">11:00 AM</option>
                          <option value="13:00">1:00 PM</option>
                          <option value="14:00">2:00 PM</option>
                          <option value="15:00">3:00 PM</option>
                          <option value="16:00">4:00 PM</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Service Summary */}
                    {selectedProducts?.length > 0 && (
                      <div className="p-3 bg-white rounded-lg border border-indigo-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-indigo-600" />
                          Service Summary
                        </h4>
                        <div className="space-y-2">
                          {selectedProducts?.map((product, index) => (
                            <div key={product?.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{product?.name}:</span>
                              <span className="font-medium text-indigo-600">${product?.unit_price?.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-gray-200 flex items-center justify-between font-medium">
                            <span>Total Services:</span>
                            <span className="text-indigo-600">
                              ${calculateTotals()?.totalPrice?.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Additional Notes */}
                  <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Additional Notes & Instructions</h3>
                        <p className="text-sm text-gray-600">Special requirements or customer requests</p>
                      </div>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e?.target?.value)}
                      rows={4}
                      placeholder="Enter any special instructions, customer requests, vendor requirements, or additional notes for this aftermarket sale..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none transition-colors"
                    />
                  </div>
                </div>

                {/* Enhanced Right Column - Transaction Summary with Real Data */}
                <div className="space-y-6">
                  {/* Comprehensive Transaction Summary */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                      Transaction Summary
                    </h3>
                    
                    {customerData?.name && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          Customer
                        </h4>
                        <p className="font-medium">{customerData?.name}</p>
                        {customerData?.phone && <p className="text-sm text-gray-600">{customerData?.phone}</p>}
                        {customerData?.email && <p className="text-sm text-gray-600">{customerData?.email}</p>}
                      </div>
                    )}

                    {selectedVehicle && (
                      <div className="mb-4 p-3 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Car className="w-4 h-4 mr-2" />
                          Vehicle
                        </h4>
                        <p className="font-medium">
                          {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
                        </p>
                        <p className="text-sm text-gray-600">Stock: {selectedVehicle?.stock_number || 'N/A'}</p>
                        <p className="text-sm text-gray-600">VIN: {selectedVehicle?.vin || 'N/A'}</p>
                      </div>
                    )}

                    {selectedProducts?.length > 0 && (
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Wrench className="w-4 h-4 mr-2" />
                          Services ({selectedProducts?.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedProducts?.map((product) => (
                            <div key={product?.id} className="flex justify-between text-sm">
                              <span>{product?.name}</span>
                              <div className="text-right">
                                <div className="font-medium">${product?.unit_price?.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">Stock: {product?.quantity_in_stock}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(vendorAssignments)?.length > 0 && (
                      <div className="mb-4 p-3 bg-orange-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          Assigned Vendors
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(vendorAssignments)?.map(([productId, vendor]) => {
                            const product = selectedProducts?.find(p => p?.id === productId);
                            return (
                              <div key={productId} className="text-sm">
                                <div className="font-medium">{vendor?.name}</div>
                                <div className="text-gray-600">{product?.name}</div>
                                <div className="flex items-center text-xs text-gray-500">
                                  <Star className="w-3 h-3 mr-1 text-yellow-400" />
                                  {vendor?.rating || 'N/A'} • {vendor?.specialty || 'General'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {scheduledDate && (
                      <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Scheduled
                        </h4>
                        <p className="font-medium">
                          {format(new Date(scheduledDate), 'MMM dd, yyyy')} at {scheduledTime}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(scheduledDate), 'EEEE')}
                        </p>
                      </div>
                    )}

                    {selectedProducts?.length > 0 && (
                      <div className="border-t border-gray-200 pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Services Total:</span>
                            <span>${calculateTotals()?.totalPrice?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estimated Cost:</span>
                            <span className="text-red-600">${calculateTotals()?.totalCost?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Tax (8%):</span>
                            <span>${(calculateTotals()?.totalPrice * 0.08)?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Profit Margin:</span>
                            <span>{(((calculateTotals()?.totalProfit / calculateTotals()?.totalPrice) * 100) || 0)?.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 text-green-600">
                            <span>Total + Tax:</span>
                            <span>${(calculateTotals()?.totalPrice * 1.08)?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg text-blue-600">
                            <span>Net Profit:</span>
                            <span>${calculateTotals()?.totalProfit?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSaveTransaction}
                        disabled={!canSave || isSaving}
                        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>{isSaving ? 'Saving Sale...' : 'Complete Sale'}</span>
                      </button>
                      
                      {!canSave && (
                        <p className="text-sm text-red-600 mt-2 text-center">
                          Please complete customer, vehicle, and service selection
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Quick Actions */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Quick Actions
                    </h4>
                    <div className="space-y-2">
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2 transition-colors">
                        <Car className="w-4 h-4" />
                        <span>Vehicle History</span>
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2 transition-colors">
                        <Users className="w-4 h-4" />
                        <span>Vendor Performance</span>
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2 transition-colors">
                        <TrendingUp className="w-4 h-4" />
                        <span>Sales Analytics</span>
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2 transition-colors">
                        <Calendar className="w-4 h-4" />
                        <span>Schedule Calendar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-purple-600" />
                Add New Product
              </h2>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                <input
                  type="text"
                  placeholder="Cold Air Intake System"
                  value={newProductData?.name}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, name: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={newProductData?.category}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, category: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                >
                  <option value="">Select Category</option>
                  <option value="Performance">Performance</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Suspension">Suspension</option>
                  <option value="Exhaust">Exhaust</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="299.99"
                  value={newProductData?.unit_price}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, unit_price: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  rows={3}
                  placeholder="High-performance cold air intake system for increased horsepower..."
                  value={newProductData?.description}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, description: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                  <input
                    type="text"
                    placeholder="K&N, AEM, etc."
                    value={newProductData?.brand}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, brand: e?.target?.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={newProductData?.quantity_in_stock}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, quantity_in_stock: e?.target?.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewProduct}
                  disabled={!newProductData?.name || !newProductData?.unit_price || isSavingNewProduct}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                >
                  {isSavingNewProduct ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{isSavingNewProduct ? 'Adding...' : 'Add Product'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-orange-600" />
                Add New Vendor
              </h2>
              <button
                onClick={() => setShowAddVendorModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
                <input
                  type="text"
                  placeholder="ABC Performance Shop"
                  value={newVendorData?.name}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, name: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={newVendorData?.phone}
                    onChange={(e) => setNewVendorData(prev => ({ ...prev, phone: e?.target?.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                  <select
                    value={newVendorData?.rating}
                    onChange={(e) => setNewVendorData(prev => ({ ...prev, rating: e?.target?.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  >
                    <option value="">Select Rating</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="contact@abcperformance.com"
                  value={newVendorData?.email}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, email: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={newVendorData?.contact_person}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, contact_person: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                <select
                  value={newVendorData?.specialty}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, specialty: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                >
                  <option value="">Select Specialty</option>
                  <option value="Performance">Performance</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Suspension">Suspension</option>
                  <option value="Exhaust">Exhaust</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  placeholder="123 Main St, City, State 12345"
                  value={newVendorData?.address}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, address: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes about this vendor..."
                  value={newVendorData?.notes}
                  onChange={(e) => setNewVendorData(prev => ({ ...prev, notes: e?.target?.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-colors"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddVendorModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewVendor}
                  disabled={!newVendorData?.name || !newVendorData?.phone || isSavingNewVendor}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                >
                  {isSavingNewVendor ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{isSavingNewVendor ? 'Adding...' : 'Add Vendor'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Quick Add Modal with Real Integration */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                Quick Add Sale
              </h2>
              <button
                onClick={() => setShowQuickAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Number *</label>
                <input
                  type="text"
                  placeholder="Search existing vehicles..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service *</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                  <option value="">Select Service</option>
                  {products?.slice(0, 5)?.map((product) => (
                    <option key={product?.id} value={product?.id}>
                      {product?.name} - ${product?.unit_price?.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Date</label>
                <input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowQuickAddModal(false);
                    handleCreateNewSale();
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;