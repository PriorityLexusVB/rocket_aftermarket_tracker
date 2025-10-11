import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layouts/AppLayout';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { MobileTable, MobileFloatingAction, MobileModal } from '../../components/mobile/MobileComponents';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import dealService from '../../services/dealService';
import DealForm from './DealForm';

// PHASE 1: Feature flag for organized rollout - now from environment variable
const NEW_DEALS_UI = import.meta.env?.VITE_NEW_DEALS_UI === 'true' || false;

const DealsPage = () => {
  const { user } = useAuth();
  const { themeClasses } = useTheme();
  const navigate = useNavigate();
  
  // PHASE 1: Enhanced state management with better organization
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // PHASE 1: Organized modal states with proper feature flag gating
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showDealDetails, setShowDealDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  // PHASE 1: Schema-accurate reference data states
  const [vehicles, setVehicles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [deliveryCoordinators, setDeliveryCoordinators] = useState([]);
  const [financeManagers, setFinanceManagers] = useState([]);
  
  // PHASE 1: Consolidated error and action states
  const [messageText, setMessageText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [dealToDelete, setDealToDelete] = useState(null);
  const [deletingDealId, setDeletingDealId] = useState(null);

  // Load all required data on component mount
  useEffect(() => {
    loadDeals();
    loadVehicles();
    loadVendors();
    loadProducts();
    loadSalespeople();
    loadDeliveryCoordinators();
    loadFinanceManagers();
  }, []);

  // PHASE 1: Schema-accurate data loading with exact column references
  const loadDeals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicles:vehicles!jobs_vehicle_id_fkey (
            stock_number, year, make, model, color, vin, 
            owner_name, owner_phone, owner_email
          ),
          vendors (name, specialty),
          sales_person:user_profiles!jobs_created_by_fkey (full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (full_name, email),
          job_parts (
            id, quantity_used, unit_price, total_price,
            products (
              id, name, op_code, unit_price, category, brand, part_number
            )
          ),
          transactions (
            id, created_at, total_amount,
            customer_name, customer_phone, customer_email
          )
        `)
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      
      // PHASE 1: Enhanced data transformation with proper schema mapping
      const transformedDeals = data?.map(job => ({
        id: job?.id,
        vehicleInfo: {
          year: job?.vehicles?.year,
          make: job?.vehicles?.make,
          model: job?.vehicles?.model,
          vin: job?.vehicles?.vin,
          stockNumber: job?.vehicles?.stock_number,
          vehicleId: job?.vehicle_id
        },
        customer: {
          name: job?.transactions?.[0]?.customer_name || job?.vehicles?.owner_name || 'N/A',
          phone: job?.transactions?.[0]?.customer_phone || job?.vehicles?.owner_phone || 'N/A',
          email: job?.transactions?.[0]?.customer_email || job?.vehicles?.owner_email || 'N/A'
        },
        salesperson: job?.sales_person?.full_name || 'Unassigned',
        deliveryCoordinator: job?.delivery_coordinator?.full_name || 'Unassigned',
        items: job?.job_parts?.map(part => ({
          id: part?.id,
          productId: part?.products?.id,
          name: part?.products?.name,
          fullName: part?.products?.name,
          opCode: part?.products?.op_code,
          price: part?.unit_price || part?.products?.unit_price,
          category: part?.products?.category,
          brand: part?.products?.brand,
          partNumber: part?.products?.part_number,
          quantity: part?.quantity_used,
          totalPrice: part?.total_price,
          status: 'Active'
        })) || [],
        totalValue: job?.transactions?.[0]?.total_amount || 
                    job?.job_parts?.reduce((sum, part) => sum + (part?.total_price || 0), 0) || 
                    job?.estimated_cost || 0,
        status: job?.job_status,
        vendor: job?.vendors?.name || 'None',
        estimatedCompletion: job?.scheduled_end_time,
        priority: job?.priority || 'medium',
        description: job?.description,
        title: job?.title,
        needsLoaner: job?.customer_needs_loaner || false,
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

  // PHASE 1: Schema-accurate reference data loading functions
  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select('*')
        ?.eq('vehicle_status', 'active')
        ?.order('stock_number');
      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('name');
      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

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

  const loadSalespeople = async () => {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.eq('role', 'staff')
        ?.eq('department', 'Sales Consultants')
        ?.eq('is_active', true)
        ?.order('full_name');
      if (error) throw error;
      setSalespeople(data || []);
    } catch (error) {
      console.error('Error loading salespeople:', error);
    }
  };

  const loadDeliveryCoordinators = async () => {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.in('role', ['admin', 'manager'])
        ?.eq('department', 'Delivery Coordinator')
        ?.eq('is_active', true)
        ?.order('full_name');
      if (error) throw error;
      setDeliveryCoordinators(data || []);
    } catch (error) {
      console.error('Error loading delivery coordinators:', error);
    }
  };

  const loadFinanceManagers = async () => {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.eq('role', 'staff')
        ?.eq('department', 'Finance Manager')
        ?.eq('is_active', true)
        ?.order('full_name');
      if (error) throw error;
      setFinanceManagers(data || []);
    } catch (error) {
      console.error('Error loading finance managers:', error);
    }
  };

  // PHASE 1: Enhanced filtering with schema-accurate field references
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

  // PHASE 1: Feature-flag-aware action handlers
  const handleNewDeal = () => {
    if (!NEW_DEALS_UI) {
      // Legacy behavior - redirect to separate route
      navigate('/deals/new');
      return;
    }

    // PHASE 1: Basic modal opening - Phase 2 will implement full DealForm
    setSubmitError('');
    setShowNewDealModal(true);
  };

  const handleEditDeal = (deal) => {
    if (!NEW_DEALS_UI) {
      // Legacy behavior - redirect to separate route
      navigate(`/deals/${deal?.id}/edit`);
      return;
    }

    // PHASE 1: Store deal for editing - Phase 2 will implement full DealForm with prefill
    setSelectedDeal(deal);
    setSubmitError('');
    setShowEditModal(true);
  };

  const handleDeleteDeal = (deal) => {
    if (!NEW_DEALS_UI) {
      // Legacy behavior - simple confirm dialog
      const confirmed = window.confirm(`Delete deal for ${deal?.customer?.name}?`);
      if (confirmed) {
        deleteDealLegacy(deal?.id);
      }
      return;
    }

    // PHASE 1: Enhanced delete confirmation modal
    setDealToDelete(deal);
    setShowDeleteConfirmModal(true);
  };

  const handleMessageCustomer = (deal) => {
    if (!NEW_DEALS_UI) {
      // Legacy behavior - simple prompt
      const message = prompt(`Message for ${deal?.customer?.name}:`);
      if (message) {
        sendMessageLegacy(deal?.customer?.phone, message);
      }
      return;
    }

    // PHASE 1: Enhanced messaging drawer
    setSelectedDeal(deal);
    setMessageText(`Hi ${deal?.customer?.name}, this is regarding your ${deal?.vehicleInfo?.year} ${deal?.vehicleInfo?.make} ${deal?.vehicleInfo?.model} (Stock: ${deal?.vehicleInfo?.stockNumber}). `);
    setShowMessageModal(true);
  };

  // PHASE 1: Rollback-capable legacy functions
  const deleteDealLegacy = async (dealId) => {
    try {
      const { error } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);
      if (error) throw error;
      loadDeals();
      alert('Deal deleted successfully');
    } catch (error) {
      console.error('Error deleting deal:', error);
      alert('Error deleting deal');
    }
  };

  const sendMessageLegacy = async (phone, message) => {
    try {
      // Simple message logging
      console.log('Sending message to:', phone, 'Message:', message);
      alert(`Message sent to ${phone}`);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    }
  };

  // PHASE 1: Enhanced utility functions
  const parseNameToLastnameFirstInitial = (fullName) => {
    if (!fullName || fullName === 'Unassigned' || fullName === 'N/A') {
      return fullName;
    }
    
    const nameParts = fullName?.trim()?.split(' ');
    if (nameParts?.length < 2) {
      return fullName;
    }
    
    const firstName = nameParts?.[0];
    const lastName = nameParts?.[nameParts?.length - 1];
    
    return `${lastName}, ${firstName?.charAt(0)?.toUpperCase()}.`;
  };

  // PHASE 1: Schema-accurate KPI calculations
  const totalRevenue = filteredDeals?.reduce((sum, deal) => sum + (deal?.totalValue || 0), 0);
  const completedDeals = filteredDeals?.filter(deal => deal?.status === 'completed')?.length;
  const pendingDeals = filteredDeals?.filter(deal => deal?.status === 'pending')?.length;
  const activeDeals = filteredDeals?.filter(deal => deal?.status === 'in_progress' || deal?.status === 'scheduled')?.length;
  const estimatedTotalProfit = totalRevenue * 0.25;
  const averageMargin = totalRevenue > 0 ? (estimatedTotalProfit / totalRevenue * 100) : 0;

  // PHASE 1: Enhanced utility handlers
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

  // PHASE 1: Enhanced mobile card rendering with schema-accurate data
  const renderDealCard = (deal, index) => (
    <div key={deal?.id} className={`${themeClasses?.card} p-4 mb-4 rounded-lg border shadow-sm`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`${themeClasses?.text} text-base font-semibold mb-1`}>
              {deal?.vehicleInfo?.year} {deal?.vehicleInfo?.make} {deal?.vehicleInfo?.model}
            </h3>
            <p className={`${themeClasses?.textSecondary} text-sm`}>Stock: {deal?.vehicleInfo?.stockNumber}</p>
            
            <div className="mt-1 space-y-1">
              <p className="text-green-600 text-xs font-semibold">
                DC: {parseNameToLastnameFirstInitial(deal?.deliveryCoordinator)}
              </p>
              <p className="text-blue-600 text-xs font-semibold">
                Sales: {parseNameToLastnameFirstInitial(deal?.salesperson)}
              </p>
            </div>
            
            <div className="mt-2 space-y-1">
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-gray-600">📅 Created: {deal?.todaysDate}</span>
                {deal?.promisedDate && (
                  <span className="text-blue-600 font-medium">🎯 Promise: {deal?.promisedDate}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  deal?.serviceType === 'vendor' ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-green-100 text-green-800 border border-green-300'
                }`}>
                  {deal?.serviceType === 'vendor' ? '🏢 Off-Site' : '🏠 On-Site'}
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

        <div className={`border-t ${themeClasses?.border} pt-2`} />

        <div className="flex items-center justify-between">
          <div>
            <p className={`${themeClasses?.text} text-sm font-semibold`}>
              {deal?.customer?.name === 'N/A' ? 'N/A' : deal?.customer?.name}
            </p>
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
              <div className={`w-2 h-2 rounded-full mr-1 ${
                deal?.priority?.toLowerCase() === 'high' || deal?.priority?.toLowerCase() === 'urgent' ? 'bg-red-500' :
                deal?.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <span className={`${themeClasses?.textSecondary} text-xs`}>
                {deal?.priority}
              </span>
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                💳 Net 0 Days
              </span>
            </div>
          </div>
        </div>

        {/* PHASE 1: Enhanced line items display with schema-accurate data */}
        <div className={`border-t pt-2 ${themeClasses?.border}`}>
          {deal?.items?.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Line Items</h4>
              {deal?.items?.slice(0, 2)?.map((item, idx) => (
                <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span title={item?.fullName || item?.name} className="font-semibold text-sm cursor-help text-blue-900">
                      {item?.fullName || item?.name}
                    </span>
                    <span className="text-blue-700 font-bold text-sm">
                      ${item?.price?.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <Icon name="Calendar" size={10} className="text-blue-600" />
                      <span className="text-blue-700 font-medium">
                        Promise: {deal?.promisedDate || 'TBD'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Icon name="CreditCard" size={10} className="text-blue-600" />
                      <span className="text-blue-700 font-medium">
                        Net 0 Days
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-blue-300">
                    <div className="flex justify-between text-xs text-blue-700">
                      <span>Status: Active</span>
                      <span>Priority: {deal?.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
              {deal?.items?.length > 2 && (
                <p className="text-blue-600 text-xs font-medium">+{deal?.items?.length - 2} more line items</p>
              )}
            </div>
          ) : (
            <p className={`${themeClasses?.textSecondary} text-xs italic`}>{deal?.title || deal?.description}</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2">
          <Button onClick={() => setSelectedDeal(deal) || setShowDealDetails(true)} size="sm" variant="ghost" className="text-xs py-1">
            <Icon name="Eye" size={12} className="mr-1" />View
          </Button>
          <Button onClick={() => handleEditDeal(deal)} size="sm" variant="ghost" className="text-xs py-1">
            <Icon name="Edit" size={12} className="mr-1" />Edit
          </Button>
          <Button onClick={() => handleMessageCustomer(deal)} size="sm" variant="primary" className="text-xs py-1">
            <Icon name="MessageSquare" size={12} className="mr-1" />SMS
          </Button>
          <Button onClick={() => handleDeleteDeal(deal)} size="sm" variant="ghost" className="text-xs py-1 text-red-600 hover:bg-red-50">
            <Icon name="Trash2" size={12} className="mr-1" />Del
          </Button>
        </div>
      </div>
    </div>
  );

  // PHASE 1: Enhanced desktop table row rendering
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
          <p className={`${themeClasses?.text} text-sm font-medium`}>
            {deal?.customer?.name === 'N/A' ? 'N/A' : deal?.customer?.name}
          </p>
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
        <div className="space-y-1">
          <p className="text-green-600 text-sm font-medium">
            DC: {parseNameToLastnameFirstInitial(deal?.deliveryCoordinator)}
          </p>
          <p className="text-blue-600 text-sm font-medium">
            Sales: {parseNameToLastnameFirstInitial(deal?.salesperson)}
          </p>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          {deal?.items?.length > 0 ? deal?.items?.slice(0, 2)?.map((item, itemIndex) => (
            <div key={itemIndex} className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm cursor-help text-blue-900" title={item?.fullName || item?.name}>
                  {item?.fullName || item?.name}
                </span>
                <span className="text-blue-700 font-bold text-sm">
                  ${item?.price?.toFixed(2)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1">
                  <Icon name="Calendar" size={10} className="text-blue-600" />
                  <span className="text-blue-700 font-medium">
                    Promise: {deal?.promisedDate || 'TBD'}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Icon name="CreditCard" size={10} className="text-blue-600" />
                  <span className="text-blue-700 font-medium">
                    Net 0 Days
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className={`${themeClasses?.textSecondary} text-xs italic`}>{deal?.title || deal?.description}</div>
          )}
          {deal?.items?.length > 2 && (
            <p className="text-blue-600 text-xs font-medium">+{deal?.items?.length - 2} more line items</p>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-center">
          <p className="text-blue-600 text-sm font-bold">
            ${deal?.totalValue?.toLocaleString()}
          </p>
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              💳 Net 0 Days
            </span>
          </div>
        </div>
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
          <Button onClick={() => setSelectedDeal(deal) || setShowDealDetails(true)} size="sm" variant="ghost" className="">
            <Icon name="Eye" size={14} />
          </Button>
          <Button onClick={() => handleEditDeal(deal)} size="sm" variant="ghost" className="">
            <Icon name="Edit" size={14} />
          </Button>
          <Button onClick={() => handleMessageCustomer(deal)} size="sm" variant="primary" className="">
            <Icon name="MessageSquare" size={14} />
          </Button>
          <Button onClick={() => handleDeleteDeal(deal)} size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">
            <Icon name="Trash2" size={14} />
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
        
        {/* PHASE 1: Enhanced feature flag indicator with environment source */}
        {NEW_DEALS_UI && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Icon name="Settings" size={16} className="text-green-600" />
              <span className="text-green-800 font-medium text-sm">NEW_DEALS_UI Active (Phase 1)</span>
              <span className="text-green-600 text-xs">
                Environment: {import.meta.env?.VITE_NEW_DEALS_UI} • Individual line scheduling, finance integration ready
              </span>
            </div>
          </div>
        )}

        {/* PHASE 1: Enhanced header with organized date display */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex-1">
            <div className="flex items-center space-x-6 mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center space-x-3">
                <Icon name="Calendar" size={24} className="text-blue-600" />
                <div>
                  <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Today's Date</p>
                  <p className="text-lg font-bold text-blue-900">
                    {new Date()?.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              
              <div className="h-8 w-px bg-gray-300"></div>
              
              <div className="flex items-center space-x-3">
                <Icon name="Hash" size={24} className="text-green-600" />
                <div>
                  <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Next Deal #</p>
                  <p className="text-lg font-bold text-green-900">
                    #{deals?.length ? `${Math.max(...deals?.map(d => parseInt(d?.id?.slice(-3)) || 0)) + 1}` : '1'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-2">
              <h1 className={`${themeClasses?.text} text-3xl font-bold`}>
                Aftermarket Deals
              </h1>
            </div>
            <p className={`${themeClasses?.textSecondary} text-base`}>
              {NEW_DEALS_UI ? 
                'Phase 1: Feature-flagged UI with enhanced modals and schema-accurate data loading' : 'Classic deals management interface'
              }
            </p>
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
            <Button onClick={handleExport} variant="ghost" className="flex items-center">
              <Icon name="Download" size={16} className="mr-2" />Export
            </Button>
            <Button onClick={handleNewDeal} variant="primary" className="flex items-center">
              <Icon name="Plus" size={16} className="mr-2" />New Deal
            </Button>
          </div>
        </div>

        {/* PHASE 1: Enhanced mobile search and filter with better organization */}
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

        {/* PHASE 1: Schema-accurate KPI section with better calculations */}
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

        {/* PHASE 1: Enhanced deals table with better responsive design */}
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
            headers={['Vehicle', 'Customer', 'DC / Sales', 'Items', 'Value', 'Status', 'Actions']}
            className={themeClasses?.table || ''}
          />
        </div>

        {/* Mobile Floating Action Button */}
        <MobileFloatingAction
          onClick={handleNewDeal}
          icon={<Icon name="Plus" size={20} />}
          className="fixed bottom-4 right-4 z-50"
        />

        {/* PHASE 1: Enhanced modals with better organization - only show when feature flag enabled */}
        {NEW_DEALS_UI && (
          <>
            {/* PHASE 1: Enhanced Deal Details Modal */}
            <MobileModal
              isOpen={showDealDetails && selectedDeal}
              onClose={() => setShowDealDetails(false)}
              title="Deal Details"
              size="medium"
            >
              {selectedDeal && (
                <div className="space-y-4 p-1">
                  <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
                    <h3 className={`${themeClasses?.text} text-lg font-semibold mb-3`}>
                      {selectedDeal?.vehicleInfo?.year} {selectedDeal?.vehicleInfo?.make} {selectedDeal?.vehicleInfo?.model}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Stock:</span>
                        <span className={`${themeClasses?.text}`}>{selectedDeal?.vehicleInfo?.stockNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer:</span>
                        <span className={`${themeClasses?.text}`}>{selectedDeal?.customer?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className={`${themeClasses?.text}`}>{selectedDeal?.customer?.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Value:</span>
                        <span className="text-blue-600 font-bold text-lg">${selectedDeal?.totalValue?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`${themeClasses?.text}`}>{selectedDeal?.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Line Items:</span>
                        <span className={`${themeClasses?.text}`}>{selectedDeal?.items?.length} items</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button 
                      onClick={() => { setShowDealDetails(false); handleEditDeal(selectedDeal); }} 
                      variant="primary" 
                      className="w-full py-2"
                    >
                      <Icon name="Edit" size={14} className="mr-2" />Edit Deal
                    </Button>
                    <Button 
                      onClick={() => { setShowDealDetails(false); handleMessageCustomer(selectedDeal); }} 
                      variant="ghost" 
                      className="w-full py-2"
                    >
                      <Icon name="MessageSquare" size={14} className="mr-2" />Message Customer
                    </Button>
                  </div>
                </div>
              )}
            </MobileModal>

            {/* PHASE 1: Enhanced Message Modal with schema-accurate logging */}
            <MobileModal
              isOpen={showMessageModal}
              onClose={() => setShowMessageModal(false)}
              title="Message Customer"
              size="medium"
            >
              <div className="space-y-4 p-1">
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
                  <Button 
                    onClick={async () => {
                      try {
                        // PHASE 1: Schema-accurate message logging using exact column names
                        await supabase?.from('communications')?.insert([{
                          job_id: selectedDeal?.id,
                          vehicle_id: selectedDeal?.vehicleInfo?.vehicleId,
                          communication_type: 'sms',
                          recipient: selectedDeal?.customer?.phone,
                          message: messageText,
                          sent_by: user?.id
                        }]);
                        
                        alert(`Message sent to ${selectedDeal?.customer?.name}`);
                        setShowMessageModal(false);
                        setMessageText('');
                      } catch (error) {
                        console.error('Error sending message:', error);
                        alert('Error sending message');
                      }
                    }} 
                    variant="primary" 
                    className="flex-1"
                  >
                    Send Message
                  </Button>
                </div>
              </div>
            </MobileModal>

            {/* PHASE 1: Enhanced Delete Confirmation with schema-accurate deletion */}
            <MobileModal
              isOpen={showDeleteConfirmModal}
              onClose={() => {
                setShowDeleteConfirmModal(false);
                setDealToDelete(null);
              }}
              title="Delete Deal"
              size="medium"
            >
              <div className="space-y-4 p-1">
                {dealToDelete && (
                  <>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <Icon name="AlertTriangle" size={20} className="text-red-600" />
                        <h3 className="text-red-800 font-semibold">Confirm Deletion</h3>
                      </div>
                      <p className="text-red-700 text-sm">
                        This will permanently delete the deal and all associated data.
                      </p>
                    </div>

                    <div className={`${themeClasses?.card} p-4 rounded-lg border`}>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vehicle:</span>
                          <span className={`${themeClasses?.text} font-medium`}>
                            {dealToDelete?.vehicleInfo?.year} {dealToDelete?.vehicleInfo?.make} {dealToDelete?.vehicleInfo?.model}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Customer:</span>
                          <span className={`${themeClasses?.text}`}>{dealToDelete?.customer?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Value:</span>
                          <span className="text-red-600 font-bold text-lg">${dealToDelete?.totalValue?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <Button 
                        onClick={() => {
                          setShowDeleteConfirmModal(false);
                          setDealToDelete(null);
                        }}
                        variant="ghost" 
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={async () => {
                          try {
                            setDeletingDealId(dealToDelete?.id);
                            
                            // PHASE 1: Schema-accurate cascading deletion using exact table names
                            await supabase?.from('job_parts')?.delete()?.eq('job_id', dealToDelete?.id);
                            await supabase?.from('transactions')?.delete()?.eq('job_id', dealToDelete?.id);
                            await supabase?.from('communications')?.delete()?.eq('job_id', dealToDelete?.id);
                            await supabase?.from('jobs')?.delete()?.eq('id', dealToDelete?.id);

                            setDeals(deals?.filter(deal => deal?.id !== dealToDelete?.id));
                            setShowDeleteConfirmModal(false);
                            setDealToDelete(null);
                            
                            alert(`✅ Deal deleted successfully!`);
                          } catch (error) {
                            console.error('Error deleting deal:', error);
                            setSubmitError(`Failed to delete deal: ${error?.message}`);
                          } finally {
                            setDeletingDealId(null);
                          }
                        }}
                        variant="primary"
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        disabled={deletingDealId === dealToDelete?.id}
                      >
                        {deletingDealId === dealToDelete?.id ? (
                          <>
                            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Icon name="Trash2" size={16} className="mr-2" />
                            Delete Deal
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </MobileModal>

            {/* PHASE 2: Real DealForm Create Modal */}
            <MobileModal
              isOpen={showNewDealModal}
              onClose={() => {
                setShowNewDealModal(false);
                setSelectedDeal(null);
                setSubmitError('');
              }}
              title="Create New Deal"
              size="large"
            >
              <DealForm
                mode="create"
                onSubmit={async (payload) => {
                  try {
                    await dealService?.createDeal(payload);
                    setShowNewDealModal(false);
                    loadDeals(); // Refresh list
                    alert('✅ Deal created successfully!');
                  } catch (error) {
                    console.error('Create deal error:', error);
                    setSubmitError(`Failed to create deal: ${error?.message}`);
                  }
                }}
                onCancel={() => {
                  setShowNewDealModal(false);
                  setSubmitError('');
                }}
                vehicles={vehicles}
                vendors={vendors}
                products={products}
                salespeople={salespeople}
                deliveryCoordinators={deliveryCoordinators}
                financeManagers={financeManagers}
              />
            </MobileModal>

            {/* PHASE 2: Real DealForm Edit Modal */}
            <MobileModal
              isOpen={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setSelectedDeal(null);
                setSubmitError('');
              }}
              title="Edit Deal"
              size="large"
            >
              {selectedDeal && (
                <DealForm
                  mode="edit"
                  initialData={async () => {
                    try {
                      // PHASE 2: Fetch complete deal data for editing
                      const deal = await dealService?.getDeal(selectedDeal?.id);
                      const items = await dealService?.getDealItems(selectedDeal?.id);
                      return { deal, items };
                    } catch (error) {
                      console.error('Error loading deal for edit:', error);
                      setSubmitError(`Failed to load deal: ${error?.message}`);
                      return null;
                    }
                  }}
                  onSubmit={async (payload) => {
                    try {
                      // PHASE 2: Update deal using service
                      await dealService?.updateDeal(selectedDeal?.id, payload?.deal);
                      
                      // Handle line items mutations
                      const existingItems = await dealService?.getDealItems(selectedDeal?.id);
                      const mutations = {
                        insert: payload?.items?.filter(item => !item?.id),
                        update: payload?.items?.filter(item => item?.id),
                        delete: existingItems?.filter(existing => !payload?.items?.some(item => item?.id === existing?.id))?.map(item => item?.id)
                      };
                      
                      if (mutations?.insert?.length > 0 || mutations?.update?.length > 0 || mutations?.delete?.length > 0) {
                        await dealService?.mutateItems(selectedDeal?.id, mutations);
                      }

                      setShowEditModal(false);
                      setSelectedDeal(null);
                      loadDeals(); // Refresh list
                      alert('✅ Deal updated successfully!');
                    } catch (error) {
                      console.error('Update deal error:', error);
                      setSubmitError(`Failed to update deal: ${error?.message}`);
                    }
                  }}
                  onCancel={() => {
                    setShowEditModal(false);
                    setSelectedDeal(null);
                    setSubmitError('');
                  }}
                  vehicles={vehicles}
                  vendors={vendors}
                  products={products}
                  salespeople={salespeople}
                  deliveryCoordinators={deliveryCoordinators}
                  financeManagers={financeManagers}
                />
              )}
            </MobileModal>
          </>
        )}

        {/* PHASE 1: Error display area */}
        {submitError && (
          <div className="fixed bottom-4 left-4 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50">
            <div className="flex items-center space-x-2">
              <Icon name="AlertTriangle" size={16} className="text-red-600" />
              <p className="text-red-800 text-sm">{submitError}</p>
              <Button 
                onClick={() => setSubmitError('')} 
                size="sm" 
                variant="ghost" 
                className="text-red-600 hover:bg-red-100"
              >
                <Icon name="X" size={14} />
              </Button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default DealsPage;