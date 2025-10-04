import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

import InlineEditCell, { validators, formatters } from '../../../components/common/InlineEditCell';
import AdvancedFilters from '../../../components/common/AdvancedFilters';
import ExportButton from '../../../components/common/ExportButton';
import { vehicleService } from '../../../services/vehicleService';
import { useOverdueJobs } from '../../../services/advancedFeaturesService';

const EnhancedVehicleTable = ({ 
  vehicles, 
  selectedVehicles, 
  onSelectionChange, 
  onVehicleUpdate,
  userRole = 'staff',
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange 
}) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isLoading, setIsLoading] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const { overdueJobs } = useOverdueJobs();

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleCellUpdate = async (vehicleId, field, value) => {
    try {
      setIsLoading(true);
      const result = await vehicleService?.updateVehicle(vehicleId, { [field]: value });
      
      if (result?.error) {
        throw new Error(result?.error?.message);
      }
      
      // Update parent component
      if (onVehicleUpdate) {
        onVehicleUpdate(vehicleId, { [field]: value });
      }
      
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error; // Re-throw to show error in inline edit component
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (vehicleId) => {
    navigate(`/vehicle-detail-workstation?id=${vehicleId}`);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectionChange(vehicles?.map(v => v?.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectVehicle = (vehicleId, checked) => {
    if (checked) {
      onSelectionChange([...selectedVehicles, vehicleId]);
    } else {
      onSelectionChange(selectedVehicles?.filter(id => id !== vehicleId));
    }
  };

  const getStatusBadge = (status, vehicleId) => {
    // Check if vehicle has overdue jobs
    const hasOverdueJobs = overdueJobs?.some(job => 
      job?.vehicle_info?.includes(vehicles?.find(v => v?.id === vehicleId)?.license_plate)
    );

    const statusConfig = {
      'active': { color: 'bg-success text-success-foreground', label: 'Active' },
      'maintenance': { color: 'bg-warning text-warning-foreground', label: 'Maintenance' },
      'retired': { color: 'bg-secondary text-secondary-foreground', label: 'Retired' },
      'sold': { color: 'bg-primary text-primary-foreground', label: 'Sold' }
    };
    
    const config = statusConfig?.[status] || statusConfig?.['active'];
    
    return (
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${config?.color} ${
          hasOverdueJobs ? 'ring-2 ring-red-500 ring-opacity-50' : ''
        }`}>
          {config?.label}
        </span>
        {hasOverdueJobs && (
          <Icon name="AlertTriangle" size={14} className="text-red-500" />
        )}
      </div>
    );
  };

  const getRowClassName = (vehicle) => {
    const hasOverdueJobs = overdueJobs?.some(job => 
      job?.vehicle_info?.includes(vehicle?.license_plate)
    );

    return `hover:bg-muted/50 transition-colors duration-150 ${
      selectedVehicles?.includes(vehicle?.id) ? 'bg-primary/5' : ''
    } ${
      hasOverdueJobs ? 'bg-red-50/50 border-l-4 border-l-red-500' : ''
    }`;
  };

  const sortedVehicles = useMemo(() => {
    if (!sortConfig?.key) return vehicles;
    
    return [...(vehicles || [])]?.sort((a, b) => {
      const aValue = a?.[sortConfig?.key];
      const bValue = b?.[sortConfig?.key];
      
      if (aValue < bValue) return sortConfig?.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig?.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [vehicles, sortConfig]);

  const handleBulkStatusUpdate = async (newStatus) => {
    try {
      setIsLoading(true);
      
      // Update all selected vehicles
      const updatePromises = selectedVehicles?.map(vehicleId =>
        vehicleService?.updateVehicle(vehicleId, { vehicle_status: newStatus })
      );
      
      await Promise.all(updatePromises);
      
      // Clear selection
      onSelectionChange([]);
      setShowBulkActions(false);
      
      // Refresh data if needed
      if (onVehicleUpdate) {
        selectedVehicles?.forEach(vehicleId => {
          onVehicleUpdate(vehicleId, { vehicle_status: newStatus });
        });
      }
      
    } catch (error) {
      console.error('Bulk update failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAllSelected = selectedVehicles?.length === vehicles?.length && vehicles?.length > 0;
  const isIndeterminate = selectedVehicles?.length > 0 && selectedVehicles?.length < vehicles?.length;

  // Filter configuration for vehicles
  const filterConfig = {
    vehicle_status: {
      type: 'select',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'retired', label: 'Retired' },
        { value: 'sold', label: 'Sold' }
      ]
    },
    make: {
      type: 'text',
      label: 'Make'
    },
    year: {
      type: 'numberrange',
      label: 'Year Range'
    },
    overdue_jobs: {
      type: 'checkbox',
      label: 'Has Overdue Jobs'
    }
  };

  return (
    <div className="space-y-4">
      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={onFilterChange}
        onClearFilters={() => onFilterChange({})}
        pageType="vehicles"
        filterConfig={filterConfig}
      />
      <div className="bg-card rounded-lg border border-border shadow-elevation-1 overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-foreground">
                Vehicle Inventory ({vehicles?.length})
              </h3>
              {selectedVehicles?.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedVehicles?.length} selected
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    iconName="Settings"
                    iconPosition="left"
                    className="text-sm"
                  >
                    Bulk Actions
                  </Button>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <ExportButton
                exportType="vehicles"
                filters={filters}
                selectedIds={selectedVehicles}
                onExportStart={() => setIsLoading(true)}
                onExportComplete={() => setIsLoading(false)}
                onExportError={() => setIsLoading(false)}
              />
              
              <Button
                variant="default"
                size="sm"
                iconName="Plus"
                iconPosition="left"
                onClick={() => navigate('/sales-transaction-interface')}
                className="text-sm"
              >
                Add Vehicle
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {showBulkActions && selectedVehicles?.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-800">
                  Bulk Actions for {selectedVehicles?.length} vehicle{selectedVehicles?.length !== 1 ? 's' : ''}:
                </span>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('maintenance')}
                    disabled={isLoading}
                    className="text-sm"
                  >
                    Mark as Maintenance
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('sold')}
                    disabled={isLoading}
                    className="text-sm"
                  >
                    Mark as Sold
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBulkActions(false)}
                    iconName="X"
                    className="text-sm"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e?.target?.checked)}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                  />
                </th>
                
                {[
                  { key: 'vin', label: 'VIN', sortable: true },
                  { key: 'year', label: 'Year', sortable: true },
                  { key: 'make', label: 'Make', sortable: true },
                  { key: 'model', label: 'Model', sortable: true },
                  { key: 'stock_number', label: 'Stock #', sortable: true },
                  { key: 'owner_name', label: 'Owner', sortable: true },
                  { key: 'aftermarketCount', label: 'Jobs', sortable: true },
                  ...(userRole === 'manager' ? [{ key: 'totalProfit', label: 'Profit', sortable: true }] : []),
                  { key: 'vehicle_status', label: 'Status', sortable: true },
                  { key: 'actions', label: 'Actions', sortable: false }
                ]?.map((column) => (
                  <th
                    key={column?.key}
                    className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                      column?.sortable ? 'cursor-pointer hover:text-foreground' : ''
                    }`}
                    onClick={column?.sortable ? () => handleSort(column?.key) : undefined}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column?.label}</span>
                      {column?.sortable && sortConfig?.key === column?.key && (
                        <Icon 
                          name={sortConfig?.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
                          size={14} 
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody className="bg-card divide-y divide-border">
              {sortedVehicles?.map((vehicle) => (
                <tr
                  key={vehicle?.id}
                  className={getRowClassName(vehicle)}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedVehicles?.includes(vehicle?.id)}
                      onChange={(e) => handleSelectVehicle(vehicle?.id, e?.target?.checked)}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.vin}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'vin', value)}
                      onCancel={() => {}}
                      validation={validators?.required}
                      cellClassName="font-mono text-sm"
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.year}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'year', parseInt(value))}
                      onCancel={() => {}}
                      type="number"
                      validation={validators?.combine(validators?.required, validators?.number)}
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.make}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'make', value)}
                      onCancel={() => {}}
                      validation={validators?.required}
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.model}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'model', value)}
                      onCancel={() => {}}
                      validation={validators?.required}
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.stock_number}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'stock_number', value)}
                      onCancel={() => {}}
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <InlineEditCell
                      value={vehicle?.owner_name}
                      onSave={(value) => handleCellUpdate(vehicle?.id, 'owner_name', value)}
                      onCancel={() => {}}
                      disabled={isLoading || userRole === 'staff'}
                    />
                  </td>
                  
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {vehicle?.aftermarketCount || 0}
                      </span>
                      {(vehicle?.aftermarketCount || 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRowClick(vehicle?.id)}
                          className="w-6 h-6 hover:bg-muted"
                        >
                          <Icon name="Eye" size={12} />
                        </Button>
                      )}
                    </div>
                  </td>
                  
                  {userRole === 'manager' && (
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${
                        (vehicle?.totalProfit || 0) >= 0 ? 'text-success' : 'text-error'
                      }`}>
                        {formatters?.currency(vehicle?.totalProfit || 0)}
                      </span>
                    </td>
                  )}
                  
                  <td className="px-4 py-4">
                    {getStatusBadge(vehicle?.vehicle_status, vehicle?.id)}
                  </td>
                  
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRowClick(vehicle?.id)}
                        className="w-8 h-8 hover:bg-muted"
                        aria-label="View details"
                      >
                        <Icon name="Eye" size={16} />
                      </Button>
                      
                      {userRole !== 'staff' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => console.log('Edit vehicle', vehicle?.id)}
                          className="w-8 h-8 hover:bg-muted"
                          aria-label="Edit vehicle"
                        >
                          <Icon name="Edit" size={16} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {vehicles?.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Icon name="Car" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No vehicles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || Object.values(filters || {})?.some(f => f) 
                ? 'Try adjusting your search or filters' : 'Start by adding your first vehicle to the system'
              }
            </p>
            <Button
              variant="default"
              iconName="Plus"
              iconPosition="left"
              onClick={() => navigate('/sales-transaction-interface')}
              className="text-sm"
            >
              Add Vehicle
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedVehicleTable;