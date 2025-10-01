import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { CalendarDays, Search, Plus, Clock, MapPin, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AppLayout from '../../components/layouts/AppLayout';

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // week, day, agenda, resource
  const [appointments, setAppointments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New state for appointment modal
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    title: '',
    description: '',
    vehicle_id: '',
    vendor_id: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    priority: 'medium',
    location: '',
    estimated_hours: 1
  });

  // Get date range for current view
  const getDateRange = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return { start, end };
  };

  // Load appointments for current date range
  useEffect(() => {
    loadAppointments();
    loadVendors();
    loadUnassignedJobs();
  }, [currentDate, view]);

  const loadAppointments = async () => {
    try {
      const { start, end } = getDateRange();
      
      // Convert to UTC for database query
      const startUTC = start?.toISOString();
      const endUTC = end?.toISOString();

      const { data, error } = await supabase?.rpc('get_jobs_by_date_range', {
        start_date: startUTC,
        end_date: endUTC
      });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
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

  const loadUnassignedJobs = async () => {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles (stock_number, year, make, model, color)
        `)?.is('vendor_id', null)?.in('job_status', ['pending', 'scheduled'])?.order('created_at', { ascending: false })?.limit(10);

      if (error) throw error;
      setUnassignedJobs(data || []);
    } catch (error) {
      console.error('Error loading unassigned jobs:', error);
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

  // Load vehicles when modal opens
  useEffect(() => {
    if (showNewAppointmentModal) {
      loadVehicles();
    }
  }, [showNewAppointmentModal]);

  // Stock-first search
  const handleStockSearch = async (searchTerm) => {
    if (!searchTerm?.trim()) return;

    try {
      // First try exact match
      let { data: exactMatch } = await supabase?.from('vehicles')?.select('*')?.ilike('stock_number', searchTerm)?.limit(1);

      if (exactMatch && exactMatch?.length > 0) {
        console.log('Exact stock match:', exactMatch?.[0]);
        return;
      }

      // Fallback to partial search
      const { data: partialMatches } = await supabase?.from('vehicles')?.select('*')?.or(`stock_number.ilike.%${searchTerm}%,vin.ilike.%${searchTerm}%,owner_name.ilike.%${searchTerm}%`)?.order('stock_number')?.limit(20);

      console.log('Partial matches:', partialMatches);
    } catch (error) {
      console.error('Stock search error:', error);
    }
  };

  const handleNewAppointment = () => {
    setShowNewAppointmentModal(true);
  };

  const handleCreateAppointment = async (e) => {
    e?.preventDefault();
    setLoading(true);

    try {
      // Create the job/appointment
      const { data: job, error } = await supabase?.from('jobs')?.insert([{
          title: newAppointmentForm?.title,
          description: newAppointmentForm?.description,
          vehicle_id: newAppointmentForm?.vehicle_id,
          vendor_id: newAppointmentForm?.vendor_id || null,
          scheduled_start_time: new Date(newAppointmentForm?.scheduled_start_time)?.toISOString(),
          scheduled_end_time: new Date(newAppointmentForm?.scheduled_end_time)?.toISOString(),
          job_status: 'scheduled',
          priority: newAppointmentForm?.priority,
          location: newAppointmentForm?.location,
          estimated_hours: parseFloat(newAppointmentForm?.estimated_hours)
        }])?.select()?.single();

      if (error) throw error;

      // Close modal and reset form
      setShowNewAppointmentModal(false);
      setNewAppointmentForm({
        title: '',
        description: '',
        vehicle_id: '',
        vendor_id: '',
        scheduled_start_time: '',
        scheduled_end_time: '',
        priority: 'medium',
        location: '',
        estimated_hours: 1
      });

      // Reload appointments
      await loadAppointments();
    } catch (error) {
      console.error('Error creating appointment:', error);
    } finally {
      setLoading(false);
    }
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
        case 'n':
          e?.preventDefault();
          handleNewAppointment();
          break;
        case 'escape':
          setShowDrawer(false);
          setShowNewAppointmentModal(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

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

  const formatTimeDisplay = (timestamp) => {
    // Display in America/New_York timezone
    const date = parseISO(timestamp);
    return format(date, 'h:mm a');
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
      <div className="h-screen flex bg-gray-50">
        {/* Main Calendar Area */}
        <div className="flex-1 flex flex-col">
          {/* Modern Header with Enhanced Controls */}
          <div className="bg-white border-b border-gray-200 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <CalendarDays className="w-8 h-8 text-blue-600" />
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
                    <p className="text-sm text-gray-500">Schedule & Timeline Management</p>
                  </div>
                </div>
                
                {/* Enhanced Search with Modern Styling */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="stock-search"
                    type="text"
                    placeholder="Search by Stock #, Customer, or Vehicle..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e?.target?.value);
                      if (e?.target?.value?.length > 2) {
                        handleStockSearch(e?.target?.value);
                      }
                    }}
                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-xl w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Enhanced View Selector */}
                <div className="flex bg-gray-100 rounded-xl p-1 shadow-sm">
                  {['week', 'day', 'agenda', 'resource']?.map((viewType) => (
                    <button
                      key={viewType}
                      onClick={() => setView(viewType)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
                        view === viewType 
                          ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {viewType}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleNewAppointment}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center space-x-2 shadow-lg transition-all duration-200 hover:shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">New Appointment</span>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="flex-1 p-6">
            {view === 'week' && (
              <div className="bg-white rounded-lg shadow">
                <div className="grid grid-cols-8 border-b border-gray-200">
                  <div className="p-4 font-medium text-gray-900">Time</div>
                  {Array.from({ length: 7 }, (_, i) => {
                    const day = addDays(startOfWeek(currentDate), i);
                    return (
                      <div key={i} className="p-4 text-center border-l border-gray-200">
                        <div className="font-medium text-gray-900">{format(day, 'EEE')}</div>
                        <div className="text-sm text-gray-500">{format(day, 'MMM d')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Time Slots */}
                <div className="max-h-96 overflow-y-auto">
                  {Array.from({ length: 12 }, (_, hour) => {
                    const timeSlot = hour + 8; // 8 AM to 8 PM
                    return (
                      <div key={hour} className="grid grid-cols-8 border-b border-gray-100 min-h-16">
                        <div className="p-4 text-sm text-gray-500 border-r border-gray-200">
                          {format(new Date()?.setHours(timeSlot, 0), 'h:mm a')}
                        </div>
                        {Array.from({ length: 7 }, (_, day) => (
                          <div key={day} className="p-2 border-l border-gray-100">
                            {/* Appointments for this time slot would go here */}
                            {appointments?.filter(apt => {
                                const aptDate = parseISO(apt?.scheduled_start_time);
                                const slotDate = addDays(startOfWeek(currentDate), day);
                                return aptDate?.getDate() === slotDate?.getDate() && 
                                       aptDate?.getHours() === timeSlot;
                              })?.map(apt => (
                                <div
                                  key={apt?.id}
                                  onClick={() => {
                                    setSelectedAppointment(apt);
                                    setShowDrawer(true);
                                  }}
                                  className={`p-2 rounded text-xs cursor-pointer mb-1 border ${getStatusColor(apt?.job_status)}`}
                                >
                                  <div className="font-medium">{apt?.title}</div>
                                  <div className="text-xs opacity-75">{apt?.vehicle_info}</div>
                                  <div className="text-xs opacity-75">{apt?.vendor_name}</div>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'resource' && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium">Vendor Resources</h3>
                </div>
                <div className="space-y-4 p-4">
                  {vendors?.map(vendor => (
                    <div key={vendor?.id} className="border border-gray-200 rounded-lg">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{vendor?.name}</h4>
                          <span className="text-sm text-gray-500">{vendor?.specialty}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-2">
                          {appointments?.filter(apt => apt?.vendor_id === vendor?.id)?.map(apt => (
                              <div
                                key={apt?.id}
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setShowDrawer(true);
                                }}
                                className={`p-3 rounded-lg cursor-pointer border ${getStatusColor(apt?.job_status)}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{apt?.title}</div>
                                    <div className="text-sm text-gray-600">{apt?.vehicle_info}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">
                                      {formatTimeDisplay(apt?.scheduled_start_time)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {format(parseISO(apt?.scheduled_start_time), 'MMM d')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Unassigned Queue Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Unassigned Queue</h3>
            <p className="text-sm text-gray-500">{unassignedJobs?.length} jobs pending assignment</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {unassignedJobs?.map(job => (
              <div
                key={job?.id}
                className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer"
                draggable
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{job?.title}</h4>
                    <p className="text-sm text-gray-600">{job?.description}</p>
                    
                    {job?.vehicles && (
                      <div className="mt-2 text-xs text-blue-600 font-medium">
                        Stock: {job?.vehicles?.stock_number || 'N/A'} • {job?.vehicles?.year} {job?.vehicles?.make} {job?.vehicles?.model}
                      </div>
                    )}
                    
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {job?.estimated_hours}h
                      </span>
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {job?.location}
                      </span>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(job?.job_status)}`}>
                    {job?.job_status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Appointment Drawer */}
        {showDrawer && selectedAppointment && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Appointment Details</h3>
                  <button
                    onClick={() => setShowDrawer(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    ×
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{selectedAppointment?.title}</h4>
                    <p className="text-sm text-gray-600">{selectedAppointment?.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(selectedAppointment?.job_status)}`}>
                        {selectedAppointment?.job_status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Priority:</span>
                      <span className="ml-2 font-medium">{selectedAppointment?.priority}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-gray-500">Vehicle:</span>
                    <div className="mt-1 font-medium">{selectedAppointment?.vehicle_info}</div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-gray-500">Vendor:</span>
                    <div className="mt-1 font-medium">{selectedAppointment?.vendor_name}</div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-gray-500">Scheduled:</span>
                    <div className="mt-1">
                      {format(parseISO(selectedAppointment?.scheduled_start_time), 'MMM d, yyyy h:mm a')} - 
                      {formatTimeDisplay(selectedAppointment?.scheduled_end_time)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Appointment Modal */}
        {showNewAppointmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Schedule New Appointment</h3>
                <button
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateAppointment}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={newAppointmentForm?.title}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, title: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      placeholder="e.g., Oil Change, Brake Service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle</label>
                    <select
                      value={newAppointmentForm?.vehicle_id}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, vehicle_id: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles?.map(vehicle => (
                        <option key={vehicle?.id} value={vehicle?.id}>
                          {vehicle?.stock_number} - {vehicle?.year} {vehicle?.make} {vehicle?.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                    <select
                      value={newAppointmentForm?.vendor_id}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, vendor_id: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Vendor (Optional)</option>
                      {vendors?.map(vendor => (
                        <option key={vendor?.id} value={vendor?.id}>
                          {vendor?.name} - {vendor?.specialty}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={newAppointmentForm?.priority}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, priority: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={newAppointmentForm?.scheduled_start_time}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, scheduled_start_time: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={newAppointmentForm?.scheduled_end_time}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, scheduled_end_time: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={newAppointmentForm?.location}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, location: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Bay 1, Shop A, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours</label>
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={newAppointmentForm?.estimated_hours}
                      onChange={(e) => setNewAppointmentForm({...newAppointmentForm, estimated_hours: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newAppointmentForm?.description}
                    onChange={(e) => setNewAppointmentForm({...newAppointmentForm, description: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Additional notes, specific services needed, etc."
                  />
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowNewAppointmentModal(false)}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>}
                    <span>{loading ? 'Creating...' : 'Create Appointment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CalendarPage;