import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const CalendarSchedulingCenter = () => {
  // State management
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('week'); // 'day', 'week', 'month'
  const [jobs, setJobs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  // Date range calculation based on view type
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    switch (viewType) {
      case 'day':
        start?.setHours(0, 0, 0, 0);
        end?.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = start?.getDay();
        start?.setDate(start?.getDate() - dayOfWeek);
        start?.setHours(0, 0, 0, 0);
        end?.setDate(start?.getDate() + 6);
        end?.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start?.setDate(1);
        start?.setHours(0, 0, 0, 0);
        end?.setMonth(end?.getMonth() + 1);
        end?.setDate(0);
        end?.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }, [currentDate, viewType]);

  // Simplified data loading with better error handling
  const loadCalendarData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading calendar data...', {
        start: dateRange?.start?.toISOString(),
        end: dateRange?.end?.toISOString()
      });
      
      // Try RPC function first
      let jobsResult;
      try {
        const { data, error } = await supabase?.rpc('get_jobs_by_date_range', {
          start_date: dateRange?.start?.toISOString(),
          end_date: dateRange?.end?.toISOString(),
          vendor_filter: selectedVendors?.length > 0 ? selectedVendors?.[0] : null,
          status_filter: null
        });
        
        if (error) throw error;
        jobsResult = data || [];
        setDebugInfo(`RPC function returned ${jobsResult?.length} jobs`);
        
      } catch (rpcError) {
        console.warn('RPC failed, using direct query:', rpcError);
        
        // Fallback to direct database query with proper joins
        const { data, error } = await supabase?.from('jobs')?.select(`
            id,
            title,
            description,
            scheduled_start_time,
            scheduled_end_time,
            job_status,
            vendor_id,
            vehicle_id,
            color_code,
            priority,
            estimated_hours,
            job_number,
            location,
            calendar_notes,
            vendors:vendor_id(id, name, specialty),
            vehicles:vehicle_id(id, make, model, year, owner_name, stock_number)
          `)?.not('scheduled_start_time', 'is', null)?.gte('scheduled_start_time', dateRange?.start?.toISOString())?.lte('scheduled_start_time', dateRange?.end?.toISOString())?.order('scheduled_start_time', { ascending: true });
          
        if (error) throw error;
        
        // Transform the data to match expected structure
        jobsResult = (data || [])?.map(job => ({
          ...job,
          vendor_name: job?.vendors?.name || 'Unassigned',
          vehicle_info: job?.vehicles 
            ? `${job?.vehicles?.year} ${job?.vehicles?.make} ${job?.vehicles?.model}`?.trim()
            : 'No Vehicle'
        }));
        
        setDebugInfo(`Direct query returned ${jobsResult?.length} jobs`);
      }

      setJobs(jobsResult);
      console.log('Jobs loaded successfully:', jobsResult);

    } catch (error) {
      console.error('Error loading calendar data:', error);
      setError(`Failed to load calendar data: ${error?.message}`);
      setDebugInfo(`Error: ${error?.message}`);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase?.from('vendors')?.select('id, name, is_active, specialty')?.eq('is_active', true)?.order('name');

      if (error) throw error;
      setVendors(data || []);
      console.log('Vendors loaded:', data?.length || 0);
      
    } catch (error) {
      console.error('Error loading vendors:', error);
      setVendors([]);
    }
  };

  // Load data on component mount and date range changes
  useEffect(() => {
    loadCalendarData();
    loadVendors();
  }, [dateRange, selectedVendors]);

  // Navigation handlers
  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    
    switch (viewType) {
      case 'day':
        newDate?.setDate(newDate?.getDate() + direction);
        break;
      case 'week':
        newDate?.setDate(newDate?.getDate() + (direction * 7));
        break;
      case 'month':
        newDate?.setMonth(newDate?.getMonth() + direction);
        break;
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const refreshData = () => {
    setError(null);
    loadCalendarData();
    loadVendors();
  };

  // Format date for display
  const formatDisplayDate = () => {
    if (viewType === 'week') {
      const weekStart = new Date(dateRange.start);
      const weekEnd = new Date(dateRange.end);
      return `${weekStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    const options = { 
      year: 'numeric', 
      month: 'long',
      ...(viewType === 'day' && { day: 'numeric' })
    };
    
    return currentDate?.toLocaleDateString('en-US', options);
  };

  // Simple calendar grid component
  const CalendarGrid = ({ jobs, viewType }) => {
    if (viewType === 'week') {
      // Create week view
      const weekDays = [];
      const startDate = new Date(dateRange.start);
      
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate);
        dayDate?.setDate(startDate?.getDate() + i);
        
        const dayJobs = jobs?.filter(job => {
          const jobDate = new Date(job.scheduled_start_time);
          return jobDate?.toDateString() === dayDate?.toDateString();
        });
        
        weekDays?.push({
          date: dayDate,
          jobs: dayJobs
        });
      }
      
      return (
        <div className="grid grid-cols-7 gap-1 h-full">
          {/* Day headers */}
          {weekDays?.map((day) => (
            <div key={day?.date?.toISOString()} className="bg-gray-50 p-2 border-b font-semibold text-center">
              <div className="text-sm text-gray-600">
                {day?.date?.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-lg">
                {day?.date?.getDate()}
              </div>
            </div>
          ))}
          {/* Day content */}
          {weekDays?.map((day) => (
            <div key={`content-${day?.date?.toISOString()}`} className="bg-white p-2 border-r border-gray-200 min-h-96 overflow-y-auto">
              {day?.jobs?.map((job) => (
                <div
                  key={job?.id}
                  className="mb-2 p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow"
                  style={{ backgroundColor: job?.color_code || '#3b82f6', color: 'white' }}
                  onClick={() => alert(`Job: ${job?.title}\nVendor: ${job?.vendor_name}\nTime: ${new Date(job.scheduled_start_time)?.toLocaleTimeString()}`)}
                >
                  <div className="font-medium truncate">{job?.title}</div>
                  <div className="text-xs opacity-90">{job?.vendor_name}</div>
                  <div className="text-xs opacity-80">
                    {new Date(job.scheduled_start_time)?.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    
    // Simple list view for day/month
    return (
      <div className="p-4">
        {jobs?.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No jobs scheduled for this period
          </div>
        ) : (
          <div className="space-y-4">
            {jobs?.map((job) => (
              <div
                key={job?.id}
                className="bg-white p-4 rounded-lg shadow border cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => alert(`Job Details:\n${job?.title}\nVendor: ${job?.vendor_name}\nVehicle: ${job?.vehicle_info}\nTime: ${new Date(job.scheduled_start_time)?.toLocaleString()}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{job?.title}</h3>
                    <p className="text-sm text-gray-600">
                      {job?.vendor_name} • {job?.vehicle_info}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(job.scheduled_start_time)?.toLocaleString()}
                    </p>
                  </div>
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: job?.color_code || '#3b82f6' }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Calendar Loading Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          
          <div className="bg-gray-100 p-3 rounded-lg text-left text-xs mb-4">
            <p><strong>Debug Info:</strong></p>
            <p>{debugInfo}</p>
            <p>Jobs Count: {jobs?.length}</p>
            <p>Vendors Count: {vendors?.length}</p>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={refreshData}
              className="flex items-center space-x-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Loading</span>
            </button>
            <button
              onClick={() => {
                setCurrentDate(new Date());
                setError(null);
                refreshData();
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Reset to Today
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading calendar data...</p>
          <p className="text-xs text-gray-500 mt-2">{debugInfo}</p>
        </div>
      </div>
    );
  }

  // Main calendar view
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Calendar Scheduling Center</h1>
            </div>
            
            {/* Date Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-lg font-medium min-w-64 text-center">
                {formatDisplayDate()}
              </span>
              <button
                onClick={() => navigateDate(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Type Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['day', 'week', 'month']?.map((view) => (
                <button
                  key={view}
                  onClick={() => setViewType(view)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewType === view
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {view?.charAt(0)?.toUpperCase() + view?.slice(1)}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={refreshData}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Stats and Info */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <span>Jobs: {jobs?.length}</span>
            <span>Vendors: {vendors?.length}</span>
            <span>Period: {formatDisplayDate()}</span>
          </div>
          
          {debugInfo && (
            <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
              {debugInfo}
            </div>
          )}
        </div>
      </div>
      {/* Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-4">Vendors</h3>
          
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedVendors?.length === 0}
                onChange={() => setSelectedVendors([])}
                className="rounded border-gray-300"
              />
              <span className="ml-2 text-sm">All Vendors ({vendors?.length})</span>
            </label>
            
            {vendors?.map((vendor) => (
              <label key={vendor?.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedVendors?.includes(vendor?.id)}
                  onChange={(e) => {
                    if (e?.target?.checked) {
                      setSelectedVendors([vendor?.id]);
                    } else {
                      setSelectedVendors([]);
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm">
                  {vendor?.name}
                  {vendor?.specialty && (
                    <span className="text-gray-500 text-xs"> ({vendor?.specialty})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium text-gray-900 mb-2">Quick Stats</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Total Jobs: {jobs?.length}</div>
              <div>This Week: {jobs?.filter(job => {
                const jobDate = new Date(job.scheduled_start_time);
                const now = new Date();
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                const endOfWeek = new Date(startOfWeek);
                endOfWeek?.setDate(startOfWeek?.getDate() + 6);
                return jobDate >= startOfWeek && jobDate <= endOfWeek;
              })?.length}</div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden">
          <CalendarGrid jobs={jobs} viewType={viewType} />
        </div>
      </div>
    </div>
  );
};

export default CalendarSchedulingCenter;