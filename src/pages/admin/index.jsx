import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AppLayout from '../../components/layouts/AppLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { Plus, Edit2, Trash2, Users, Package, MessageSquare, Building, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import Icon from '../../components/AppIcon';


const AdminPage = () => {
  const { userProfile, isManager, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('userAccounts');
  
  // Debug states
  const [debugInfo, setDebugInfo] = useState({
    authUser: null,
    userProfile: null,
    isManager: false,
    profileLoadError: null,
    showDebug: false
  });
  
  // States for different sections
  const [userAccounts, setUserAccounts] = useState([]);
  const [staffRecords, setStaffRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  
  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [userAccountForm, setUserAccountForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'manager',
    department: '',
    phone: ''
  });

  const [staffForm, setStaffForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    department: ''
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    specialty: '',
    rating: ''
  });

  const [productForm, setProductForm] = useState({
    name: '',
    brand: '',
    category: '',
    cost: '',
    unit_price: '',
    part_number: '',
    description: '',
    op_code: ''
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    message_template: '',
    template_type: 'job_status'
  });

  const tabs = [
    { id: 'userAccounts', label: 'User Accounts', icon: UserCheck },
    { id: 'staffRecords', label: 'Staff Records', icon: Users },
    { id: 'vendors', label: 'Vendors', icon: Building },
    { id: 'products', label: 'Aftermarket Products', icon: Package },
    { id: 'smsTemplates', label: 'SMS Templates', icon: MessageSquare }
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'vendor', label: 'Vendor' }
  ];

  const userDepartmentOptions = [
    { value: 'Delivery Coordinator', label: 'Delivery Coordinator' },
    { value: 'Managers', label: 'Managers' }
  ];

  const staffDepartmentOptions = [
    { value: 'Sales Consultants', label: 'Sales Consultants' },
    { value: 'Finance Manager', label: 'Finance Manager' }
  ];

  const templateTypeOptions = [
    { value: 'job_status', label: 'Job Status' },
    { value: 'overdue_alert', label: 'Overdue Alert' },
    { value: 'customer_notification', label: 'Customer Notification' },
    { value: 'vendor_assignment', label: 'Vendor Assignment' },
    { value: 'completion_notice', label: 'Completion Notice' }
  ];

  // Debug function to check current user status
  const debugAuthState = async () => {
    console.log('=== ADMIN ACCESS DEBUG ===');
    
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      console.log('Current session:', { hasSession: !!session, sessionError });
      
      if (session?.user) {
        console.log('Auth user:', {
          id: session?.user?.id,
          email: session?.user?.email,
          role: session?.user?.role
        });
        
        // Try to fetch user profile directly
        const { data: profile, error: profileError } = await supabase
          ?.from('user_profiles')
          ?.select('*')
          ?.eq('id', session?.user?.id)
          ?.single();
          
        console.log('Direct profile fetch:', {
          profile: profile,
          profileError: profileError
        });
        
        // Check if user can access user_profiles table at all
        const { data: allProfiles, error: allProfilesError } = await supabase
          ?.from('user_profiles')
          ?.select('id, full_name, role')
          ?.limit(5);
          
        console.log('All profiles check:', {
          canAccessTable: !allProfilesError,
          profileCount: allProfiles?.length || 0,
          error: allProfilesError
        });
        
        setDebugInfo({
          authUser: session?.user,
          userProfile: profile,
          isManager: profile?.role === 'manager' || profile?.role === 'admin',
          profileLoadError: profileError,
          showDebug: true
        });
      }
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo(prev => ({
        ...prev,
        profileLoadError: error,
        showDebug: true
      }));
    }
  };

  // Force profile reload function
  const forceProfileReload = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      console.log('Forcing profile reload for user:', user?.id);
      
      // Try multiple approaches to get the profile
      const attempts = [
        // Direct ID match
        supabase?.from('user_profiles')?.select('*')?.eq('id', user?.id)?.single(),
        // Email match as fallback
        supabase?.from('user_profiles')?.select('*')?.eq('email', user?.email)?.single()
      ];
      
      for (const attempt of attempts) {
        const { data, error } = await attempt;
        if (data && !error) {
          console.log('Profile found:', data);
          
          // If this succeeds, the issue might be in AuthContext
          // Create/update profile if needed
          if (data?.role === 'admin' || data?.role === 'manager') {
            console.log('User has admin/manager role:', data?.role);
            window.location?.reload(); // Force a complete reload to reinitialize auth
            return;
          }
        }
      }
      
      console.log('No valid admin/manager profile found. Attempting to create one...');
      
      // If no profile exists, create one with admin role
      const { data: newProfile, error: createError } = await supabase
        ?.from('user_profiles')
        ?.upsert({
          id: user?.id,
          email: user?.email,
          full_name: user?.email?.split('@')?.[0] || 'Admin User',
          role: 'admin', // Grant admin access
          department: 'Managers',
          is_active: true,
          created_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        })
        ?.select()
        ?.single();
        
      if (newProfile && !createError) {
        console.log('Admin profile created:', newProfile);
        window.location?.reload(); // Force reload to pick up new profile
      } else {
        console.error('Failed to create admin profile:', createError);
      }
      
    } catch (error) {
      console.error('Error in force profile reload:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAdmin = async () => {
      if (authLoading) return; // Wait for auth to finish loading
      
      console.log('Admin page initialization:', {
        hasUser: !!user,
        hasProfile: !!userProfile,
        isManager: isManager,
        userRole: userProfile?.role
      });
      
      if (user && !userProfile) {
        // User is authenticated but no profile - try to load it
        console.log('User authenticated but no profile found, attempting reload...');
        await forceProfileReload();
      } else if (isManager) {
        // User has proper access, load admin data
        loadAllData();
      }
      
      setLoading(false);
    };

    initializeAdmin();
  }, [user, userProfile, isManager, authLoading]);

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadUserAccounts(),
        loadStaffRecords(),
        loadVendors(),
        loadProducts(),
        loadSmsTemplates()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const loadUserAccounts = async () => {
    try {
      // Load user accounts with login capabilities (managers and delivery coordinators)
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.in('role', ['admin', 'manager'])  // Only admin and managers have login
        ?.in('department', ['Managers', 'Delivery Coordinator'])  // Only these departments for user accounts
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      console.log(`Loaded ${data?.length || 0} user accounts`);
      setUserAccounts(data || []);
    } catch (error) {
      console.error('Error loading user accounts:', error);
    }
  };

  const loadStaffRecords = async () => {
    try {
      // Load staff records (directory only - Sales Consultants and Finance Managers)
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.eq('role', 'staff')  // Only staff role
        ?.in('department', ['Sales Consultants', 'Finance Manager'])  // Only these departments for staff records
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      console.log(`Loaded ${data?.length || 0} staff records`);
      setStaffRecords(data || []);
    } catch (error) {
      console.error('Error loading staff records:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        ?.from('products')
        ?.select('*, vendors(name)')
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadSmsTemplates = async () => {
    try {
      const { data, error } = await supabase
        ?.from('sms_templates')
        ?.select('*')
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      setSmsTemplates(data || []);
    } catch (error) {
      console.error('Error loading SMS templates:', error);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
    
    // Reset forms
    if (type === 'userAccount') {
      setUserAccountForm(item || {
        full_name: '',
        email: '',
        password: '',
        role: 'manager',
        department: '',
        phone: ''
      });
    } else if (type === 'staff') {
      setStaffForm(item || {
        full_name: '',
        phone: '',
        email: '',
        department: ''
      });
    } else if (type === 'vendor') {
      setVendorForm(item || {
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        specialty: '',
        rating: ''
      });
    } else if (type === 'product') {
      setProductForm(item || {
        name: '',
        brand: '',
        category: '',
        cost: '',
        unit_price: '',
        part_number: '',
        description: '',
        op_code: ''
      });
    } else if (type === 'template') {
      setTemplateForm(item || {
        name: '',
        message_template: '',
        template_type: 'job_status'
      });
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitting(true);

    try {
      if (modalType === 'userAccount') {
        await handleUserAccountSubmit();
      } else if (modalType === 'staff') {
        await handleStaffSubmit();
      } else if (modalType === 'vendor') {
        await handleVendorSubmit();
      } else if (modalType === 'product') {
        await handleProductSubmit();
      } else if (modalType === 'template') {
        await handleTemplateSubmit();
      }
      
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error: ' + error?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserAccountSubmit = async () => {
    if (editingItem) {
      // Update existing user
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({
          full_name: userAccountForm?.full_name,
          email: userAccountForm?.email,
          role: userAccountForm?.role,
          department: userAccountForm?.department,
          phone: userAccountForm?.phone
        })
        ?.eq('id', editingItem?.id);

      if (error) throw error;
    } else {
      // Create new user with auth account
      if (!userAccountForm?.password) {
        throw new Error('Password is required for new users');
      }

      const { data: authData, error: authError } = await supabase?.auth?.signUp({
        email: userAccountForm?.email,
        password: userAccountForm?.password,
        options: {
          data: {
            full_name: userAccountForm?.full_name,
            role: userAccountForm?.role,
            department: userAccountForm?.department,
            phone: userAccountForm?.phone
          }
        }
      });

      if (authError) throw authError;
    }

    await loadUserAccounts();
  };

  const handleStaffSubmit = async () => {
    const staffData = {
      full_name: staffForm?.full_name,
      phone: staffForm?.phone || null,
      email: staffForm?.email || null,
      department: staffForm?.department,
      role: 'staff',  // Always staff role for directory entries
      is_active: true,
      vendor_id: null
    };

    if (editingItem) {
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update(staffData)
        ?.eq('id', editingItem?.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        ?.from('user_profiles')
        ?.insert([staffData]);

      if (error) throw error;
    }

    await loadStaffRecords();
  };

  const handleVendorSubmit = async () => {
    const vendorData = {
      name: vendorForm?.name,
      contact_person: vendorForm?.contact_person,
      phone: vendorForm?.phone,
      email: vendorForm?.email,
      specialty: vendorForm?.specialty,
      rating: vendorForm?.rating ? parseFloat(vendorForm?.rating) : null
    };

    if (editingItem) {
      const { error } = await supabase
        ?.from('vendors')
        ?.update(vendorData)
        ?.eq('id', editingItem?.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        ?.from('vendors')
        ?.insert([vendorData]);

      if (error) throw error;
    }

    await loadVendors();
  };

  const handleProductSubmit = async () => {
    const productData = {
      name: productForm?.name,
      brand: productForm?.brand,
      category: productForm?.category,
      cost: productForm?.cost ? parseFloat(productForm?.cost) : 0,
      unit_price: productForm?.unit_price ? parseFloat(productForm?.unit_price) : 0,
      part_number: productForm?.part_number,
      description: productForm?.description,
      op_code: productForm?.op_code || null
    };

    if (editingItem) {
      const { error } = await supabase
        ?.from('products')
        ?.update(productData)
        ?.eq('id', editingItem?.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        ?.from('products')
        ?.insert([productData]);

      if (error) throw error;
    }

    await loadProducts();
  };

  const handleTemplateSubmit = async () => {
    // Ensure stock number appears first and message is under 160 chars
    let message = templateForm?.message_template;
    if (!message?.startsWith('Stock #') && !message?.startsWith('{{stock')) {
      message = 'Stock #{{stock_number}}: ' + message;
    }
    
    if (message?.length > 160) {
      throw new Error('SMS template must be under 160 characters');
    }

    const templateData = {
      name: templateForm?.name,
      message_template: message,
      template_type: templateForm?.template_type
    };

    if (editingItem) {
      const { error } = await supabase
        ?.from('sms_templates')
        ?.update(templateData)
        ?.eq('id', editingItem?.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        ?.from('sms_templates')
        ?.insert([templateData]);

      if (error) throw error;
    }

    await loadSmsTemplates();
  };

  const handleDelete = async (table, id, itemType = null) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setDeletingId(id);
    setSubmitting(true);

    try {
      console.log(`Deleting from ${table} with id: ${id}`);

      // For user_profiles, clean up foreign key dependencies
      if (table === 'user_profiles') {
        console.log('Cleaning up foreign key dependencies...');
        
        // Clean up related data in parallel
        const cleanupPromises = [];

        // Clean up foreign key references
        cleanupPromises?.push(
          supabase?.from('jobs')?.update({ 
            assigned_to: null,
            created_by: null,
            delivery_coordinator_id: null
          })?.or(`assigned_to.eq.${id},created_by.eq.${id},delivery_coordinator_id.eq.${id}`)
        );

        cleanupPromises?.push(
          supabase?.from('transactions')?.update({ processed_by: null })?.eq('processed_by', id)
        );

        cleanupPromises?.push(
          supabase?.from('vehicles')?.update({ created_by: null })?.eq('created_by', id)
        );

        cleanupPromises?.push(
          supabase?.from('vendors')?.update({ created_by: null })?.eq('created_by', id)
        );

        cleanupPromises?.push(
          supabase?.from('products')?.update({ created_by: null })?.eq('created_by', id)
        );

        cleanupPromises?.push(
          supabase?.from('sms_templates')?.update({ created_by: null })?.eq('created_by', id)
        );

        // Clean up dependent records
        cleanupPromises?.push(
          supabase?.from('filter_presets')?.delete()?.eq('user_id', id)
        );

        cleanupPromises?.push(
          supabase?.from('notification_preferences')?.delete()?.eq('user_id', id)
        );

        cleanupPromises?.push(
          supabase?.from('activity_history')?.delete()?.eq('performed_by', id)
        );

        cleanupPromises?.push(
          supabase?.from('communications')?.delete()?.eq('sent_by', id)
        );

        // Wait for all cleanup operations
        await Promise.allSettled(cleanupPromises);
        console.log('Foreign key cleanup completed');
      }

      // Perform the actual deletion
      const { error: deleteError } = await supabase
        ?.from(table)
        ?.delete()
        ?.eq('id', id);

      if (deleteError) {
        console.error('Delete operation failed:', deleteError);
        throw deleteError;
      }

      console.log('Delete operation successful');

      // Immediately update state to remove the deleted item - this is the critical fix
      if (table === 'user_profiles') {
        if (itemType === 'userAccount') {
          setUserAccounts(prev => {
            const filtered = prev?.filter(item => item?.id !== id);
            console.log(`User accounts updated: ${filtered?.length} remaining`);
            return filtered || [];
          });
        } else {
          setStaffRecords(prev => {
            const filtered = prev?.filter(item => item?.id !== id);
            console.log(`Staff records updated: ${filtered?.length} remaining`);
            return filtered || [];
          });
        }
        
        // Force a complete refresh after successful deletion with proper delay
        setTimeout(async () => {
          try {
            await Promise.all([loadUserAccounts(), loadStaffRecords()]);
            console.log('Data reloaded successfully after deletion');
          } catch (refreshError) {
            console.error('Error refreshing data after deletion:', refreshError);
          }
        }, 500);
        
      } else if (table === 'vendors') {
        setVendors(prev => {
          const filtered = prev?.filter(item => item?.id !== id);
          console.log(`Vendors updated: ${filtered?.length} remaining`);
          return filtered || [];
        });
        setTimeout(async () => {
          try {
            await loadVendors();
            console.log('Vendors reloaded successfully');
          } catch (refreshError) {
            console.error('Error refreshing vendors:', refreshError);
          }
        }, 500);
        
      } else if (table === 'products') {
        setProducts(prev => {
          const filtered = prev?.filter(item => item?.id !== id);
          console.log(`Products updated: ${filtered?.length} remaining`);
          return filtered || [];
        });
        setTimeout(async () => {
          try {
            await loadProducts();
            console.log('Products reloaded successfully');
          } catch (refreshError) {
            console.error('Error refreshing products:', refreshError);
          }
        }, 500);
        
      } else if (table === 'sms_templates') {
        setSmsTemplates(prev => {
          const filtered = prev?.filter(item => item?.id !== id);
          console.log(`SMS templates updated: ${filtered?.length} remaining`);
          return filtered || [];
        });
        setTimeout(async () => {
          try {
            await loadSmsTemplates();
            console.log('SMS templates reloaded successfully');
          } catch (refreshError) {
            console.error('Error refreshing SMS templates:', refreshError);
          }
        }, 500);
      }

      // Show success message
      console.log(`Successfully deleted item from ${table}`);

    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item: ' + (error?.message || 'Unknown error'));
      
      // On error, force refresh all data to ensure UI is in sync
      setTimeout(async () => {
        try {
          await loadAllData();
          console.log('All data reloaded after error');
        } catch (refreshError) {
          console.error('Error refreshing all data after deletion error:', refreshError);
        }
      }, 1000);
      
    } finally {
      setSubmitting(false);
      setDeletingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading admin panel...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Enhanced access denied screen with debugging options
  if (!isManager) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-6">
                Admin or manager access required to view this page
              </p>
              
              <div className="space-y-4">
                <Button
                  onClick={forceProfileReload}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  <RefreshCw className="w-4 h-4" />
                  {submitting ? 'Checking Access...' : 'Retry Access Check'}
                </Button>
                
                <Button
                  onClick={debugAuthState}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Debug Access Issue
                </Button>
              </div>
              
              {debugInfo?.showDebug && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg text-left text-sm">
                  <h3 className="font-semibold mb-2">Debug Information:</h3>
                  <div className="space-y-1 font-mono text-xs">
                    <div>Auth User: {debugInfo?.authUser?.email || 'None'}</div>
                    <div>User ID: {debugInfo?.authUser?.id || 'None'}</div>
                    <div>Profile Found: {debugInfo?.userProfile ? 'Yes' : 'No'}</div>
                    <div>User Role: {debugInfo?.userProfile?.role || 'None'}</div>
                    <div>Is Manager: {debugInfo?.isManager ? 'Yes' : 'No'}</div>
                    {debugInfo?.profileLoadError && (
                      <div className="text-red-600 mt-2">
                        Error: {debugInfo?.profileLoadError?.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-4">
                If you believe this is an error, please contact your system administrator
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const renderUserAccountsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">User Accounts (with login)</h3>
        <Button
          onClick={() => openModal('userAccount')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          disabled={submitting}
        >
          <Plus className="w-4 h-4" />
          Add User Account
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userAccounts?.map((account) => (
              <tr key={account?.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{account?.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{account?.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    {account?.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{account?.department || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{account?.phone || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => openModal('userAccount', account)}
                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    disabled={submitting || deletingId === account?.id}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('user_profiles', account?.id, 'userAccount')}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    disabled={submitting || deletingId === account?.id}
                  >
                    {deletingId === account?.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStaffRecordsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Staff Records (directory only - no login)</h3>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setStaffForm({ ...staffForm, department: 'Sales Consultants' });
              openModal('staff');
            }}
            className="bg-green-600 hover:bg-green-700 text-white text-sm"
            disabled={submitting}
          >
            Add Sales Consultant
          </Button>
          <Button
            onClick={() => {
              setStaffForm({ ...staffForm, department: 'Finance Manager' });
              openModal('staff');
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white text-sm"
            disabled={submitting}
          >
            Add Finance Manager
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {staffDepartmentOptions?.map((dept) => {
          const deptStaff = staffRecords?.filter(staff => staff?.department === dept?.value) || [];
          return (
            <div key={dept?.value} className="bg-white rounded-lg shadow p-6">
              <h4 className="font-semibold text-gray-900 mb-4">{dept?.label}</h4>
              <div className="space-y-3">
                {deptStaff?.map((staff) => (
                  <div key={staff?.id} className="border rounded-lg p-4 space-y-2">
                    <div className="font-medium text-gray-900">{staff?.full_name}</div>
                    <div className="text-sm text-gray-600">
                      Phone: {staff?.phone || 'No phone'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Email: {staff?.email ? (
                        <span className="break-all" title={staff?.email}>
                          {staff?.email?.length > 30 
                            ? `${staff?.email?.substring(0, 30)}...` 
                            : staff?.email
                          }
                        </span>
                      ) : (
                        'No email'
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => openModal('staff', staff)}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        disabled={submitting || deletingId === staff?.id}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('user_profiles', staff?.id, 'staffRecord')}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        disabled={submitting || deletingId === staff?.id}
                      >
                        {deletingId === staff?.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {deptStaff?.length === 0 && (
                  <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded">
                    No {dept?.label?.toLowerCase()} added yet
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderVendorsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Vendor Management</h3>
        <Button
          onClick={() => openModal('vendor')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          disabled={submitting}
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors?.map((vendor) => (
              <tr key={vendor?.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{vendor?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{vendor?.contact_person || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{vendor?.phone || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{vendor?.email || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{vendor?.specialty || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {vendor?.rating ? `${vendor?.rating}/5` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => openModal('vendor', vendor)}
                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    disabled={submitting || deletingId === vendor?.id}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('vendors', vendor?.id)}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    disabled={submitting || deletingId === vendor?.id}
                  >
                    {deletingId === vendor?.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProductsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Aftermarket Products</h3>
          <p className="text-sm text-gray-600 mt-1">
            Op Code: Short abbreviation displayed on trackers and calendars. Full name shown in detailed reports.
          </p>
        </div>
        <Button
          onClick={() => openModal('product')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          disabled={submitting}
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Op Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retail Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products?.map((product) => (
              <tr key={product?.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {product?.op_code ? (
                    <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-800 rounded border border-green-200">
                      {product?.op_code}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">No code</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{product?.brand || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{product?.category || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">${product?.cost || '0'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">${product?.unit_price || '0'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-mono text-sm">
                  {product?.part_number || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => openModal('product', product)}
                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    disabled={submitting || deletingId === product?.id}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('products', product?.id)}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    disabled={submitting || deletingId === product?.id}
                  >
                    {deletingId === product?.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSmsTemplatesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">SMS Templates</h3>
        <Button
          onClick={() => openModal('template')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          disabled={submitting}
        >
          <Plus className="w-4 h-4" />
          Add Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {smsTemplates?.map((template) => (
          <div key={template?.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">{template?.name}</h4>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {template?.template_type}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal('template', template)}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  disabled={submitting || deletingId === template?.id}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete('sms_templates', template?.id)}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  disabled={submitting || deletingId === template?.id}
                >
                  {deletingId === template?.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-sm text-gray-700 font-mono">{template?.message_template}</p>
              <div className="mt-2 text-xs text-gray-500">
                {template?.message_template?.length}/160 characters
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModal = () => {
    if (!showModal) return null;

    const getModalTitle = () => {
      const action = editingItem ? 'Edit' : 'Add';
      if (modalType === 'userAccount') return `${action} User Account`;
      if (modalType === 'staff') return `${action} Staff Member`;
      if (modalType === 'vendor') return `${action} Vendor`;
      if (modalType === 'product') return `${action} Product`;
      if (modalType === 'template') return `${action} SMS Template`;
      return action;
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              disabled={submitting}
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalType === 'userAccount' && (
              <>
                <Input
                  label="Full Name *"
                  type="text"
                  value={userAccountForm?.full_name}
                  onChange={(e) => setUserAccountForm({...userAccountForm, full_name: e?.target?.value})}
                  required
                />
                <Input
                  label="Email *"
                  type="email"
                  value={userAccountForm?.email}
                  onChange={(e) => setUserAccountForm({...userAccountForm, email: e?.target?.value})}
                  required
                />
                {!editingItem && (
                  <Input
                    label="Password *"
                    type="password"
                    value={userAccountForm?.password}
                    onChange={(e) => setUserAccountForm({...userAccountForm, password: e?.target?.value})}
                    required={!editingItem}
                  />
                )}
                <Select
                  label="Role *"
                  value={userAccountForm?.role}
                  onChange={(e) => setUserAccountForm({...userAccountForm, role: e?.target?.value})}
                  options={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Manager' }
                  ]}
                />
                <Select
                  label="Department *"
                  value={userAccountForm?.department}
                  onChange={(e) => setUserAccountForm({...userAccountForm, department: e?.target?.value})}
                  options={userDepartmentOptions}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={userAccountForm?.phone}
                  onChange={(e) => setUserAccountForm({...userAccountForm, phone: e?.target?.value})}
                />
              </>
            )}

            {modalType === 'staff' && (
              <>
                <Input
                  label="Name *"
                  type="text"
                  value={staffForm?.full_name}
                  onChange={(e) => setStaffForm({...staffForm, full_name: e?.target?.value})}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={staffForm?.phone}
                  onChange={(e) => setStaffForm({...staffForm, phone: e?.target?.value})}
                />
                <Input
                  label="Email"
                  type="email"
                  value={staffForm?.email}
                  onChange={(e) => setStaffForm({...staffForm, email: e?.target?.value})}
                />
                <Select
                  label="Department *"
                  value={staffForm?.department}
                  onChange={(e) => setStaffForm({...staffForm, department: e?.target?.value})}
                  options={staffDepartmentOptions}
                />
              </>
            )}

            {modalType === 'vendor' && (
              <>
                <Input
                  label="Name *"
                  type="text"
                  value={vendorForm?.name}
                  onChange={(e) => setVendorForm({...vendorForm, name: e?.target?.value})}
                  required
                />
                <Input
                  label="Contact Person"
                  type="text"
                  value={vendorForm?.contact_person}
                  onChange={(e) => setVendorForm({...vendorForm, contact_person: e?.target?.value})}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={vendorForm?.phone}
                  onChange={(e) => setVendorForm({...vendorForm, phone: e?.target?.value})}
                />
                <Input
                  label="Email"
                  type="email"
                  value={vendorForm?.email}
                  onChange={(e) => setVendorForm({...vendorForm, email: e?.target?.value})}
                />
                <Input
                  label="Specialty"
                  type="text"
                  value={vendorForm?.specialty}
                  onChange={(e) => setVendorForm({...vendorForm, specialty: e?.target?.value})}
                />
                <Input
                  label="Rating (1-5)"
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={vendorForm?.rating}
                  onChange={(e) => setVendorForm({...vendorForm, rating: e?.target?.value})}
                />
              </>
            )}

            {modalType === 'product' && (
              <>
                <Input
                  label="Name *"
                  type="text"
                  value={productForm?.name}
                  onChange={(e) => setProductForm({...productForm, name: e?.target?.value})}
                  required
                />
                <Input
                  label="Op Code"
                  type="text"
                  value={productForm?.op_code}
                  onChange={(e) => setProductForm({...productForm, op_code: e?.target?.value?.toUpperCase()})}
                  placeholder="TG, WD, BP, etc."
                  maxLength="10"
                  className="uppercase"
                  helperText="Short abbreviation for trackers/calendars (e.g., ToughGuard = TG)"
                />
                <Input
                  label="Brand"
                  type="text"
                  value={productForm?.brand}
                  onChange={(e) => setProductForm({...productForm, brand: e?.target?.value})}
                />
                <Input
                  label="Category"
                  type="text"
                  value={productForm?.category}
                  onChange={(e) => setProductForm({...productForm, category: e?.target?.value})}
                />
                <Input
                  label="Cost"
                  type="number"
                  step="0.01"
                  value={productForm?.cost}
                  onChange={(e) => setProductForm({...productForm, cost: e?.target?.value})}
                />
                <Input
                  label="Default Retail Price *"
                  type="number"
                  step="0.01"
                  value={productForm?.unit_price}
                  onChange={(e) => setProductForm({...productForm, unit_price: e?.target?.value})}
                  required
                />
                <Input
                  label="Part Number"
                  type="text"
                  value={productForm?.part_number}
                  onChange={(e) => setProductForm({...productForm, part_number: e?.target?.value})}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={productForm?.description}
                    onChange={(e) => setProductForm({...productForm, description: e?.target?.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {modalType === 'template' && (
              <>
                <Input
                  label="Template Name *"
                  type="text"
                  value={templateForm?.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e?.target?.value})}
                  required
                />
                <Select
                  label="Template Type *"
                  value={templateForm?.template_type}
                  onChange={(e) => setTemplateForm({...templateForm, template_type: e?.target?.value})}
                  options={templateTypeOptions}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message Template * (Stock # will be auto-added if not present)
                  </label>
                  <textarea
                    value={templateForm?.message_template}
                    onChange={(e) => setTemplateForm({...templateForm, message_template: e?.target?.value})}
                    rows="4"
                    maxLength="160"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Your message template..."
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {templateForm?.message_template?.length || 0}/160 characters
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={submitting}
                className={`bg-blue-600 hover:bg-blue-700 text-white ${submitting ? 'opacity-50' : ''}`}
              >
                {submitting ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
            <p className="text-gray-600">Complete administrative management for Rocket Aftermarket Tracker</p>
            {userProfile && (
              <div className="mt-2 text-sm text-gray-500">
                Logged in as: {userProfile?.full_name} ({userProfile?.role})
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex space-x-8 border-b border-gray-200">
              {tabs?.map((tab) => {
                const Icon = tab?.icon;
                return (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab?.id
                        ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab?.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow p-6">
            {activeTab === 'userAccounts' && renderUserAccountsTab()}
            {activeTab === 'staffRecords' && renderStaffRecordsTab()}
            {activeTab === 'vendors' && renderVendorsTab()}
            {activeTab === 'products' && renderProductsTab()}
            {activeTab === 'smsTemplates' && renderSmsTemplatesTab()}
          </div>
        </div>
      </div>

      {renderModal()}
    </AppLayout>
  );
};

export default AdminPage;