import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/ui/Button';

const UserManagement = () => {
  const { userProfile, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Simplified form state - starts minimal
  const [formData, setFormData] = useState({
    full_name: '',
    job_title: '', // Stores in department field
    needs_login: false, // Checkbox that reveals more fields
    // Login fields only visible when needed
    email: '',
    password: '',
    role: 'staff',
    vendor_id: '',
    phone: ''
  });

  // Updated job title options with "Delivery Coordinator"
  const jobTitleOptions = [
    'Sales Person',
    'Delivery Coordinator', // Changed from BDC Manager
    'Finance Manager',
    'Service Advisor',
    'Technician',
    'Parts Manager',
    'General Manager',
    'Assistant Manager',
    'Receptionist',
    'Quality Inspector',
    'Detailer'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load users with vendor information
      const { data: usersData, error: usersError } = await supabase?.from('user_profiles')?.select(`
          *,
          vendor:vendors(id, name)
        `)?.order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Load vendors for the dropdown
      const { data: vendorsData, error: vendorsError } = await supabase?.from('vendors')?.select('id, name, is_active')?.eq('is_active', true)?.order('name');

      if (vendorsError) throw vendorsError;

      setUsers(usersData || []);
      setVendors(vendorsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load users and vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      job_title: '',
      needs_login: false,
      email: '',
      password: '',
      role: 'staff',
      vendor_id: '',
      phone: ''
    });
    setShowCreateForm(false);
    setError(null);
    setSuccess(null);
  };

  const handleCreateUser = async (e) => {
    e && e?.preventDefault();
    e && e?.stopPropagation();
    
    if (!formData?.full_name || !formData?.full_name?.trim()) {
      setError('Name is required');
      return;
    }

    // Only require login fields if needs_login is checked
    if (formData?.needs_login) {
      if (!formData?.email || !formData?.email?.trim()) {
        setError('Email is required for login access');
        return;
      }
      if (!formData?.password || !formData?.password?.trim() || formData?.password?.length < 6) {
        setError('Password must be at least 6 characters for login access');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    try {
      setCreating(true);
      setError(null);
      
      if (formData?.needs_login) {
        // Create user with authentication
        const { data: authUser, error: authError } = await supabase?.auth?.signUp({
          email: formData?.email,
          password: formData?.password,
        });

        if (authError) throw authError;

        // Create user profile with login access
        const { data: profile, error: profileError } = await supabase?.from('user_profiles')?.insert([{
            id: authUser?.user?.id,
            email: formData?.email,
            full_name: formData?.full_name,
            role: formData?.role,
            vendor_id: formData?.role === 'vendor' ? formData?.vendor_id : null,
            phone: formData?.phone,
            department: formData?.job_title,
            is_active: true
          }])?.select()?.single();

        if (profileError) throw profileError;

        setUsers(prev => [profile, ...prev]);
        setSuccess(`${formData?.full_name} created with login access!`);
      } else {
        // Create staff-only record (no authentication needed)
        const { data: staffRecord, error: staffError } = await supabase?.from('user_profiles')?.insert([{
            id: crypto.randomUUID(),
            full_name: formData?.full_name,
            email: null, // No email for staff-only
            phone: formData?.phone || null,
            role: 'staff',
            department: formData?.job_title,
            is_active: true,
            vendor_id: null
          }])?.select()?.single();

        if (staffError) throw staffError;

        setUsers(prev => [staffRecord, ...prev]);
        setSuccess(`${formData?.full_name} added to staff!`);
      }
      
      resetForm();
      
    } catch (error) {
      console.error('Error creating staff member:', error);
      setError(`Error: ${error?.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase?.from('user_profiles')?.update({ is_active: !currentStatus })?.eq('id', userId);

      if (error) throw error;

      setSuccess(`User status updated successfully`);
      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 text-lg font-medium">Access Denied</div>
        <p className="text-gray-600 mt-2">Only administrators can manage users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {/* Header with User/Roles info moved here */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Staff Management &amp; User Access</h2>
          <p className="text-sm text-muted-foreground">Manage staff members - add name only or create login access as needed</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={!isAdmin}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <span className="mr-2">➕</span>
          Add Staff
        </Button>
      </div>
      
      {/* Error and Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 text-sm">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 text-sm">
            <strong>Success:</strong> {success}
          </div>
        </div>
      )}

      {/* Simplified Create Form - Starts Minimal */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-medium mb-4">Add Staff Member</h3>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            
            {/* Name and Job Title - Always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData?.full_name || ''}
                  onChange={(e) => handleFormChange('full_name', e?.target?.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                  required
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <select
                  value={formData?.job_title || ''}
                  onChange={(e) => handleFormChange('job_title', e?.target?.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={creating}
                >
                  <option value="">Select job title</option>
                  {jobTitleOptions?.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Login Access Checkbox */}
            <div className="border-l-4 border-blue-500 bg-blue-50 p-3">
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="needs_login"
                  checked={formData?.needs_login}
                  onChange={(e) => handleFormChange('needs_login', e?.target?.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={creating}
                />
                <label htmlFor="needs_login" className="text-sm font-medium text-gray-900 cursor-pointer">
                  This person needs login access to the system
                </label>
              </div>
            </div>

            {/* Login Fields - Only visible when checkbox is checked */}
            {formData?.needs_login && (
              <div className="bg-white border border-blue-200 rounded-lg p-4 mt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">User Access Setup</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData?.email || ''}
                      onChange={(e) => handleFormChange('email', e?.target?.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="user@company.com"
                      required={formData?.needs_login}
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={formData?.password || ''}
                      onChange={(e) => handleFormChange('password', e?.target?.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Minimum 6 characters"
                      required={formData?.needs_login}
                      minLength={6}
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      System Role
                    </label>
                    <select
                      value={formData?.role || 'staff'}
                      onChange={(e) => handleFormChange('role', e?.target?.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={creating}
                    >
                      <option value="staff">Staff Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>

                  {formData?.role === 'vendor' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vendor
                      </label>
                      <select
                        value={formData?.vendor_id || ''}
                        onChange={(e) => handleFormChange('vendor_id', e?.target?.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={creating}
                      >
                        <option value="">Select vendor...</option>
                        {vendors?.map(vendor => (
                          <option key={vendor?.id} value={vendor?.id}>
                            {vendor?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                type="button"
                onClick={resetForm}
                disabled={creating}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleCreateUser}
                disabled={creating || !formData?.full_name || !formData?.full_name?.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {creating ? 'Adding...' : 'Add Staff'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">All Staff ({users?.length})</h3>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search by name, phone, email..."
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e?.target?.value)}
                  className="pl-8 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name & Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Type
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
              {users?.filter(user => {
                if (!searchQuery) return true;
                const query = searchQuery?.toLowerCase();
                return user?.full_name?.toLowerCase()?.includes(query) ||
                       user?.email?.toLowerCase()?.includes(query) ||
                       user?.phone?.toLowerCase()?.includes(query) ||
                       user?.department?.toLowerCase()?.includes(query);
              })?.map((user) => (
                <tr key={user?.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.full_name}
                    </div>
                    {user?.email && (
                      <div className="text-sm text-gray-500">
                        {user?.email}
                      </div>
                    )}
                    {user?.phone && (
                      <div className="text-sm text-blue-600">
                        📞 {user?.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user?.department || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user?.email && user?.role ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Can Login
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        Name Only
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user?.is_active 
                        ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user?.email && user?.role && (
                      <button
                        onClick={() => handleToggleUserStatus(user?.id, user?.is_active)}
                        className={`${
                          user?.is_active
                            ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        disabled={!isAdmin}
                      >
                        {user?.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users?.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No staff members found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;