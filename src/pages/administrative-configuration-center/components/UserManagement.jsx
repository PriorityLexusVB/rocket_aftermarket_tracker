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
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'staff',
    vendor_id: '',
    password: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load users with vendor information
      const { data: usersData, error: usersError } = await supabase
        ?.from('user_profiles')
        ?.select(`
          *,
          vendor:vendors(id, name)
        `)
        ?.order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Load vendors for the dropdown
      const { data: vendorsData, error: vendorsError } = await supabase
        ?.from('vendors')
        ?.select('id, name, is_active')
        ?.eq('is_active', true)
        ?.order('name');

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

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!isAdmin) return;

    try {
      setCreating(true);
      setError(null);

      // Validate required fields
      if (!formData?.email || !formData?.full_name || !formData?.password) {
        setError('Email, full name, and password are required');
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase?.auth?.signUp({
        email: formData?.email,
        password: formData?.password,
        options: {
          data: {
            full_name: formData?.full_name,
            role: formData?.role
          }
        }
      });

      if (authError) throw authError;

      if (authData?.user) {
        // Create user profile
        const profileData = {
          id: authData?.user?.id,
          email: formData?.email,
          full_name: formData?.full_name,
          role: formData?.role,
          is_active: true
        };

        // Add vendor_id if vendor role is selected
        if (formData?.role === 'vendor' && formData?.vendor_id) {
          profileData.vendor_id = formData?.vendor_id;
        }

        const { error: profileError } = await supabase
          ?.from('user_profiles')
          ?.insert(profileData);

        if (profileError) throw profileError;

        setSuccess(`User ${formData?.email} created successfully`);
        setFormData({
          email: '',
          full_name: '',
          role: 'staff',
          vendor_id: '',
          password: ''
        });
        setShowCreateForm(false);
        loadData();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({ is_active: !currentStatus })
        ?.eq('id', userId);

      if (error) throw error;

      setSuccess(`User status updated successfully`);
      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <p className="text-gray-600">Create and manage system users with role-based access</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Create New User
        </Button>
      </div>
      {/* Error and Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex">
            <div className="text-green-800">
              <strong>Success:</strong> {success}
            </div>
          </div>
        </div>
      )}
      {/* Create User Form */}
      {showCreateForm && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Create New User</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData?.email}
                onChange={(e) => handleFormChange('email', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData?.full_name}
                onChange={(e) => handleFormChange('full_name', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={formData?.role}
                onChange={(e) => handleFormChange('role', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>

            {formData?.role === 'vendor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Associated Vendor
                </label>
                <select
                  value={formData?.vendor_id}
                  onChange={(e) => handleFormChange('vendor_id', e?.target?.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a vendor...</option>
                  {vendors?.map(vendor => (
                    <option key={vendor?.id} value={vendor?.id}>
                      {vendor?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                value={formData?.password}
                onChange={(e) => handleFormChange('password', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
            </div>

            <div className="md:col-span-2 flex items-center space-x-4">
              <Button
                type="submit"
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
              >
                {creating ? 'Creating...' : 'Create User'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
      {/* Demo Credentials Section */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-medium text-blue-800 mb-2">Demo Credentials</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-blue-700">Admin:</strong> admin@rocketaftermarket.com / admin123
          </div>
          <div>
            <strong className="text-blue-700">Manager:</strong> manager@rocketaftermarket.com / manager123
          </div>
          <div>
            <strong className="text-blue-700">Vendor:</strong> vendor@premiumauto.com / vendor123
          </div>
          <div>
            <strong className="text-blue-700">Vendor Staff:</strong> vendorstaff@premiumauto.com / vendor456
          </div>
        </div>
      </div>
      {/* Users List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">System Users ({users?.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user?.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user?.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                      user?.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user?.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      user?.role === 'vendor'? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user?.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user?.vendor?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                      user?.is_active 
                        ? 'bg-green-100 text-green-800' :'bg-red-100 text-red-800'
                    }`}>
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(user?.created_at)?.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleToggleUserStatus(user?.id, user?.is_active)}
                      className={`${
                        user?.is_active
                          ? 'text-red-600 hover:text-red-900' :'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {user?.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users?.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No users found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;