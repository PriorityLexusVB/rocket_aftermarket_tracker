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

  // handleFormChange function
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // resetForm function
  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'staff',
      vendor_id: '',
      password: ''
    });
    setShowCreateForm(false);
  };

  // authService replacement
  const authService = {
    createUser: async (userData) => {
      // Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabase?.auth?.signUp({
        email: userData?.email,
        password: userData?.password,
      });

      if (authError) throw authError;

      // Create user profile
      const { data: profile, error: profileError } = await supabase?.from('user_profiles')?.insert([{
          id: authUser?.user?.id,
          email: userData?.email,
          full_name: userData?.full_name,
          role: userData?.role,
          vendor_id: userData?.vendor_id,
          phone: userData?.phone,
          is_active: userData?.is_active !== false
        }])?.select()?.single();

      if (profileError) throw profileError;

      return profile;
    }
  };

  // logger replacement
  const logger = {
    logSuccess: async (action, type, id, message, data) => {
      console.log(`Success: ${action}`, { type, id, message, data });
    },
    logError: async (error, data) => {
      console.error('Error logged:', error, data);
    }
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!formData?.email || !formData?.password) {
      alert('Email and password are required');
      return;
    }

    try {
      setLoading(true);
      
      // Create the user profile data
      const userData = {
        email: formData?.email,
        password: formData?.password,
        full_name: formData?.full_name,
        role: formData?.role,
        vendor_id: formData?.role === 'vendor' ? formData?.vendor_id : null,
        phone: formData?.phone,
        is_active: formData?.is_active
      };

      const newUser = await authService?.createUser(userData);
      setUsers(prev => [newUser, ...prev]);
      
      alert('User created successfully!');
      resetForm();
      
      await logger?.logSuccess(
        'user_created',
        'USER',
        newUser?.id,
        `New user created: ${newUser?.email}`,
        { userData: newUser }
      );
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`Error creating user: ${error?.message}`);
      
      await logger?.logError(
        error,
        { 
          action: 'user_create_error',
          formData
        }
      );
    } finally {
      setLoading(false);
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

  // Enhanced form validation
  const isFormValid = () => {
    return formData?.email?.trim() && 
           formData?.full_name?.trim() && 
           formData?.password?.trim() &&
           formData?.password?.length >= 6 &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage system users with role-based access</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={!isAdmin}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <span className="mr-2">➕</span>
          Create New User
        </Button>
      </div>
      {/* Enhanced Error and Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center">
            <span className="mr-2 text-destructive">⚠️</span>
            <div className="text-destructive">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <span className="mr-2 text-green-600">✅</span>
            <div className="text-green-800">
              <strong>Success:</strong> {success}
            </div>
          </div>
        </div>
      )}
      {/* Enhanced Create User Form */}
      {showCreateForm && (
        <div className="mb-6 p-6 bg-muted/50 border border-border rounded-lg">
          <h3 className="text-lg font-medium text-foreground mb-4">Create New User</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData?.email || ''}
                onChange={(e) => handleFormChange('email', e?.target?.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="user@example.com"
                required
                disabled={creating}
              />
              {formData?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email) && (
                <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData?.full_name || ''}
                onChange={(e) => handleFormChange('full_name', e?.target?.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="John Doe"
                required
                disabled={creating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Role *
              </label>
              <select
                value={formData?.role || 'staff'}
                onChange={(e) => handleFormChange('role', e?.target?.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                disabled={creating}
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>

            {formData?.role === 'vendor' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Associated Vendor
                </label>
                <select
                  value={formData?.vendor_id || ''}
                  onChange={(e) => handleFormChange('vendor_id', e?.target?.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={creating}
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
              <label className="block text-sm font-medium text-foreground mb-2">
                Password *
              </label>
              <input
                type="password"
                value={formData?.password || ''}
                onChange={(e) => handleFormChange('password', e?.target?.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                disabled={creating}
              />
              {formData?.password && formData?.password?.length < 6 && (
                <p className="text-xs text-destructive mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            <div className="md:col-span-2 flex items-center space-x-4 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={!isFormValid() || loading}
                onClick={handleCreateUser}
              >
                {loading ? 'Creating...' : 'Create User'}
              </Button>
              <Button
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
                        ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
                          ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
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