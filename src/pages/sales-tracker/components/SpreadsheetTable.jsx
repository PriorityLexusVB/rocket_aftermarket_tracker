import React, { useState, useCallback, useEffect } from 'react';
import { DollarSign, Truck, Clock, CheckCircle2, AlertCircle, Edit, Trash2 } from 'lucide-react';


import { useLogger } from '../../../hooks/useLogger';

// Service Configuration - Easy to modify and expand
const SERVICE_CATEGORIES = {
  protection: {
    name: 'Protection',
    color: 'blue',
    services: [
      { key: 'ppf', name: 'PPF', fullName: 'Paint Protection Film', keywords: ['ppf', 'protection film', 'clear bra'] },
      { key: 'ceramic', name: 'CER', fullName: 'Ceramic Coating', keywords: ['ceramic', 'coating'] },
      { key: 'tint', name: 'TINT', fullName: 'Window Tinting', keywords: ['tint', 'window'] },
      { key: 'rg', name: 'RG', fullName: 'Rain Guards', keywords: ['rg', 'rain guard'] }
    ]
  },
  aesthetic: {
    name: 'Aesthetic',
    color: 'purple',
    services: [
      { key: 'wrap', name: 'WRAP', fullName: 'Vehicle Wrap', keywords: ['wrap', 'vinyl'] },
      { key: 'exterior', name: 'EXT', fullName: 'Exterior Work', keywords: ['exterior', 'paint'] },
      { key: 'interior', name: 'INT', fullName: 'Interior Work', keywords: ['interior', 'seats', 'carpet'] }
    ]
  },
  maintenance: {
    name: 'Maintenance',
    color: 'green',
    services: [
      { key: 'detailing', name: 'DTL', fullName: 'Detailing', keywords: ['detail', 'wash', 'clean'] },
      { key: 'repair', name: 'RPR', fullName: 'Repair', keywords: ['repair', 'fix', 'damage'] },
      { key: 'windshield', name: 'WIND', fullName: 'Windshield Work', keywords: ['windshield', 'glass'] }
    ]
  }
};

