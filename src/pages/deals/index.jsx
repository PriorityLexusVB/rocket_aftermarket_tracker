import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layouts/AppLayout';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const DealsPage = () => {
  const { user } = useAuth();
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

  // Load deals data from database
  useEffect(() => {
    loadDeals();
    loadVehicles();
    loadVendors();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      // Fix: Use the proper relationship path through job_parts junction table
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles (stock_number, year, make, model, color, vin),
          vendors (name, specialty),
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
      
      // Transform data to match existing UI structure
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
        items: job?.job_parts?.map(part => ({
          id: part?.products?.id,
          name: part?.products?.name,
          price: part?.unit_price || part?.products?.unit_price,
          category: part?.products?.category,
          brand: part?.products?.brand,
          partNumber: part?.products?.part_number,
          quantity: part?.quantity_used,
          status: 'Active' // Default status since job_parts doesn't have status
        })) || [],
        totalValue: job?.transactions?.[0]?.total_amount || 
                    job?.job_parts?.reduce((sum, part) => sum + (part?.total_price || 0), 0) || 
                    job?.estimated_cost || 0,
        status: job?.job_status,
        vendor: job?.vendors?.name || 'Unassigned',
        estimatedCompletion: job?.scheduled_end_time,
        priority: job?.priority || 'Medium',
        description: job?.description,
        title: job?.title
      })) || [];

      setDeals(transformedDeals);
      setFilteredDeals(transformedDeals);
    } catch (error) {
      console.error('Error loading deals:', error);
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
        deal?.vehicleInfo?.model?.toLowerCase()?.includes(searchTerm?.toLowerCase())
      );
    }
    
    setFilteredDeals(filtered);
  }, [deals, filterStatus, searchTerm]);

  // Action handlers
  const handleViewDeal = (deal) => {
    setSelectedDeal(deal);
    setShowDealDetails(true);
  };

  const handleEditDeal = (deal) => {
    // Navigate to edit page or open edit modal
    navigate(`/deals/${deal?.id}/edit`);
  };

  const handleMessageCustomer = (deal) => {
    // Integrate with SMS system or email
    console.log('Message customer for deal:', deal?.id);
  };

  const handleNewDeal = () => {
    setShowNewDealModal(true);
  };

  const handleFilter = (status) => {
    setFilterStatus(status);
  };

  const handleExport = () => {
    // Export deals to CSV
    const csv = [
      ['Stock Number', 'Customer', 'Vehicle', 'Status', 'Value', 'Vendor'],
      ...filteredDeals?.map(deal => [
        deal?.vehicleInfo?.stockNumber,
        deal?.customer?.name,
        `${deal?.vehicleInfo?.year} ${deal?.vehicleInfo?.make} ${deal?.vehicleInfo?.model}`,
        deal?.status,
        `$${deal?.totalValue}`,
        deal?.vendor
      ])
    ]?.map(row => row?.join(','))?.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a?.setAttribute('hidden', '');
    a?.setAttribute('href', url);
    a?.setAttribute('download', 'deals-export.csv');
    document.body?.appendChild(a);
    a?.click();
    document.body?.removeChild(a);
  };

  const getStatusColor = (status) => {
    const colors = {
      'in_progress': 'bg-blue-100 text-blue-800 border-blue-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'scheduled': 'bg-purple-100 text-purple-800 border-purple-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors?.[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'high': 'text-red-600',
      'urgent': 'text-red-800',
      'medium': 'text-yellow-600',
      'low': 'text-green-600'
    };
    return colors?.[priority?.toLowerCase()] || 'text-gray-600';
  };

  // Calculate stats
  const totalRevenue = filteredDeals?.reduce((sum, deal) => sum + (deal?.totalValue || 0), 0);
  const completedDeals = filteredDeals?.filter(deal => deal?.status === 'completed')?.length;
  const pendingDeals = filteredDeals?.filter(deal => deal?.status === 'pending')?.length;
  const activeDeals = filteredDeals?.filter(deal => deal?.status === 'in_progress')?.length;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Active Deals
            </h1>
            <p className="text-gray-600">
              Track and manage your aftermarket deals and installations
            </p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button variant="outline" size="sm" onClick={() => handleFilter(filterStatus === 'all' ? 'pending' : 'all')} className="flex items-center">
              <Icon name="Filter" size={16} className="mr-2" />
              {filterStatus === 'all' ? 'Filter' : 'Show All'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center">
              <Icon name="Download" size={16} className="mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleNewDeal} className="flex items-center">
              <Icon name="Plus" size={16} className="mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Deals</p>
                <p className="text-2xl font-bold text-gray-900">{activeDeals}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Icon name="TrendingUp" size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">${totalRevenue?.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon name="DollarSign" size={24} className="text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{pendingDeals}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Icon name="Clock" size={24} className="text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedDeals}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon name="CheckCircle" size={24} className="text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Deals Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
                Current Deals ({filteredDeals?.length})
              </h2>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Icon 
                    name="Search" 
                    size={16} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                  />
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Vehicle
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Customer
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Items
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Value
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Priority
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDeals?.map((deal) => (
                  <tr key={deal?.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                           onClick={() => navigate(`/vehicles?search=${deal?.vehicleInfo?.stockNumber}`)}>
                          {deal?.vehicleInfo?.year} {deal?.vehicleInfo?.make} {deal?.vehicleInfo?.model}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {deal?.vehicleInfo?.stockNumber}
                        </p>
                        <p className="text-xs text-gray-400">
                          VIN: {deal?.vehicleInfo?.vin}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {deal?.customer?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {deal?.customer?.phone}
                        </p>
                        <p className="text-xs text-gray-500">
                          {deal?.customer?.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {deal?.items?.length > 0 ? deal?.items?.slice(0, 2)?.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-xs text-gray-900">{item?.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item?.status === 'Installing' ? 'bg-blue-100 text-blue-700' :
                              item?.status === 'Ordered' ? 'bg-yellow-100 text-yellow-700' :
                              item?.status === 'Pending' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {item?.status}
                            </span>
                          </div>
                        )) : (
                          <div className="text-xs text-gray-500">{deal?.title || deal?.description}</div>
                        )}
                        {deal?.items?.length > 2 && (
                          <p className="text-xs text-gray-500">
                            +{deal?.items?.length - 2} more items
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        ${deal?.totalValue?.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(deal?.status)}`}>
                        {deal?.status?.replace('_', ' ')?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          deal?.priority?.toLowerCase() === 'high' || deal?.priority?.toLowerCase() === 'urgent' ? 'bg-red-500' :
                          deal?.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></div>
                        <span className={`text-sm font-medium ${getPriorityColor(deal?.priority)}`}>
                          {deal?.priority}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDeal(deal)} className="p-2">
                          <Icon name="Eye" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditDeal(deal)} className="p-2">
                          <Icon name="Edit" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleMessageCustomer(deal)} className="p-2">
                          <Icon name="MessageSquare" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deal Details Modal */}
        {showDealDetails && selectedDeal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Deal Details</h3>
                <button
                  onClick={() => setShowDealDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Icon name="X" size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Vehicle</h4>
                    <p className="text-lg font-semibold">
                      {selectedDeal?.vehicleInfo?.year} {selectedDeal?.vehicleInfo?.make} {selectedDeal?.vehicleInfo?.model}
                    </p>
                    <p className="text-sm text-gray-600">Stock: {selectedDeal?.vehicleInfo?.stockNumber}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Customer</h4>
                    <p className="text-lg font-semibold">{selectedDeal?.customer?.name}</p>
                    <p className="text-sm text-gray-600">{selectedDeal?.customer?.phone}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status & Priority</h4>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(selectedDeal?.status)}`}>
                      {selectedDeal?.status?.replace('_', ' ')?.toUpperCase()}
                    </span>
                    <span className={`text-sm font-medium ${getPriorityColor(selectedDeal?.priority)}`}>
                      {selectedDeal?.priority} Priority
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Total Value</h4>
                  <p className="text-2xl font-bold text-green-600">${selectedDeal?.totalValue?.toLocaleString()}</p>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={() => handleEditDeal(selectedDeal)} className="flex-1 flex items-center justify-center">
                    <Icon name="Edit" size={16} className="mr-2" />
                    Edit Deal
                  </Button>
                  <Button variant="outline" onClick={() => handleMessageCustomer(selectedDeal)} className="flex-1 flex items-center justify-center">
                    <Icon name="MessageSquare" size={16} className="mr-2" />
                    Message Customer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DealsPage;