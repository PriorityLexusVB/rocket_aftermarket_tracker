import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/layouts/AppLayout';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { MobileModal } from '../../components/mobile/MobileComponents';
import dealService from '../../services/dealService';
import { jobService } from '../../services/jobService';
import DealForm from './DealForm';
import { useAuth } from '../../contexts/AuthContext';

const DealsPage = () => {
  const { user, loading: authLoading, signIn } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // State for all dropdown data
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [deliveryCoordinators, setDeliveryCoordinators] = useState([]);
  const [financeManagers, setFinanceManagers] = useState([]);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: 'admin@priorityautomotive.com',
    password: 'admin123'
  });
    
  // Fetch all data required for the DealForm
  useEffect(() => {
    if (!user) return; // Wait for authentication

    const fetchData = async () => {
      setLoading(true);
      try {
        const [dealsData, productsData, vendorsData, salesData, financeData, deliveryData] = await Promise.all([
          dealService?.getDeals(),
          dealService?.getProducts(),
          dealService?.getVendors(),
          dealService?.getStaffByDepartment('sales'),
          dealService?.getStaffByDepartment('finance'),
          dealService?.getStaffByDepartment('delivery')
        ]);
        setDeals(dealsData || []);
        setProducts(productsData || []);
        setVendors(vendorsData || []);
        setSalespeople(salesData || []);
        setFinanceManagers(financeData || []);
        setDeliveryCoordinators(deliveryData || []);
      } catch (error) {
        setSubmitError(`Failed to load data: ${error?.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  

const handleCreateDeal = async (payload) => {
  try {
    setSubmitError('');

    const draftId = payload?.meta?.draft_job_id || null;

    // --- Normalize payload (unchanged) ---
    const v = payload?.vehicle || {};
    const d = payload?.deal || {};
    const tx = payload?.transaction || {};
    const items = payload?.lineItems || payload?.items || [];

    const name = (tx?.customer_name || '')?.trim();
    const vehicleLabel = [v?.year, v?.make, v?.model]?.filter(Boolean)?.join(' ');
    const derivedTitle =
      d?.title ||
      (vehicleLabel ? `${vehicleLabel}` : (name ? `Deal for ${name}` : 'Sales Transaction'));
    const promised =
      d?.promised_date || (items?.find(i => i?.promised_date)?.promised_date) || null;

    const mapped = {
      // parent job fields
      title: derivedTitle,
      description: d?.description || d?.notes || `Deal for ${name || 'Customer'}`,
      vehicle_id: d?.vehicle_id || v?.id || null,
      vendor_id: d?.vendor_id || null,
      service_type: d?.service_type || (d?.vendor_id ? 'off_site' : 'in_house'),
      location: d?.location || (d?.vendor_id ? 'Off-Site' : 'In-House'),
      priority: d?.priority || 'medium',
      promised_date: promised,
      scheduled_start_time: d?.scheduled_start_time || null,
      scheduled_end_time: d?.scheduled_end_time || null,
      estimated_cost: d?.estimated_cost ?? tx?.total_amount ?? 0,
      job_status: d?.job_status || 'pending',
      assigned_to: d?.assigned_to || null,
      finance_manager_id: d?.finance_manager_id || null,
      delivery_coordinator_id: d?.delivery_coordinator_id || null,
      customer_needs_loaner: d?.customer_needs_loaner || false,
      calendar_notes: d?.calendar_notes || null,

      // line items
      lineItems: (items || [])?.map(i => ({
        id: i?.id || null,
        product_id: i?.product_id,
        quantity: 1,
        unit_price: parseFloat(i?.unit_price ?? 0),
        promised_date: i?.promised_date || null,
        vendor_id: i?.vendor_id || null,
        product_name: i?.product_name || null,
      })),

      // passthrough for Rocket's service if needed
      customer_name: name,
    };

    let result;

    // --- Prefer Rocket's dealService if it's present and async ---
    if (typeof dealService?.createDeal === 'function') {
      if (draftId && typeof dealService?.updateDealWithLineItems === 'function') {
        result = await dealService?.updateDealWithLineItems(draftId, mapped);
      } else {
        result = await dealService?.createDeal(mapped);
      }
    } else {
      // Fallback to our jobService path
      if (draftId) {
        result = await jobService?.updateDealWithLineItems(draftId, mapped);
      } else {
        const created = await jobService?.createJob(mapped);
        const parentId = created?.data?.id || created?.id;
        if (!parentId) throw new Error(created?.error?.message || 'createJob failed');
        result = await jobService?.updateDealWithLineItems(parentId, mapped);
      }
    }

    // --- Refresh dash ---
    const updatedDeals = await dealService?.getDeals(); // Rocket fixed this
    setDeals(updatedDeals || []);
    setShowNewDealModal(false);
  } catch (err) {
    const msg = err?.message || String(err);
    const prefix = 'Failed to create deal';
    setSubmitError(msg?.includes(prefix) ? msg : `${prefix}: ${msg}`);
    console.error('Create deal error', err);
  }
};

  const handleLogin = async (e) => {
    e?.preventDefault();
    setSubmitError('');

    try {
      let result = await signIn(loginData?.email, loginData?.password);
      if (result?.success) {
        setShowLoginModal(false);
        setLoginData({ email: '', password: '' });
      } else {
        setSubmitError(result?.error || 'Login failed');
      }
    } catch (error) {
      setSubmitError(`Login error: ${error?.message}`);
    }
  };

  const handleDemoLogin = async () => {
    setSubmitError('');
    
    try {
      let result = await signIn('admin@priorityautomotive.com', 'admin123');
      if (result?.success) {
        setShowLoginModal(false);
      } else {
        setSubmitError(result?.error || 'Demo login failed');
      }
    } catch (error) {
      setSubmitError(`Demo login error: ${error?.message}`);
    }
  };

  // Show loading spinner while auth is loading
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Icon name="Loader" className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading authentication...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white p-8 rounded-lg shadow-lg border">
              <div className="text-center mb-6">
                <Icon name="Lock" className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">Authentication Required</h2>
                <p className="text-gray-600 mt-2">Please sign in to view deals and customer data</p>
              </div>
              
              <div className="space-y-4">
                <Button 
                  onClick={handleDemoLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Icon name="Play" size={18} className="mr-2" />
                  Demo Login (Admin Access)
                </Button>
                
                <Button 
                  onClick={() => setShowLoginModal(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Icon name="LogIn" size={18} className="mr-2" />
                  Custom Login
                </Button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <Icon name="Info" size={16} className="inline mr-1" />
                  Demo account includes pre-loaded customer data with off-site jobs scheduled for 10/17/2025
                </p>
              </div>
            </div>
          </div>

          {/* Custom Login Modal */}
          {showLoginModal && (
            <MobileModal
              isOpen={showLoginModal}
              onClose={() => setShowLoginModal(false)}
              title="Sign In"
            >
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginData?.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginData?.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <Icon name="AlertCircle" className="h-5 w-5 text-red-400 mr-2" />
                      <p className="text-red-800 text-sm">{submitError}</p>
                    </div>
                  </div>
                )}
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={() => setShowLoginModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Sign In
                  </Button>
                </div>
              </form>
            </MobileModal>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Deals Management</h1>
            <p className="text-gray-600 mt-1">Manage customer deals, vehicles, and service appointments</p>
          </div>
          <Button 
            onClick={() => setShowNewDealModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
          >
            <Icon name="Plus" size={18} />
            <span>New Deal</span>
          </Button>
        </div>

        {/* Deals Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center">
              <Icon name="FileText" className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Deals</p>
                <p className="text-2xl font-bold text-gray-900">{deals?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center">
              <Icon name="CheckCircle" className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deals?.filter(deal => deal?.job_status === 'completed')?.length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center">
              <Icon name="Clock" className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deals?.filter(deal => deal?.job_status === 'in_progress')?.length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex items-center">
              <Icon name="AlertCircle" className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deals?.filter(deal => deal?.job_status === 'scheduled')?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Deals Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Deals</h3>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Icon name="Loader" className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" />
                  <div className="text-gray-500">Loading deals...</div>
                </div>
              </div>
            ) : deals?.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deal Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Promise Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deals?.map((deal) => (
                    <tr key={deal?.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{deal?.title || 'Untitled Deal'}</div>
                          <div className="text-sm text-gray-500">{deal?.job_number || 'No Job Number'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {deal?.vehicles ? `${deal?.vehicles?.year} ${deal?.vehicles?.make} ${deal?.vehicles?.model}` : 'No Vehicle'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {deal?.vehicles?.owner_name || 'No Customer'}
                          {deal?.vehicles?.stock_number && ` - ${deal?.vehicles?.stock_number}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          deal?.job_status === 'completed' ? 'bg-green-100 text-green-800' :
                          deal?.job_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          deal?.job_status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          deal?.job_status === 'pending' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {deal?.job_status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {deal?.service_type === 'off_site' && (
                            <Icon name="MapPin" size={16} className="text-orange-500 mr-1" />
                          )}
                          <span className={`text-sm ${
                            deal?.service_type === 'off_site' ? 'text-orange-700 font-medium' : 'text-gray-600'
                          }`}>
                            {deal?.service_type === 'off_site' ? 'Off-Site' : 'In-House'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${parseFloat(deal?.estimated_cost || 0)?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {deal?.promised_date ? new Date(deal?.promised_date)?.toLocaleDateString() : 'No Promise Date'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Icon name="FileText" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No deals found.</p>
                  <p className="text-sm text-gray-400">Demo data should appear here once the migration is applied.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal for Creating a New Deal */}
        {showNewDealModal && (
          <MobileModal
            isOpen={showNewDealModal}
            onClose={() => setShowNewDealModal(false)}
            title="Create New Deal"
            size="large"
          >
            <DealForm
              mode="create"
              onSubmit={handleCreateDeal}
              onCancel={() => setShowNewDealModal(false)}
              products={products}
              vendors={vendors}
              salespeople={salespeople}
              deliveryCoordinators={deliveryCoordinators}
              financeManagers={financeManagers}
            />
            {submitError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <Icon name="AlertCircle" className="h-5 w-5 text-red-400 mr-2" />
                  <p className="text-red-800 text-sm">{submitError}</p>
                </div>
              </div>
            )}
          </MobileModal>
        )}
        
        {/* Error display outside modal - only show when no modal is open */}
        {submitError && !showNewDealModal && (
          <div className="fixed bottom-4 right-4 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50">
            <div className="flex items-center">
              <Icon name="AlertCircle" className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-800 text-sm">{submitError}</p>
              <button
                onClick={() => setSubmitError('')}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DealsPage;