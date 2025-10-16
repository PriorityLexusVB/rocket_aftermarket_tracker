// src/pages/deals/index.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDeals, deleteDeal } from '../../services/dealService';
import ExportButton from '../../components/common/ExportButton';
import NewDealModal from './NewDealModal';
import EditDealModal from './components/EditDealModal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useDropdownData } from '../../hooks/useDropdownData';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

const StatusPill = ({ status }) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const color = statusColors?.[status] || 'bg-gray-100 text-gray-700';
  const displayStatus = status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN';
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
      {displayStatus}
    </span>
  );
};

// Helper to format names as "Lastname, F."
const formatStaffName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName?.trim()?.split(' ');
  if (parts?.length < 2) return fullName;
  
  const firstName = parts?.[0];
  const lastName = parts?.slice(1)?.join(' ');
  const firstInitial = firstName?.[0]?.toUpperCase();
  
  return `${lastName}, ${firstInitial}.`;
};

// Service Location Tag Component
const ServiceLocationTag = ({ jobParts }) => {
  if (!jobParts || jobParts?.length === 0) {
    return <span className="text-xs text-gray-500">No items</span>;
  }

  const hasOffSite = jobParts?.some(part => part?.is_off_site);
  const hasOnSite = jobParts?.some(part => !part?.is_off_site);

  if (hasOffSite && hasOnSite) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
          🏢 Off-Site
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          🏠 On-Site
        </span>
      </div>
    );
  }

  if (hasOffSite) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
        🏢 Off-Site
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
      🏠 On-Site
    </span>
  );
};

const SchedulingStatus = ({ jobParts }) => {
  if (!jobParts || jobParts?.length === 0) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  const schedulingItems = jobParts?.filter(part => part?.requires_scheduling);
  const noScheduleItems = jobParts?.filter(part => !part?.requires_scheduling);
  
  const upcomingPromises = schedulingItems?.filter(part => {
    if (!part?.promised_date) return false;
    const promiseDate = new Date(part?.promised_date);
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return promiseDate >= today;
  });

  const overduePromises = schedulingItems?.filter(part => {
    if (!part?.promised_date) return false;
    const promiseDate = new Date(part?.promised_date);
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return promiseDate < today;
  });

  if (overduePromises?.length > 0) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          {overduePromises?.length} overdue
        </span>
        {upcomingPromises?.length > 0 && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {upcomingPromises?.length} scheduled
          </span>
        )}
      </div>
    );
  }

  if (upcomingPromises?.length > 0) {
    const nextPromise = upcomingPromises?.sort((a, b) => 
      new Date(a?.promised_date) - new Date(b?.promised_date)
    )?.[0];
    const promiseDate = new Date(nextPromise?.promised_date);
    const formattedDate = promiseDate?.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
        Next: {formattedDate}
      </span>
    );
  }

  if (noScheduleItems?.length > 0) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
        No scheduling needed
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-500">—</span>
  );
};

// Mobile-friendly customer display with tap-to-call
const CustomerDisplay = ({ deal }) => {
  if (!deal?.customer_name && !deal?.customer_phone) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return (
    <div className="space-y-1">
      {deal?.customer_name && (
        <div className="font-medium text-sm text-gray-900">
          {deal?.customer_name}
        </div>
      )}
      {deal?.customer_phone && (
        <div className="md:hidden">
          <a 
            href={`tel:${deal?.customer_phone}`}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {deal?.customer_phone}
          </a>
        </div>
      )}
      {deal?.customer_phone && (
        <div className="hidden md:block text-xs text-gray-500">
          {deal?.customer_phone}
        </div>
      )}
    </div>
  );
};

// Value display with currency formatting
const ValueDisplay = ({ amount }) => {
  const value = parseFloat(amount) || 0;
  return (
    <div className="text-right">
      <span className="text-sm font-medium text-gray-900">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        })?.format(value)}
      </span>
    </div>
  );
};

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditDealModal, setShowEditDealModal] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Add missing state variables
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lineItemForm, setLineItemForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleId: null,
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    stockNumber: '',
    description: '',
    priority: 'medium',
    salespersonId: null,
    deliveryCoordinatorId: null,
    needsLoaner: false
  });
  
  // Enhanced filtering state
  const [filters, setFilters] = useState({
    status: 'all',
    assignedTo: null,
    priority: null,
    vendor: null,
    dateRange: null,
    search: ''
  });

  // Load dropdown data for filters
  const {
    getUserOptions,
    getVendorOptions,
    globalSearch,
    searchResults,
    clearSearch,
    loading: dropdownLoading
  } = useDropdownData({
    loadOnMount: true,
    cacheTime: 10 * 60 * 1000 // 10 minutes
  });
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // Calculate KPIs with proper safety checks
  const calculateKPIs = (dealsData) => {
    const safeDeals = dealsData || [];
    
    const activeJobs = safeDeals?.filter(d => 
      d?.job_status === 'in_progress'
    )?.length || 0;
    
    const totalRevenue = safeDeals?.reduce((sum, deal) => {
      const revenue = parseFloat(deal?.total_amount) || 0;
      return sum + revenue;
    }, 0);
    
    // Estimate 25% profit margin
    const totalProfit = totalRevenue * 0.25;
    const margin = totalRevenue > 0 ? 25.0 : 0;
    
    const pendingJobs = safeDeals?.filter(d => 
      d?.job_status === 'pending'
    )?.length || 0;

    const totalDrafts = safeDeals?.filter(d => 
      d?.job_status === 'draft'
    )?.length || 0;
    
    return {
      active: activeJobs,
      revenue: totalRevenue?.toFixed(2) || '0.00',
      profit: totalProfit?.toFixed(2) || '0.00', 
      margin: margin?.toFixed(1) || '0.0',
      pending: pendingJobs,
      drafts: totalDrafts
    };
  };

  const kpis = calculateKPIs(deals);

  // Enhanced filter deals with multiple criteria
  const filteredDeals = deals?.filter(deal => {
    // Status filter
    if (filters?.status !== 'all' && deal?.job_status !== filters?.status) {
      return false;
    }

    // Assigned to filter
    if (filters?.assignedTo && deal?.assigned_to !== filters?.assignedTo) {
      return false;
    }

    // Priority filter
    if (filters?.priority && deal?.priority !== filters?.priority) {
      return false;
    }

    // Vendor filter
    if (filters?.vendor && deal?.vendor_id !== filters?.vendor) {
      return false;
    }

    // Search filter
    if (filters?.search?.trim()) {
      const searchTerm = filters?.search?.toLowerCase();
      const searchableFields = [
        deal?.title,
        deal?.customer_name,
        deal?.customer_phone,
        deal?.customer_email,
        deal?.job_number,
        deal?.vehicle?.make,
        deal?.vehicle?.model,
        deal?.description
      ]?.filter(Boolean);

      const hasMatch = searchableFields?.some(field => 
        field?.toLowerCase()?.includes(searchTerm)
      );

      if (!hasMatch) return false;
    }

    return true;
  });

  // Update filter function
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      status: 'all',
      assignedTo: null,
      priority: null,
      vendor: null,
      dateRange: null,
      search: ''
    });
    clearSearch();
  };

  // Quick Draft save helper
  const handleQuickSaveDraft = async () => {
    try {
      setIsSubmittingDeal(true);
      setSubmitError('');

      const customerName = (lineItemForm?.customerName || '')?.trim();
      const customerPhone = (lineItemForm?.customerPhone || '')?.trim() || null;
      const customerEmail = (lineItemForm?.customerEmail || '')?.trim() || null;

      if (!customerName) {
        setSubmitError('Customer name is required to save a draft.');
        return;
      }

      // Vehicle: prefer selected vehicle; else create a simple placeholder
      let vehicleId = lineItemForm?.vehicleId || null;
      if (!vehicleId) {
        const veh = {
          year: parseInt(lineItemForm?.vehicleYear || 0) || null,
          make: lineItemForm?.vehicleMake || null,
          model: lineItemForm?.vehicleModel || null,
          stock_number: lineItemForm?.stockNumber || `DRAFT-${Date.now()}`,
          owner_name: customerName,
          owner_phone: customerPhone,
          owner_email: customerEmail,
          vehicle_status: 'active',
          created_by: user?.id
        };
        const { data: v, error: vErr } = await supabase?.from('vehicles')?.insert([veh])?.select()?.single();
        if (vErr) throw vErr;
        vehicleId = v?.id;
      }

      const nowIso = new Date()?.toISOString();

      // Create a Draft job (no items yet)
      const job = {
        vehicle_id: vehicleId,
        vendor_id: null,
        description: (lineItemForm?.description || 'Draft deal'),
        priority: (lineItemForm?.priority || 'medium')?.toLowerCase(),
        job_status: 'draft',
        title: `Draft – ${customerName}`,
        estimated_cost: 0,
        created_by: lineItemForm?.salespersonId || user?.id,
        delivery_coordinator_id: lineItemForm?.deliveryCoordinatorId || null,
        customer_needs_loaner: !!lineItemForm?.needsLoaner,
        created_at: nowIso,
        promised_date: null,
        service_type: 'in_house',
        scheduled_start_time: null,
        scheduled_end_time: null,
        calendar_event_id: null,
        location: null,
        color_code: null
      };

      const { data: jobRow, error: jobErr } = await supabase?.from('jobs')?.insert([job])?.select()?.single();
      if (jobErr) throw jobErr;

      // Ensure a transaction exists even for drafts (0 total)
      const tx = {
        job_id: jobRow?.id,
        vehicle_id: vehicleId,
        total_amount: 0,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        transaction_status: 'pending',
        created_at: nowIso
      };
      const { error: txErr } = await supabase?.from('transactions')?.upsert([tx], { onConflict: 'job_id' });
      if (txErr) throw txErr;

      setShowNewDealModal(false);
      setLineItemForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        vehicleId: null,
        vehicleYear: '',
        vehicleMake: '',
        vehicleModel: '',
        stockNumber: '',
        description: '',
        priority: 'medium',
        salespersonId: null,
        deliveryCoordinatorId: null,
        needsLoaner: false
      });
      await loadDeals();
    } catch (e) {
      setSubmitError(`Failed to save draft: ${e?.message}`);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  const handleEditDeal = (dealId) => {
    setEditingDealId(dealId);
    setShowEditDealModal(true);
  };

  const closeEditModal = () => {
    setShowEditDealModal(false);
    setEditingDealId(null);
  };

  const handleDeleteDeal = async (dealId) => {
    try {
      await deleteDeal(dealId);
      setDeleteConfirm(null);
      await loadDeals();
    } catch (e) {
      alert(`Failed to delete deal: ${e?.message}`);
    }
  };

  const loadDeals = async () => {
    try {
      setLoading(true);
      const data = await getAllDeals();
      setDeals(data || []);
    } catch (e) {
      setSubmitError(`Failed to load deals: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading deals...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Deal Tracker</h1>
          <div className="flex items-center space-x-3">
            <ExportButton
              exportType="jobs"
              filters={{ status: filters?.status }}
              onExportStart={() => console.log('Starting export...')}
              onExportComplete={(recordCount, filename) => console.log(`Export complete: ${recordCount} records`)}
              onExportError={(errorMessage) => alert(`Export failed: ${errorMessage}`)}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50"
            />
            <Button
              onClick={() => setShowNewDealModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-11"
            >
              <Icon name="Plus" size={16} className="mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Draft nudge banner */}
        {kpis?.drafts > 0 && (
          <div className="mb-6 p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-sm flex items-center justify-between">
            <span>⏳ You have {kpis?.drafts} draft deal{kpis?.drafts > 1 ? 's' : ''} to finish.</span>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => updateFilter('status', 'draft')} 
              className="text-amber-700 hover:text-amber-800"
            >
              View drafts
            </Button>
          </div>
        )}

        {/* KPI Row */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* Active Jobs */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-100 mr-4">
                  <Icon name="Clock" size={24} className="text-orange-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Active</h3>
                  <p className="text-gray-900 text-2xl font-bold">{kpis?.active}</p>
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100 mr-4">
                  <Icon name="DollarSign" size={24} className="text-green-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Revenue</h3>
                  <p className="text-gray-900 text-2xl font-bold">${kpis?.revenue}</p>
                </div>
              </div>
            </div>

            {/* Profit */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100 mr-4">
                  <Icon name="TrendingUp" size={24} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Profit</h3>
                  <p className="text-gray-900 text-2xl font-bold">${kpis?.profit}</p>
                </div>
              </div>
            </div>

            {/* Margin */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100 mr-4">
                  <Icon name="Percent" size={24} className="text-purple-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Margin</h3>
                  <p className="text-gray-900 text-2xl font-bold">{kpis?.margin}%</p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-yellow-100 mr-4">
                  <Icon name="Clock" size={24} className="text-yellow-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Pending</h3>
                  <p className="text-gray-900 text-2xl font-bold">{kpis?.pending}</p>
                </div>
              </div>
            </div>

            {/* Drafts */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-gray-100 mr-4">
                  <Icon name="File" size={24} className="text-gray-700" />
                </div>
                <div>
                  <h3 className="text-gray-600 text-sm font-medium uppercase tracking-wide">Drafts</h3>
                  <p className="text-gray-900 text-2xl font-bold">{kpis?.drafts}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="mb-6 bg-white rounded-lg border p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Icon 
                  name="Search" 
                  size={16} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                />
                <input
                  type="text"
                  placeholder="Search deals, customers, vehicles..."
                  value={filters?.search}
                  onChange={(e) => updateFilter('search', e?.target?.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="min-w-[150px]">
              <select
                value={filters?.status}
                onChange={(e) => updateFilter('status', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Assigned To Filter */}
            <div className="min-w-[200px]">
              <SearchableSelect
                options={getUserOptions({ roles: ['staff', 'admin', 'manager'], activeOnly: true })}
                value={filters?.assignedTo}
                onChange={(value) => updateFilter('assignedTo', value)}
                placeholder="Assigned to..."
                searchable={true}
                clearable={true}
                className=""
              />
            </div>

            {/* Priority Filter */}
            <div className="min-w-[120px]">
              <select
                value={filters?.priority || ''}
                onChange={(e) => updateFilter('priority', e?.target?.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>  
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Vendor Filter */}
            <div className="min-w-[180px]">
              <SearchableSelect
                options={getVendorOptions({ activeOnly: true })}
                value={filters?.vendor}
                onChange={(value) => updateFilter('vendor', value)}
                placeholder="Any vendor..."
                searchable={true}
                clearable={true}
                groupBy="specialty"
                className=""
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-gray-600 hover:text-gray-800"
              >
                <Icon name="X" size={16} className="mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Active filters display */}
          {(filters?.assignedTo || filters?.priority || filters?.vendor || filters?.search) && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              
              {filters?.search && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Search: "{filters?.search}"
                  <button
                    onClick={() => updateFilter('search', '')}
                    className="ml-1 hover:bg-blue-200 rounded p-0.5"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}

              {filters?.assignedTo && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  Assigned: {getUserOptions({ activeOnly: true })?.find(u => u?.id === filters?.assignedTo)?.name}
                  <button
                    onClick={() => updateFilter('assignedTo', null)}
                    className="ml-1 hover:bg-green-200 rounded p-0.5"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}

              {filters?.priority && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  Priority: {filters?.priority}
                  <button
                    onClick={() => updateFilter('priority', null)}
                    className="ml-1 hover:bg-orange-200 rounded p-0.5"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}

              {filters?.vendor && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Vendor: {getVendorOptions({ activeOnly: true })?.find(v => v?.id === filters?.vendor)?.name}
                  <button
                    onClick={() => updateFilter('vendor', null)}
                    className="ml-1 hover:bg-purple-200 rounded p-0.5"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredDeals?.length} of {deals?.length} deals
          {(filters?.assignedTo || filters?.priority || filters?.vendor || filters?.search) && (
            <span className="ml-2 text-blue-600">(filtered)</span>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job / Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduling
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeals?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {filterStatus === 'all' ? 'No deals found' : `No ${filterStatus} deals found`}
                  </td>
                </tr>
              ) : filteredDeals?.map(deal => (
                <tr key={deal?.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {deal?.job_number || `Job-${deal?.id?.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-gray-500">{deal?.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {deal?.vehicle ? 
                        `${deal?.vehicle?.year} ${deal?.vehicle?.make} ${deal?.vehicle?.model}` : 
                        '—'
                      }
                    </div>
                    {deal?.vehicle?.stock_number && (
                      <div className="text-xs text-gray-500">Stock: {deal?.vehicle?.stock_number}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <CustomerDisplay deal={deal} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={deal?.job_status} />
                  </td>
                  <td className="px-6 py-4">
                    <SchedulingStatus jobParts={deal?.job_parts} />
                  </td>
                  <td className="px-6 py-4">
                    <ServiceLocationTag jobParts={deal?.job_parts} />
                  </td>
                  <td className="px-6 py-4">
                    <ValueDisplay amount={deal?.total_amount} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditDeal(deal?.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(deal)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {filteredDeals?.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <div className="text-gray-500">
                {filterStatus === 'all' ? 'No deals found' : `No ${filterStatus} deals found`}
              </div>
            </div>
          ) : filteredDeals?.map(deal => (
            <div key={deal?.id} className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {deal?.job_number || `Job-${deal?.id?.slice(0, 8)}`}
                  </div>
                  <div className="text-sm text-gray-500">{deal?.title}</div>
                </div>
                <div className="flex space-x-2">
                  <StatusPill status={deal?.job_status} />
                </div>
              </div>

              <div className="space-y-3">
                {deal?.vehicle && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Vehicle</div>
                    <div className="text-sm text-gray-900">
                      {`${deal?.vehicle?.year} ${deal?.vehicle?.make} ${deal?.vehicle?.model}`}
                    </div>
                    {deal?.vehicle?.stock_number && (
                      <div className="text-xs text-gray-500">Stock: {deal?.vehicle?.stock_number}</div>
                    )}
                  </div>
                )}

                {(deal?.customer_name || deal?.customer_phone) && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Customer</div>
                    <CustomerDisplay deal={deal} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Service</div>
                    <ServiceLocationTag jobParts={deal?.job_parts} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Value</div>
                    <ValueDisplay amount={deal?.total_amount} />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Scheduling</div>
                  <SchedulingStatus jobParts={deal?.job_parts} />
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditDeal(deal?.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Icon name="Edit" size={16} className="mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirm(deal)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Icon name="Trash2" size={16} className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* New Deal Modal - Enhanced */}
        <NewDealModal 
          isOpen={showNewDealModal}
          onClose={() => setShowNewDealModal(false)}
          onSuccess={loadDeals}
        />

        {/* Edit Deal Modal */}
        <EditDealModal
          isOpen={showEditDealModal}
          dealId={editingDealId}
          onClose={closeEditModal}
          onSuccess={() => {
            loadDeals();
            closeEditModal();
          }}
        />

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Delete Deal</h3>
                <p className="text-gray-600 mb-6">
                  Delete deal and its line items? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteDeal(deleteConfirm?.id)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}