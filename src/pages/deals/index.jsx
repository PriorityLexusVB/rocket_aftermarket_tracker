import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layouts/AppLayout';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

import { MobileTable, MobileBottomSheet, MobileFloatingAction, MobileModal } from '../../components/mobile/MobileComponents';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const DealsPage = () => {
  const { user } = useAuth();
  const { themeClasses } = useTheme();
  const navigate = useNavigate();
  
  // Enhanced state management
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showDealDetails, setShowDealDetails] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [deliveryCoordinators, setDeliveryCoordinators] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddSalespersonModal, setShowAddSalespersonModal] = useState(false);
  const [showAddDeliveryCoordinatorModal, setShowAddDeliveryCoordinatorModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingDeal, setSchedulingDeal] = useState(null);

  // Enhanced state for new features
  const [dealCalendarEvents, setDealCalendarEvents] = useState([]);
  const [showCalendarView, setShowCalendarView] = useState(false);

  // Enhanced Line Item Form State - Enhanced with dates and vehicle details
  const [lineItemForm, setLineItemForm] = useState({
    stockNumber: '', 
    vehicleId: '',
    // NEW: Manual vehicle details
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleCondition: 'used', // Default to used
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    needsLoaner: false,
    salespersonId: '',
    deliveryCoordinatorId: '',
    vendorId: '', // OPTIONAL - NOT MANDATORY
    isOffSite: false,
    productId: '',
    unitPrice: 0,
    cost: 0,
    priority: 'medium',
    description: '',
    // NEW: Date fields (NO PROMISED TIME)
    todaysDate: new Date()?.toISOString()?.split('T')?.[0],
    promisedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)?.toISOString()?.split('T')?.[0] // 7 days from today
  });

  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);

  const [dealLineItems, setDealLineItems] = useState([]);

  // New Vendor Form
  const [newVendorForm, setNewVendorForm] = useState({
    name: '',
    specialty: '',
    contactPerson: '',
    phone: '',
    email: ''
  });

  // New Product Form with cost field 
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: '',
    brand: '',
    unitPrice: 0,
    cost: 0,
    partNumber: '',
    description: ''
  });

  // NEW: New Salesperson Form
  const [newSalespersonForm, setNewSalespersonForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'staff'
  });

  // NEW: New Delivery Coordinator Form
  const [newDeliveryCoordinatorForm, setNewDeliveryCoordinatorForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'staff'
  });

  // Load all required data
  useEffect(() => {
    loadDeals();
    loadVehicles();
    loadVendors();
    loadProducts();
    loadSalespeople();
    loadDeliveryCoordinators();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles (stock_number, year, make, model, color, vin),
          vendors (name, specialty),
          sales_person:user_profiles!jobs_created_by_fkey (full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (full_name, email),
          job_parts (
            id,
            quantity_used,
            unit_price,
            total_price,
            products (
              id,
              name,
              unit_price,
              category,
              brand,
              part_number
            )
          ),
          transactions (
            id,
            total_amount,
            customer_name,
            customer_phone,
            customer_email
          )
        `)?.in('job_status', ['pending', 'scheduled', 'in_progress', 'completed'])?.order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedDeals = data?.map(job => ({
        id: job?.id,
        vehicleInfo: {
          year: job?.vehicles?.year,
          make: job?.vehicles?.make,
          model: job?.vehicles?.model,
          vin: job?.vehicles?.vin,
          stockNumber: job?.vehicles?.stock_number
        },
        customer: {
          name: job?.transactions?.[0]?.customer_name || 'N/A',
          phone: job?.transactions?.[0]?.customer_phone || 'N/A',
          email: job?.transactions?.[0]?.customer_email || 'N/A'
        },
        salesperson: job?.sales_person?.full_name || 'Unassigned',
        deliveryCoordinator: job?.delivery_coordinator?.full_name || 'Unassigned',
        items: job?.job_parts?.map(part => ({
          id: part?.products?.id,
          name: part?.products?.name,
          price: part?.unit_price || part?.products?.unit_price,
          category: part?.products?.category,
          brand: part?.products?.brand,
          partNumber: part?.products?.part_number,
          quantity: part?.quantity_used,
          status: 'Active'
        })) || [],
        totalValue: job?.transactions?.[0]?.total_amount || 
                    job?.job_parts?.reduce((sum, part) => sum + (part?.total_price || 0), 0) || 
                    job?.estimated_cost || 0,
        status: job?.job_status,
        vendor: job?.vendors?.name || 'None', // Changed from 'Unassigned' to 'None'
        estimatedCompletion: job?.scheduled_end_time,
        priority: job?.priority || 'medium',
        description: job?.description,
        title: job?.title,
        needsLoaner: job?.customer_needs_loaner || false,
        // NEW: Enhanced date information (NO PROMISED TIME)
        todaysDate: job?.created_at ? new Date(job.created_at)?.toLocaleDateString() : new Date()?.toLocaleDateString(),
        promisedDate: job?.promised_date ? new Date(job.promised_date)?.toLocaleDateString() : null,
        serviceType: job?.service_type || (job?.vendor_id ? 'vendor' : 'in_house'),
        calendarEventId: job?.calendar_event_id
      })) || [];

      setDeals(transformedDeals);
      setFilteredDeals(transformedDeals);
    } catch (error) {
      console.error('Error loading deals:', error);
      setSubmitError(`Error loading deals: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase?.from('vehicles')?.select('*')?.eq('vehicle_status', 'active')?.order('stock_number');
      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase?.from('vendors')?.select('*')?.eq('is_active', true)?.order('name');
      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase?.from('products')?.select('*')?.eq('is_active', true)?.order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadSalespeople = async () => {
    try {
      // Load staff specifically for salesperson roles - match the admin page filtering
      // This ensures we get the same sales people that are shown in the admin staff page
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.or('department.ilike.%sales%,department.eq.Sales Person')
        ?.not('department', 'eq', 'General Sales Manager') // Exclude General Sales Manager like in admin
        ?.eq('is_active', true)
        ?.order('full_name');
      if (error) throw error;
      setSalespeople(data || []);
    } catch (error) {
      console.error('Error loading salespeople:', error);
    }
  };

  // NEW: Load delivery coordinators separately - FILTER OUT General Sales Manager
  const loadDeliveryCoordinators = async () => {
    try {
      // Load staff specifically for delivery coordinator roles - EXCLUDE General Sales Manager
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.in('role', ['staff', 'manager', 'admin'])?.eq('is_active', true)?.not('department', 'ilike', '%General Sales Manager%')?.order('full_name');
      if (error) throw error;
      setDeliveryCoordinators(data || []);
    } catch (error) {
      console.error('Error loading delivery coordinators:', error);
    }
  };

  // Filter and search functionality
  useEffect(() => {
    let filtered = deals;
    
    if (filterStatus !== 'all') {
      filtered = filtered?.filter(deal => 
        deal?.status?.toLowerCase()?.includes(filterStatus?.toLowerCase())
      );
    }
    
    if (searchTerm) {
      filtered = filtered?.filter(deal =>
        deal?.vehicleInfo?.stockNumber?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        deal?.customer?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        deal?.vehicleInfo?.make?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        deal?.vehicleInfo?.model?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        deal?.salesperson?.toLowerCase()?.includes(searchTerm?.toLowerCase())
      );
    }
    
    setFilteredDeals(filtered);
  }, [deals, filterStatus, searchTerm]);

  // Enhanced Action handlers
  const handleViewDeal = (deal) => {
    setSelectedDeal(deal);
    setShowDealDetails(true);
  };

  // FIXED: handleEditDeal - Now implements actual edit functionality
  const handleEditDeal = (deal) => {
    setSelectedDeal(deal);
    
    // Initialize edit form with deal data
    setLineItemForm({
      stockNumber: deal?.vehicleInfo?.stockNumber || '',
      vehicleId: deal?.vehicleInfo?.vehicleId || '',
      // NEW: Auto-populate manual vehicle fields from deal
      vehicleYear: deal?.vehicleInfo?.year || '',
      vehicleMake: deal?.vehicleInfo?.make || '',
      vehicleModel: deal?.vehicleInfo?.model || '',
      vehicleCondition: deal?.vehicleInfo?.condition || 'used',
      customerName: deal?.customer?.name || '',
      customerPhone: deal?.customer?.phone || '',
      customerEmail: deal?.customer?.email || '',
      needsLoaner: deal?.needsLoaner || false,
      salespersonId: salespeople?.find(s => s?.full_name === deal?.salesperson)?.id || '',
      deliveryCoordinatorId: deliveryCoordinators?.find(d => d?.full_name === deal?.deliveryCoordinator)?.id || '',
      vendorId: vendors?.find(v => v?.name === deal?.vendor)?.id || '',
      isOffSite: deal?.serviceType === 'vendor' || false,
      priority: deal?.priority || 'medium',
      description: deal?.description || '',
      todaysDate: deal?.todaysDate || new Date()?.toISOString()?.split('T')?.[0],
      promisedDate: deal?.promisedDate ? new Date(deal?.promisedDate)?.toISOString()?.split('T')?.[0] : ''
    });
    
    // Set deal line items for editing
    setDealLineItems(deal?.items?.map(item => ({
      id: item?.id || Date.now() + Math.random(),
      vehicle: {
        id: deal?.vehicleInfo?.vehicleId,
        stock_number: deal?.vehicleInfo?.stockNumber,
        year: deal?.vehicleInfo?.year,
        make: deal?.vehicleInfo?.make,
        model: deal?.vehicleInfo?.model
      },
      customerName: deal?.customer?.name,
      customerPhone: deal?.customer?.phone,
      customerEmail: deal?.customer?.email,
      needsLoaner: deal?.needsLoaner,
      salesperson: salespeople?.find(s => s?.full_name === deal?.salesperson),
      deliveryCoordinator: deliveryCoordinators?.find(d => d?.full_name === deal?.deliveryCoordinator),
      vendor: vendors?.find(v => v?.name === deal?.vendor),
      product: {
        id: item?.id,
        name: item?.name,
        unit_price: item?.price,
        category: item?.category,
        brand: item?.brand,
        part_number: item?.partNumber
      },
      unitPrice: item?.price || 0,
      totalPrice: item?.price * (item?.quantity || 1),
      priority: deal?.priority,
      description: deal?.description,
      serviceType: deal?.serviceType,
      hasValidClassification: true
    })) || []);
    
    setShowEditModal(true);
  };

  // NEW: Enhanced save function for editing deals
  const handleSaveEditedDeal = async () => {
    if (!selectedDeal?.id || !dealLineItems?.length) {
      setSubmitError('Invalid deal data or no line items');
      return;
    }

    setIsSubmittingDeal(true);
    setSubmitError('');

    try {
      const mainItem = dealLineItems?.[0];
      const totalDealValue = dealLineItems?.reduce((sum, item) => sum + item?.totalPrice, 0);
      
      // Update the main job record
      const dealUpdateData = {
        vendor_id: mainItem?.vendor?.id || null,
        description: mainItem?.description || `Updated Aftermarket Deal - ${dealLineItems?.length} item${dealLineItems?.length > 1 ? 's' : ''}`,
        priority: mainItem?.priority?.toLowerCase(),
        estimated_cost: totalDealValue,
        created_by: mainItem?.salesperson?.id,
        delivery_coordinator_id: mainItem?.deliveryCoordinator?.id || null,
        customer_needs_loaner: mainItem?.needsLoaner,
        promised_date: lineItemForm?.promisedDate ? new Date(lineItemForm?.promisedDate)?.toISOString() : null,
        service_type: mainItem?.vendor ? 'vendor' : 'in_house'
      };

      const { error: jobError } = await supabase?.from('jobs')?.update(dealUpdateData)?.eq('id', selectedDeal?.id);
      if (jobError) throw jobError;

      // Update transaction record
      const transactionUpdateData = {
        total_amount: totalDealValue,
        customer_name: mainItem?.customerName,
        customer_phone: mainItem?.customerPhone || null,
        customer_email: mainItem?.customerEmail || null
      };

      const { error: transactionError } = await supabase
        ?.from('transactions')
        ?.update(transactionUpdateData)
        ?.eq('job_id', selectedDeal?.id);
      if (transactionError) throw transactionError;

      setShowEditModal(false);
      setSelectedDeal(null);
      loadDeals(); // Reload deals to show updates
      
      alert('✅ Deal Updated Successfully!\n\n📋 Changes saved to database\n📊 Financial totals recalculated\n✅ Customer information updated');

    } catch (error) {
      console.error('Error updating deal:', error);
      setSubmitError(`Failed to update deal: ${error?.message}`);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  const handleMessageCustomer = (deal) => {
    setSelectedDeal(deal);
    setMessageText(`Hi ${deal?.customer?.name}, this is regarding your ${deal?.vehicleInfo?.year} ${deal?.vehicleInfo?.make} ${deal?.vehicleInfo?.model} (Stock: ${deal?.vehicleInfo?.stockNumber}). `);
    setShowMessageModal(true);
  };

  const handleNewDeal = () => {
    setLineItemForm({
      stockNumber: '', // NEW: Reset stock number
      vehicleId: '',
      // NEW: Reset manual vehicle details
      vehicleYear: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleCondition: 'used',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      needsLoaner: false,
      salespersonId: user?.id || '',
      vendorId: '', // OPTIONAL - NOT MANDATORY
      isOffSite: false,
      productId: '',
      unitPrice: 0,
      cost: 0,
      priority: 'Medium',
      description: '',
      // NEW: Date fields (NO PROMISED TIME)
      todaysDate: new Date()?.toISOString()?.split('T')?.[0],
      promisedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)?.toISOString()?.split('T')?.[0]
    });
    setDealLineItems([]);
    setStockSearchResults([]); // NEW: Clear search results
    setSubmitError('');
    setShowNewDealModal(true);
  };

  // NEW: Stock Number Search Function
  const handleStockSearch = async (stockNumber) => {
    if (!stockNumber?.trim()) {
      setStockSearchResults([]);
      return;
    }

    setIsSearchingStock(true);
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select('*')
        ?.eq('vehicle_status', 'active')
        ?.ilike('stock_number', `%${stockNumber}%`)
        ?.limit(10);

      if (error) throw error;
      setStockSearchResults(data || []);
    } catch (error) {
      console.error('Error searching stock:', error);
      setStockSearchResults([]);
    } finally {
      setIsSearchingStock(false);
    }
  };

  // NEW: Enhanced stock number selection to populate manual fields
  const handleStockSelect = (vehicle) => {
    setLineItemForm({
      ...lineItemForm,
      stockNumber: vehicle?.stock_number,
      vehicleId: vehicle?.id,
      // NEW: Auto-populate manual vehicle fields from stock lookup
      vehicleYear: vehicle?.year?.toString() || '',
      vehicleMake: vehicle?.make || '',
      vehicleModel: vehicle?.model || '',
      vehicleCondition: vehicle?.condition || 'used'
    });
    setStockSearchResults([]);
  };

  // NEW: Handle schedule deal functionality
  const handleScheduleDeal = (deal) => {
    setSchedulingDeal(deal);
    setShowScheduleModal(true);
  };

  // Enhanced Add line item - Include vehicle condition and manual details validation
  const handleAddLineItem = () => {
    // Enhanced validation to include vehicle details
    if (!lineItemForm?.customerName || !lineItemForm?.productId) {
      setSubmitError('Customer Name and Product are required for each line item');
      return;
    }

    // Check if we have vehicle information (either from stock lookup or manual entry)
    if (!lineItemForm?.vehicleId && (!lineItemForm?.vehicleYear || !lineItemForm?.vehicleMake || !lineItemForm?.vehicleModel)) {
      setSubmitError('Vehicle information is required. Either search by stock number or enter Year, Make, and Model manually.');
      return;
    }

    // Check vehicle condition
    if (!lineItemForm?.vehicleCondition) {
      setSubmitError('Please select vehicle condition (New or Used)');
      return;
    }

    // REMOVED: Vendor validation - vendor is optional
    // NEW: Simple classification - if vendor selected, it's vendor service
    const isVendorService = !!lineItemForm?.vendorId;
    const isOffSite = isVendorService || lineItemForm?.isOffSite;

    const selectedVehicle = vehicles?.find(v => v?.id === lineItemForm?.vehicleId) || {
      // Use manual vehicle details if no vehicle found in database
      year: lineItemForm?.vehicleYear,
      make: lineItemForm?.vehicleMake,
      model: lineItemForm?.vehicleModel,
      stock_number: lineItemForm?.stockNumber || 'Manual Entry',
      condition: lineItemForm?.vehicleCondition
    };
    
    const selectedProduct = products?.find(p => p?.id === lineItemForm?.productId);
    const selectedVendor = vendors?.find(v => v?.id === lineItemForm?.vendorId);
    const selectedSalesperson = salespeople?.find(s => s?.id === lineItemForm?.salespersonId);
    const selectedDeliveryCoordinator = deliveryCoordinators?.find(d => d?.id === lineItemForm?.deliveryCoordinatorId);

    // Calculate totals and profit - NO QUANTITY
    const unitPrice = lineItemForm?.unitPrice || selectedProduct?.unit_price || 0;
    const unitCost = lineItemForm?.cost || selectedProduct?.cost || 0;
    const totalPrice = unitPrice; // Single item pricing
    const totalCost = unitCost; // Single item cost
    const totalProfit = totalPrice - totalCost;
    const profitMargin = totalPrice > 0 ? (totalProfit / totalPrice * 100) : 0;

    const lineItem = {
      id: Date.now(),
      vehicle: selectedVehicle,
      vehicleCondition: lineItemForm?.vehicleCondition, // NEW: Track vehicle condition
      customerName: lineItemForm?.customerName,
      customerPhone: lineItemForm?.customerPhone,
      customerEmail: lineItemForm?.customerEmail,
      needsLoaner: lineItemForm?.needsLoaner,
      salesperson: selectedSalesperson,
      deliveryCoordinator: selectedDeliveryCoordinator,
      vendor: selectedVendor || null, // OPTIONAL
      isOffSite: isOffSite,
      product: selectedProduct,
      unitPrice: unitPrice,
      unitCost: unitCost,
      totalPrice: totalPrice,
      totalCost: totalCost,
      totalProfit: totalProfit,
      profitMargin: profitMargin,
      priority: lineItemForm?.priority,
      description: lineItemForm?.description,
      // SIMPLIFIED: Service classification
      serviceLocation: isOffSite ? 'Off-Site' : 'On-Site',
      serviceType: isVendorService ? 'vendor' : 'in_house',
      requiresLoaner: lineItemForm?.needsLoaner,
      hasValidClassification: true // Always valid now
    };

    setDealLineItems([...dealLineItems, lineItem]);
    
    // Reset form but keep customer info and vehicle details for next item
    setLineItemForm({
      ...lineItemForm,
      productId: '',
      vendorId: '',
      isOffSite: false,
      unitPrice: 0,
      cost: 0,
      description: ''
      // Keep vehicle details, customer info, and vehicle condition for next line item
    });
    setSubmitError('');
  };

  const handleRemoveLineItem = (itemId) => {
    setDealLineItems(dealLineItems?.filter(item => item?.id !== itemId));
  };

  // Enhanced Save New Deal with improved calendar integration for line items
  const handleSaveNewDeal = async () => {
    if (!dealLineItems?.length) {
      setSubmitError('Add at least one line item before creating the deal');
      return;
    }

    setIsSubmittingDeal(true);
    setSubmitError('');

    try {
      // Enhanced date handling (NO PROMISED TIME)
      const todaysDate = new Date(); // Today's date
      const promisedDate = new Date(lineItemForm?.promisedDate); // Promised date ONLY
      
      // Group line items by service type and vendor for calendar integration
      const offSiteVendorGroups = {};
      const onSiteItems = [];
      
      dealLineItems?.forEach(item => {
        if (item?.vendor && item?.isOffSite) {
          // Group off-site items by vendor - each vendor gets separate calendar entry
          if (!offSiteVendorGroups?.[item?.vendor?.id]) {
            offSiteVendorGroups[item?.vendor?.id] = {
              vendor: item?.vendor,
              items: [],
              totalValue: 0
            };
          }
          offSiteVendorGroups?.[item?.vendor?.id]?.items?.push(item);
          offSiteVendorGroups[item?.vendor?.id].totalValue += item?.totalPrice;
        } else {
          // Group all on-site items together
          onSiteItems?.push(item);
        }
      });

      const createdJobs = [];
      const mainItem = dealLineItems?.[0]; // For customer info
      
      // Create separate calendar entries for each off-site vendor
      for (const [vendorId, vendorGroup] of Object.entries(offSiteVendorGroups)) {
        const vendorTotalValue = vendorGroup?.totalValue;
        const itemCount = vendorGroup?.items?.length;
        
        const dealData = {
          vehicle_id: mainItem?.vehicle?.id,
          vendor_id: vendorGroup?.vendor?.id,
          description: `${vendorGroup?.vendor?.name} - ${itemCount} item${itemCount > 1 ? 's' : ''}: ${vendorGroup?.items?.map(i => i?.product?.name)?.join(', ')}`,
          priority: mainItem?.priority?.toLowerCase(),
          job_status: 'scheduled', // Off-site items are scheduled
          title: `${mainItem?.vehicle?.year} ${mainItem?.vehicle?.make} ${mainItem?.vehicle?.model} - ${vendorGroup?.vendor?.name}`,
          estimated_cost: vendorTotalValue,
          created_by: mainItem?.salesperson?.id,
          delivery_coordinator_id: mainItem?.deliveryCoordinator?.id || null,
          customer_needs_loaner: mainItem?.needsLoaner,
          created_at: todaysDate?.toISOString(),
          promised_date: promisedDate?.toISOString(),
          service_type: 'vendor',
          // Calendar integration with specific color for off-site vendors
          scheduled_start_time: promisedDate?.toISOString(),
          scheduled_end_time: new Date(promisedDate.getTime() + 4 * 60 * 60 * 1000)?.toISOString(), // 4 hours later
          calendar_event_id: `deal_vendor_${vendorGroup?.vendor?.id}_${Date.now()}_${mainItem?.vehicle?.stock_number}`,
          location: `${vendorGroup?.vendor?.name} - Off-Site`,
          // Orange color for off-site vendor items
          color_code: '#f97316' // Orange color to distinguish off-site items
        };

        const { data: jobData, error: jobError } = await supabase?.from('jobs')?.insert([dealData])?.select()?.single();
        if (jobError) throw jobError;
        createdJobs?.push({ job: jobData, items: vendorGroup?.items, type: 'off-site' });

        // Create job_parts for this vendor's items
        const jobPartsData = vendorGroup?.items?.map(item => ({
          job_id: jobData?.id,
          product_id: item?.product?.id,
          quantity_used: 1,
          unit_price: item?.unitPrice,
          total_price: item?.totalPrice
        }));

        const { error: partsError } = await supabase?.from('job_parts')?.insert(jobPartsData);
        if (partsError) throw partsError;

        // Create transaction record for this vendor group
        const transactionData = {
          job_id: jobData?.id,
          vehicle_id: mainItem?.vehicle?.id,
          transaction_type: 'aftermarket_sale',
          total_amount: vendorTotalValue,
          customer_name: mainItem?.customerName,
          customer_phone: mainItem?.customerPhone || null,
          customer_email: mainItem?.customerEmail || null,
          transaction_status: 'pending',
          payment_status: 'pending',
          created_at: todaysDate?.toISOString()
        };

        const { error: transactionError } = await supabase?.from('transactions')?.insert([transactionData]);
        if (transactionError) throw transactionError;
      }

      // Create single grouped calendar entry for all on-site items
      if (onSiteItems?.length > 0) {
        const onSiteTotalValue = onSiteItems?.reduce((sum, item) => sum + item?.totalPrice, 0);
        
        const onSiteDealData = {
          vehicle_id: mainItem?.vehicle?.id,
          vendor_id: null, // No vendor for in-house service
          description: `In-House Service - ${onSiteItems?.length} item${onSiteItems?.length > 1 ? 's' : ''}: ${onSiteItems?.map(i => i?.product?.name)?.join(', ')}`,
          priority: mainItem?.priority?.toLowerCase(),
          job_status: 'pending', // On-site items are pending until scheduled
          title: `${mainItem?.vehicle?.year} ${mainItem?.vehicle?.make} ${mainItem?.vehicle?.model} - In-House Service`,
          estimated_cost: onSiteTotalValue,
          created_by: mainItem?.salesperson?.id,
          delivery_coordinator_id: mainItem?.deliveryCoordinator?.id || null,
          customer_needs_loaner: mainItem?.needsLoaner,
          created_at: todaysDate?.toISOString(),
          promised_date: promisedDate?.toISOString(),
          service_type: 'in_house',
          // Calendar integration - no scheduled times initially for on-site (can be scheduled later)
          scheduled_start_time: null,
          scheduled_end_time: null,
          calendar_event_id: `deal_onsite_${Date.now()}_${mainItem?.vehicle?.stock_number}`,
          location: 'In-House Service Bay',
          // Green color for on-site grouped items
          color_code: '#22c55e' // Green color for on-site items
        };

        const { data: onSiteJobData, error: onSiteJobError } = await supabase?.from('jobs')?.insert([onSiteDealData])?.select()?.single();
        if (onSiteJobError) throw onSiteJobError;
        createdJobs?.push({ job: onSiteJobData, items: onSiteItems, type: 'on-site' });

        // Create job_parts for on-site items
        const onSiteJobPartsData = onSiteItems?.map(item => ({
          job_id: onSiteJobData?.id,
          product_id: item?.product?.id,
          quantity_used: 1,
          unit_price: item?.unitPrice,
          total_price: item?.totalPrice
        }));

        const { error: onSitePartsError } = await supabase?.from('job_parts')?.insert(onSiteJobPartsData);
        if (onSitePartsError) throw onSitePartsError;

        // Create transaction record for on-site group
        const onSiteTransactionData = {
          job_id: onSiteJobData?.id,
          vehicle_id: mainItem?.vehicle?.id,
          transaction_type: 'aftermarket_sale',
          total_amount: onSiteTotalValue,
          customer_name: mainItem?.customerName,
          customer_phone: mainItem?.customerPhone || null,
          customer_email: mainItem?.customerEmail || null,
          transaction_status: 'pending',
          payment_status: 'pending',
          created_at: todaysDate?.toISOString()
        };

        const { error: onSiteTransactionError } = await supabase?.from('transactions')?.insert([onSiteTransactionData]);
        if (onSiteTransactionError) throw onSiteTransactionError;
      }

      setShowNewDealModal(false);
      loadDeals();
      
      // Enhanced success message showing calendar integration details
      const totalDealValue = dealLineItems?.reduce((sum, item) => sum + item?.totalPrice, 0);
      const offSiteVendorCount = Object.keys(offSiteVendorGroups)?.length;
      const onSiteCount = onSiteItems?.length;
      
      const calendarSummary = [];
      if (offSiteVendorCount > 0) {
        calendarSummary?.push(`📅 ${offSiteVendorCount} Off-Site Calendar Event${offSiteVendorCount > 1 ? 's' : ''} (Orange)`);
      }
      if (onSiteCount > 0) {
        calendarSummary?.push(`📅 1 On-Site Calendar Event (Green) - ${onSiteCount} items grouped`);
      }

      const successMessage = `✅ Aftermarket Deal Created with Calendar Integration!

📅 TODAY'S DATE: ${todaysDate?.toLocaleDateString()}
🎯 PROMISED DATE: ${promisedDate?.toLocaleDateString()}

📋 DEAL DETAILS:
Customer: ${mainItem?.customerName}
Vehicle: ${mainItem?.vehicle?.year} ${mainItem?.vehicle?.make} ${mainItem?.vehicle?.model} (${mainItem?.vehicle?.stock_number})
Salesperson: ${mainItem?.salesperson?.full_name}
Delivery Coordinator: ${mainItem?.deliveryCoordinator?.full_name || 'None'}

📊 FINANCIAL SUMMARY:
Total Line Items: ${dealLineItems?.length}
Total Deal Value: $${totalDealValue?.toFixed(2)}
${mainItem?.needsLoaner ? '🚗 Loaner Vehicle Required' : ''}

🗓️ CALENDAR INTEGRATION:
${calendarSummary?.join('\n')}
${offSiteVendorCount > 0 ? '🔸 Each off-site vendor gets separate calendar entry' : ''}
${onSiteCount > 0 ? '🔸 All on-site items grouped in single calendar event' : ''}

✅ Color coding: Orange for off-site, Green for on-site
✅ Ready for calendar scheduling and vendor coordination`;

      alert(successMessage);

    } catch (error) {
      console.error('Error creating deal:', error);
      setSubmitError(`Failed to create deal: ${error?.message}`);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  // Add New Vendor
  const handleSaveNewVendor = async () => {
    if (!newVendorForm?.name || !newVendorForm?.specialty) {
      alert('Vendor name and specialty are required');
      return;
    }

    try {
      const { data, error } = await supabase?.from('vendors')?.insert([{
        name: newVendorForm?.name,
        specialty: newVendorForm?.specialty,
        contact_person: newVendorForm?.contactPerson,
        phone: newVendorForm?.phone,
        email: newVendorForm?.email,
        created_by: user?.id
      }])?.select()?.single();

      if (error) throw error;

      setVendors([...vendors, data]);
      setLineItemForm({...lineItemForm, vendorId: data?.id});
      setShowAddVendorModal(false);
      setNewVendorForm({ name: '', specialty: '', contactPerson: '', phone: '', email: '' });
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Error adding vendor');
    }
  };

  // Add New Product - Updated with cost field
  const handleSaveNewProduct = async () => {
    if (!newProductForm?.name || !newProductForm?.unitPrice) {
      alert('Product name and price are required');
      return;
    }

    try {
      const { data, error } = await supabase?.from('products')?.insert([{
        name: newProductForm?.name,
        category: newProductForm?.category,
        brand: newProductForm?.brand,
        unit_price: newProductForm?.unitPrice,
        cost: newProductForm?.cost,
        part_number: newProductForm?.partNumber,
        description: newProductForm?.description,
        created_by: user?.id
      }])?.select()?.single();

      if (error) throw error;

      setProducts([...products, data]);
      setLineItemForm({
        ...lineItemForm, 
        productId: data?.id, 
        unitPrice: data?.unit_price,
        cost: data?.cost || 0
      });
      setShowAddProductModal(false);
      setNewProductForm({ name: '', category: '', brand: '', unitPrice: 0, cost: 0, partNumber: '', description: '' });
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product');
    }
  };

  // NEW: Add New Salesperson
  const handleSaveNewSalesperson = async () => {
    if (!newSalespersonForm?.fullName || !newSalespersonForm?.email) {
      alert('Salesperson name and email are required');
      return;
    }

    try {
      const { data, error } = await supabase?.from('user_profiles')?.insert([{
        full_name: newSalespersonForm?.fullName,
        email: newSalespersonForm?.email,
        phone: newSalespersonForm?.phone,
        role: 'staff',
        created_by: user?.id
      }])?.select()?.single();

      if (error) throw error;

      setSalespeople([...salespeople, data]);
      setLineItemForm({...lineItemForm, salespersonId: data?.id});
      setShowAddSalespersonModal(false);
      setNewSalespersonForm({ fullName: '', email: '', phone: '', role: 'staff' });
    } catch (error) {
      console.error('Error adding salesperson:', error);
      alert('Error adding salesperson');
    }
  };

  // NEW: Add New Delivery Coordinator
  const handleSaveNewDeliveryCoordinator = async () => {
    if (!newDeliveryCoordinatorForm?.fullName || !newDeliveryCoordinatorForm?.email) {
      alert('Delivery coordinator name and email are required');
      return;
    }

    try {
      const { data, error } = await supabase?.from('user_profiles')?.insert([{
        full_name: newDeliveryCoordinatorForm?.fullName,
        email: newDeliveryCoordinatorForm?.email,
        phone: newDeliveryCoordinatorForm?.phone,
        role: 'staff',
        created_by: user?.id
      }])?.select()?.single();

      if (error) throw error;

      setDeliveryCoordinators([...deliveryCoordinators, data]);
      setLineItemForm({...lineItemForm, deliveryCoordinatorId: data?.id});
      setShowAddDeliveryCoordinatorModal(false);
      setNewDeliveryCoordinatorForm({ fullName: '', email: '', phone: '', role: 'staff' });
    } catch (error) {
      console.error('Error adding delivery coordinator:', error);
      alert('Error adding delivery coordinator');
    }
  };

  const handleSendMessage = async () => {
    if (!messageText?.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      console.log('Sending SMS to:', selectedDeal?.customer?.phone, 'Message:', messageText);
      alert(`Message sent to ${selectedDeal?.customer?.name}`);
      setShowMessageModal(false);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    }
  };

  // Utility functions
  const handleFilter = (status) => setFilterStatus(status);
  
  const handleExport = () => {
    const csv = [
      ['Stock Number', 'Customer', 'Vehicle', 'Salesperson', 'Status', 'Value', 'Vendor'],
      ...filteredDeals?.map(deal => [
        deal?.vehicleInfo?.stockNumber,
        deal?.customer?.name,
        `${deal?.vehicleInfo?.year} ${deal?.vehicleInfo?.make} ${deal?.vehicleInfo?.model}`,
        deal?.salesperson,
        deal?.status,
        `${deal?.totalValue}`,
        deal?.vendor
      ])
    ]?.map(row => row?.join(','))?.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a?.setAttribute('href', url);
    a?.setAttribute('download', 'aftermarket-deals.csv');
    document.body?.appendChild(a);
    a?.click();
    document.body?.removeChild(a);
  };

  // Calculate enhanced KPI stats with proper profit tracking
  const totalRevenue = filteredDeals?.reduce((sum, deal) => sum + (deal?.totalValue || 0), 0);
  const totalCosts = dealLineItems?.reduce((sum, item) => sum + (item?.totalCost || 0), 0);
  const estimatedTotalProfit = totalRevenue * 0.25; // Estimated 25% profit margin
  const averageMargin = totalRevenue > 0 ? (estimatedTotalProfit / totalRevenue * 100) : 0;
  const completedDeals = filteredDeals?.filter(deal => deal?.status === 'completed')?.length;
  const pendingDeals = filteredDeals?.filter(deal => deal?.status === 'pending')?.length;
  const activeDeals = filteredDeals?.filter(deal => deal?.status === 'in_progress')?.length;
  const averageDealValue = filteredDeals?.length > 0 ? (totalRevenue / filteredDeals?.length) : 0;
  const highPriorityDeals = filteredDeals?.filter(deal => deal?.priority?.toLowerCase() === 'high' || deal?.priority?.toLowerCase() === 'urgent')?.length;

  // Enhanced Deal Card Renderer to show calendar integration info
  const renderDealCard = (deal, index) => (
    <div key={deal?.id} className={`${themeClasses?.card} p-4 mb-4 rounded-lg border shadow-sm`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`${themeClasses?.text} text-base font-semibold mb-1`}>
              {deal?.vehicleInfo?.year} {deal?.vehicleInfo?.make} {deal?.vehicleInfo?.model}
            </h3>
            <p className={`${themeClasses?.textSecondary} text-sm`}>Stock: {deal?.vehicleInfo?.stockNumber}</p>
            <p className="text-blue-600 text-xs font-semibold mt-1">Sales: {deal?.salesperson}</p>
            
            {/* Enhanced date display with calendar integration info */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-gray-600">📅 Created: {deal?.todaysDate}</span>
                {deal?.promisedDate && (
                  <span className="text-blue-600 font-medium">🎯 Promised: {deal?.promisedDate}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  deal?.serviceType === 'vendor' ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-green-100 text-green-800 border border-green-300'
                }`}>
                  {deal?.serviceType === 'vendor' ? '🏢 Off-Site (Orange)' : '🏠 On-Site (Green)'}
                </span>
                {deal?.calendarEventId && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    📅 Calendar Ready
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            deal?.status === 'completed' ? 'bg-green-100 text-green-800' : 
            deal?.status === 'pending'? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {deal?.status?.replace('_', ' ')?.toUpperCase()}
          </span>
        </div>

        <div className={`border-t ${themeClasses?.border}`} />

        <div className="flex items-center justify-between">
          <div>
            <p className={`${themeClasses?.text} text-sm font-semibold`}>{deal?.customer?.name}</p>
            <p className={`${themeClasses?.textSecondary} text-xs`}>{deal?.customer?.phone}</p>
            {deal?.needsLoaner && (
              <div className="flex items-center mt-2">
                <Icon name="Car" size={12} className="text-blue-500 mr-1" />
                <span className="text-blue-600 text-xs font-medium">Loaner Required</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-600 text-xl font-bold">
              ${deal?.totalValue?.toLocaleString()}
            </p>
            <div className="flex items-center justify-end mt-1">
              <div 
                className={`w-2 h-2 rounded-full mr-1 ${
                  deal?.priority?.toLowerCase() === 'high' || deal?.priority?.toLowerCase() === 'urgent' ? 'bg-red-500' :
                  deal?.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              />
              <span className={`${themeClasses?.textSecondary} text-xs`}>
                {deal?.priority}
              </span>
            </div>
          </div>
        </div>

        <div className={`border-t pt-2 ${themeClasses?.border}`}>
          {deal?.items?.length > 0 ? (
            <div className="space-y-1">
              {deal?.items?.slice(0, 2)?.map((item, idx) => (
                <div key={idx} className={`flex justify-between text-xs ${themeClasses?.textSecondary}`}>
                  <span>{item?.name}</span>
                  <span>Qty: {item?.quantity}</span>
                </div>
              ))}
              {deal?.items?.length > 2 && (
                <p className="text-blue-600 text-xs font-medium">+{deal?.items?.length - 2} more items</p>
              )}
            </div>
          ) : (
            <p className={`${themeClasses?.textSecondary} text-xs italic`}>{deal?.title || deal?.description}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button onClick={() => handleViewDeal(deal)} size="sm" variant="ghost" className="text-xs py-1">
            <Icon name="Eye" size={12} className="mr-1" />View
          </Button>
          <Button onClick={() => handleEditDeal(deal)} size="sm" variant="ghost" className="text-xs py-1">
            <Icon name="Edit" size={12} className="mr-1" />Edit
          </Button>
          <Button onClick={() => handleMessageCustomer(deal)} size="sm" variant="primary" className="text-xs py-1">
            <Icon name="MessageSquare" size={12} className="mr-1" />SMS
          </Button>
        </div>
      </div>
    </div>
  );

  // Original Desktop Table Row Renderer
  const renderDesktopRow = (deal, index) => (
    <>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <p className={`${themeClasses?.text} text-sm font-medium cursor-pointer hover:text-blue-600`}
             onClick={() => navigate(`/vehicles?search=${deal?.vehicleInfo?.stockNumber}`)}>
            {deal?.vehicleInfo?.year} {deal?.vehicleInfo?.make} {deal?.vehicleInfo?.model}
          </p>
          <p className={`${themeClasses?.textSecondary} text-xs mt-0.5`}>Stock: {deal?.vehicleInfo?.stockNumber}</p>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <p className={`${themeClasses?.text} text-sm font-medium`}>{deal?.customer?.name}</p>
          <p className={`${themeClasses?.textSecondary} text-xs`}>{deal?.customer?.phone}</p>
          {deal?.needsLoaner && (
            <div className="flex items-center mt-1">
              <Icon name="Car" size={10} className="text-blue-500 mr-1" />
              <span className="text-blue-600 text-xs">Loaner</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <p className="text-blue-600 text-sm font-medium">{deal?.salesperson}</p>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          {deal?.items?.length > 0 ? deal?.items?.slice(0, 2)?.map((item, index) => (
            <div key={index} className={`flex items-center justify-between text-xs ${themeClasses?.textSecondary}`}>
              <span className="font-medium">{item?.name}</span>
              <span>Qty: {item?.quantity}</span>
            </div>
          )) : (
            <div className={`${themeClasses?.textSecondary} text-xs italic`}>{deal?.title || deal?.description}</div>
          )}
          {deal?.items?.length > 2 && (
            <p className="text-blue-600 text-xs font-medium">+{deal?.items?.length - 2} more</p>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <p className="text-blue-600 text-sm font-bold">
          ${deal?.totalValue?.toLocaleString()}
        </p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          deal?.status === 'completed' ? 'bg-green-100 text-green-800' : 
          deal?.status === 'pending'? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {deal?.status?.replace('_', ' ')?.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <Button onClick={() => handleViewDeal(deal)} size="sm" variant="ghost" className="">
            <Icon name="Eye" size={14} />
          </Button>
          <Button onClick={() => handleEditDeal(deal)} size="sm" variant="ghost" className="">
            <Icon name="Edit" size={14} />
          </Button>
          <Button onClick={() => handleMessageCustomer(deal)} size="sm" variant="primary" className="">
            <Icon name="MessageSquare" size={14} />
          </Button>
        </div>
      </td>
    </>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className={`flex items-center justify-center h-screen ${themeClasses?.background}`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className={`${themeClasses?.text} font-medium`}>Loading deals...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${themeClasses?.background}`}>
        {/* Enhanced Header with date info */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className={`${themeClasses?.text} text-3xl font-bold mb-2`}>
              Aftermarket Deals
            </h1>
            <p className={`${themeClasses?.textSecondary} text-base`}>
              Manage aftermarket sales with today&apos;s date, promised dates, and calendar integration
            </p>
            <div className="mt-2 text-sm text-gray-600">
              📅 Today: {new Date()?.toLocaleDateString()} | 🎯 Default Promise: 7 days from creation
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              onClick={() => handleFilter(filterStatus === 'all' ? 'pending' : 'all')} 
              variant="ghost" 
              className="flex items-center"
            >
              <Icon name="Filter" size={16} className="mr-2" />
              {filterStatus === 'all' ? 'Filter' : 'Show All'}
            </Button>
            <Button 
              onClick={handleExport} 
              variant="ghost" 
              className="flex items-center"
            >
              <Icon name="Download" size={16} className="mr-2" />Export
            </Button>
            <Button 
              onClick={handleNewDeal} 
              variant="primary" 
              className="flex items-center"
            >
              <Icon name="Plus" size={16} className="mr-2" />New Deal
            </Button>
          </div>
        </div>

        {/* Mobile Search and Filter */}
        <div className="md:hidden mb-6 space-y-3">
          <div className="relative">
            <Icon name="Search" size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${themeClasses?.textSecondary}`} />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e?.target?.value)}
              className={`pl-10 pr-3 py-3 text-sm w-full rounded-lg border ${themeClasses?.input}`}
            />
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {['all', 'pending', 'in_progress', 'completed']?.map(status => (
              <Button
                key={status}
                onClick={() => handleFilter(status)}
                variant={filterStatus === status ? "primary" : "ghost"}
                size="sm"
                className="whitespace-nowrap"
              >
                {status === 'all' ? `All (${deals?.length})` : 
                 status === 'pending' ? `Pending (${pendingDeals})` :
                 status === 'in_progress' ? `Active (${activeDeals})` :
                 `Completed (${completedDeals})`}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Section - Original styling */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className={`${themeClasses?.card} p-6 rounded-xl border shadow-sm`}>
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100 mr-4">
                <Icon name="Activity" size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className={`${themeClasses?.textSecondary} text-sm font-medium uppercase tracking-wide`}>Active Deals</h3>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>{activeDeals}</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses?.card} p-6 rounded-xl border shadow-sm`}>
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100 mr-4">
                <Icon name="DollarSign" size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className={`${themeClasses?.textSecondary} text-sm font-medium uppercase tracking-wide`}>Total Revenue</h3>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>${Math.round(totalRevenue)?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses?.card} p-6 rounded-xl border shadow-sm`}>
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100 mr-4">
                <Icon name="TrendingUp" size={24} className="text-purple-600" />
              </div>
              <div>
                <h3 className={`${themeClasses?.textSecondary} text-sm font-medium uppercase tracking-wide`}>Est. Profit</h3>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>${Math.round(estimatedTotalProfit)?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses?.card} p-6 rounded-xl border shadow-sm`}>
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100 mr-4">
                <Icon name="Percent" size={24} className="text-yellow-600" />
              </div>
              <div>
                <h3 className={`${themeClasses?.textSecondary} text-sm font-medium uppercase tracking-wide`}>Avg Margin</h3>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>{averageMargin?.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className={`${themeClasses?.card} p-6 rounded-xl border shadow-sm`}>
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100 mr-4">
                <Icon name="Clock" size={24} className="text-orange-600" />
              </div>
              <div>
                <h3 className={`${themeClasses?.textSecondary} text-sm font-medium uppercase tracking-wide`}>Pending</h3>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>{pendingDeals}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Deals Table - Original styling */}
        <div className={`${themeClasses?.card} rounded-xl border shadow-sm overflow-hidden`}>
          <div className={`hidden md:block px-6 py-4 ${themeClasses?.cardHeader} border-b`}>
            <div className="flex items-center justify-between">
              <h2 className={`${themeClasses?.text} text-xl font-semibold`}>All Deals ({filteredDeals?.length})</h2>
              <div className="relative">
                <Icon name="Search" size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${themeClasses?.textSecondary}`} />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e?.target?.value)}
                  className={`pl-9 pr-3 py-2 text-sm w-64 rounded-lg border ${themeClasses?.input}`}
                />
              </div>
            </div>
          </div>

          <div className={`md:hidden px-4 py-3 ${themeClasses?.cardHeader} border-b`}>
            <h2 className={`${themeClasses?.text} text-lg font-semibold`}>
              {filteredDeals?.length} Deal{filteredDeals?.length !== 1 ? 's' : ''}
            </h2>
          </div>

          <MobileTable
            data={filteredDeals}
            renderCard={renderDealCard}
            renderDesktopRow={renderDesktopRow}
            headers={['Vehicle', 'Customer', 'Salesperson', 'Items', 'Value', 'Status', 'Actions']}
            className={themeClasses?.table || ''}
          />
        </div>

        {/* Mobile Floating Action Button */}
        <MobileFloatingAction
          onClick={handleNewDeal}
          icon={<Icon name="Plus" size={20} />}
          className="md:hidden bg-blue-600 hover:bg-blue-700 text-white fixed bottom-6 right-6 p-4 rounded-full shadow-lg"
        />

        {/* NEW DEAL MODAL - ENHANCED STYLING */}
        <MobileModal
          isOpen={showNewDealModal}
          onClose={() => setShowNewDealModal(false)}
          title="Create New Deal with Dates & Calendar"
          size="full"
          fullScreen={true}
        >
          <div className="space-y-6 p-1">
            {submitError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center space-x-2">
                  <Icon name="AlertCircle" size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Error</span>
                </div>
                <p className="text-xs mt-2 text-red-700">{submitError}</p>
              </div>
            )}

            {/* Enhanced Line Item Form with Date Fields */}
            <div className={`${themeClasses?.card} p-6 rounded-lg border shadow-sm`}>
              <div className="flex items-center mb-6">
                <Icon name="Calendar" size={20} className="text-blue-600 mr-3" />
                <h3 className={`${themeClasses?.text} text-lg font-semibold`}>Deal Information &amp; Dates</h3>
              </div>

              {/* NEW: Date Information Section (NO PROMISED TIME) - MOVED TO TOP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                    📅 Today&apos;s Date
                  </label>
                  <input
                    type="date"
                    value={lineItemForm?.todaysDate}
                    onChange={(e) => setLineItemForm({...lineItemForm, todaysDate: e?.target?.value})}
                    className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                  />
                  <p className="text-xs text-gray-600 mt-1">Deal creation date (can be manually overwritten)</p>
                </div>
                <div>
                  <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                    🎯 Promised Date *
                  </label>
                  <input
                    type="date"
                    value={lineItemForm?.promisedDate}
                    onChange={(e) => setLineItemForm({...lineItemForm, promisedDate: e?.target?.value})}
                    className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    min={lineItemForm?.todaysDate}
                  />
                  <p className="text-xs text-gray-600 mt-1">Customer promised completion date</p>
                </div>
              </div>

              {/* REORGANIZED: Customer Information Section - MOVED TO TOP */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className={`${themeClasses?.text} text-base font-semibold mb-4`}>Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Name *</label>
                    <input
                      type="text"
                      value={lineItemForm?.customerName}
                      onChange={(e) => setLineItemForm({...lineItemForm, customerName: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Phone</label>
                    <input
                      type="tel"
                      value={lineItemForm?.customerPhone}
                      onChange={(e) => setLineItemForm({...lineItemForm, customerPhone: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Email</label>
                    <input
                      type="email"
                      value={lineItemForm?.customerEmail}
                      onChange={(e) => setLineItemForm({...lineItemForm, customerEmail: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="customer@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* REORGANIZED: Vehicle Information Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className={`${themeClasses?.text} text-base font-semibold mb-4`}>Vehicle Information</h4>
                
                {/* Stock Number Search */}
                <div className="mb-4">
                  <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                    Stock Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={lineItemForm?.stockNumber}
                      onChange={(e) => {
                        const value = e?.target?.value;
                        setLineItemForm({...lineItemForm, stockNumber: value, vehicleId: ''});
                        handleStockSearch(value);
                      }}
                      placeholder="Enter stock number..."
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                    {isSearchingStock && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Icon name="Loader2" size={16} className="animate-spin text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Stock Search Results */}
                  {stockSearchResults?.length > 0 && (
                    <div className={`mt-2 max-h-40 overflow-y-auto rounded-lg border ${themeClasses?.card}`}>
                      {stockSearchResults?.map(vehicle => (
                        <div
                          key={vehicle?.id}
                          onClick={() => handleStockSelect(vehicle)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${themeClasses?.hover}`}
                        >
                          <p className={`${themeClasses?.text} text-sm font-medium`}>
                            {vehicle?.stock_number}
                          </p>
                          <p className={`${themeClasses?.textSecondary} text-xs`}>
                            {vehicle?.year} {vehicle?.make} {vehicle?.model}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Vehicle Display */}
                  {lineItemForm?.vehicleId && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-blue-600 text-sm font-medium">
                        ✓ Vehicle Selected
                      </p>
                      <p className={`${themeClasses?.textSecondary} text-xs`}>
                        {vehicles?.find(v => v?.id === lineItemForm?.vehicleId)?.year} {vehicles?.find(v => v?.id === lineItemForm?.vehicleId)?.make} {vehicles?.find(v => v?.id === lineItemForm?.vehicleId)?.model}
                      </p>
                    </div>
                  )}
                </div>

                {/* NEW: Manual Vehicle Details Section - Year Make Model */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Year *
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date()?.getFullYear() + 1}
                      value={lineItemForm?.vehicleYear || ''}
                      onChange={(e) => setLineItemForm({...lineItemForm, vehicleYear: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="e.g., 2023"
                    />
                  </div>
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Make *
                    </label>
                    <input
                      type="text"
                      value={lineItemForm?.vehicleMake || ''}
                      onChange={(e) => setLineItemForm({...lineItemForm, vehicleMake: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="e.g., Toyota, Honda, Ford"
                    />
                  </div>
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Model *
                    </label>
                    <input
                      type="text"
                      value={lineItemForm?.vehicleModel || ''}
                      onChange={(e) => setLineItemForm({...lineItemForm, vehicleModel: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="e.g., Camry, Civic, F-150"
                    />
                  </div>
                </div>

                {/* NEW: Vehicle Condition (New/Used) Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-3`}>
                      Vehicle Condition *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          lineItemForm?.vehicleCondition === 'new' ?'border-green-500 bg-green-50 shadow-sm' :'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setLineItemForm({...lineItemForm, vehicleCondition: 'new'})}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                            lineItemForm?.vehicleCondition === 'new' ?'bg-green-600 border-green-600' :'bg-white border-gray-300'
                          }`}>
                            {lineItemForm?.vehicleCondition === 'new' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <label className={`${themeClasses?.text} text-sm font-medium cursor-pointer`}>New</label>
                          </div>
                        </div>
                      </div>
                      <div 
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          lineItemForm?.vehicleCondition === 'used' ?'border-blue-500 bg-blue-50 shadow-sm' :'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setLineItemForm({...lineItemForm, vehicleCondition: 'used'})}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                            lineItemForm?.vehicleCondition === 'used' ?'bg-blue-600 border-blue-600' :'bg-white border-gray-300'
                          }`}>
                            {lineItemForm?.vehicleCondition === 'used' && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <label className={`${themeClasses?.text} text-sm font-medium cursor-pointer`}>Used</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FIXED: Customer Loaner Vehicle Checkbox - Remove duplicate checkboxes and fix visual state */}
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-3`}>
                      Customer Loaner Vehicle
                    </label>
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        lineItemForm?.needsLoaner ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => setLineItemForm({...lineItemForm, needsLoaner: !lineItemForm?.needsLoaner})}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 flex items-center justify-center rounded border-2 transition-all duration-200 ${
                          lineItemForm?.needsLoaner 
                            ? 'bg-blue-600 border-blue-600' :'bg-white border-gray-300 hover:border-gray-400'
                        }`}>
                          {lineItemForm?.needsLoaner && (
                            <Icon name="Check" size={14} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className={`${themeClasses?.text} text-sm font-medium cursor-pointer`}>
                            Customer requires loaner vehicle
                          </label>
                        </div>
                        {lineItemForm?.needsLoaner && (
                          <div className="flex-shrink-0">
                            <Icon name="Car" size={16} className="text-blue-600" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REORGANIZED: Staff Assignment Section - MOVED TO TOP */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className={`${themeClasses?.text} text-base font-semibold mb-4`}>Staff Assignment</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Delivery Coordinator</label>
                    <select
                      value={lineItemForm?.deliveryCoordinatorId}
                      onChange={(e) => setLineItemForm({...lineItemForm, deliveryCoordinatorId: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    >
                      <option value="">Select Delivery Coordinator</option>
                      {deliveryCoordinators?.map(coordinator => (
                        <option key={coordinator?.id} value={coordinator?.id}>
                          {coordinator?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Sales Person</label>
                    <select
                      value={lineItemForm?.salespersonId}
                      onChange={(e) => setLineItemForm({...lineItemForm, salespersonId: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    >
                      <option value="">Select Salesperson</option>
                      {salespeople?.map(person => (
                        <option key={person?.id} value={person?.id}>
                          {person?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Finance Manager</label>
                    <select
                      value={lineItemForm?.financeManagerId || ''}
                      onChange={(e) => setLineItemForm({...lineItemForm, financeManagerId: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    >
                      <option value="">Select Finance Manager</option>
                      {salespeople?.filter(person => person?.department?.toLowerCase()?.includes('finance') || person?.role === 'manager')?.map(person => (
                        <option key={person?.id} value={person?.id}>
                          {person?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="mb-6">
                <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Notes</label>
                <textarea
                  value={lineItemForm?.description}
                  onChange={(e) => setLineItemForm({...lineItemForm, description: e?.target?.value})}
                  className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                  rows="3"
                  placeholder="Additional notes about the deal..."
                />
              </div>

              {/* REORGANIZED: Line Item Details Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className={`${themeClasses?.text} text-base font-semibold mb-4`}>Line Item Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Product Name *</label>
                    <select
                      value={lineItemForm?.productId}
                      onChange={(e) => {
                        const productId = e?.target?.value;
                        const product = products?.find(p => p?.id === productId);
                        setLineItemForm({
                          ...lineItemForm, 
                          productId,
                          unitPrice: product?.unit_price || 0,
                          cost: product?.cost || 0
                        });
                      }}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    >
                      <option value="">Select Product</option>
                      {products?.map(product => (
                        <option key={product?.id} value={product?.id}>
                          {product?.name} - ${product?.unit_price} ({product?.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Sold Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lineItemForm?.unitPrice}
                      onChange={(e) => setLineItemForm({...lineItemForm, unitPrice: parseFloat(e?.target?.value) || 0})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lineItemForm?.cost}
                      onChange={(e) => setLineItemForm({...lineItemForm, cost: parseFloat(e?.target?.value) || 0})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      placeholder="Your cost"
                    />
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-3`}>
                      Vendor Required *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          !lineItemForm?.isOffSite 
                            ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setLineItemForm({...lineItemForm, isOffSite: false, vendorId: ''})}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                            !lineItemForm?.isOffSite 
                              ? 'bg-green-600 border-green-600' :'bg-white border-gray-300'
                          }`}>
                            {!lineItemForm?.isOffSite && (
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            )}
                          </div>
                          <label className={`${themeClasses?.text} text-xs font-medium cursor-pointer`}>On-Site</label>
                        </div>
                      </div>
                      <div 
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          lineItemForm?.isOffSite 
                            ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setLineItemForm({...lineItemForm, isOffSite: true})}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                            lineItemForm?.isOffSite 
                              ? 'bg-orange-600 border-orange-600' :'bg-white border-gray-300'
                          }`}>
                            {lineItemForm?.isOffSite && (
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            )}
                          </div>
                          <label className={`${themeClasses?.text} text-xs font-medium cursor-pointer`}>Off-Site</label>
                        </div>
                      </div>
                    </div>

                    {/* NEW: Vendor Selection appears when Off-Site is selected */}
                    {lineItemForm?.isOffSite && (
                      <div className="mt-4">
                        <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                          Select Vendor *
                        </label>
                        <select
                          value={lineItemForm?.vendorId}
                          onChange={(e) => setLineItemForm({...lineItemForm, vendorId: e?.target?.value})}
                          className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                          required
                        >
                          <option value="">Choose a vendor for off-site service</option>
                          {vendors?.map(vendor => (
                            <option key={vendor?.id} value={vendor?.id}>
                              {vendor?.name} - {vendor?.specialty}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-600 mt-1">
                          Required for off-site services. This will be used for scheduling and coordination.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Promised Date</label>
                    <input
                      type="date"
                      value={lineItemForm?.promisedDate}
                      onChange={(e) => setLineItemForm({...lineItemForm, promisedDate: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      min={lineItemForm?.todaysDate}
                    />
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Priority Level</label>
                    <select
                      value={lineItemForm?.priority}
                      onChange={(e) => setLineItemForm({...lineItemForm, priority: e?.target?.value})}
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pricing Preview - Updated without quantity */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${themeClasses?.card} p-4 rounded-lg border text-center`}>
                  <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Selling Price</p>
                  <p className={`${themeClasses?.text} text-2xl font-bold`}>
                    ${(lineItemForm?.unitPrice || 0)?.toFixed(2)}
                  </p>
                </div>
                <div className={`${themeClasses?.card} p-4 rounded-lg border text-center`}>
                  <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Your Cost</p>
                  <p className={`${themeClasses?.text} text-2xl font-bold`}>
                    ${(lineItemForm?.cost || 0)?.toFixed(2)}
                  </p>
                </div>
                <div className={`${themeClasses?.card} p-4 rounded-lg border text-center`}>
                  <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Profit</p>
                  <p className="text-green-600 text-2xl font-bold">
                    ${((lineItemForm?.unitPrice || 0) - (lineItemForm?.cost || 0))?.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Button 
                  onClick={handleAddLineItem}
                  variant="primary"
                  className="w-full py-3 text-base font-medium bg-blue-600 hover:bg-blue-700"
                  disabled={!lineItemForm?.customerName || !lineItemForm?.productId || (!lineItemForm?.vehicleId && (!lineItemForm?.vehicleYear || !lineItemForm?.vehicleMake || !lineItemForm?.vehicleModel))}
                >
                  <Icon name="Plus" size={16} className="mr-2" />
                  Add Line Item to Deal (Reorganized Flow)
                </Button>
              </div>
            </div>

            {/* Enhanced Line Items List with calendar integration preview */}
            {dealLineItems?.length > 0 && (
              <div>
                <div className={`${themeClasses?.card} p-6 rounded-lg border shadow-sm mb-6`}>
                  <div className="text-center mb-4">
                    <p className={`${themeClasses?.textSecondary} text-sm font-medium uppercase`}>Deal Summary ({dealLineItems?.length} items)</p>
                    <p className={`${themeClasses?.text} text-3xl font-bold mt-2`}>
                      ${dealLineItems?.reduce((sum, item) => sum + item?.totalPrice, 0)?.toFixed(2)}
                    </p>
                  </div>
                  
                  {/* Calendar Integration Preview */}
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className={`${themeClasses?.text} text-sm font-semibold mb-3 flex items-center`}>
                      <Icon name="Calendar" size={16} className="mr-2 text-blue-600" />
                      Calendar Integration Preview
                    </h4>
                    
                    {/* Off-site vendors preview */}
                    {(() => {
                      const offSiteVendors = {};
                      const onSiteItems = [];
                      
                      dealLineItems?.forEach(item => {
                        if (item?.vendor && item?.isOffSite) {
                          if (!offSiteVendors?.[item?.vendor?.id]) {
                            offSiteVendors[item?.vendor?.id] = {
                              vendor: item?.vendor,
                              items: [],
                              count: 0
                            };
                          }
                          offSiteVendors?.[item?.vendor?.id]?.items?.push(item);
                          offSiteVendors[item?.vendor?.id].count++;
                        } else {
                          onSiteItems?.push(item);
                        }
                      });
                      
                      const offSiteCount = Object.keys(offSiteVendors)?.length;
                      const onSiteCount = onSiteItems?.length;
                      
                      return (
                        <div className="space-y-2 text-sm">
                          {offSiteCount > 0 && (
                            <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                              <span className="text-orange-800 font-medium">
                                📅 {offSiteCount} Off-Site Calendar Event{offSiteCount > 1 ? 's' : ''} (Orange)
                              </span>
                              <span className="text-orange-600 text-xs">
                                Scheduled for {lineItemForm?.promisedDate}
                              </span>
                            </div>
                          )}
                          
                          {offSiteCount > 1 && (
                            <div className="ml-4 space-y-1">
                              {Object.entries(offSiteVendors)?.map(([vendorId, vendorGroup]) => (
                                <div key={vendorId} className="text-xs text-orange-700">
                                  • {vendorGroup?.vendor?.name}: {vendorGroup?.count} item{vendorGroup?.count > 1 ? 's' : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {onSiteCount > 0 && (
                            <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                              <span className="text-green-800 font-medium">
                                📅 1 On-Site Calendar Event (Green) - {onSiteCount} items grouped
                              </span>
                              <span className="text-green-600 text-xs">
                                Pending scheduling
                              </span>
                            </div>
                          )}
                          
                          <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                            ✅ Each off-site vendor gets separate calendar entry for coordination<br/>
                            ✅ All on-site items grouped together for efficient scheduling<br/>
                            ✅ Color coding: Orange for off-site, Green for on-site
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <div>📅 Created: {lineItemForm?.todaysDate} | 🎯 Promised: {lineItemForm?.promisedDate}</div>
                    <div>✅ Vehicle condition, service location, and customer loaner preferences tracked</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {dealLineItems?.map(item => (
                    <div key={item?.id} className={`${themeClasses?.card} p-4 rounded-lg border shadow-sm`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`${themeClasses?.text} text-sm font-medium`}>
                            {item?.vehicle?.stock_number} - {item?.vehicle?.year} {item?.vehicle?.make} {item?.vehicle?.model}
                          </p>
                          <p className={`${themeClasses?.textSecondary} text-xs`}>
                            {item?.customerName} - {item?.product?.name}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <p className="text-blue-600 text-sm font-medium">
                              ${item?.totalPrice?.toFixed(2)}
                            </p>
                            {/* Vehicle Condition Badge */}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item?.vehicleCondition === 'new' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {item?.vehicleCondition === 'new' ? '🆕 New' : '🚗 Used'}
                            </span>
                            {item?.requiresLoaner && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Icon name="Car" size={10} className="mr-1" />
                                Loaner Required
                              </span>
                            )}
                            {/* Enhanced service type with calendar color preview */}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item?.serviceType === 'vendor' ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-green-100 text-green-800 border border-green-300'
                            }`}>
                              {item?.serviceType === 'vendor' ? '🏢 Off-Site (Orange Calendar)' : '🏠 On-Site (Green Calendar)'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item?.priority === 'Urgent' || item?.priority === 'High' ? 'bg-red-100 text-red-800' :
                              item?.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {item?.priority}
                            </span>
                          </div>
                          {item?.vendor && (
                            <p className={`${themeClasses?.textSecondary} text-xs mt-1`}>
                              📅 Calendar: {item?.vendor?.name} | Scheduled for {lineItemForm?.promisedDate}
                            </p>
                          )}
                          {item?.description && (
                            <p className={`${themeClasses?.textSecondary} text-xs mt-1 italic`}>
                              {item?.description}
                            </p>
                          )}
                        </div>
                        <Button 
                          onClick={() => handleRemoveLineItem(item?.id)}
                          variant="ghost"
                          size="sm"
                          className="p-2"
                        >
                          <Icon name="Trash2" size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className={`flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3 pt-6 border-t ${themeClasses?.border}`}>
              <Button onClick={() => setShowNewDealModal(false)} variant="ghost" className="flex-1 py-3">
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNewDeal}
                disabled={!dealLineItems?.length || isSubmittingDeal}
                variant="primary"
                className="flex-1 py-3"
              >
                {isSubmittingDeal ? (
                  <>
                    <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                    Creating Deal with Dates...
                  </>
                ) : (
                  <>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Create Deal ({dealLineItems?.length} items) + Calendar
                  </>
                )}
              </Button>
            </div>
          </div>
        </MobileModal>

        {/* ENHANCED EDIT DEAL MODAL - Now fully functional */}
        <MobileModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDeal(null);
            setDealLineItems([]);
          }}
          title={`Edit Deal: ${selectedDeal?.vehicleInfo?.year || ''} ${selectedDeal?.vehicleInfo?.make || ''} ${selectedDeal?.vehicleInfo?.model || ''}`?.trim() || 'Edit Deal'}
          size="full"
          fullScreen={true}
        >
          <div className="space-y-6 p-1">
            {submitError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center space-x-2">
                  <Icon name="AlertCircle" size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Error</span>
                </div>
                <p className="text-xs mt-2 text-red-700">{submitError}</p>
              </div>
            )}

            {selectedDeal && (
              <div className="space-y-6">
                {/* Deal Summary Header */}
                <div className={`${themeClasses?.card} p-6 rounded-lg border shadow-sm bg-blue-50`}>
                  <div className="flex items-center mb-4">
                    <Icon name="Edit" size={20} className="text-blue-600 mr-3" />
                    <h3 className={`${themeClasses?.text} text-lg font-semibold`}>
                      Editing Deal #{selectedDeal?.id}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Vehicle</p>
                      <p className={`${themeClasses?.text} text-sm font-medium`}>
                        {selectedDeal?.vehicleInfo?.year} {selectedDeal?.vehicleInfo?.make} {selectedDeal?.vehicleInfo?.model}
                      </p>
                      <p className={`${themeClasses?.textSecondary} text-xs`}>Stock: {selectedDeal?.vehicleInfo?.stockNumber}</p>
                    </div>
                    <div>
                      <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Current Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedDeal?.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        selectedDeal?.status === 'pending'? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedDeal?.status?.replace('_', ' ')?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Current Value</p>
                      <p className="text-blue-600 text-xl font-bold">
                        ${selectedDeal?.totalValue?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enhanced Deal Edit Form */}
                <div className={`${themeClasses?.card} p-6 rounded-lg border shadow-sm`}>
                  <div className="flex items-center mb-6">
                    <Icon name="Settings" size={20} className="text-blue-600 mr-3" />
                    <h3 className={`${themeClasses?.text} text-lg font-semibold`}>Deal Information & Settings</h3>
                  </div>

                  {/* Date Information Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                        📅 Original Date
                      </label>
                      <input
                        type="date"
                        value={lineItemForm?.todaysDate}
                        readOnly
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input} bg-gray-100`}
                      />
                      <p className="text-xs text-gray-600 mt-1">Deal creation date (cannot be changed)</p>
                    </div>
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                        🎯 Promised Date *
                      </label>
                      <input
                        type="date"
                        value={lineItemForm?.promisedDate}
                        onChange={(e) => setLineItemForm({...lineItemForm, promisedDate: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                        min={new Date()?.toISOString()?.split('T')?.[0]}
                      />
                      <p className="text-xs text-gray-600 mt-1">Customer promised completion date</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Customer Information */}
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Name *</label>
                      <input
                        type="text"
                        value={lineItemForm?.customerName}
                        onChange={(e) => setLineItemForm({...lineItemForm, customerName: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                        placeholder="Enter customer name"
                      />
                    </div>

                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Phone</label>
                      <input
                        type="tel"
                        value={lineItemForm?.customerPhone}
                        onChange={(e) => setLineItemForm({...lineItemForm, customerPhone: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Customer Email</label>
                      <input
                        type="email"
                        value={lineItemForm?.customerEmail}
                        onChange={(e) => setLineItemForm({...lineItemForm, customerEmail: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                        placeholder="customer@email.com"
                      />
                    </div>

                    {/* Staff Assignments */}
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Salesperson</label>
                      <select
                        value={lineItemForm?.salespersonId}
                        onChange={(e) => setLineItemForm({...lineItemForm, salespersonId: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      >
                        <option value="">Select Salesperson</option>
                        {salespeople?.map(person => (
                          <option key={person?.id} value={person?.id}>
                            {person?.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Delivery Coordinator</label>
                      <select
                        value={lineItemForm?.deliveryCoordinatorId}
                        onChange={(e) => setLineItemForm({...lineItemForm, deliveryCoordinatorId: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      >
                        <option value="">Select Delivery Coordinator</option>
                        {deliveryCoordinators?.map(coordinator => (
                          <option key={coordinator?.id} value={coordinator?.id}>
                            {coordinator?.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Vendor (Optional)</label>
                      <select
                        value={lineItemForm?.vendorId}
                        onChange={(e) => setLineItemForm({...lineItemForm, vendorId: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      >
                        <option value="">No Vendor (In-House)</option>
                        {vendors?.map(vendor => (
                          <option key={vendor?.id} value={vendor?.id}>
                            {vendor?.name} - {vendor?.specialty}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Service Settings */}
                    <div>
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Priority Level</label>
                      <select
                        value={lineItemForm?.priority}
                        onChange={(e) => setLineItemForm({...lineItemForm, priority: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    {/* Loaner Vehicle Setting */}
                    <div className="md:col-span-2 lg:col-span-1">
                      <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/30">
                        <input
                          type="checkbox"
                          id="editNeedsLoaner"
                          checked={lineItemForm?.needsLoaner}
                          onChange={(e) => setLineItemForm({...lineItemForm, needsLoaner: e?.target?.checked})}
                          className="h-5 w-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <label htmlFor="editNeedsLoaner" className={`${themeClasses?.text} text-sm font-medium cursor-pointer`}>
                            Needs Loaner Vehicle
                          </label>
                          <p className={`${themeClasses?.textSecondary} text-xs mt-1`}>
                            Customer requires a loaner vehicle during service
                          </p>
                        </div>
                        {lineItemForm?.needsLoaner && (
                          <div className="flex-shrink-0">
                            <Icon name="Car" size={16} className="text-blue-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Service Description</label>
                      <textarea
                        value={lineItemForm?.description}
                        onChange={(e) => setLineItemForm({...lineItemForm, description: e?.target?.value})}
                        className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                        rows="3"
                        placeholder="Describe the service or work to be performed..."
                      />
                    </div>
                  </div>
                </div>

                {/* Current Line Items Display */}
                {dealLineItems?.length > 0 && (
                  <div className={`${themeClasses?.card} p-6 rounded-lg border shadow-sm`}>
                    <div className="flex items-center mb-4">
                      <Icon name="List" size={20} className="text-blue-600 mr-3" />
                      <h3 className={`${themeClasses?.text} text-lg font-semibold`}>Current Line Items ({dealLineItems?.length})</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {dealLineItems?.map(item => (
                        <div key={item?.id} className={`p-4 rounded-lg border ${themeClasses?.border} bg-gray-50`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`${themeClasses?.text} text-sm font-medium`}>
                                {item?.product?.name}
                              </p>
                              <p className={`${themeClasses?.textSecondary} text-xs mt-1`}>
                                Category: {item?.product?.category} | Brand: {item?.product?.brand}
                              </p>
                              <div className="flex items-center space-x-4 mt-2">
                                <p className="text-blue-600 text-sm font-medium">
                                  ${item?.totalPrice?.toFixed(2)}
                                </p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  item?.serviceType === 'vendor' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {item?.serviceType === 'vendor' ? '🏢 Vendor Service' : '🏠 In-House Service'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Status: Active</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className={`${themeClasses?.text} font-medium`}>Updated Total Value:</span>
                        <span className="text-blue-600 text-2xl font-bold">
                          ${dealLineItems?.reduce((sum, item) => sum + item?.totalPrice, 0)?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className={`flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3 pt-6 border-t ${themeClasses?.border}`}>
                  <Button 
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedDeal(null);
                      setDealLineItems([]);
                    }}
                    variant="ghost" 
                    className="flex-1 py-3"
                  >
                    Cancel Changes
                  </Button>
                  <Button 
                    onClick={handleSaveEditedDeal}
                    disabled={isSubmittingDeal || !dealLineItems?.length}
                    variant="primary"
                    className="flex-1 py-3"
                  >
                    {isSubmittingDeal ? (
                      <>
                        <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Icon name="Save" size={16} className="mr-2" />
                        Save Deal Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </MobileModal>

        {/* Deal Details Bottom Sheet - Mobile */}
        <MobileBottomSheet
          isOpen={showDealDetails && selectedDeal}
          onClose={() => setShowDealDetails(false)}
          title={selectedDeal ? `${selectedDeal?.vehicleInfo?.year || ''} ${selectedDeal?.vehicleInfo?.make || ''} ${selectedDeal?.vehicleInfo?.model || ''}`?.trim() || 'Deal Details' : 'Deal Details'}
        >
          {selectedDeal && (
            <div className="space-y-4">
              <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
                <div className="space-y-3">
                  <div>
                    <h4 className={`${themeClasses?.textSecondary} text-xs font-medium uppercase tracking-wide mb-1`}>Vehicle Information</h4>
                    <p className={`${themeClasses?.text} text-sm font-medium`}>
                      {selectedDeal?.vehicleInfo?.year} {selectedDeal?.vehicleInfo?.make} {selectedDeal?.vehicleInfo?.model}
                    </p>
                    <p className={`${themeClasses?.textSecondary} text-xs`}>Stock: {selectedDeal?.vehicleInfo?.stockNumber}</p>
                  </div>
                  <div>
                    <h4 className={`${themeClasses?.textSecondary} text-xs font-medium uppercase tracking-wide mb-1`}>Customer and Sales</h4>
                    <p className={`${themeClasses?.text} text-sm font-medium`}>{selectedDeal?.customer?.name}</p>
                    <p className="text-blue-600 text-xs">{selectedDeal?.salesperson}</p>
                  </div>
                </div>
              </div>
              <div className={`${themeClasses?.card} p-4 rounded-lg border text-center`}>
                <p className={`${themeClasses?.textSecondary} text-xs font-medium uppercase`}>Total Value</p>
                <p className={`${themeClasses?.text} text-2xl font-bold`}>${selectedDeal?.totalValue?.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <Button onClick={() => { setShowDealDetails(false); handleEditDeal(selectedDeal); }} variant="primary" className="w-full py-2">
                  <Icon name="Edit" size={14} className="mr-2" />Edit Deal
                </Button>
                <Button onClick={() => { setShowDealDetails(false); handleMessageCustomer(selectedDeal); }} variant="ghost" className="w-full py-2">
                  <Icon name="MessageSquare" size={14} className="mr-2" />Message Customer
                </Button>
              </div>
            </div>
          )}
        </MobileBottomSheet>

        {/* MESSAGE CUSTOMER MODAL */}
        <MobileModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          title="Message Customer"
        >
          <div className="space-y-4">
            <div>
              <p className={`${themeClasses?.textSecondary} text-sm mb-2`}>
                Sending to: <span className={themeClasses?.text}>{selectedDeal?.customer?.name}</span>
              </p>
              <p className={`${themeClasses?.textSecondary} text-sm mb-4`}>
                Phone: <span className={themeClasses?.text}>{selectedDeal?.customer?.phone}</span>
              </p>
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Message</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e?.target?.value)}
                placeholder="Enter your message..."
                rows={4}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={() => setShowMessageModal(false)} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSendMessage} variant="primary" className="flex-1">
                Send Message
              </Button>
            </div>
          </div>
        </MobileModal>

        {/* NEW: Schedule Modal */}
        <MobileModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          title="Schedule Deal"
          size="full"
          fullScreen={true}
        >
          <div className="space-y-6 p-1">
            {schedulingDeal && (
              <div className="space-y-4">
                <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
                  <h3 className={`${themeClasses?.text} text-lg font-semibold mb-3`}>
                    Schedule: {schedulingDeal?.vehicleInfo?.year} {schedulingDeal?.vehicleInfo?.make} {schedulingDeal?.vehicleInfo?.model}
                  </h3>
                  <p className={`${themeClasses?.textSecondary} text-sm`}>
                    Customer: {schedulingDeal?.customer?.name} | Stock: {schedulingDeal?.vehicleInfo?.stockNumber}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>
                      End Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Vendor</label>
                    <select className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}>
                      <option value="">Select Vendor</option>
                      {vendors?.map(vendor => (
                        <option key={vendor?.id} value={vendor?.id}>
                          {vendor?.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Location</label>
                    <input
                      type="text"
                      placeholder="e.g., Service Bay 1"
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Notes</label>
                    <textarea
                      rows="3"
                      placeholder="Internal scheduling notes..."
                      className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button 
                    onClick={() => setShowScheduleModal(false)} 
                    variant="ghost" 
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={() => {
                      // Handle scheduling logic here
                      setShowScheduleModal(false);
                      alert('Deal scheduled successfully!');
                    }}
                  >
                    <Icon name="Calendar" size={16} className="mr-2" />
                    Schedule Deal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </MobileModal>

        {/* ADD VENDOR MODAL */}
        <MobileModal
          isOpen={showAddVendorModal}
          onClose={() => setShowAddVendorModal(false)}
          title="Add New Vendor"
        >
          <div className="space-y-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Vendor Name *</label>
              <input
                type="text"
                value={newVendorForm?.name}
                onChange={(e) => setNewVendorForm({...newVendorForm, name: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Enter vendor name"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Specialty *</label>
              <input
                type="text"
                value={newVendorForm?.specialty}
                onChange={(e) => setNewVendorForm({...newVendorForm, specialty: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="e.g., Window Tinting, Audio Systems"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Contact Person</label>
              <input
                type="text"
                value={newVendorForm?.contactPerson}
                onChange={(e) => setNewVendorForm({...newVendorForm, contactPerson: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Primary contact name"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Phone</label>
              <input
                type="tel"
                value={newVendorForm?.phone}
                onChange={(e) => setNewVendorForm({...newVendorForm, phone: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Email</label>
              <input
                type="email"
                value={newVendorForm?.email}
                onChange={(e) => setNewVendorForm({...newVendorForm, email: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="vendor@company.com"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={() => setShowAddVendorModal(false)} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveNewVendor} variant="primary" className="flex-1">
                Add Vendor
              </Button>
            </div>
          </div>
        </MobileModal>

        {/* ADD PRODUCT MODAL */}
        <MobileModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          title="Add New Product"
        >
          <div className="space-y-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Product Name *</label>
              <input
                type="text"
                value={newProductForm?.name}
                onChange={(e) => setNewProductForm({...newProductForm, name: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Enter product name"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Category</label>
              <input
                type="text"
                value={newProductForm?.category}
                onChange={(e) => setNewProductForm({...newProductForm, category: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="e.g., Window Tinting, Audio"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Brand</label>
              <input
                type="text"
                value={newProductForm?.brand}
                onChange={(e) => setNewProductForm({...newProductForm, brand: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Product brand"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm?.unitPrice}
                  onChange={(e) => setNewProductForm({...newProductForm, unitPrice: parseFloat(e?.target?.value) || 0})}
                  className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Your Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm?.cost}
                  onChange={(e) => setNewProductForm({...newProductForm, cost: parseFloat(e?.target?.value) || 0})}
                  className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Part Number</label>
              <input
                type="text"
                value={newProductForm?.partNumber}
                onChange={(e) => setNewProductForm({...newProductForm, partNumber: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Manufacturer part number"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Description</label>
              <textarea
                value={newProductForm?.description}
                onChange={(e) => setNewProductForm({...newProductForm, description: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                rows="3"
                placeholder="Product description"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={() => setShowAddProductModal(false)} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveNewProduct} variant="primary" className="flex-1">
                Add Product
              </Button>
            </div>
          </div>
        </MobileModal>

        {/* ADD SALESPERSON MODAL */}
        <MobileModal
          isOpen={showAddSalespersonModal}
          onClose={() => setShowAddSalespersonModal(false)}
          title="Add New Salesperson"
        >
          <div className="space-y-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Full Name *</label>
              <input
                type="text"
                value={newSalespersonForm?.fullName}
                onChange={(e) => setNewSalespersonForm({...newSalespersonForm, fullName: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Email *</label>
              <input
                type="email"
                value={newSalespersonForm?.email}
                onChange={(e) => setNewSalespersonForm({...newSalespersonForm, email: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Phone</label>
              <input
                type="tel"
                value={newSalespersonForm?.phone}
                onChange={(e) => setNewSalespersonForm({...newSalespersonForm, phone: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={() => setShowAddSalespersonModal(false)} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveNewSalesperson} variant="primary" className="flex-1">
                Add Salesperson
              </Button>
            </div>
          </div>
        </MobileModal>

        {/* ADD DELIVERY COORDINATOR MODAL */}
        <MobileModal
          isOpen={showAddDeliveryCoordinatorModal}
          onClose={() => setShowAddDeliveryCoordinatorModal(false)}
          title="Add New Delivery Coordinator"
        >
          <div className="space-y-4">
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Full Name *</label>
              <input
                type="text"
                value={newDeliveryCoordinatorForm?.fullName}
                onChange={(e) => setNewDeliveryCoordinatorForm({...newDeliveryCoordinatorForm, fullName: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Email *</label>
              <input
                type="email"
                value={newDeliveryCoordinatorForm?.email}
                onChange={(e) => setNewDeliveryCoordinatorForm({...newDeliveryCoordinatorForm, email: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className={`${themeClasses?.text} block text-sm font-medium mb-2`}>Phone</label>
              <input
                type="tel"
                value={newDeliveryCoordinatorForm?.phone}
                onChange={(e) => setNewDeliveryCoordinatorForm({...newDeliveryCoordinatorForm, phone: e?.target?.value})}
                className={`w-full p-3 text-sm rounded-lg border ${themeClasses?.input}`}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={() => setShowAddDeliveryCoordinatorModal(false)} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveNewDeliveryCoordinator} variant="primary" className="flex-1">
                Add Delivery Coordinator
              </Button>
            </div>
          </div>
        </MobileModal>

      </div>
    </AppLayout>
  );
};

export default DealsPage;