import React, { useState, useEffect } from 'react';
import { Settings, Users, Package, Building2, MessageSquare, Upload, Database, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';


const AdminPage = () => {
  const { userProfile, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importStatus, setImportStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const tabs = [
    { key: 'vendors', label: 'Vendors', icon: Building2 },
    { key: 'services', label: 'Services/Catalog', icon: Package },
    { key: 'users', label: 'Users/Roles', icon: Users },
    { key: 'sms', label: 'SMS Templates', icon: MessageSquare },
    { key: 'import', label: 'CSV Import', icon: Upload }
  ];

  useEffect(() => {
    if (activeTab !== 'sms' && activeTab !== 'import') {
      loadTabData();
    }
  }, [activeTab]);

  const loadTabData = async () => {
    if (!isManager) return;
    
    setLoading(true);
    try {
      switch (activeTab) {
        case 'vendors':
          await loadVendors();
          break;
        case 'services':
          await loadServices();
          break;
        case 'users':
          await loadUsers();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${activeTab}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    const { data, error } = await supabase?.from('vendors')?.select('*')?.order('name');
    
    if (error) throw error;
    setVendors(data || []);
  };

  const loadServices = async () => {
    const { data, error } = await supabase?.from('products')?.select(`
        *,
        vendors (name)
      `)?.order('name');
    
    if (error) throw error;
    setServices(data || []);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase?.from('user_profiles')?.select('*')?.order('full_name');
    
    if (error) throw error;
    setUsers(data || []);
  };

  const handleAdd = (type) => {
    setModalType(type);
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  const handleEdit = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      let table = '';
      switch (type) {
        case 'vendor':
          table = 'vendors';
          break;
        case 'service':
          table = 'products';
          break;
        case 'user':
          table = 'user_profiles';
          break;
      }

      const { error } = await supabase?.from(table)?.delete()?.eq('id', id);
      if (error) throw error;

      // Reload data
      await loadTabData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);

    try {
      let table = '';
      let data = { ...formData };

      switch (modalType) {
        case 'vendor':
          table = 'vendors';
          break;
        case 'service':
          table = 'products';
          break;
        case 'user':
          table = 'user_profiles';
          break;
      }

      if (editingItem) {
        // Update existing
        const { error } = await supabase?.from(table)?.update(data)?.eq('id', editingItem?.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase?.from(table)?.insert([data]);
        if (error) throw error;
      }

      setShowModal(false);
      await loadTabData();
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setLoading(false);
    }
  };

  // CSV Import Functions
  const handleFileUpload = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e?.target?.result;
      const lines = text?.split('\n')?.filter(line => line?.trim());
      const headers = lines?.[0]?.split(',')?.map(h => h?.trim());
      const preview = lines?.slice(1, 6)?.map(line => {
        const values = line?.split(',')?.map(v => v?.trim());
        return headers?.reduce((obj, header, index) => {
          obj[header] = values?.[index] || '';
          return obj;
        }, {});
      });
      
      setCsvPreview(preview);
    };
    
    reader?.readAsText(file);
  };

  const processCsvImport = async () => {
    if (!csvFile) return;

    setImportStatus('Processing...');
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e?.target?.result;
        const lines = text?.split('\n')?.filter(line => line?.trim());
        const headers = lines?.[0]?.split(',')?.map(h => h?.trim()?.toLowerCase());
        
        // Stock-first dedupe logic
        const processedVehicles = new Map();
        const processedJobs = [];
        
        for (let i = 1; i < lines?.length; i++) {
          const values = lines?.[i]?.split(',')?.map(v => v?.trim());
          const record = headers?.reduce((obj, header, index) => {
            obj[header] = values?.[index] || '';
            return obj;
          }, {});

          // Map CSV headers to database columns (case-insensitive)
          const stockNumber = record?.['stock'] || record?.['stock_number'] || record?.['stock #'];
          const customerName = record?.['customer'] || record?.['customer_name'] || record?.['owner'];
          const vehicleYear = record?.['year'] || record?.['vehicle_year'];
          const vehicleMake = record?.['make'] || record?.['vehicle_make'];
          const vehicleModel = record?.['model'] || record?.['vehicle_model'];
          const serviceDate = record?.['date'] || record?.['service_date'] || record?.['appointment_date'];
          const services = record?.['services'] || record?.['service_list'] || '';
          
          // Stock-first vehicle deduplication
          if (stockNumber && !processedVehicles?.has(stockNumber)) {
            processedVehicles?.set(stockNumber, {
              stock_number: stockNumber,
              owner_name: customerName,
              year: parseInt(vehicleYear) || null,
              make: vehicleMake,
              model: vehicleModel,
              vehicle_status: 'active'
            });
          }

          // Create job entry (stock + date + customer = unique work order)
          if (stockNumber && serviceDate && customerName) {
            const jobKey = `${stockNumber}-${serviceDate}-${customerName}`;
            
            processedJobs?.push({
              key: jobKey,
              title: `Service - ${stockNumber}`,
              description: services,
              stock_number: stockNumber,
              customer_name: customerName,
              scheduled_start_time: new Date(serviceDate)?.toISOString(),
              job_status: 'pending'
            });
          }
        }

        // Insert vehicles first
        const vehiclesArray = Array.from(processedVehicles?.values());
        if (vehiclesArray?.length > 0) {
          const { error: vehiclesError } = await supabase?.from('vehicles')?.upsert(vehiclesArray, { onConflict: 'stock_number' });
          
          if (vehiclesError) throw vehiclesError;
        }

        // Then insert jobs with vehicle references
        for (const job of processedJobs) {
          // Get vehicle ID by stock number
          const { data: vehicle } = await supabase?.from('vehicles')?.select('id')?.eq('stock_number', job?.stock_number)?.single();

          if (vehicle) {
            const { error: jobError } = await supabase?.from('jobs')?.insert({
                title: job?.title,
                description: job?.description,
                scheduled_start_time: job?.scheduled_start_time,
                vehicle_id: vehicle?.id,
                job_status: job?.job_status
              });
            
            if (jobError) throw jobError;
          }
        }

        setImportStatus(`Successfully imported ${vehiclesArray?.length} vehicles and ${processedJobs?.length} jobs`);
      } catch (error) {
        console.error('Import error:', error);
        setImportStatus(`Error: ${error?.message}`);
      }
    };
    
    reader?.readAsText(csvFile);
  };

  const handleBackupData = async () => {
    try {
      // This would implement a data backup functionality
      console.log('Backup data functionality would be implemented here');
    } catch (error) {
      console.error('Error backing up data:', error);
    }
  };

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You need manager or administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Settings className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              onClick={handleBackupData}
              className="flex items-center space-x-2"
              variant="outline"
            >
              <Database className="w-4 h-4" />
              <span>Backup Data</span>
            </Button>
          </div>
        </div>
      </div>
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-8">
          {tabs?.map((tab) => {
            const Icon = tab?.icon;
            return (
              <Button
                key={tab?.key}
                onClick={() => setActiveTab(tab?.key)}
                variant="ghost"
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 rounded-none ${
                  activeTab === tab?.key
                    ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab?.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'vendors' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Vendor Management</h2>
                <Button
                  onClick={() => handleAdd('vendor')}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Vendor</span>
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor Name
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendors?.map((vendor) => (
                    <tr key={vendor?.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{vendor?.name}</div>
                        <div className="text-sm text-gray-500">Rating: {vendor?.rating || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{vendor?.contact_person}</div>
                        <div className="text-sm text-gray-500">{vendor?.phone}</div>
                        <div className="text-sm text-gray-500">{vendor?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vendor?.specialty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vendor?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {vendor?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          onClick={() => handleEdit('vendor', vendor)}
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-900 p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete('vendor', vendor?.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-900 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Service Catalog</h2>
                <Button
                  onClick={() => handleAdd('service')}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Service</span>
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services?.map((service) => (
                  <div key={service?.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">
                      {service?.name === 'RG' ? 'RUSTGUARD' : service?.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{service?.description}</p>
                    
                    <div className="mt-4 flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-500">Price: </span>
                        <span className="font-medium">${service?.price}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Cost: </span>
                        <span className="font-medium">${service?.cost}</span>
                      </div>
                    </div>
                    
                    {service?.vendors && (
                      <div className="mt-2 text-xs text-gray-500">
                        Vendor: {service?.vendors?.name}
                      </div>
                    )}
                    
                    <div className="mt-4 flex space-x-2">
                      <Button
                        onClick={() => handleEdit('service', service)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete('service', service?.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">User Management</h2>
                <Button
                  onClick={() => handleAdd('user')}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add User</span>
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
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
                  {users?.map((user) => (
                    <tr key={user?.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user?.full_name}</div>
                        <div className="text-sm text-gray-500">{user?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {user?.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user?.department || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          onClick={() => handleEdit('user', user)}
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-900 p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete('user', user?.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-900 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium">SMS Templates & Reminders</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Default Templates</h3>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-sm">Appointment Confirmation</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      "Stock {`{STOCK}`} service confirmed for {`{DATE}`}. Reply YES to confirm or CALL {`{PHONE}`}"
                    </p>
                    <div className="text-xs text-gray-500 mt-2">Character count: 85/160</div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-sm">Service Complete</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      "Stock {`{STOCK}`} service complete! Total: ${`{AMOUNT}`}. Ready for pickup. Call {`{PHONE}`}"
                    </p>
                    <div className="text-xs text-gray-500 mt-2">Character count: 78/160</div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-sm">Appointment Change</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      "Stock {`{STOCK}`} appointment moved to {`{NEW_DATE}`} {`{NEW_TIME}`}. Reply C to confirm"
                    </p>
                    <div className="text-xs text-gray-500 mt-2">Character count: 82/160</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Reminder Settings</h3>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">24h Before Appointment</span>
                        <input type="checkbox" defaultChecked className="rounded" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">1h Before Appointment</span>
                        <input type="checkbox" defaultChecked className="rounded" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Service Complete</span>
                        <input type="checkbox" defaultChecked className="rounded" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">No-Show Auto (T+15min)</span>
                        <input type="checkbox" defaultChecked className="rounded" />
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    Save SMS Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium">CSV Import</h2>
              <p className="text-sm text-gray-500 mt-1">Import vehicles, work orders, and appointments from CSV files</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="space-y-4">
                  <h3 className="font-medium">Upload CSV File</h3>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Drop CSV file here or click to upload
                        </span>
                        <input
                          id="csv-upload"
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        Supports: vehicles, work orders, appointments
                      </p>
                    </div>
                  </div>
                  
                  {csvFile && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <h4 className="font-medium text-green-900">File Ready</h4>
                          <p className="text-sm text-green-700">{csvFile?.name}</p>
                        </div>
                        <Button
                          onClick={processCsvImport}
                          variant="secondary"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Process Import
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {importStatus && (
                    <div className={`border rounded-lg p-4 ${
                      importStatus?.includes('Error') 
                        ? 'bg-red-50 border-red-200 text-red-700' :'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                      {importStatus}
                    </div>
                  )}
                </div>
                
                {/* Preview Section */}
                <div className="space-y-4">
                  <h3 className="font-medium">Column Mapping Guide</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-3">Supported Headers (case-insensitive):</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <strong>Vehicle:</strong><br />
                        stock, stock_number, stock #<br />
                        year, make, model, color<br />
                        vin, customer, owner
                      </div>
                      <div>
                        <strong>Service:</strong><br />
                        date, service_date<br />
                        services, service_list<br />
                        status, priority
                      </div>
                    </div>
                  </div>
                  
                  {csvPreview?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Preview (first 5 rows):</h4>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(csvPreview?.[0])?.map(header => (
                                  <th key={header} className="px-3 py-2 text-left font-medium text-gray-900">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {csvPreview?.map((row, index) => (
                                <tr key={index}>
                                  {Object.values(row)?.map((value, cellIndex) => (
                                    <td key={cellIndex} className="px-3 py-2 text-gray-900">
                                      {value}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium mb-4">
              {editingItem ? `Edit ${modalType}` : `Add New ${modalType}`}
            </h3>
            
            <form onSubmit={handleSubmit}>
              {modalType === 'vendor' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData?.name || ''}
                      onChange={(e) => setFormData({...formData, name: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={formData?.contact_person || ''}
                      onChange={(e) => setFormData({...formData, contact_person: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData?.phone || ''}
                      onChange={(e) => setFormData({...formData, phone: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData?.email || ''}
                      onChange={(e) => setFormData({...formData, email: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                    <input
                      type="text"
                      value={formData?.specialty || ''}
                      onChange={(e) => setFormData({...formData, specialty: e?.target?.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;