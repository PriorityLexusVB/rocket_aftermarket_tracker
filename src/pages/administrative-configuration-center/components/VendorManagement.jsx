import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLogger } from '../../../hooks/useLogger';
import UIButton from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import vendorService from '../../../services/vendorService';

const VendorManagement = () => {
  const { userProfile } = useAuth();
  const logger = useLogger();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    specialty: '',
    rating: '',
    notes: '',
    is_active: true
  });

  const specialties = [
    'Engine Components',
    'Braking Systems',
    'Suspension',
    'Electrical',
    'Body & Paint',
    'Exhaust Systems',
    'Transmission',
    'Accessories',
    'Tires & Wheels',
    'Performance Parts'
  ];

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const vendorData = await vendorService?.getAllVendors();
      setVendors(vendorData);
      
      await logger?.logInfo(
        'vendors_loaded',
        'VENDOR',
        'list',
        `Loaded ${vendorData?.length} vendors for management`,
        { vendorCount: vendorData?.length }
      );
    } catch (error) {
      console.error('Error loading vendors:', error);
      await logger?.logError(
        error,
        { 
          action: 'vendor_load_error',
          context: 'vendor-management' 
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    try {
      setLoading(true);
      
      if (formMode === 'add') {
        const newVendor = await vendorService?.createVendor(formData);
        setVendors(prev => [newVendor, ...prev]);
        
        await logger?.logSuccess(
          'vendor_added',
          'VENDOR',
          newVendor?.id,
          `New vendor added: ${newVendor?.name}`,
          { vendorData: newVendor }
        );
        
        // Show success feedback
        alert('Vendor added successfully!');
      } else {
        const updatedVendor = await vendorService?.updateVendor(selectedVendor?.id, formData);
        setVendors(prev => prev?.map(v => v?.id === updatedVendor?.id ? updatedVendor : v));
        
        await logger?.logSuccess(
          'vendor_updated',
          'VENDOR',
          updatedVendor?.id,
          `Vendor updated: ${updatedVendor?.name}`,
          { vendorData: updatedVendor }
        );
        
        // Show success feedback
        alert('Vendor updated successfully!');
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert(`Error ${formMode === 'add' ? 'adding' : 'updating'} vendor: ${error?.message}`);
      
      await logger?.logError(
        error,
        { 
          action: `vendor_${formMode}_error`,
          entityId: formMode === 'edit' ? selectedVendor?.id : 'new',
          formData 
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditVendor = (vendor) => {
    console.log('Edit button clicked for vendor:', vendor?.name);
    
    try {
      setSelectedVendor(vendor);
      setFormData({
        name: vendor?.name || '',
        contact_person: vendor?.contact_person || '',
        email: vendor?.email || '',
        phone: vendor?.phone || '',
        address: vendor?.address || '',
        specialty: vendor?.specialty || '',
        rating: vendor?.rating || '',
        notes: vendor?.notes || '',
        is_active: vendor?.is_active !== undefined ? vendor?.is_active : true
      });
      setFormMode('edit');
      setShowForm(true);
    } catch (error) {
      console.error('Error in handleEditVendor:', error);
      alert('Error opening vendor for editing');
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    console.log('Delete button clicked for vendor ID:', vendorId);
    
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    
    try {
      setLoading(true);
      await vendorService?.deleteVendor(vendorId);
      setVendors(prev => prev?.filter(v => v?.id !== vendorId));
      
      alert('Vendor deleted successfully!');
      
      await logger?.logSuccess(
        'vendor_deleted',
        'VENDOR',
        vendorId,
        `Vendor deleted successfully`,
        { vendorId }
      );
    } catch (error) {
      console.error('Error deleting vendor:', error);
      alert(`Error deleting vendor: ${error?.message}`);
      
      await logger?.logError(
        error,
        { 
          action: 'vendor_delete_error',
          entityId: vendorId 
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewVendor = () => {
    console.log('Add New Vendor button clicked');
    
    try {
      setFormMode('add');
      setSelectedVendor(null);
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        specialty: '',
        rating: '',
        notes: '',
        is_active: true
      });
      setShowForm(true);
    } catch (error) {
      console.error('Error in handleAddNewVendor:', error);
      alert('Error opening add vendor form');
    }
  };

  const handleBulkToggleActive = async (active) => {
    const selectedVendors = vendors?.filter(v => v?.selected);
    if (selectedVendors?.length === 0) return;

    try {
      const vendorIds = selectedVendors?.map(v => v?.id);
      await vendorService?.bulkUpdateVendors(vendorIds, { is_active: active });
      
      setVendors(prev => prev?.map(v => 
        vendorIds?.includes(v?.id) ? { ...v, is_active: active, selected: false } : v
      ));

      await logger?.logSuccess(
        'vendor_bulk_updated',
        'VENDOR',
        'bulk',
        `Bulk ${active ? 'activated' : 'deactivated'} ${selectedVendors?.length} vendors`,
        { vendorIds, active }
      );
    } catch (error) {
      console.error('Error bulk updating vendors:', error);
      await logger?.logError(
        error,
        { 
          action: 'vendor_bulk_update_error',
          context: { active, selectedCount: selectedVendors?.length }
        }
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      specialty: '',
      rating: '',
      notes: '',
      is_active: true
    });
    setSelectedVendor(null);
    setShowForm(false);
    setFormMode('add');
  };

  const toggleVendorSelection = (vendorId) => {
    setVendors(prev => prev?.map(v => 
      v?.id === vendorId ? { ...v, selected: !v?.selected } : v
    ));
  };

  const filteredVendors = vendors?.filter(vendor => {
    const matchesSearch = vendor?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         vendor?.contact_person?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         vendor?.email?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    
    const matchesSpecialty = filterSpecialty === '' || vendor?.specialty === filterSpecialty;
    
    return matchesSearch && matchesSpecialty;
  });

  const selectedCount = vendors?.filter(v => v?.selected)?.length || 0;

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading vendors...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Vendor List (60%) */}
      <div className="w-3/5 p-6 border-r border-gray-200">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e?.target?.value)}
              className="w-64"
            />
            
            <Select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e?.target?.value)}
              className="w-48"
            >
              <option value="">All Specialties</option>
              {specialties?.map(specialty => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </Select>
          </div>

          <UIButton
            onClick={handleAddNewVendor}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Add New Vendor'}
          </UIButton>
        </div>

        {/* Bulk Actions */}
        {selectedCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedCount} vendor{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div className="space-x-2">
              <UIButton
                onClick={() => handleBulkToggleActive(true)}
                className="text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                Activate
              </UIButton>
              <UIButton
                onClick={() => handleBulkToggleActive(false)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                Deactivate
              </UIButton>
            </div>
          </div>
        )}

        {/* Vendor Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const checked = e?.target?.checked;
                        setVendors(prev => prev?.map(v => ({ ...v, selected: checked })));
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Specialty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors?.map((vendor) => (
                  <tr key={vendor?.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={vendor?.selected || false}
                        onChange={() => toggleVendorSelection(vendor?.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{vendor?.name}</div>
                        <div className="text-sm text-gray-500">{vendor?.contact_person}</div>
                        {vendor?.rating && (
                          <div className="text-xs text-yellow-600">
                            {'⭐'?.repeat(Math?.floor(vendor?.rating))} ({vendor?.rating})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{vendor?.email}</div>
                      <div className="text-sm text-gray-500">{vendor?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {vendor?.specialty || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        vendor?.is_active 
                          ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {vendor?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <UIButton
                        onClick={(e) => {
                          e?.preventDefault();
                          e?.stopPropagation();
                          handleEditVendor(vendor);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1"
                        disabled={loading}
                        type="button"
                      >
                        Edit
                      </UIButton>
                      <UIButton
                        onClick={(e) => {
                          e?.preventDefault();
                          e?.stopPropagation();
                          handleDeleteVendor(vendor?.id);
                        }}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1"
                        disabled={loading}
                        type="button"
                      >
                        Delete
                      </UIButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredVendors?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No vendors found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Vendor Form (40%) */}
      <div className="w-2/5 p-6">
        {showForm ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formMode === 'add' ? 'Add New Vendor' : 'Edit Vendor'}
              </h3>
              <UIButton
                onClick={resetForm}
                className="text-xs bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancel
              </UIButton>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <Input
                  value={formData?.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e?.target?.value }))}
                  required
                  placeholder="Enter vendor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <Input
                  value={formData?.contact_person}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e?.target?.value }))}
                  placeholder="Enter contact person name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData?.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e?.target?.value }))}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  value={formData?.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e?.target?.value }))}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={formData?.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e?.target?.value }))}
                  placeholder="Enter address"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specialty
                </label>
                <Select
                  value={formData?.specialty}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialty: e?.target?.value }))}
                >
                  <option value="">Select specialty</option>
                  {specialties?.map(specialty => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rating (1-5)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={formData?.rating}
                  onChange={(e) => setFormData(prev => ({ ...prev, rating: e?.target?.value }))}
                  placeholder="Enter rating"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData?.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e?.target?.value }))}
                  placeholder="Enter notes"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData?.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e?.target?.checked }))}
                  className="rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Active Vendor
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <UIButton
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (formMode === 'add' ? 'Add Vendor' : 'Update Vendor')}
                </UIButton>
                <UIButton
                  type="button"
                  onClick={(e) => {
                    e?.preventDefault();
                    e?.stopPropagation();
                    resetForm();
                  }}
                  className="px-6 bg-gray-500 hover:bg-gray-600 text-white"
                  disabled={loading}
                >
                  Cancel
                </UIButton>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-4xl mb-4">👥</div>
            <p>Select a vendor to edit or click &quot;Add New Vendor&quot; to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorManagement;