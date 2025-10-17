// src/pages/deals/index.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDeals, markLoanerReturned } from '../../services/dealService';
import ExportButton from '../../components/common/ExportButton';
import NewDealModal from './NewDealModal';
import EditDealModal from './components/EditDealModal';

import { useDropdownData } from '../../hooks/useDropdownData';
import Navbar from '../../components/ui/Navbar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

// ✅ UPDATED: StatusPill with enhanced styling  
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

// ✅ ADDED: Helper to format names as "Lastname, F."
const formatStaffName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName?.trim()?.split(' ');
  if (parts?.length < 2) return fullName;
  
  const firstName = parts?.[0];
  const lastName = parts?.slice(1)?.join(' ');
  const firstInitial = firstName?.[0]?.toUpperCase();
  
  return `${lastName}, ${firstInitial}.`;
};

// ✅ UPDATED: Enhanced "Next" promised chip with exact functionality per requirements
const NextPromisedChip = ({ nextPromisedShort }) => {
  if (!nextPromisedShort) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  // Parse the date to determine urgency
  const promiseDate = new Date(nextPromisedShort);
  const today = new Date();
  today?.setHours(0, 0, 0, 0);
  promiseDate?.setHours(0, 0, 0, 0);
  
  const todayPlus2 = new Date(today);
  todayPlus2?.setDate(today?.getDate() + 2);

  let urgencyClass = '';
  
  // Compute urgency per requirements
  if (promiseDate < today) {
    // overdue: date < today
    urgencyClass = 'bg-red-100 text-red-800 border-red-200';
  } else if (promiseDate <= todayPlus2) {
    // soon: today ≤ date ≤ today+2
    urgencyClass = 'bg-amber-100 text-amber-800 border-amber-200';
  } else {
    // ok: otherwise
    urgencyClass = 'bg-green-100 text-green-800 border-green-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${urgencyClass}`}>
      Next: {nextPromisedShort}
    </span>
  );
};

// ✅ UPDATED: Service Location Tag with exact colors per checklist (#22c55e in-house / #f97316 vendor)
const ServiceLocationTag = ({ serviceType, jobParts }) => {
  // Check if any line items are off-site to determine vendor status
  const hasOffSiteItems = jobParts?.some(part => part?.is_off_site);
  const hasOnSiteItems = jobParts?.some(part => !part?.is_off_site);

  if (hasOffSiteItems && hasOnSiteItems) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#f97316' }}>
          🏢 Off-Site
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#22c55e' }}>
          🏠 In-House
        </span>
      </div>
    );
  }

  if (hasOffSiteItems) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#f97316' }}>
        🏢 Off-Site
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#22c55e' }}>
      🏠 In-House
    </span>
  );
};

// ✅ UPDATED: Enhanced draft reminder with improved styling
const DraftReminderBanner = ({ draftsCount, onViewDrafts }) => {
  const [dismissed, setDismissed] = useState(false);
  
  if (draftsCount === 0 || dismissed) return null;

  return (
    <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: '#FEF3C7', borderColor: '#F3E8A3', color: '#92400E' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Icon name="AlertCircle" size={20} style={{ color: '#D97706' }} />
          </div>
          <div>
            <p className="font-medium">Draft – needs details</p>
            <p className="text-sm">
              You have {draftsCount} draft deal{draftsCount > 1 ? 's' : ''} to complete.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onViewDrafts} 
            style={{ color: '#92400E' }}
            className="hover:bg-yellow-100"
            aria-label="View draft deals"
          >
            View drafts
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1"
            style={{ color: '#F59E0B' }}
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ UPDATED: Mobile-friendly customer display with enhanced tap-to-call and SMS
const CustomerDisplay = ({ deal }) => {
  if (!deal?.customer_name && !deal?.customer_phone) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return (
    <div className="space-y-1">
      {deal?.customer_name && (
        <div className="font-medium text-sm text-slate-900">
          {deal?.customer_name}
        </div>
      )}
      {deal?.customer_phone && (
        <a 
          href={`tel:${deal?.customer_phone}`}
          className="text-xs text-slate-500 hover:text-blue-600 underline"
          onClick={(e) => e?.stopPropagation()}
        >
          {deal?.customer_phone}
        </a>
      )}
    </div>
  );
};

// ✅ UPDATED: Value display with currency formatting
const ValueDisplay = ({ amount }) => {
  const value = parseFloat(amount) || 0;
  return (
    <div className="text-right">
      <span className="text-sm font-medium text-slate-900">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        })?.format(value)}
      </span>
    </div>
  );
};

// ✅ ADDED: Enhanced Loaner Badge component for tracker rows
const LoanerBadge = ({ deal }) => {
  if (!deal?.loaner_number) {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
      🚗 Loaner #{deal?.loaner_number}
      {deal?.loaner_eta_short && (
        <span className="ml-1">• due {deal?.loaner_eta_short}</span>
      )}
    </span>
  );
};

// ✅ FIXED: Loaner Drawer Component with enhanced mobile functionality
const LoanerDrawer = ({ isOpen, onClose, deal, onSave, loading }) => {
  const [loanerForm, setLoanerForm] = useState({
    loaner_number: '',
    eta_return_date: '',
    notes: ''
  });
  const [error, setError] = useState('');

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (isOpen && deal) {
      // Pre-populate if loaner exists
      setLoanerForm({
        loaner_number: deal?.loaner_number || '',
        eta_return_date: deal?.loaner_eta_return_date || '',
        notes: deal?.loaner_notes || ''
      });
      setError('');
    } else if (!isOpen) {
      setLoanerForm({ loaner_number: '', eta_return_date: '', notes: '' });
      setError('');
    }
  }, [isOpen, deal]);

  const handleSave = async () => {
    setError('');
    
    if (!loanerForm?.loaner_number?.trim()) {
      setError('Loaner number is required');
      return;
    }
    
    if (!loanerForm?.eta_return_date) {
      setError('ETA return date is required');
      return;
    }

    try {
      await onSave({
        job_id: deal?.id,
        loaner_number: loanerForm?.loaner_number?.trim(),
        eta_return_date: loanerForm?.eta_return_date,
        notes: loanerForm?.notes?.trim() || null
      });
      onClose(); // Close drawer on successful save
    } catch (err) {
      setError(err?.message || 'Failed to save loaner assignment');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      
      {/* Drawer - Mobile-first light theme only */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Loaner Assignment
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <Icon name="X" size={20} />
            </Button>
          </div>

          {/* Deal Info */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-sm text-slate-900 mb-2">Deal Information</h4>
            <p className="text-sm text-slate-600">{deal?.title}</p>
            <p className="text-xs text-slate-500">{deal?.customer_name}</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button 
                onClick={() => setError('')}
                className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form with light theme inputs */}
          <div className="space-y-4">
            {/* Loaner Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Loaner Number *
              </label>
              <input
                type="text"
                value={loanerForm?.loaner_number}
                onChange={(e) => setLoanerForm(prev => ({ ...prev, loaner_number: e?.target?.value }))}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 123"
                required
              />
            </div>

            {/* ETA Return Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expected Return Date *
              </label>
              <input
                type="date"
                value={loanerForm?.eta_return_date}
                onChange={(e) => setLoanerForm(prev => ({ ...prev, eta_return_date: e?.target?.value }))}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date()?.toISOString()?.split('T')?.[0]}
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={loanerForm?.notes}
                onChange={(e) => setLoanerForm(prev => ({ ...prev, notes: e?.target?.value }))}
                className="bg-white border border-slate-200 rounded-lg w-full px-3 py-2 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Optional notes about the loaner vehicle..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading || !loanerForm?.loaner_number?.trim() || !loanerForm?.eta_return_date}
            >
              {loading ? 'Saving...' : 'Save Loaner'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

// ✅ ADDED: Mark Returned Modal Component
const MarkReturnedModal = ({ loaner, onClose, onConfirm, loading }) => {
  if (!loaner) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Mark Loaner Returned</h3>
          <p className="text-slate-600 mb-6">
            Mark loaner <strong>#{loaner?.loaner_number}</strong> as returned?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={loading}
              aria-label="Cancel marking loaner as returned"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
              disabled={loading}
              aria-label="Confirm loaner returned"
            >
              {loading ? 'Processing...' : 'Mark Returned'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditDealModal, setShowEditDealModal] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // ✅ FIXED: Added missing error state management
  const [error, setError] = useState('');
  
  // ✅ UPDATED: Status tabs & quick search with enhanced filtering
  const [filters, setFilters] = useState({
    status: 'All',
    salesAssigned: null,
    deliveryAssigned: null,
    financeAssigned: null,
    vendor: null,
    search: ''
  });

  // ✅ ADDED: Loaner management state
  const [showLoanerDrawer, setShowLoanerDrawer] = useState(false);
  const [selectedDealForLoaner, setSelectedDealForLoaner] = useState(null);
  const [loanerLoading, setLoanerLoading] = useState(false);
  const [markReturnedModal, setMarkReturnedModal] = useState(null);
  const [returningLoaner, setReturningLoaner] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  // ✅ FIXED: Properly use the dropdown hook instead of direct function calls
  const {
    getUserOptions,
    getVendorOptions,
    clearSearch,
    loading: dropdownLoading,
    error: dropdownError,
    refresh: refreshDropdowns
  } = useDropdownData({ loadOnMount: true });
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ FIXED: Replace direct function calls with hook-based calls
  const getSalesConsultants = () => {
    try {
      return getUserOptions({ 
        roles: ['staff'], 
        departments: ['Sales Consultants'], 
        activeOnly: true 
      }) || [];
    } catch (err) {
      console.error('Error getting sales consultants:', err);
      return [];
    }
  };

  const getDeliveryCoordinators = () => {
    try {
      return getUserOptions({ 
        roles: ['admin', 'manager'], 
        departments: ['Delivery Coordinator'], 
        activeOnly: true 
      }) || [];
    } catch (err) {
      console.error('Error getting delivery coordinators:', err);
      return [];
    }
  };

  const getFinanceManagers = () => {
    try {
      return getUserOptions({ 
        roles: ['staff'], 
        departments: ['Finance Manager'], 
        activeOnly: true 
      }) || [];
    } catch (err) {
      console.error('Error getting finance managers:', err);
      return [];
    }
  };

  const getSafeVendorOptions = (filterOptions = {}) => {
    try {
      return getVendorOptions(filterOptions) || [];
    } catch (err) {
      console.error('Error getting vendor options:', err);
      return [];
    }
  };

  // ✅ FIXED: Enhanced delete function with proper error handling
  const handleDeleteDeal = async (dealId) => {
    try {
      setError(''); // Clear previous errors
      const { error: deleteError } = await supabase?.rpc('delete_job_cascade', { p_job_id: dealId });
      if (deleteError) throw deleteError;
      
      setDeleteConfirm(null);
      await loadDeals();
    } catch (e) {
      setError(`Failed to delete deal: ${e?.message}`);
      console.error('Delete error:', e);
    }
  };

  // ✅ FIXED: Enhanced loaner assignment with better error handling and modal state management  
  const handleSaveLoaner = async (loanerData) => {
    try {
      setLoanerLoading(true);
      setError(''); // Clear previous errors
      
      // Insert or update loaner assignment per existing schema
      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.upsert({
          job_id: loanerData?.job_id,
          loaner_number: loanerData?.loaner_number,
          eta_return_date: loanerData?.eta_return_date,
          notes: loanerData?.notes
        }, {
          onConflict: 'job_id'
        });
      
      if (error) throw error;
      
      // ✅ FIXED: Properly close drawer and reset state
      setShowLoanerDrawer(false);
      setSelectedDealForLoaner(null);
      await loadDeals(); // Refresh data
    } catch (e) {
      const errorMessage = `Failed to save loaner assignment: ${e?.message}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoanerLoading(false);
    }
  };

  // ✅ FIXED: Enhanced mark returned with better error handling
  const handleMarkLoanerReturned = async (loanerData) => {
    try {
      setReturningLoaner(true);
      setError(''); // Clear previous errors
      await markLoanerReturned(loanerData?.loaner_id);
      setMarkReturnedModal(null);
      await loadDeals(); // Refresh data
    } catch (e) {
      setError(`Failed to mark loaner as returned: ${e?.message}`);
      console.error('Mark returned error:', e);
    } finally {
      setReturningLoaner(false);
    }
  };

  // ✅ FIXED: Enhanced load deals with better error handling and retry logic
  const loadDeals = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      const data = await getAllDeals();
      setDeals(data || []);
    } catch (e) {
      const errorMessage = `Failed to load deals: ${e?.message}`;
      console.error('Load deals error:', e);
      
      // Retry logic for network issues
      if (retryCount < 2 && (e?.message?.includes('fetch') || e?.message?.includes('network'))) {
        console.log(`Retrying load deals (attempt ${retryCount + 1})`);
        setTimeout(() => loadDeals(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      setError(errorMessage);
      setDeals([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADDED: Initialize status from URL parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams?.get('status');
    if (statusParam) {
      const statusValue = statusParam?.charAt(0)?.toUpperCase() + statusParam?.slice(1);
      setFilters(prev => ({ ...prev, status: statusValue }));
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, []);

  // ✅ FIXED: Properly use the dropdown hook instead of direct function calls
  const loadDropdownData = async () => {
    await refreshDropdowns();
  };

  // ✅ FIXED: Move handleManageLoaner function to proper location inside component
  const handleManageLoaner = (deal) => {
    setSelectedDealForLoaner(deal);
    setShowLoanerDrawer(true);
  };

  // ✅ FIXED: Enhanced error display component
  const ErrorAlert = ({ message, onClose }) => {
    if (!message) return null;
    
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex justify-between items-start">
          <div className="flex">
            <Icon name="AlertCircle" size={20} className="text-red-500 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Error</h4>
              <p className="text-sm text-red-700 mt-1">{message}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-600"
              aria-label="Dismiss error"
            >
              <Icon name="X" size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ✅ UPDATED: Calculate KPIs with proper safety checks
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

  // ✅ UPDATED: Enhanced filter deals with 300ms debounced search
  const filteredDeals = deals?.filter(deal => {
    // Status filter with tab-based logic
    if (filters?.status !== 'All') {
      const targetStatus = filters?.status?.toLowerCase()?.replace(' ', '_');
      if (deal?.job_status !== targetStatus) {
        return false;
      }
    }

    // Sales assigned filter
    if (filters?.salesAssigned && deal?.assigned_to !== filters?.salesAssigned) {
      return false;
    }

    // Delivery assigned filter
    if (filters?.deliveryAssigned && deal?.delivery_coordinator_id !== filters?.deliveryAssigned) {
      return false;
    }

    // Finance assigned filter
    if (filters?.financeAssigned && deal?.finance_manager_id !== filters?.financeAssigned) {
      return false;
    }

    // Vendor filter
    if (filters?.vendor && deal?.vendor_id !== filters?.vendor) {
      return false;
    }

    // ✅ UPDATED: Search filter with debounced search (matches stock, name, phone with stripped non-digits)
    if (searchDebounce?.trim()) {
      const searchTerm = searchDebounce?.toLowerCase();
      
      // Strip non-digits for phone matching
      const stripNonDigits = (str) => str?.replace(/\D/g, '') || '';
      const searchDigits = stripNonDigits(searchTerm);
      
      const searchableFields = [
        deal?.title,
        deal?.customer_name,
        deal?.customer_phone,
        deal?.customer_email,
        deal?.job_number,
        deal?.vehicle?.make,
        deal?.vehicle?.model,
        deal?.vehicle?.stock_number || deal?.stock_no,
        deal?.description
      ]?.filter(Boolean);

      const hasMatch = searchableFields?.some(field => {
        const fieldStr = field?.toLowerCase();
        // Standard text match
        if (fieldStr?.includes(searchTerm)) return true;
        // Phone number digit match
        if (searchDigits?.length >= 3 && stripNonDigits(fieldStr)?.includes(searchDigits)) return true;
        return false;
      });

      if (!hasMatch) return false;
    }

    return true;
  });

  // ✅ ADDED: 300ms debounced search implementation
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(filters?.search);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters?.search]);

  // ✅ UPDATED: Update filter function with URL parameter support
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Update URL for status filter
    if (key === 'status') {
      const searchParams = new URLSearchParams(window.location.search);
      if (value === 'All') {
        searchParams?.delete('status');
      } else {
        searchParams?.set('status', value?.toLowerCase());
      }
      const newUrl = `${window.location?.pathname}${searchParams?.toString() ? '?' + searchParams?.toString() : ''}`;
      window.history?.replaceState({}, '', newUrl);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      status: 'All',
      salesAssigned: null,
      deliveryAssigned: null,
      financeAssigned: null,
      vendor: null,
      search: ''
    });
    clearSearch();
    
    // Clear URL params
    window.history?.replaceState({}, '', window.location?.pathname);
  };

  const handleEditDeal = (dealId) => {
    setEditingDealId(dealId);
    setShowEditDealModal(true);
  };

  const closeEditModal = () => {
    setShowEditDealModal(false);
    setEditingDealId(null);
  };

  // ✅ FIXED: Enhanced loading state with proper dropdown loading reference
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <div className="p-4 md:p-8" style={{ paddingTop: '5rem' }}>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-slate-600">Loading deals...</div>
              {dropdownLoading && (
                <div className="text-sm text-slate-500 mt-2">Loading dropdown data...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ✅ FIXED: Ensure navbar is always visible */}
      <Navbar />
      <div className="p-4 md:p-8 max-w-7xl mx-auto" style={{ paddingTop: '5rem' }}>
        
        {/* ✅ FIXED: Error display */}
        <ErrorAlert message={error || dropdownError} onClose={() => { setError(''); }} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Deal Tracker</h1>
          <div className="flex items-center space-x-3">
            <ExportButton
              exportType="jobs"
              filters={{ status: filters?.status }}
              onExportStart={() => console.log('Starting export...')}
              onExportComplete={(recordCount, filename) => console.log(`Export complete: ${recordCount} records`)}
              onExportError={(errorMessage) => setError(`Export failed: ${errorMessage}`)}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50"
            />
            <Button
              onClick={() => setShowNewDealModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-11"
              aria-label="Create new deal"
            >
              <Icon name="Plus" size={16} className="mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* ✅ UPDATED: Draft reminder banner */}
        <DraftReminderBanner 
          draftsCount={kpis?.drafts}
          onViewDrafts={() => updateFilter('status', 'Draft')}
        />

        {/* ✅ UPDATED: KPI Row - Enhanced with profit analysis */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* Active Jobs */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-100 mr-4">
                  <Icon name="Clock" size={24} className="text-orange-700" />
                </div>
                <div>
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Active</h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.active}</p>
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
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Revenue</h3>
                  <p className="text-slate-900 text-2xl font-bold">${kpis?.revenue}</p>
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
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Profit</h3>
                  <p className="text-slate-900 text-2xl font-bold">${kpis?.profit}</p>
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
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Margin</h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.margin}%</p>
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
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Pending</h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.pending}</p>
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
                  <h3 className="text-slate-600 text-sm font-medium uppercase tracking-wide">Drafts</h3>
                  <p className="text-slate-900 text-2xl font-bold">{kpis?.drafts}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ FIXED: Status tabs & enhanced dropdown filters */}
        <div className="mb-6 bg-white rounded-lg border p-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'Draft', 'Pending', 'Active', 'Completed']?.map(status => (
              <button
                key={status}
                onClick={() => updateFilter('status', status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${filters?.status === status 
                    ? 'bg-blue-600 text-white' :'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* ✅ UPDATED: Search box with 300ms debounce, matches stock, name, phone (strip non-digits) */}
            <div className="flex-1">
              <div className="relative">
                <Icon 
                  name="Search" 
                  size={16} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" 
                />
                <input
                  type="text"
                  placeholder="Search deals, customers, vehicles..."
                  value={filters?.search}
                  onChange={(e) => updateFilter('search', e?.target?.value)}
                  className="bg-white border border-slate-200 rounded-lg w-full h-11 pl-9 pr-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* ✅ FIXED: Separate dropdown filters with proper binding */}
            <div className="min-w-[200px]">
              <select
                value={filters?.salesAssigned || ''}
                onChange={(e) => updateFilter('salesAssigned', e?.target?.value || null)}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={dropdownLoading}
                id="sales-filter"
              >
                <option value="">Sales Consultants</option>
                {getSalesConsultants()?.map(user => (
                  <option key={user?.id} value={user?.id}>
                    {formatStaffName(user?.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px]">
              <select
                value={filters?.deliveryAssigned || ''}
                onChange={(e) => updateFilter('deliveryAssigned', e?.target?.value || null)}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={dropdownLoading}
                id="delivery-filter"
              >
                <option value="">Delivery Coordinator</option>
                {getDeliveryCoordinators()?.map(user => (
                  <option key={user?.id} value={user?.id}>
                    {formatStaffName(user?.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px]">
              <select
                value={filters?.financeAssigned || ''}
                onChange={(e) => updateFilter('financeAssigned', e?.target?.value || null)}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={dropdownLoading}
                id="finance-filter"
              >
                <option value="">Finance Manager</option>
                {getFinanceManagers()?.map(user => (
                  <option key={user?.id} value={user?.id}>
                    {formatStaffName(user?.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px]">
              <select
                value={filters?.vendor || ''}
                onChange={(e) => updateFilter('vendor', e?.target?.value || null)}
                className="bg-white border border-slate-200 rounded-lg w-full h-11 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={dropdownLoading}
                id="vendor-filter"
              >
                <option value="">Vendors</option>
                {getSafeVendorOptions({ activeOnly: true })?.map(vendor => (
                  <option key={vendor?.id} value={vendor?.id}>
                    {vendor?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh button for dropdowns */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshDropdowns}
                className="text-slate-600 hover:text-slate-800"
                disabled={dropdownLoading}
                aria-label="Refresh dropdown data"
              >
                <Icon name="RefreshCw" size={16} className="mr-1" />
                {dropdownLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-600 hover:text-slate-800"
                aria-label="Clear all filters"
              >
                <Icon name="X" size={16} className="mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-600">
          Showing {filteredDeals?.length} of {deals?.length} deals
          {(filters?.salesAssigned || filters?.deliveryAssigned || filters?.financeAssigned || filters?.vendor || filters?.search) && (
            <span className="ml-2 text-blue-600">(filtered)</span>
          )}
        </div>

        {/* ✅ UPDATED: Desktop Table with exact columns per requirements */}
        <div className="hidden md:block bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Next
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredDeals?.map(deal => (
                <tr key={deal?.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <CustomerDisplay deal={deal} />
                  </td>
                  <td className="px-6 py-4">
                    <ValueDisplay amount={deal?.total_amount} />
                  </td>
                  <td className="px-6 py-4">
                    <NextPromisedChip nextPromisedShort={deal?.next_promised_short} />
                  </td>
                  <td className="px-6 py-4">
                    <ServiceLocationTag serviceType={deal?.service_type} jobParts={deal?.job_parts} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditDeal(deal?.id)}
                        className="text-blue-600 hover:text-blue-800"
                        aria-label="Edit deal"
                      >
                        Edit
                      </Button>
                      
                      {/* ✅ FIXED: Loaner management for desktop with proper condition */}
                      {deal?.customer_needs_loaner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleManageLoaner(deal)}
                          className="text-purple-600 hover:text-purple-800"
                          aria-label="Manage loaner"
                        >
                          Loaner
                        </Button>
                      )}
                      
                      {/* Mark returned button for active loaners */}
                      {deal?.loaner_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMarkReturnedModal({
                            loaner_id: deal?.loaner_id,
                            loaner_number: deal?.loaner_number,
                            job_title: deal?.title
                          })}
                          className="text-green-600 hover:text-green-800"
                          aria-label="Mark loaner returned"
                        >
                          Return
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(deal)}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Delete deal"
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

        {/* ✅ UPDATED: Mobile Cards with enhanced styling and loaner support */}
        <div className="md:hidden space-y-4">
          {filteredDeals?.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <div className="text-slate-500">
                {filters?.status === 'All' ? 'No deals found' : `No ${filters?.status?.toLowerCase()} deals found`}
              </div>
            </div>
          ) : filteredDeals?.map(deal => (
            <div key={deal?.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-4 border-b bg-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-slate-900">
                      {deal?.job_number || `Job-${deal?.id?.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-slate-600">{deal?.title}</div>
                  </div>
                  <StatusPill status={deal?.job_status} />
                </div>
              </div>

              {/* Card Content with enhanced mobile layout */}
              <div className="p-4 space-y-4">
                {/* Customer Display */}
                {(deal?.customer_name || deal?.customer_phone) && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Customer
                    </div>
                    <CustomerDisplay deal={deal} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Value
                    </div>
                    <ValueDisplay amount={deal?.total_amount} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Next
                    </div>
                    <NextPromisedChip nextPromisedShort={deal?.next_promised_short} />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Service
                  </div>
                  <ServiceLocationTag serviceType={deal?.service_type} jobParts={deal?.job_parts} />
                </div>

                {/* ✅ ADDED: Loaner badge display for mobile */}
                {deal?.loaner_number && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Loaner Assignment
                    </div>
                    <LoanerBadge deal={deal} />
                  </div>
                )}
              </div>

              {/* ✅ FIXED: Enhanced mobile footer with proper loaner actions */}
              <div className="p-4 border-t bg-slate-50">
                {/* Primary actions row */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditDeal(deal?.id)}
                    className="h-11 w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    aria-label="Edit deal"
                  >
                    <Icon name="Edit" size={16} className="mr-2" />
                    Edit
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteConfirm(deal)}
                    className="h-11 w-full bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    aria-label="Delete deal"
                  >
                    <Icon name="Trash2" size={16} className="mr-2" />
                    Delete
                  </Button>
                </div>

                {/* ✅ FIXED: Loaner actions row with proper conditions */}
                {(deal?.customer_needs_loaner || deal?.loaner_id) && (
                  <div className="grid grid-cols-2 gap-2">
                    {deal?.customer_needs_loaner && !deal?.loaner_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManageLoaner(deal)}
                        className="h-11 w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        aria-label="Manage loaner"
                      >
                        <Icon name="Car" size={16} className="mr-2" />
                        Assign Loaner
                      </Button>
                    )}
                    
                    {deal?.loaner_id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageLoaner(deal)}
                          className="h-11 w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          aria-label="Edit loaner"
                        >
                          <Icon name="Edit" size={16} className="mr-2" />
                          Edit Loaner
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setMarkReturnedModal({
                            loaner_id: deal?.loaner_id,
                            loaner_number: deal?.loaner_number,
                            job_title: deal?.title
                          })}
                          className="h-11 w-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          aria-label="Mark loaner returned"
                        >
                          <Icon name="CheckCircle" size={16} className="mr-2" />
                          Mark Returned
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ✅ UPDATED: New Deal Modal */}
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

        {/* ✅ UPDATED: Delete Confirmation Modal with light theme */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Delete Deal</h3>
                <p className="text-slate-600 mb-6">
                  Delete deal and its line items? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 h-11"
                    aria-label="Cancel deletion"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteDeal(deleteConfirm?.id)}
                    className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                    aria-label="Confirm deletion"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ADDED: Loaner Drawer with improved error handling */}
        <LoanerDrawer
          isOpen={showLoanerDrawer}
          onClose={() => {
            setShowLoanerDrawer(false);
            setSelectedDealForLoaner(null);
            setError(''); // Clear any drawer-related errors
          }}
          deal={selectedDealForLoaner}
          onSave={handleSaveLoaner}
          loading={loanerLoading}
        />

        {/* Mark Loaner Returned Modal */}
        <MarkReturnedModal
          loaner={markReturnedModal}
          onClose={() => {
            setMarkReturnedModal(null);
            setError(''); // Clear any modal-related errors
          }}
          onConfirm={() => handleMarkLoanerReturned(markReturnedModal)}
          loading={returningLoaner}
        />
      </div>
    </div>
  );
}