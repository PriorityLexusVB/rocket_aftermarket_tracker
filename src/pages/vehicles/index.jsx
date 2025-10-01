import React, { useState, useEffect } from 'react';
import { Car, Search, Plus, Calendar, History, FileText, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AppLayout from '../../components/layouts/AppLayout';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadVehicles();
  }, [searchQuery, statusFilter]);

  // Auto-focus search on component mount
  useEffect(() => {
    const searchInput = document.getElementById('vehicle-search');
    if (searchInput) {
      searchInput?.focus();
    }
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      
      let query = supabase?.from('vehicles')?.select('*')?.order('stock_number', { ascending: true });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query?.eq('vehicle_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search query (stock-first approach)
      let filteredData = data || [];
      
      if (searchQuery?.trim()) {
        const searchTerm = searchQuery?.toLowerCase()?.trim();
        
        // Stock-first search: exact match first, then partial
        const exactStockMatch = filteredData?.filter(vehicle => 
          vehicle?.stock_number?.toLowerCase() === searchTerm
        );
        
        if (exactStockMatch?.length > 0) {
          filteredData = exactStockMatch;
        } else {
          // Partial search: stock, VIN, customer name
          filteredData = filteredData?.filter(vehicle => 
            vehicle?.stock_number?.toLowerCase()?.includes(searchTerm) ||
            vehicle?.vin?.toLowerCase()?.includes(searchTerm) ||
            vehicle?.owner_name?.toLowerCase()?.includes(searchTerm) ||
            `${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`?.toLowerCase()?.includes(searchTerm)
          );
        }
      }

      setVehicles(filteredData);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicleHistory = async (vehicleId) => {
    try {
      // Get jobs and communications for this vehicle
      const [jobsResponse, communicationsResponse] = await Promise.all([
        supabase?.from('jobs')?.select(`
            *,
            vendors (name),
            user_profiles (full_name)
          `)?.eq('vehicle_id', vehicleId)?.order('created_at', { ascending: false }),
        
        supabase?.from('communications')?.select('*')?.eq('vehicle_id', vehicleId)?.order('sent_at', { ascending: false })
      ]);

      const jobs = jobsResponse?.data || [];
      const communications = communicationsResponse?.data || [];

      // Combine and sort by date
      const history = [
        ...jobs?.map(job => ({
          type: 'job',
          date: job?.created_at,
          title: job?.title,
          description: job?.description,
          status: job?.job_status,
          vendor: job?.vendors?.name,
          assignee: job?.user_profiles?.full_name
        })),
        ...communications?.map(comm => ({
          type: 'communication',
          date: comm?.sent_at,
          title: `${comm?.communication_type?.toUpperCase()} Message`,
          description: comm?.message,
          status: comm?.is_successful ? 'delivered' : 'failed'
        }))
      ]?.sort((a, b) => new Date(b.date) - new Date(a.date));

      setVehicleHistory(history);
    } catch (error) {
      console.error('Error loading vehicle history:', error);
    }
  };

  const handleViewHistory = (vehicle) => {
    setSelectedVehicle(vehicle);
    loadVehicleHistory(vehicle?.id);
    setShowHistoryDrawer(true);
  };

  const handleScheduleService = (vehicle) => {
    // Navigate to calendar with vehicle pre-selected
    console.log('Schedule service for vehicle:', vehicle?.stock_number);
    // Could integrate with calendar page or open modal
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800 border-green-300',
      'maintenance': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'retired': 'bg-gray-100 text-gray-800 border-gray-300',
      'sold': 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors?.[status] || colors?.active;
  };

  if (loading) {
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
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Modern Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <Car className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Vehicle Management</h1>
                  <p className="text-sm text-gray-500">Inventory & Service Tracking</p>
                </div>
              </div>
              
              {/* Enhanced Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="vehicle-search"
                  type="text"
                  placeholder="Search by Stock #, VIN, Customer, or Vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e?.target?.value)}
                  className="pl-10 pr-4 py-3 border border-gray-300 rounded-xl w-96 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Enhanced Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e?.target?.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="maintenance">In Maintenance</option>
                <option value="retired">Retired</option>
                <option value="sold">Sold</option>
              </select>

              <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center space-x-2 shadow-lg transition-all duration-200 hover:shadow-xl">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Add Vehicle</span>
              </button>
            </div>
          </div>
        </div>
        {/* Vehicles Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner Information
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vehicles?.map((vehicle) => (
                    <tr key={vehicle?.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-blue-600">
                          {vehicle?.stock_number || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vehicle?.license_plate}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle?.year} {vehicle?.make} {vehicle?.model}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vehicle?.color} • {vehicle?.mileage?.toLocaleString()} miles
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          VIN: {vehicle?.vin}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle?.owner_name}
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          {vehicle?.owner_phone && (
                            <div className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {vehicle?.owner_phone}
                            </div>
                          )}
                          {vehicle?.owner_email && (
                            <div className="flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {vehicle?.owner_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(vehicle?.vehicle_status)}`}>
                          {vehicle?.vehicle_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleViewHistory(vehicle)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <History className="w-4 h-4 mr-1" />
                          History
                        </button>
                        <button
                          onClick={() => handleScheduleService(vehicle)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule
                        </button>
                        <button className="text-gray-600 hover:text-gray-900 flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vehicles?.length === 0 && (
              <div className="text-center py-12">
                <Car className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No vehicles found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'Try adjusting your search terms.' : 'Get started by adding a new vehicle.'}
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Vehicle History Drawer */}
        {showHistoryDrawer && selectedVehicle && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Vehicle History</h3>
                  <button
                    onClick={() => setShowHistoryDrawer(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    ×
                  </button>
                </div>
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-900">
                    Stock: {selectedVehicle?.stock_number} • {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
                  </div>
                  <div className="text-sm text-gray-500">{selectedVehicle?.owner_name}</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {vehicleHistory?.length > 0 ? (
                    vehicleHistory?.map((item, index) => (
                      <div key={index} className="border-l-2 border-gray-200 pl-4 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                item?.type === 'job' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {item?.type}
                              </span>
                              {item?.status && (
                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(item?.status)}`}>
                                  {item?.status?.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            
                            <h4 className="font-medium text-gray-900 mt-1">{item?.title}</h4>
                            {item?.description && (
                              <p className="text-sm text-gray-600 mt-1">{item?.description}</p>
                            )}
                            
                            <div className="text-xs text-gray-500 mt-2 space-y-1">
                              <div>{new Date(item.date)?.toLocaleDateString()}</div>
                              {item?.vendor && <div>Vendor: {item?.vendor}</div>}
                              {item?.assignee && <div>Assigned to: {item?.assignee}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <History className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">No history available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default VehiclesPage;