const SpreadsheetTable = ({ data = [], onEdit, onDelete }) => {
  const [editingCell, setEditingCell] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [viewMode, setViewMode] = useState('checkboxes');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [filters, setFilters] = useState({
    status: '',
    coordinator: '',
    search: ''
  });

  const { logUserInteraction, logSalesAction, logError } = useLogger();

  // Add missing handleFilterChange function
  const handleFilterChange = useCallback(async (filterType, value) => {
    try {
      setFilters(prev => ({ ...prev, [filterType]: value }));
      
      await logUserInteraction(
        'sales-tracker-filter',
        'filter_changed',
        { filterType, value, timestamp: new Date()?.toISOString() }
      );
    } catch (error) {
      await logError(error, { action: 'filter_change', filterType, value });
    }
  }, [logUserInteraction, logError]);

  // Filter data based on current filters
  const filteredData = data?.filter(sale => {
    if (!sale) return false;
    
    const matchesStatus = !filters?.status || sale?.status === filters?.status;
    const matchesCoordinator = !filters?.coordinator || 
      sale?.deliveryCoordinator?.toLowerCase()?.includes(filters?.coordinator?.toLowerCase());
    const matchesSearch = !filters?.search || 
      sale?.stockNumber?.toLowerCase()?.includes(filters?.search?.toLowerCase()) ||
      sale?.customer?.name?.toLowerCase()?.includes(filters?.search?.toLowerCase()) ||
      (sale?.year && sale?.make && sale?.model && 
       (sale?.year + ' ' + sale?.make + ' ' + sale?.model)?.toLowerCase()?.includes(filters?.search?.toLowerCase()));
    
    return matchesStatus && matchesCoordinator && matchesSearch;
  });

  // Enhanced edit with logging
  const handleEdit = useCallback(async (sale) => {
    try {
      await logSalesAction(
        'sale_edit_initiated',
        sale?.id,
        `Edit initiated for sale ${sale?.stockNumber || 'Unknown'}`,
        { saleData: sale }
      );
      onEdit?.(sale);
    } catch (error) {
      await logError(error, { action: 'handle_edit', saleId: sale?.id });
    }
  }, [onEdit, logSalesAction, logError]);

  // Enhanced delete with logging
  const handleDelete = useCallback(async (saleId) => {
    try {
      const sale = data?.find(s => s?.id === saleId);
      
      await logSalesAction(
        'sale_delete_initiated',
        saleId,
        `Delete initiated for sale ${sale?.stockNumber || saleId}`,
        { saleData: sale }
      );
      
      onDelete?.(saleId);
    } catch (error) {
      await logError(error, { action: 'handle_delete', saleId });
    }
  }, [data, onDelete, logSalesAction, logError]);

  // Enhanced service toggle with detailed logging
  const handleServiceToggle = useCallback(async (saleId, service, isEnabled) => {
    try {
      const sale = filteredData?.find(s => s?.id === saleId);
      const serviceAction = isEnabled ? 'service_enabled' : 'service_disabled';
      
      await logSalesAction(
        serviceAction,
        saleId,
        `${service} ${isEnabled ? 'enabled' : 'disabled'} for ${sale?.stockNumber || saleId}`,
        {
          service,
          isEnabled,
          saleData: {
            stockNumber: sale?.stockNumber,
            customerName: sale?.customer?.name,
            vehicleInfo: `${sale?.year} ${sale?.make} ${sale?.model}`
          }
        }
      );

      // Call parent update function if it exists
      onEdit?.({ ...sale, services: { ...sale?.services, [service]: isEnabled } });

    } catch (error) {
      await logError(error, { 
        action: 'service_toggle', 
        saleId, 
        service, 
        isEnabled 
      });
    }
  }, [filteredData, onEdit, logSalesAction, logError]);

  // Log component mount and data changes
  useEffect(() => {
    const logDataLoad = async () => {
      try {
        await logUserInteraction(
          'sales-tracker-table',
          'data_loaded',
          { 
            recordCount: data?.length,
            hasData: Boolean(data?.length)
          }
        );
      } catch (error) {
        console.error('Failed to log data load:', error);
      }
    };

    if (data?.length !== undefined) {
      logDataLoad();
    }
  }, [data?.length, logUserInteraction]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { 
        text: 'Pending', 
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        icon: Clock 
      },
      in_progress: { 
        text: 'In Progress', 
        className: 'bg-blue-100 text-blue-800 border border-blue-200',
        icon: Truck 
      },
      completed: { 
        text: 'Completed', 
        className: 'bg-green-100 text-green-800 border border-green-200',
        icon: CheckCircle2 
      },
      cancelled: { 
        text: 'Cancelled', 
        className: 'bg-red-100 text-red-800 border border-red-200',
        icon: AlertCircle 
      }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;
    const IconComponent = config?.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.className}`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config?.text}
      </span>
    );
  };

  const renderServicesBadges = (services) => {
    if (!services || Object.keys(services)?.length === 0) {
      return <span className="text-gray-500 text-sm">No services</span>;
    }

    const activeServices = Object.entries(services)?.filter(([_, enabled]) => enabled);
    
    if (activeServices?.length === 0) {
      return <span className="text-gray-500 text-sm">No services</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {activeServices?.slice(0, 3)?.map(([serviceKey]) => {
          // Find the service configuration
          let serviceConfig = null;
          let categoryColor = 'gray';
          
          Object.values(SERVICE_CATEGORIES)?.forEach(category => {
            const found = category?.services?.find(s => s?.key === serviceKey);
            if (found) {
              serviceConfig = found;
              categoryColor = category?.color;
            }
          });

          const serviceName = serviceConfig?.name || serviceKey?.toUpperCase();
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-800 border-blue-200',
            purple: 'bg-purple-100 text-purple-800 border-purple-200',
            green: 'bg-green-100 text-green-800 border-green-200',
            gray: 'bg-gray-100 text-gray-800 border-gray-200'
          };

          return (
            <span 
              key={serviceKey}
              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${colorClasses?.[categoryColor] || colorClasses?.gray}`}
            >
              {serviceName}
            </span>
          );
        })}
        {activeServices?.length > 3 && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            +{activeServices?.length - 3} more
          </span>
        )}
      </div>
    );
  };

  if (!data || data?.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales Data</h3>
        <p className="text-gray-600">Start by adding your first sale entry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced filter section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              value={filters?.status} 
              onChange={(e) => handleFilterChange('status', e?.target?.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coordinator</label>
            <select 
              value={filters?.coordinator} 
              onChange={(e) => handleFilterChange('coordinator', e?.target?.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Coordinators</option>
              <option value="Sarah Johnson">Sarah Johnson</option>
              <option value="Mike Chen">Mike Chen</option>
              <option value="Alex Rodriguez">Alex Rodriguez</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Stock #, Customer, Vehicle..."
              value={filters?.search}
              onChange={(e) => handleFilterChange('search', e?.target?.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {/* Enhanced table section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Sales Tracker ({filteredData?.length} records)
          </h3>
          <div className="flex gap-2">
            <span className="text-sm text-gray-500">
              Showing {filteredData?.length} of {data?.length} sales
            </span>
          </div>
        </div>

        {/* Simplified table structure */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coordinator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData?.map((sale) => (
                <tr key={sale?.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale?.stockNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{sale?.customer?.name || 'Unknown'}</div>
                      {sale?.customer?.email && (
                        <div className="text-gray-500 text-xs">{sale?.customer?.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        {sale?.year && sale?.make && sale?.model 
                          ? `${sale?.year} ${sale?.make} ${sale?.model}`
                          : 'Vehicle Info N/A'
                        }
                      </div>
                      {sale?.color && (
                        <div className="text-gray-500 text-xs">{sale?.color}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {renderServicesBadges(sale?.services)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getStatusBadge(sale?.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(sale?.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm">
                      {sale?.deliveryCoordinator || 'Unassigned'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(sale?.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Edit Sale"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sale?.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Delete Sale"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No sales records found matching your filters.</p>
              <button 
                onClick={() => setFilters({ status: '', coordinator: '', search: '' })}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetTable;