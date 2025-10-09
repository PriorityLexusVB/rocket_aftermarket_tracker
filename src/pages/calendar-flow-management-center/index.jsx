import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Car, Building2, AlertTriangle, Search, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '../../components/layouts/AppLayout';
import { calendarService } from '../../services/calendarService';
import { vendorService } from '../../services/vendorService';
import QuickFilters from './components/QuickFilters';

import UnassignedQueue from './components/UnassignedQueue';
import JobDrawer from './components/JobDrawer';
import RoundUpModal from './components/RoundUpModal';
import { formatTime, isOverdue, getStatusBadge } from '../../lib/time';

const CalendarFlowManagementCenter = () => {
  // State management
  const [loading, setLoading] = useState(true);
  
  // Separate original data from filtered data
  const [originalJobs, setOriginalJobs] = useState([]);
  const [originalUnassignedJobs, setOriginalUnassignedJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [filteredUnassignedJobs, setFilteredUnassignedJobs] = useState([]);
  
  const [vendors, setVendors] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showRoundUp, setShowRoundUp] = useState(false);
  const [roundUpType, setRoundUpType] = useState('daily');
  
  // View settings - Updated default and possible values
  const [viewMode, setViewMode] = useState('week'); // week, day, month
  const [vendorLanesEnabled, setVendorLanesEnabled] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [filters, setFilters] = useState({
    vendors: [],
    statuses: [],
    showUnassigned: true,
    searchQuery: ''
  });

  // Drag and drop
  const [draggedJob, setDraggedJob] = useState(null);
  const [dropZoneActive, setDropZoneActive] = useState(null);

  // Load initial data
  useEffect(() => {
    loadCalendarData();
    loadVendors();
  }, [currentDate, viewMode]);

  // Apply filters whenever filters or original data change
  useEffect(() => {
    applyFilters();
  }, [filters, originalJobs, originalUnassignedJobs]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const startDate = getViewStartDate();
      const endDate = getViewEndDate();
      
      // Load all jobs without status filtering to allow client-side filtering
      const { data: jobsData, error } = await calendarService?.getJobsByDateRange(
        startDate, 
        endDate, 
        {
          vendorId: filters?.vendors?.length > 0 ? filters?.vendors?.[0] : null
          // Removed status filter to load all jobs for client-side filtering
        }
      );

      if (!error && jobsData) {
        const assignedJobs = jobsData?.filter(job => job?.vendor_id);
        const unassigned = jobsData?.filter(job => !job?.vendor_id);
        
        // Store original data separately
        setOriginalJobs(assignedJobs);
        setOriginalUnassignedJobs(unassigned);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // New centralized filter application function
  const applyFilters = () => {
    // Apply filters to assigned jobs
    const filteredAssigned = applyFiltersToJobList(originalJobs);
    setFilteredJobs(filteredAssigned);
    
    // Apply filters to unassigned jobs
    const filteredUnassigned = applyFiltersToJobList(originalUnassignedJobs);
    setFilteredUnassignedJobs(filteredUnassigned);
  };

  // Enhanced filter application function
  const applyFiltersToJobList = (jobList) => {
    if (!jobList || jobList?.length === 0) return [];
    
    let filteredJobs = [...jobList];
    
    // Apply search filter
    if (filters?.searchQuery) {
      const query = filters?.searchQuery?.toLowerCase();
      filteredJobs = filteredJobs?.filter(job => 
        job?.job_number?.toLowerCase()?.includes(query) ||
        job?.title?.toLowerCase()?.includes(query) ||
        job?.vehicle_info?.toLowerCase()?.includes(query) ||
        job?.customer_name?.toLowerCase()?.includes(query) ||
        job?.customer_phone?.toLowerCase()?.includes(query)
      );
    }
    
    // Apply status filters (multiple statuses)
    if (filters?.statuses?.length > 0) {
      filteredJobs = filteredJobs?.filter(job => {
        // Map filter IDs to actual job status values
        const statusMapping = {
          'today': () => {
            const jobDate = new Date(job?.scheduled_start_time);
            const today = new Date();
            return jobDate?.toDateString() === today?.toDateString();
          },
          'in_progress': () => job?.job_status === 'in_progress',
          'overdue': () => isOverdue(job?.promised_date),
          'no_show': () => job?.job_status === 'no_show',
          'completed': () => job?.job_status === 'completed'
        };
        
        // Check if job matches any of the selected statuses
        return filters?.statuses?.some(statusId => statusMapping?.[statusId]?.());
      });
    }
    
    // Apply vendor filters
    if (filters?.vendors?.length > 0) {
      filteredJobs = filteredJobs?.filter(job => 
        filters?.vendors?.includes(job?.vendor_id)
      );
    }
    
    return filteredJobs;
  };

  const loadVendors = async () => {
    try {
      const { data: vendorsData } = await vendorService?.getVendors({ is_active: true });
      if (vendorsData) {
        setVendors(vendorsData);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const getViewStartDate = () => {
    const date = new Date(currentDate);
    switch (viewMode) {
      case 'day':
        date?.setHours(0, 0, 0, 0);
        return date;
      case 'week':
        const dayOfWeek = date?.getDay();
        date?.setDate(date?.getDate() - dayOfWeek + 1); // Monday start
        date?.setHours(0, 0, 0, 0);
        return date;
      case 'month':
        date?.setDate(1); // First day of the month
        date?.setHours(0, 0, 0, 0);
        return date;
      default:
        date?.setHours(0, 0, 0, 0);
        return date;
    }
  };

  const getViewEndDate = () => {
    const date = getViewStartDate();
    switch (viewMode) {
      case 'day':
        date?.setDate(date?.getDate() + 1);
        return date;
      case 'week':
        date?.setDate(date?.getDate() + 6); // Monday to Saturday
        return date;
      case 'month':
        date?.setMonth(date?.getMonth() + 1); // Next month
        date?.setDate(0); // Last day of current month
        return date;
      default:
        date?.setDate(date?.getDate() + 1);
        return date;
    }
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setShowDrawer(true);
  };

  const handleJobStatusUpdate = async (jobId, newStatus) => {
    try {
      // Update job status via calendar service
      await calendarService?.updateJobSchedule(jobId, { status: newStatus });
      loadCalendarData(); // Refresh data
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  };

  const handleDragStart = (job) => {
    setDraggedJob(job);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDropZoneActive(null);
  };

  const handleDrop = async (vendorId, timeSlot) => {
    if (!draggedJob) return;
    
    try {
      const startTime = new Date(timeSlot);
      const endTime = new Date(startTime);
      endTime?.setHours(startTime?.getHours() + (draggedJob?.estimated_hours || 2));

      await calendarService?.updateJobSchedule(draggedJob?.id, {
        vendorId,
        startTime,
        endTime,
        location: vendorId ? 'off_site' : 'on_site'
      });

      loadCalendarData();
    } catch (error) {
      console.error('Error updating job assignment:', error);
    }
  };

  // New month view render function
  const renderMonthView = () => {
    const monthStart = getViewStartDate();
    const monthEnd = getViewEndDate();
    const startDate = new Date(monthStart);
    const endDate = new Date(monthEnd);
    
    // Get first day of the week that contains the first day of the month
    startDate?.setDate(startDate?.getDate() - startDate?.getDay() + 1); // Monday start
    // Get last day of the week that contains the last day of the month
    endDate?.setDate(endDate?.getDate() + (6 - endDate?.getDay()) + 1);
    
    const weeks = [];
    const currentWeekStart = new Date(startDate);
    
    while (currentWeekStart <= endDate) {
      const week = [];
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(currentWeekStart);
        currentDate?.setDate(currentWeekStart?.getDate() + day);
        
        const dayJobs = filteredJobs?.filter(job => {
          const jobDate = new Date(job?.scheduled_start_time);
          return jobDate?.toDateString() === currentDate?.toDateString();
        });
        
        week?.push({
          date: new Date(currentDate),
          jobs: dayJobs,
          isCurrentMonth: currentDate?.getMonth() === monthStart?.getMonth(),
          isToday: currentDate?.toDateString() === new Date()?.toDateString()
        });
      }
      weeks?.push(week);
      currentWeekStart?.setDate(currentWeekStart?.getDate() + 7);
    }

    return (
      <div className="h-full flex flex-col">
        {/* Month header with days of week */}
        <div className="grid grid-cols-7 gap-2 mb-4 border-b border-gray-200 pb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']?.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="flex-1 space-y-2">
          {weeks?.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2 h-32">
              {week?.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`
                    border border-gray-200 rounded-lg p-2 overflow-hidden
                    ${day?.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    ${day?.isToday ? 'ring-2 ring-indigo-500' : ''}
                  `}
                >
                  {/* Day number */}
                  <div className={`
                    text-sm font-medium mb-2
                    ${day?.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                    ${day?.isToday ? 'text-indigo-600' : ''}
                  `}>
                    {day?.date?.getDate()}
                  </div>

                  {/* Jobs for this day */}
                  <div className="space-y-1">
                    {day?.jobs?.slice(0, 2)?.map(job => (
                      <div
                        key={job?.id}
                        className={`
                          text-xs p-1 rounded cursor-pointer truncate
                          ${!job?.vendor_id || job?.location === 'on_site' ?'bg-green-100 text-green-800 border border-green-200' :'bg-orange-100 text-orange-800 border border-orange-200'}
                        `}
                        onClick={() => handleJobClick(job)}
                        title={`${job?.job_number} - ${job?.title}`}
                      >
                        {job?.job_number?.split('-')?.pop()}
                      </div>
                    ))}
                    {day?.jobs?.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{day?.jobs?.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Updated renderEventChip to work with filtered data
  const renderEventChip = (job) => {
    const isOnSite = !job?.vendor_id || job?.location === 'on_site';
    const chipColor = isOnSite ? 'bg-green-500' : 'bg-orange-500';
    const statusColor = getStatusBadge(job?.job_status)?.color || 'bg-blue-500';
    const overdue = isOverdue(job?.promised_date);

    return (
      <div
        key={job?.id}
        className={`
          relative rounded-lg p-3 mb-2 cursor-pointer transition-all duration-200 hover:shadow-lg
          ${chipColor} text-white text-sm
        `}
        onClick={() => handleJobClick(job)}
        draggable
        onDragStart={() => handleDragStart(job)}
        onDragEnd={handleDragEnd}
      >
        {/* Status stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} rounded-l-lg`} />
        
        {/* Main content */}
        <div className="ml-2">
          {/* Top line */}
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold truncate flex items-center">
              <Car className="h-3 w-3 mr-1" />
              <span className="truncate">{job?.job_number?.split('-')?.pop()} • {job?.title}</span>
            </div>
            {overdue && (
              <div className="flex items-center text-red-200">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs ml-1">Overdue</span>
              </div>
            )}
          </div>
          
          {/* Second line */}
          <div className="text-xs opacity-90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(job?.scheduled_start_time)}–{formatTime(job?.scheduled_end_time)}
              </div>
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Promise: {new Date(job?.promised_date)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
            
            {/* Status badge */}
            <div className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(job?.job_status)?.bg || 'bg-gray-500'} text-white`}>
              {getStatusBadge(job?.job_status)?.label || job?.job_status}
            </div>
          </div>
          
          {/* Vendor line for off-site */}
          {!isOnSite && (
            <div className="text-xs opacity-90 mt-1 flex items-center">
              <Building2 className="h-3 w-3 mr-1" />
              {job?.vendor_name}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = Array.from({ length: 10 }, (_, i) => 8 + i); // 8AM to 6PM

    return (
      <div className="grid grid-cols-7 gap-2 h-full">
        {/* Time header */}
        <div className="col-span-1 space-y-12">
          <div className="h-12"></div> {/* Header spacer */}
          {timeSlots?.map(hour => (
            <div key={hour} className="text-xs text-gray-500 text-right pr-2">
              {hour}:00
            </div>
          ))}
        </div>
        {/* Week days */}
        {weekDays?.map((day, dayIndex) => {
          const dayDate = new Date(getViewStartDate());
          dayDate?.setDate(dayDate?.getDate() + dayIndex);
          const dayJobs = filteredJobs?.filter(job => {
            const jobDate = new Date(job?.scheduled_start_time);
            return jobDate?.toDateString() === dayDate?.toDateString();
          });

          return (
            <div key={day} className="border-l border-gray-200 pl-2">
              {/* Day header */}
              <div className="h-12 border-b border-gray-200 pb-2">
                <div className="font-medium text-sm">{day}</div>
                <div className="text-xs text-gray-500">
                  {dayDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              {/* Time slots */}
              <div className="space-y-12">
                {timeSlots?.map(hour => (
                  <div
                    key={`${day}-${hour}`}
                    className="h-12 border-b border-gray-100 relative"
                    onDragOver={(e) => e?.preventDefault()}
                    onDrop={() => handleDrop(null, new Date(dayDate?.setHours(hour)))}
                  >
                    {/* Jobs for this time slot */}
                    {dayJobs
                      ?.filter(job => {
                        const jobStart = new Date(job?.scheduled_start_time);
                        return jobStart?.getHours() === hour;
                      })
                      ?.map(renderEventChip)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderVendorLanes = () => {
    const timeSlots = Array.from({ length: 10 }, (_, i) => 8 + i);
    
    return (
      <div className="space-y-4">
        {/* On-Site Lane */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <h3 className="font-medium">On-Site (PLV)</h3>
            </div>
            <div className="text-sm text-gray-600">
              {filteredJobs?.filter(job => !job?.vendor_id || job?.location === 'on_site')?.length} jobs
            </div>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {filteredJobs
              ?.filter(job => !job?.vendor_id || job?.location === 'on_site')
              ?.map(renderEventChip)}
          </div>
        </div>
        {/* Vendor Lanes */}
        {vendors?.map(vendor => {
          const vendorJobs = filteredJobs?.filter(job => job?.vendor_id === vendor?.id);
          const capacity = vendorJobs?.length;
          const maxCapacity = 7; // Default capacity

          return (
            <div key={vendor?.id} className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-500 rounded mr-3"></div>
                  <div>
                    <h3 className="font-medium">{vendor?.name}</h3>
                    <div className="text-sm text-gray-600">{vendor?.specialty}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {capacity} / {maxCapacity}
                  </div>
                  <div className="text-xs text-gray-600">scheduled / capacity</div>
                </div>
              </div>
              <div
                className="grid grid-cols-6 gap-2 min-h-[60px] border-2 border-dashed border-orange-200 rounded p-2"
                onDragOver={(e) => e?.preventDefault()}
                onDrop={() => handleDrop(vendor?.id)}
              >
                {vendorJobs?.map(renderEventChip)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calendar Flow Management Center</h1>
              <p className="text-gray-600">Visual scheduling and workflow management</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Updated View Toggle - Replace Agenda with Month */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'day' ? 'bg-white shadow-sm' : ''}`}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'week' ? 'bg-white shadow-sm' : ''}`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
                >
                  Month
                </button>
              </div>

              {/* Vendor Lanes Toggle - Hide for month view */}
              {viewMode !== 'month' && (
                <button
                  onClick={() => setVendorLanesEnabled(!vendorLanesEnabled)}
                  className={`flex items-center px-4 py-2 rounded-lg border ${
                    vendorLanesEnabled 
                      ? 'bg-blue-50 border-blue-200 text-blue-700' :'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Vendor Lanes
                </button>
              )}

              {/* Round-up Button */}
              <button
                onClick={() => setShowRoundUp(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Round-Up
              </button>
            </div>
          </div>

          {/* Navigation and Filters */}
          <div className="flex items-center justify-between mt-6">
            {/* Updated Date Navigation to handle month view */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (viewMode === 'month') {
                    newDate?.setMonth(newDate?.getMonth() - 1);
                  } else if (viewMode === 'week') {
                    newDate?.setDate(newDate?.getDate() - 7);
                  } else {
                    newDate?.setDate(newDate?.getDate() - 1);
                  }
                  setCurrentDate(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="text-lg font-medium">
                {viewMode === 'month' ? currentDate?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : viewMode === 'week' 
                    ? `Week of ${currentDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : currentDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                }
              </div>
              
              <button
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (viewMode === 'month') {
                    newDate?.setMonth(newDate?.getMonth() + 1);
                  } else if (viewMode === 'week') {
                    newDate?.setDate(newDate?.getDate() + 7);
                  } else {
                    newDate?.setDate(newDate?.getDate() + 1);
                  }
                  setCurrentDate(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Today
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search stock #, phone, customer..."
                  value={filters?.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e?.target?.value }))}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-80"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Filters - Updated to use original data for counts */}
        <QuickFilters 
          filters={filters}
          onFiltersChange={setFilters}
          jobCounts={{
            today: [...originalJobs, ...originalUnassignedJobs]?.filter(j => {
              const jobDate = new Date(j?.scheduled_start_time);
              const today = new Date();
              return jobDate?.toDateString() === today?.toDateString();
            })?.length,
            inProgress: [...originalJobs, ...originalUnassignedJobs]?.filter(j => j?.job_status === 'in_progress')?.length,
            overdue: [...originalJobs, ...originalUnassignedJobs]?.filter(j => isOverdue(j?.promised_date))?.length,
            noShow: [...originalJobs, ...originalUnassignedJobs]?.filter(j => j?.job_status === 'no_show')?.length,
            completed: [...originalJobs, ...originalUnassignedJobs]?.filter(j => j?.job_status === 'completed')?.length
          }}
        />

        {/* Main Content */}
        <div className="flex h-screen">
          {/* Unassigned Queue Sidebar - Hide for month view */}
          {viewMode !== 'month' && (
            <UnassignedQueue 
              jobs={filteredUnassignedJobs}
              onJobClick={handleJobClick}
              onDragStart={handleDragStart}
              loading={loading}
            />
          )}

          {/* Calendar View */}
          <div className={`flex-1 p-6 ${viewMode === 'month' ? 'w-full' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-auto">
                {viewMode === 'month' 
                  ? renderMonthView()
                  : vendorLanesEnabled 
                    ? renderVendorLanes() 
                    : renderWeekView()
                }
              </div>
            )}
          </div>
        </div>

        {/* Job Details Drawer */}
        <JobDrawer
          job={selectedJob}
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onStatusUpdate={handleJobStatusUpdate}
        />

        {/* Round-up Modal - Updated to use filtered data */}
        <RoundUpModal
          isOpen={showRoundUp}
          onClose={() => setShowRoundUp(false)}
          jobs={filteredJobs}
          type={roundUpType}
          onTypeChange={setRoundUpType}
        />
      </div>
    </AppLayout>
  );
};

export default CalendarFlowManagementCenter;