import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AppLayout from '../../components/layouts/AppLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Users, Package, MessageSquare, Building, UserCheck, AlertCircle, RefreshCw, Edit, Trash2, Plus } from 'lucide-react';
import Icon from '../../components/AppIcon';


const AdminPage = () => {
  const { userProfile, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('userAccounts');
  const [error, setError] = useState(null);
  
  // Debug states
  const [debugInfo, setDebugInfo] = useState({
    authUser: null,
    userProfile: null,
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

  // Initialize admin panel - check auth and load data
  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        console.log('Admin panel initializing...', { 
          authLoading, 
          user: !!user, 
          userProfile: !!userProfile 
        });

        // First check if Supabase is available
        if (!supabase) {
          setError('Database connection unavailable. Please refresh the page.');
          setLoading(false);
          return;
        }

        // Test database connection
        const { error: connectionError } = await supabase?.from('user_profiles')?.select('id')?.limit(1);

        if (connectionError) {
          console.error('Database connection failed:', connectionError);
          setError('Unable to connect to database. Please check your Supabase configuration.');
          setLoading(false);
          return;
        }

        // Load admin data regardless of auth status (for demo purposes)
        await loadAllData();
        
        setLoading(false);
      } catch (error) {
        console.error('Admin initialization failed:', error);
        setError('Failed to initialize admin panel: ' + error?.message);
        setLoading(false);
      }
    };

    // Wait for auth to complete initialization, then proceed
    if (!authLoading) {
      initializeAdmin();
    }
  }, [authLoading]);

  // Debug function to check current user status
  const debugAuthState = async () => {
    console.log('=== ADMIN ACCESS DEBUG ===');
    
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      console.log('Current session:', { 
        hasSession: !!session, 
        sessionError,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      });
      
      if (session?.user) {
        console.log('Auth user:', {
          id: session?.user?.id,
          email: session?.user?.email,
          role: session?.user?.role
        });
        
        // Try to fetch user profile directly with detailed error logging
        console.log('Attempting to fetch user profile...');
        const { data: profile, error: profileError } = await supabase
          ?.from('user_profiles')
          ?.select('*')
          ?.eq('id', session?.user?.id)
          ?.single();
          
        console.log('Direct profile fetch result:', {
          profile: profile,
          profileError: profileError,
          hasProfile: !!profile
        });
        
        setDebugInfo({
          authUser: session?.user,
          userProfile: profile,
          profileLoadError: profileError,
          showDebug: true
        });
      } else {
        console.log('No authenticated user found');
        setDebugInfo({
          authUser: null,
          userProfile: null,
          profileLoadError: { message: 'No authenticated user' },
          showDebug: true
        });
      }
      
      // Test basic database access
      console.log('Testing database access...');
      const { data: testData, error: testError } = await supabase
        ?.from('user_profiles')
        ?.select('id, full_name, role')
        ?.limit(5);
        
      console.log('Database access test:', {
        canAccess: !testError,
        recordCount: testData?.length || 0,
        error: testError
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo(prev => ({
        ...prev,
        profileLoadError: error,
        showDebug: true
      }));
    }
  };

  // Enhanced data loading with better error handling
  const loadAllData = async () => {
    console.log('Loading admin data...');
    
    try {
      const results = await Promise.allSettled([
        loadUserAccounts(),
        loadStaffRecords(), 
        loadVendors(),
        loadProducts(),
        loadSmsTemplates()
      ]);
      
      results?.forEach((result, index) => {
        const sections = ['User Accounts', 'Staff Records', 'Vendors', 'Products', 'SMS Templates'];
        if (result?.status === 'rejected') {
          console.error(`Failed to load ${sections?.[index]}:`, result?.reason);
        } else {
          console.log(`Successfully loaded ${sections?.[index]}`);
        }
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load some admin data. Please try refreshing the page.');
    }
  };

  const loadUserAccounts = async () => {
    try {
      console.log('Loading user accounts...');
      
      const { data, error, count } = await supabase
        ?.from('user_profiles')
        ?.select('*', { count: 'exact' })
        ?.in('role', ['admin', 'manager'])  
        ?.in('department', ['Managers', 'Delivery Coordinator'])  
        ?.order('created_at', { ascending: false });

      if (error) {
        console.error('User accounts query error:', error);
        throw error;
      }
      
      console.log(`User accounts query result: ${data?.length || 0} records`);
      setUserAccounts(data || []);
    } catch (error) {
      console.error('Error loading user accounts:', error);
      // Don't throw - allow other sections to load
    }
  };

  const loadStaffRecords = async () => {
    try {
      console.log('Loading staff records...');
      
      const { data: allStaff, error: staffError, count } = await supabase
        ?.from('user_profiles')
        ?.select('*', { count: 'exact' })
        ?.eq('role', 'staff')  
        ?.order('created_at', { ascending: false });

      if (staffError) {
        console.error('Staff records query error:', staffError);
        throw staffError;
      }
      
      // Filter for the specific departments we want to display in admin
      const filteredStaff = allStaff?.filter(staff => 
        ['Sales Consultants', 'Finance Manager']?.includes(staff?.department)
      ) || [];
      
      console.log(`Staff records: ${filteredStaff?.length} matching target departments`);
      setStaffRecords(filteredStaff);
    } catch (error) {
      console.error('Error loading staff records:', error);
    }
  };

  const loadVendors = async () => {
    try {
      console.log('Loading vendors...');
      
      const { data, error, count } = await supabase
        ?.from('vendors')
        ?.select('*', { count: 'exact' })
        ?.order('created_at', { ascending: false });

      if (error) {
        console.error('Vendors query error:', error);
        throw error;
      }
      
      console.log(`Vendors query result: ${data?.length || 0} records`);
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadProducts = async () => {
    try {
      console.log('Loading products...');
      
      const { data, error, count } = await supabase
        ?.from('products')
        ?.select('*, vendors(name)', { count: 'exact' })
        ?.order('created_at', { ascending: false });

      if (error) {
        console.error('Products query error:', error);
        throw error;
      }
      
      console.log(`Products query result: ${data?.length || 0} records`);
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadSmsTemplates = async () => {
    try {
      console.log('Loading SMS templates...');
      
      const { data, error, count } = await supabase
        ?.from('sms_templates')
        ?.select('*', { count: 'exact' })
        ?.order('created_at', { ascending: false });

      if (error) {
        console.error('SMS templates query error:', error);
        throw error;
      }
      
      console.log(`SMS templates query result: ${data?.length || 0} records`);
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

  // Render functions for each tab
  const renderUserAccountsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">User Accounts ({userAccounts?.length || 0})</h3>
        <Button
          onClick={() => openModal('userAccount')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User Account
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userAccounts?.map((account) => (
              <tr key={account?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {account?.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account?.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    account?.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {account?.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account?.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    account?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {account?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('userAccount', account)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('user_profiles', account?.id, 'userAccount')}
                      disabled={deletingId === account?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {userAccounts?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No user accounts found. Click "Add User Account" to create one.
        </div>
      )}
    </div>
  );

  const renderStaffRecordsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Staff Records ({staffRecords?.length || 0})</h3>
        <Button
          onClick={() => openModal('staff')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {staffRecords?.map((staff) => (
              <tr key={staff?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {staff?.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    staff?.department === 'Sales Consultants' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {staff?.department}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff?.phone || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff?.email || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    staff?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {staff?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('staff', staff)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('user_profiles', staff?.id, 'staff')}
                      disabled={deletingId === staff?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staffRecords?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No staff records found. Click "Add Staff Member" to create one.
        </div>
      )}
    </div>
  );

  const renderVendorsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Vendors ({vendors?.length || 0})</h3>
        <Button
          onClick={() => openModal('vendor')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors?.map((vendor) => (
              <tr key={vendor?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {vendor?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.contact_person || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.phone || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.specialty || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.rating ? `${vendor?.rating}/5` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    vendor?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {vendor?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('vendor', vendor)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('vendors', vendor?.id)}
                      disabled={deletingId === vendor?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vendors?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No vendors found. Click "Add Vendor" to create one.
        </div>
      )}
    </div>
  );

  const renderProductsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Aftermarket Products ({products?.length || 0})</h3>
        <Button
          onClick={() => openModal('product')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Op Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products?.map((product) => (
              <tr key={product?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product?.brand || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product?.category || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                    {product?.op_code || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${product?.cost || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${product?.unit_price || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {product?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('product', product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('products', product?.id)}
                      disabled={deletingId === product?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No products found. Click "Add Product" to create one.
        </div>
      )}
    </div>
  );

  const renderSmsTemplatesTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">SMS Templates ({smsTemplates?.length || 0})</h3>
        <Button
          onClick={() => openModal('template')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message Preview</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {smsTemplates?.map((template) => (
              <tr key={template?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {template?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {template?.template_type?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {template?.message_template}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    template?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {template?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('template', template)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('sms_templates', template?.id)}
                      disabled={deletingId === template?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {smsTemplates?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No SMS templates found. Click "Add Template" to create one.
        </div>
      )}
    </div>
  );

  // Modal rendering function
  const renderModal = () => {
    if (!showModal) return null;

    const getModalTitle = () => {
      switch (modalType) {
        case 'userAccount': return editingItem ? 'Edit User Account' : 'Add User Account';
        case 'staff': return editingItem ? 'Edit Staff Member' : 'Add Staff Member';
        case 'vendor': return editingItem ? 'Edit Vendor' : 'Add Vendor';
        case 'product': return editingItem ? 'Edit Product' : 'Add Product';
        case 'template': return editingItem ? 'Edit SMS Template' : 'Add SMS Template';
        default: return 'Form';
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modalType === 'userAccount' && (
              <>
                <Input
                  label="Full Name"
                  value={userAccountForm?.full_name}
                  onChange={(e) => setUserAccountForm({...userAccountForm, full_name: e?.target?.value})}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={userAccountForm?.email}
                  onChange={(e) => setUserAccountForm({...userAccountForm, email: e?.target?.value})}
                  required
                />
                {!editingItem && (
                  <Input
                    label="Password"
                    type="password"
                    value={userAccountForm?.password}
                    onChange={(e) => setUserAccountForm({...userAccountForm, password: e?.target?.value})}
                    required
                  />
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={userAccountForm?.role}
                    onChange={(e) => setUserAccountForm({...userAccountForm, role: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {roleOptions?.map(option => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={userAccountForm?.department}
                    onChange={(e) => setUserAccountForm({...userAccountForm, department: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Department</option>
                    {userDepartmentOptions?.map(option => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Phone"
                  value={userAccountForm?.phone}
                  onChange={(e) => setUserAccountForm({...userAccountForm, phone: e?.target?.value})}
                />
              </>
            )}

            {modalType === 'staff' && (
              <>
                <Input
                  label="Full Name"
                  value={staffForm?.full_name}
                  onChange={(e) => setStaffForm({...staffForm, full_name: e?.target?.value})}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={staffForm?.department}
                    onChange={(e) => setStaffForm({...staffForm, department: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Department</option>
                    {staffDepartmentOptions?.map(option => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Phone"
                  value={staffForm?.phone}
                  onChange={(e) => setStaffForm({...staffForm, phone: e?.target?.value})}
                />
                <Input
                  label="Email"
                  type="email"
                  value={staffForm?.email}
                  onChange={(e) => setStaffForm({...staffForm, email: e?.target?.value})}
                />
              </>
            )}

            {modalType === 'vendor' && (
              <>
                <Input
                  label="Vendor Name"
                  value={vendorForm?.name}
                  onChange={(e) => setVendorForm({...vendorForm, name: e?.target?.value})}
                  required
                />
                <Input
                  label="Contact Person"
                  value={vendorForm?.contact_person}
                  onChange={(e) => setVendorForm({...vendorForm, contact_person: e?.target?.value})}
                />
                <Input
                  label="Phone"
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
                  label="Product Name"
                  value={productForm?.name}
                  onChange={(e) => setProductForm({...productForm, name: e?.target?.value})}
                  required
                />
                <Input
                  label="Brand"
                  value={productForm?.brand}
                  onChange={(e) => setProductForm({...productForm, brand: e?.target?.value})}
                />
                <Input
                  label="Category"
                  value={productForm?.category}
                  onChange={(e) => setProductForm({...productForm, category: e?.target?.value})}
                />
                <Input
                  label="Op Code"
                  value={productForm?.op_code}
                  onChange={(e) => setProductForm({...productForm, op_code: e?.target?.value})}
                  placeholder="e.g., EN3, EN5"
                />
                <Input
                  label="Cost"
                  type="number"
                  step="0.01"
                  value={productForm?.cost}
                  onChange={(e) => setProductForm({...productForm, cost: e?.target?.value})}
                  required
                />
                <Input
                  label="Unit Price"
                  type="number"
                  step="0.01"
                  value={productForm?.unit_price}
                  onChange={(e) => setProductForm({...productForm, unit_price: e?.target?.value})}
                  required
                />
                <Input
                  label="Part Number"
                  value={productForm?.part_number}
                  onChange={(e) => setProductForm({...productForm, part_number: e?.target?.value})}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={productForm?.description}
                    onChange={(e) => setProductForm({...productForm, description: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="3"
                  />
                </div>
              </>
            )}

            {modalType === 'template' && (
              <>
                <Input
                  label="Template Name"
                  value={templateForm?.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e?.target?.value})}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
                  <select
                    value={templateForm?.template_type}
                    onChange={(e) => setTemplateForm({...templateForm, template_type: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {templateTypeOptions?.map(option => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message Template ({templateForm?.message_template?.length || 0}/160)
                  </label>
                  <textarea
                    value={templateForm?.message_template}
                    onChange={(e) => setTemplateForm({...templateForm, message_template: e?.target?.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="4"
                    maxLength="160"
                    placeholder="Use {{stock_number}}, {{vehicle_info}}, {{status}} as variables"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
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

  if (error) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Panel Error</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              
              <div className="space-y-4">
                <Button
                  onClick={() => window.location?.reload()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </Button>
                
                <Button
                  onClick={debugAuthState}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Debug Connection
                </Button>
                
                <Button
                  onClick={() => window.location.href = '/authentication-portal'}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Go to Login
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
                    <div>Department: {debugInfo?.userProfile?.department || 'None'}</div>
                    {debugInfo?.profileLoadError && (
                      <div className="text-red-600 mt-2">
                        Error: {debugInfo?.profileLoadError?.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main admin interface
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Admin Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
            <p className="text-gray-600">Complete administrative management for Priority Automotive Tracker</p>
            
            {/* User Status Display */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">System Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="font-medium">Auth Status:</span>
                  <span className={`ml-1 ${user ? 'text-green-600' : 'text-orange-600'}`}>
                    {user ? 'Authenticated' : 'Demo Mode'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">User Role:</span>
                  <span className="ml-1 text-blue-600">
                    {userProfile?.role || 'Admin'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Access Level:</span>
                  <span className="ml-1 text-green-600">Full Access</span>
                </div>
                <div>
                  <span className="font-medium">Database:</span>
                  <span className="ml-1 text-green-600">Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Status Summary */}
          <div className="mb-8 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Data Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="font-medium">User Accounts:</span>
                <span className={`ml-1 ${userAccounts?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {userAccounts?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Staff Records:</span>
                <span className={`ml-1 ${staffRecords?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {staffRecords?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Vendors:</span>
                <span className={`ml-1 ${vendors?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {vendors?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Products:</span>
                <span className={`ml-1 ${products?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {products?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">SMS Templates:</span>
                <span className={`ml-1 ${smsTemplates?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {smsTemplates?.length || 0} found
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex space-x-8 border-b border-gray-200">
              {tabs?.map((tab) => {
                const Icon = tab?.icon;
                let count = 0;
                if (tab?.id === 'userAccounts') count = userAccounts?.length || 0;
                if (tab?.id === 'staffRecords') count = staffRecords?.length || 0;
                if (tab?.id === 'vendors') count = vendors?.length || 0;
                if (tab?.id === 'products') count = products?.length || 0;
                if (tab?.id === 'smsTemplates') count = smsTemplates?.length || 0;
                
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
                    <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                      count > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content - RESTORED WORKING FUNCTIONALITY */}
          <div className="bg-white rounded-lg shadow p-6">
            {activeTab === 'userAccounts' && renderUserAccountsTab()}
            {activeTab === 'staffRecords' && renderStaffRecordsTab()}
            {activeTab === 'vendors' && renderVendorsTab()}
            {activeTab === 'products' && renderProductsTab()}
            {activeTab === 'smsTemplates' && renderSmsTemplatesTab()}
          </div>
        </div>

        {/* Modal for Create/Edit */}
        {renderModal()}
      </div>
    </AppLayout>
  );
};

export default AdminPage;