import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Checkbox from '../../../components/ui/Checkbox';

const VendorListTable = ({ 
  vendors, 
  selectedVendor, 
  onVendorSelect, 
  onVendorUpdate, 
  onBulkAction,
  userRole = 'staff'
}) => {
  const [editingVendor, setEditingVendor] = useState(null);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [filters, setFilters] = useState({
    search: '',
    specialty: '',
    status: '',
    performanceThreshold: ''
  });

  const specialtyOptions = [
    { value: '', label: 'All Specialties' },
    { value: 'tint', label: 'Window Tinting' },
    { value: 'protection', label: 'Paint Protection' },
    { value: 'wraps', label: 'Vehicle Wraps' },
    { value: 'windshield', label: 'Windshield Protection' },
    { value: 'detailing', label: 'Detailing Services' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'unavailable', label: 'Unavailable' }
  ];

  const performanceOptions = [
    { value: '', label: 'All Performance' },
    { value: '90', label: '90%+ Completion Rate' },
    { value: '80', label: '80%+ Completion Rate' },
    { value: '70', label: '70%+ Completion Rate' }
  ];

  const filteredAndSortedVendors = useMemo(() => {
    let filtered = vendors?.filter(vendor => {
      const matchesSearch = vendor?.name?.toLowerCase()?.includes(filters?.search?.toLowerCase()) ||
                           vendor?.contact?.email?.toLowerCase()?.includes(filters?.search?.toLowerCase());
      const matchesSpecialty = !filters?.specialty || vendor?.specialties?.includes(filters?.specialty);
      const matchesStatus = !filters?.status || vendor?.status === filters?.status;
      const matchesPerformance = !filters?.performanceThreshold || 
                                vendor?.completionRate >= parseInt(filters?.performanceThreshold);
      
      return matchesSearch && matchesSpecialty && matchesStatus && matchesPerformance;
    });

    filtered?.sort((a, b) => {
      const aValue = a?.[sortConfig?.key];
      const bValue = b?.[sortConfig?.key];
      
      if (sortConfig?.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return filtered;
  }, [vendors, filters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEdit = (vendor) => {
    setEditingVendor({ ...vendor });
  };

  const handleSaveEdit = () => {
    onVendorUpdate(editingVendor);
    setEditingVendor(null);
  };

  const handleCancelEdit = () => {
    setEditingVendor(null);
  };

  const handleSelectVendor = (vendorId, checked) => {
    if (checked) {
      setSelectedVendors(prev => [...prev, vendorId]);
    } else {
      setSelectedVendors(prev => prev?.filter(id => id !== vendorId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedVendors(filteredAndSortedVendors?.map(v => v?.id));
    } else {
      setSelectedVendors([]);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'text-success bg-success/10';
      case 'busy': return 'text-warning bg-warning/10';
      case 'unavailable': return 'text-error bg-error/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getPerformanceColor = (rate) => {
    if (rate >= 90) return 'text-success';
    if (rate >= 80) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-1">
      {/* Header with Filters */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Vendor Directory</h2>
            <p className="text-sm text-muted-foreground">
              {filteredAndSortedVendors?.length} vendors found
            </p>
          </div>
          
          {userRole === 'manager' && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                iconName="Download"
                iconPosition="left"
                onClick={() => onBulkAction('export', selectedVendors)}
              >
                Export
              </Button>
              <Button
                variant="default"
                iconName="Plus"
                iconPosition="left"
                onClick={() => onBulkAction('create')}
              >
                Add Vendor
              </Button>
            </div>
          )}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            type="search"
            placeholder="Search vendors..."
            value={filters?.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e?.target?.value }))}
          />
          
          <Select
            placeholder="Filter by specialty"
            options={specialtyOptions}
            value={filters?.specialty}
            onChange={(value) => setFilters(prev => ({ ...prev, specialty: value }))}
          />
          
          <Select
            placeholder="Filter by status"
            options={statusOptions}
            value={filters?.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          />
          
          <Select
            placeholder="Performance threshold"
            options={performanceOptions}
            value={filters?.performanceThreshold}
            onChange={(value) => setFilters(prev => ({ ...prev, performanceThreshold: value }))}
          />
        </div>

        {/* Bulk Actions */}
        {selectedVendors?.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
            <span className="text-sm text-foreground">
              {selectedVendors?.length} vendor{selectedVendors?.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                iconName="MessageSquare"
                iconPosition="left"
                onClick={() => onBulkAction('sms', selectedVendors)}
              >
                Send SMS
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="Users"
                iconPosition="left"
                onClick={() => onBulkAction('reassign', selectedVendors)}
              >
                Reassign Jobs
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  id="select-all-vendors"
                  name="selectAll"
                  label=""
                  description=""
                  checked={selectedVendors?.length === filteredAndSortedVendors?.length && filteredAndSortedVendors?.length > 0}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="text-left p-4 font-medium text-foreground">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center space-x-1 hover:text-primary transition-colors"
                >
                  <span>Vendor Name</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-foreground">Contact Info</th>
              <th className="text-left p-4 font-medium text-foreground">Specialties</th>
              <th className="text-left p-4 font-medium text-foreground">
                <button
                  onClick={() => handleSort('activeJobs')}
                  className="flex items-center space-x-1 hover:text-primary transition-colors"
                >
                  <span>Active Jobs</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-foreground">
                <button
                  onClick={() => handleSort('completionRate')}
                  className="flex items-center space-x-1 hover:text-primary transition-colors"
                >
                  <span>Performance</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-foreground">Status</th>
              <th className="text-left p-4 font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedVendors?.map((vendor) => (
              <tr
                key={vendor?.id}
                className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${
                  selectedVendor?.id === vendor?.id ? 'bg-primary/5 border-primary/20' : ''
                }`}
                onClick={() => onVendorSelect(vendor)}
              >
                <td className="p-4" onClick={(e) => e?.stopPropagation()}>
                  <Checkbox
                    id={`vendor-${vendor?.id}`}
                    name={`vendor-${vendor?.id}`}
                    label=""
                    description=""
                    checked={selectedVendors?.includes(vendor?.id)}
                    onChange={(e) => handleSelectVendor(vendor?.id, e?.target?.checked)}
                  />
                </td>
                
                <td className="p-4">
                  {editingVendor?.id === vendor?.id ? (
                    <Input
                      type="text"
                      value={editingVendor?.name}
                      onChange={(e) => setEditingVendor(prev => ({ ...prev, name: e?.target?.value }))}
                      className="w-full"
                      onClick={(e) => e?.stopPropagation()}
                    />
                  ) : (
                    <div>
                      <div className="font-medium text-foreground">{vendor?.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {vendor?.id}</div>
                    </div>
                  )}
                </td>
                
                <td className="p-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Icon name="Phone" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{vendor?.contact?.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="Mail" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{vendor?.contact?.email}</span>
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {vendor?.specialties?.slice(0, 2)?.map((specialty) => (
                      <span
                        key={specialty}
                        className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                    {vendor?.specialties?.length > 2 && (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                        +{vendor?.specialties?.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-foreground">{vendor?.activeJobs}</span>
                    {vendor?.overdueJobs > 0 && (
                      <span className="px-2 py-1 text-xs bg-error text-error-foreground rounded-full">
                        {vendor?.overdueJobs} overdue
                      </span>
                    )}
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="space-y-1">
                    <div className={`font-medium ${getPerformanceColor(vendor?.completionRate)}`}>
                      {vendor?.completionRate}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg: {vendor?.avgTurnaroundTime}d
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(vendor?.status)}`}>
                    {vendor?.status}
                  </span>
                </td>
                
                <td className="p-4" onClick={(e) => e?.stopPropagation()}>
                  <div className="flex items-center space-x-1">
                    {editingVendor?.id === vendor?.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          iconName="Check"
                          onClick={handleSaveEdit}
                          className="w-8 h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          iconName="X"
                          onClick={handleCancelEdit}
                          className="w-8 h-8"
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          iconName="Edit"
                          onClick={() => handleEdit(vendor)}
                          className="w-8 h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          iconName="MessageSquare"
                          onClick={() => onBulkAction('sms', [vendor?.id])}
                          className="w-8 h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          iconName="MoreHorizontal"
                          className="w-8 h-8"
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredAndSortedVendors?.length === 0 && (
        <div className="p-12 text-center">
          <Icon name="Users" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No vendors found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters or search criteria
          </p>
          {userRole === 'manager' && (
            <Button
              variant="default"
              iconName="Plus"
              iconPosition="left"
              onClick={() => onBulkAction('create')}
            >
              Add First Vendor
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorListTable;