import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns';
import { CalendarDays, Search, Plus, Filter, ChevronLeft, ChevronRight, User, X, Menu } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toUTC, estLabel } from '../../lib/time';
import { buildICS } from '../../lib/ics';
import AppLayout from '../../components/layouts/AppLayout';
import CalendarGrid from './components/CalendarGrid';
import UnassignedQueue from './components/UnassignedQueue';
import AppointmentDrawer from './components/AppointmentDrawer';
import CreateModal from './components/CreateModal';

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // week, day, agenda
  const [showVendorLanes, setShowVendorLanes] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorCapacity, setVendorCapacity] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalData, setCreateModalData] = useState(null);
  
  // Mobile & responsive states
  const [showUnassignedQueue, setShowUnassignedQueue] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Filter states
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [activeFilters, setActiveFilters] = useState({
    today: false,
    inProgress: false,
    overdue: false,
    noShow: false,
    completed: false
  });

  // Header chip filters
  const statusFilters = [
    { key: 'today', label: 'Today', color: 'bg-blue-100 text-blue-800' },
    { key: 'inProgress', label: 'In-Progress', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
    { key: 'noShow', label: 'No-Show', color: 'bg-orange-100 text-orange-800' },
    { key: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' }
  ];

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // On desktop, show unassigned queue by default
      if (window.innerWidth >= 1024) {
        setShowUnassignedQueue(true);
      } else {
        // On mobile/tablet, hide by default to maximize calendar space
        setShowUnassignedQueue(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get date range for current view
  const getDateRange = () => {
    if (view === 'day') {
      return { start: currentDate, end: currentDate };
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const end = addDays(start, 5); // Monday-Saturday (6 days)
    return { start, end };
  };

  // Load appointments with real-time subscription
  const loadAppointments = async () => {
    try {
      const { start, end } = getDateRange();
      
      // Convert to UTC for database query
      const startUTC = toUTC(start);
      const endUTC = toUTC(end);

      const { data, error } = await supabase?.rpc('get_jobs_by_date_range', {
        start_date: startUTC,
        end_date: endUTC
      });

      if (error) throw error;
      
      // Apply filters
      let filteredData = data || [];
      
      // Apply status filters
      if (selectedStatuses?.length > 0) {
        filteredData = filteredData?.filter(job => selectedStatuses?.includes(job?.job_status));
      }
      
      // Apply vendor filters
      if (selectedVendors?.length > 0) {
        filteredData = filteredData?.filter(job => 
          job?.vendor_id && selectedVendors?.includes(job?.vendor_id)
        );
      }
      
      // Apply header chip filters
      if (activeFilters?.today) {
        filteredData = filteredData?.filter(job => 
          isSameDay(parseISO(job?.scheduled_start_time), new Date())
        );
      }
      if (activeFilters?.inProgress) {
        filteredData = filteredData?.filter(job => job?.job_status === 'in_progress');
      }
      if (activeFilters?.overdue) {
        const now = new Date();
        filteredData = filteredData?.filter(job => 
          parseISO(job?.scheduled_end_time || job?.scheduled_start_time) < now && 
          !['completed', 'cancelled']?.includes(job?.job_status)
        );
      }
      if (activeFilters?.completed) {
        filteredData = filteredData?.filter(job => job?.job_status === 'completed');
      }
      
      setAppointments(filteredData);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    loadVendors();
    loadUnassignedJobs();
    
    // Set up real-time subscription
    const { start, end } = getDateRange();
    const channel = supabase?.channel('calendar-jobs')?.on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'jobs',
          filter: `scheduled_start_time.gte.${start?.toISOString()}.and.scheduled_start_time.lte.${end?.toISOString()}`
        }, 
        () => {
          loadAppointments();
        }
      )?.subscribe();

    // Polling every 10-15 seconds
    const pollInterval = setInterval(loadAppointments, 12000);
    
    // Poll on window focus
    const handleFocus = () => loadAppointments();
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase?.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentDate, view]);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase?.from('vendors')?.select(`
        *,
        vendor_hours (*)
      `)?.eq('is_active', true)?.order('name');

      if (error) throw error;
      setVendors(data || []);
      
      // Calculate vendor capacity
      const capacity = {};
      (data || [])?.forEach(vendor => {
        const hours = vendor?.vendor_hours || [];
        capacity[vendor.id] = {
          total: hours?.reduce((sum, h) => sum + (h?.capacity_per_slot || 1), 0),
          used: 0 // Will be calculated from appointments
        };
      });
      setVendorCapacity(capacity);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadUnassignedJobs = async () => {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles (stock_number, year, make, model, color, vin)
        `)?.is('vendor_id', null)?.in('job_status', ['pending', 'scheduled'])?.order('created_at', { ascending: false })?.limit(20);

      if (error) throw error;
      setUnassignedJobs(data || []);
    } catch (error) {
      console.error('Error loading unassigned jobs:', error);
    }
  };

  // Stock-first search with exact/partial fallback
  const handleStockSearch = async (searchTerm) => {
    if (!searchTerm?.trim()) return;

    try {
      // First try exact match on stock number
      let { data: exactMatch } = await supabase?.from('vehicles')
        ?.select('*')
        ?.ilike('stock_number', searchTerm)
        ?.limit(1);

      if (exactMatch && exactMatch?.length > 0) {
        // Found exact match - could open appointment creation or show vehicle details
        console.log('Exact stock match:', exactMatch?.[0]);
        return exactMatch?.[0];
      }

      // Fallback to partial search (stock-first priority)
      const { data: partialMatches } = await supabase?.from('vehicles')
        ?.select('*')
        ?.or(`stock_number.ilike.%${searchTerm}%,vin.ilike.%${searchTerm}%,owner_name.ilike.%${searchTerm}%`)
        ?.order('stock_number')
        ?.limit(20);

      return partialMatches || [];
    } catch (error) {
      console.error('Stock search error:', error);
      return [];
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, job) => {
    setDragging(job);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, targetSlot) => {
    e?.preventDefault();
    if (!dragging) return;

    const { vendorId, startTime, endTime } = targetSlot;
    
    try {
      // Guardrail checks
      const guardrailsPassed = await runGuardrails(dragging?.id, {
        vendor_id: vendorId,
        scheduled_start_time: startTime,
        scheduled_end_time: endTime,
        vehicle_id: dragging?.vehicle_id
      });

      if (guardrailsPassed?.success) {
        // Update job
        const { error } = await supabase?.from('jobs')
          ?.update({
            vendor_id: vendorId,
            scheduled_start_time: startTime,
            scheduled_end_time: endTime,
            job_status: vendorId ? 'scheduled' : 'pending'
          })
          ?.eq('id', dragging?.id);

        if (error) throw error;
        
        // Enqueue SMS notification
        await enqueueSMSNotification(dragging?.id, 'CHANGE');
        
        // Reload data
        loadAppointments();
        loadUnassignedJobs();
      } else {
        // Show error message
        alert(guardrailsPassed?.error);
      }
    } catch (error) {
      console.error('Drop error:', error);
      alert('Failed to update appointment');
    } finally {
      setDragging(null);
    }
  };

  // Enhanced guardrails validation with all three checks
  const runGuardrails = async (jobId, jobData) => {
    try {
      // 1. Vendor capacity check
      if (jobData?.vendor_id) {
        const concurrent = appointments?.filter(apt => 
          apt?.vendor_id === jobData?.vendor_id &&
          apt?.id !== jobId &&
          // Check for time overlap
          parseISO(apt?.scheduled_start_time) < parseISO(jobData?.scheduled_end_time) &&
          parseISO(apt?.scheduled_end_time || apt?.scheduled_start_time) > parseISO(jobData?.scheduled_start_time)
        )?.length;

        const vendorCapacityLimit = vendorCapacity?.[jobData?.vendor_id]?.total || 1;
        if (concurrent >= vendorCapacityLimit) {
          return { success: false, error: 'Vendor capacity exceeded for this time slot' };
        }

        // 2. Vendor hours check (EST timezone)
        const startDate = parseISO(jobData?.scheduled_start_time);
        const { data: isAvailable } = await supabase?.rpc('get_vendor_availability', {
          vendor_uuid: jobData?.vendor_id,
          check_date: format(startDate, 'yyyy-MM-dd'),
          start_time: format(startDate, 'HH:mm:ss'),
          duration_minutes: 60
        });

        if (!isAvailable) {
          // For managers, show warning but allow override
          const user = await supabase?.auth?.getUser();
          const { data: profile } = await supabase?.from('user_profiles')?.select('role')?.eq('id', user?.data?.user?.id)?.single();
          
          if (profile?.role === 'manager') {
            const override = window.confirm('This is outside vendor hours. Manager override - continue anyway?');
            if (!override) {
              return { success: false, error: 'Outside vendor hours' };
            }
          } else {
            return { success: false, error: 'Outside vendor hours. Manager override required.' };
          }
        }
      }

      // 3. Vehicle overlap check using NEW function
      if (jobData?.vehicle_id) {
        const { data: hasOverlap } = await supabase?.rpc('check_vehicle_overlap', {
          vehicle_id: jobData?.vehicle_id,
          start_time: jobData?.scheduled_start_time,
          end_time: jobData?.scheduled_end_time,
          exclude_id: jobId
        });

        if (hasOverlap) {
          return { success: false, error: 'Vehicle has conflicting appointment' };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Guardrails check failed:', error);
      return { success: false, error: 'Validation failed' };
    }
  };

  // Enhanced SMS notification with stock-first templates
  const enqueueSMSNotification = async (jobId, type) => {
    try {
      const job = appointments?.find(a => a?.id === jobId) || dragging;
      if (!job) return;

      // Get vehicle and vendor info
      const { data: vehicle } = await supabase?.from('vehicles')
        ?.select('stock_number, year, make, model, owner_phone')
        ?.eq('id', job?.vehicle_id)
        ?.single();

      const { data: vendor } = await supabase?.from('vendors')
        ?.select('name, phone')
        ?.eq('id', job?.vendor_id)
        ?.single();

      if (!vehicle?.stock_number) return;

      // Build SMS templates (stock-first, <160 chars)
      const stockNumber = vehicle?.stock_number;
      const service = job?.title;
      const ymm = `${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`;
      const whenLabel = estLabel(job?.scheduled_start_time, 'MMM d @ h:mm a');

      let template = '';
      let recipientPhone = '';

      if (type === 'NEW') {
        // Vendor notification
        template = `${stockNumber}: ${service} ${ymm} ${whenLabel} ET. Reply YES/NO.`;
        recipientPhone = vendor?.phone;
      } else if (type === 'CHANGE') {
        // Vendor change notification  
        template = `${stockNumber}: Time updated to ${whenLabel} ET.`;
        recipientPhone = vendor?.phone;
      } else if (type === 'BOOKED') {
        // Customer notification
        template = `${stockNumber} set for ${service} ${whenLabel} ET at Priority Lexus VB. Reply C/R.`;
        recipientPhone = vehicle?.owner_phone;
      }

      if (template && recipientPhone) {
        await supabase?.rpc('enqueue_sms_notification', {
          recipient_phone: recipientPhone,
          template_message: template,
          template_vars: {
            stock_number: stockNumber,
            service: service,
            ymmt: ymm,
            vendor_phone: vendor?.phone || '555-SHOP',
            customer_phone: vehicle?.owner_phone || '555-0000',
            when_label: whenLabel,
            cta: type === 'NEW' ? 'Reply YES/NO' : type === 'BOOKED' ? 'Reply C/R' : ''
          }
        });
      }
    } catch (error) {
      console.error('SMS enqueue failed:', error);
    }
  };

  // Create new appointment with stock-first field
  const handleCreateClick = (timeSlot = null) => {
    setCreateModalData(timeSlot);
    setShowCreateModal(true);
  };

  // Handle filter changes
  const handleFilterChipClick = (filterKey) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: !prev?.[filterKey]
    }));
  };

  // Export ICS file
  const exportICS = (appointment) => {
    const icsContent = buildICS({
      uid: appointment?.id,
      title: `${appointment?.vehicle_info} - ${appointment?.title}`,
      startUtcISO: appointment?.scheduled_start_time,
      endUtcISO: appointment?.scheduled_end_time,
      description: `${appointment?.description}\nVendor: ${appointment?.vendor_name}\nLocation: ${appointment?.location}`,
      location: appointment?.location || 'Priority Lexus VB'
    });
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment-${appointment?.job_number}.ics`;
    link?.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e?.target?.tagName === 'INPUT') return;
      
      switch (e?.key?.toLowerCase()) {
        case 's':
          e?.preventDefault();
          document.getElementById('stock-search')?.focus();
          break;
        case 'escape':
          setShowDrawer(false);
          setShowCreateModal(false);
          setShowMobileFilters(false);
          break;
        case 'q':
          if (!isMobile) {
            e?.preventDefault();
            setShowUnassignedQueue(!showUnassignedQueue);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showUnassignedQueue, isMobile]);

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 text-gray-800 border-gray-300',
      'scheduled': 'bg-blue-100 text-blue-800 border-blue-300', 
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'quality_check': 'bg-purple-100 text-purple-800 border-purple-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors?.[status] || colors?.pending;
  };

  if (loading && appointments?.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-screen flex bg-gray-50 overflow-hidden">
        {/* Main Calendar Area - Now Uses Full Space */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile-Optimized Header */}
          <div className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
            {/* Mobile Layout */}
            {isMobile ? (
              <div className="space-y-3">
                {/* Top Row: Title + Queue Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    <div>
                      <h1 className="text-lg font-semibold text-gray-900">Calendar Hub</h1>
                      <p className="text-xs text-gray-500">Schedule Management</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Queue Toggle Button */}
                    <button
                      onClick={() => setShowUnassignedQueue(!showUnassignedQueue)}
                      className={`p-2 rounded-md text-sm font-medium transition-all ${
                        showUnassignedQueue
                          ? 'bg-blue-600 text-white' :'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    
                    {/* Mobile Filter Toggle */}
                    <button
                      onClick={() => setShowMobileFilters(!showMobileFilters)}
                      className="p-2 text-gray-600 hover:text-gray-900 bg-gray-100 rounded-md"
                    >
                      {showMobileFilters ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                    </button>
                    
                    {/* Create Button */}
                    <button 
                      onClick={() => handleCreateClick()}
                      className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    id="stock-search"
                    type="text"
                    placeholder="Search Stock #..."
                    value={searchQuery}
                    onChange={async (e) => {
                      setSearchQuery(e?.target?.value);
                      if (e?.target?.value?.length > 2) {
                        const results = await handleStockSearch(e?.target?.value);
                        console.log('Search results:', results);
                      }
                    }}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Mobile Navigation & View Controls */}
                <div className="flex items-center justify-between">
                  {/* Date Navigation */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? -7 : -1))}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? 7 : 1))}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* View Selector */}
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {['week', 'day', 'agenda']?.map((viewType) => (
                      <button
                        key={viewType}
                        onClick={() => setView(viewType)}
                        className={`px-2 py-1.5 rounded text-xs font-medium capitalize transition-all duration-200 ${
                          view === viewType 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-600'
                        }`}
                      >
                        {viewType}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Filters (Expandable) */}
                {showMobileFilters && (
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <div className="grid grid-cols-2 gap-2">
                      {statusFilters?.map(filter => (
                        <button
                          key={filter?.key}
                          onClick={() => handleFilterChipClick(filter?.key)}
                          className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                            activeFilters?.[filter?.key]
                              ? `${filter?.color} ring-1 ring-blue-500`
                              : 'bg-white text-gray-600 border border-gray-200'
                          }`}
                        >
                          {filter?.label}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                      <span>{appointments?.length} appointments</span>
                      <span>{unassignedJobs?.length} unassigned</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Desktop Layout (keep existing)
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-3">
                      <CalendarDays className="w-6 h-6 text-blue-600" />
                      <div>
                        <h1 className="text-xl font-semibold text-gray-900">Calendar Hub</h1>
                        <p className="text-sm text-gray-500">Schedule & Timeline Management</p>
                      </div>
                    </div>
                    
                    {/* Enhanced Search with Hotkey */}
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        id="stock-search"
                        type="text"
                        placeholder="Search Stock # (Press S) - Exact first, then partial..."
                        value={searchQuery}
                        onChange={async (e) => {
                          setSearchQuery(e?.target?.value);
                          if (e?.target?.value?.length > 2) {
                            const results = await handleStockSearch(e?.target?.value);
                            console.log('Search results:', results);
                          }
                        }}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-96 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                      />
                      <kbd className="absolute right-3 top-3 text-xs text-gray-400">S</kbd>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Navigation */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? -7 : -1))}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? 7 : 1))}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* View Selector */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {['week', 'day', 'agenda']?.map((viewType) => (
                        <button
                          key={viewType}
                          onClick={() => setView(viewType)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
                            view === viewType 
                              ? 'bg-white text-blue-600 shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {viewType}
                        </button>
                      ))}
                    </div>

                    {/* Resource Toggle */}
                    <button
                      onClick={() => setShowVendorLanes(!showVendorLanes)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        showVendorLanes
                          ? 'bg-blue-100 text-blue-700 border border-blue-300' :'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <User className="w-4 h-4 mr-1 inline" />
                      Resource by Vendor
                    </button>

                    {/* Queue Toggle for Desktop */}
                    <button
                      onClick={() => setShowUnassignedQueue(!showUnassignedQueue)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        showUnassignedQueue
                          ? 'bg-blue-100 text-blue-700 border border-blue-300' :'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Menu className="w-4 h-4 mr-1 inline" />
                      Queue {!showUnassignedQueue ? '(Q)' : ''}
                    </button>

                    {/* Create Button */}
                    <button 
                      onClick={() => handleCreateClick()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2 text-sm shadow-sm transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="font-medium">New</span>
                    </button>
                  </div>
                </div>

                {/* Filter Chips Row - Desktop Only */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">Quick Filters:</span>
                    {statusFilters?.map(filter => (
                      <button
                        key={filter?.key}
                        onClick={() => handleFilterChipClick(filter?.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          activeFilters?.[filter?.key]
                            ? `${filter?.color} ring-2 ring-blue-500 ring-offset-1`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {filter?.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <span>{appointments?.length} appointments</span>
                    <span>•</span>
                    <span>{unassignedJobs?.length} unassigned</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Calendar Content - Full Space Usage */}
          <div className="flex-1 overflow-hidden">
            <CalendarGrid
              view={view}
              showVendorLanes={showVendorLanes}
              currentDate={currentDate}
              appointments={appointments}
              vendors={vendors}
              vendorCapacity={vendorCapacity}
              onAppointmentClick={(apt) => {
                setSelectedAppointment(apt);
                setShowDrawer(true);
              }}
              onCreateClick={handleCreateClick}
              onDrop={handleDrop}
              onDragOver={(e) => e?.preventDefault()}
              dragging={dragging}
              getStatusColor={getStatusColor}
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Responsive Unassigned Queue */}
        {showUnassignedQueue && (
          <>
            {/* Mobile: Overlay */}
            {isMobile ? (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 z-40"
                  onClick={() => setShowUnassignedQueue(false)}
                />
                {/* Sliding Panel */}
                <div className="fixed right-0 top-0 h-full w-80 bg-white z-50 transform transition-transform duration-300 ease-in-out shadow-xl">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Unassigned Queue</h3>
                    <button
                      onClick={() => setShowUnassignedQueue(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="h-full pb-16 overflow-hidden">
                    <UnassignedQueue
                      jobs={unassignedJobs}
                      onDragStart={handleDragStart}
                      getStatusColor={getStatusColor}
                      isMobile={true}
                      onAssignJob={() => {}}
                      onScheduleJob={() => {}}
                    />
                  </div>
                </div>
              </>
            ) : (
              // Desktop: Sidebar
              <div className="w-80 flex-shrink-0">
                <UnassignedQueue
                  jobs={unassignedJobs}
                  onDragStart={handleDragStart}
                  getStatusColor={getStatusColor}
                  isMobile={false}
                  onAssignJob={() => {}}
                  onScheduleJob={() => {}}
                />
              </div>
            )}
          </>
        )}

        {/* Appointment Drawer */}
        {showDrawer && selectedAppointment && (
          <AppointmentDrawer
            appointment={selectedAppointment}
            onClose={() => setShowDrawer(false)}
            onExportICS={exportICS}
            getStatusColor={getStatusColor}
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <CreateModal
            initialData={createModalData}
            onClose={() => {
              setShowCreateModal(false);
              setCreateModalData(null);
            }}
            onSuccess={() => {
              setShowCreateModal(false);
              setCreateModalData(null);
              loadAppointments();
              loadUnassignedJobs();
            }}
            vendors={vendors}
            onStockSearch={handleStockSearch}
            onSMSEnqueue={enqueueSMSNotification}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CalendarPage;