// src/pages/deals/index.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDeals } from '../../services/dealService';
import ExportButton from '../../components/common/ExportButton';
import KpiRow from '../../components/common/KpiRow';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

const StatusPill = ({ status }) => {
  const bg = {
    new: 'bg-gray-100 text-gray-800',
    draft: 'bg-gray-200 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    canceled: 'bg-red-100 text-red-800',
  }?.[status] || 'bg-gray-100 text-gray-800';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg}`}>{(status || '')?.replace('_',' ')}</span>;
};

// Helper to format names as "Lastname, F."
const formatStaffName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName?.trim()?.split(' ');
  if (parts?.length < 2) return fullName;
  
  const firstName = parts?.[0];
  const lastName = parts?.slice(1)?.join(' ');
  const firstInitial = firstName?.[0]?.toUpperCase();
  
  return `${lastName}, ${firstInitial}.`;
};

// Service Location Tag Component
const ServiceLocationTag = ({ jobParts }) => {
  if (!jobParts || jobParts?.length === 0) {
    return <span className="text-xs text-gray-500">-</span>;
  }

  const hasOffSite = jobParts?.some(part => part?.is_off_site);
  const hasOnSite = jobParts?.some(part => !part?.is_off_site);

  if (hasOffSite && hasOnSite) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
          🏢 Off-Site
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          🏠 On-Site
        </span>
      </div>
    );
  }

  if (hasOffSite) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
        🏢 Off-Site
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
      🏠 On-Site
    </span>
  );
};

const SchedulingStatus = ({ jobParts }) => {
  if (!jobParts || jobParts?.length === 0) {
    return <span className="text-xs text-gray-500">No items</span>;
  }

  const schedulingItems = jobParts?.filter(part => part?.requires_scheduling);
  const noScheduleItems = jobParts?.filter(part => !part?.requires_scheduling);
  
  const upcomingPromises = schedulingItems?.filter(part => {
    if (!part?.promised_date) return false;
    const promiseDate = new Date(part?.promised_date);
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return promiseDate >= today;
  });

  const overduePromises = schedulingItems?.filter(part => {
    if (!part?.promised_date) return false;
    const promiseDate = new Date(part?.promised_date);
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return promiseDate < today;
  });

  if (overduePromises?.length > 0) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          {overduePromises?.length} overdue
        </span>
        {upcomingPromises?.length > 0 && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {upcomingPromises?.length} scheduled
          </span>
        )}
        {noScheduleItems?.length > 0 && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {noScheduleItems?.length} no schedule
          </span>
        )}
      </div>
    );
  }

  if (upcomingPromises?.length > 0) {
    const nextPromise = upcomingPromises?.sort((a, b) => 
      new Date(a?.promised_date) - new Date(b?.promised_date)
    )?.[0];
    const promiseDate = new Date(nextPromise?.promised_date);
    const formattedDate = promiseDate?.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return (
      <div className="flex flex-col space-y-1">
        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Next: {formattedDate}
        </span>
        {upcomingPromises?.length > 1 && (
          <span className="text-xs text-gray-500">
            +{upcomingPromises?.length - 1} more
          </span>
        )}
        {noScheduleItems?.length > 0 && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {noScheduleItems?.length} no schedule
          </span>
        )}
      </div>
    );
  }

  if (noScheduleItems?.length > 0) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
        {noScheduleItems?.length} no schedule needed
      </span>
    );
  }

  return (
    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
      Needs scheduling setup
    </span>
  );
};

export default function DealsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportFilters, setExportFilters] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dealLineItems, setDealLineItems] = useState([]);
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lineItemForm, setLineItemForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleId: null,
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    stockNumber: '',
    description: '',
    priority: 'medium',
    salespersonId: null,
    deliveryCoordinatorId: null,
    needsLoaner: false
  });
  const navigate = useNavigate();
  const { user } = useAuth();

  // Calculate KPIs with safety checks including drafts
  const calculateKPIs = (deals) => {
    const safeDeals = deals || [];
    
    const activeJobs = safeDeals?.filter(d => 
      d?.job_status && !['completed', 'canceled']?.includes(d?.job_status)
    )?.length || 0;
    
    const totalRevenue = safeDeals?.reduce((sum, deal) => {
      const revenue = parseFloat(deal?.total_amount) || 0;
      return sum + revenue;
    }, 0);
    
    const totalProfit = safeDeals?.reduce((sum, deal) => {
      const profit = parseFloat(deal?.profit_amount) || 0;
      return sum + profit;
    }, 0);
    
    const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
    
    const pendingJobs = safeDeals?.filter(d => 
      d?.job_status === 'new' || d?.job_status === 'pending'
    )?.length || 0;

    const totalDrafts = safeDeals?.filter(d => d?.job_status === 'draft')?.length || 0;
    
    return {
      active: activeJobs,
      revenue: totalRevenue?.toFixed(2) || '0.00',
      profit: totalProfit?.toFixed(2) || '0.00', 
      margin: margin?.toFixed(1) || '0.0',
      pending: pendingJobs,
      drafts: totalDrafts
    };
  };

  const kpis = calculateKPIs(rows);

  // Filter deals based on status
  const filteredDeals = rows?.filter(deal => {
    if (filterStatus === 'all') return true;
    return deal?.job_status === filterStatus;
  });

  // Quick Draft save helper
  const handleQuickSaveDraft = async () => {
    try {
      setIsSubmittingDeal(true);
      setSubmitError('');

      const customerName = (lineItemForm?.customerName || '')?.trim();
      const customerPhone = (lineItemForm?.customerPhone || '')?.trim() || null;
      const customerEmail = (lineItemForm?.customerEmail || '')?.trim() || null;

      if (!customerName) {
        setSubmitError('Customer name is required to save a draft.');
        return;
      }

      // Vehicle: prefer selected vehicle; else create a simple placeholder
      let vehicleId = lineItemForm?.vehicleId || null;
      if (!vehicleId) {
        const veh = {
          year: parseInt(lineItemForm?.vehicleYear || 0) || null,
          make: lineItemForm?.vehicleMake || null,
          model: lineItemForm?.vehicleModel || null,
          stock_number: lineItemForm?.stockNumber || `DRAFT-${Date.now()}`,
          owner_name: customerName,
          owner_phone: customerPhone,
          owner_email: customerEmail,
          vehicle_status: 'active',
          created_by: user?.id
        };
        const { data: v, error: vErr } = await supabase?.from('vehicles')?.insert([veh])?.select()?.single();
        if (vErr) throw vErr;
        vehicleId = v?.id;
      }

      const nowIso = new Date()?.toISOString();

      // Create a Draft job (no items yet)
      const job = {
        vehicle_id: vehicleId,
        vendor_id: null,
        description: (lineItemForm?.description || 'Draft deal'),
        priority: (lineItemForm?.priority || 'medium')?.toLowerCase(),
        job_status: 'draft',
        title: `Draft – ${customerName}`,
        estimated_cost: 0,
        created_by: lineItemForm?.salespersonId || user?.id,
        delivery_coordinator_id: lineItemForm?.deliveryCoordinatorId || null,
        customer_needs_loaner: !!lineItemForm?.needsLoaner,
        created_at: nowIso,
        promised_date: null,
        service_type: 'in_house',
        scheduled_start_time: null,
        scheduled_end_time: null,
        calendar_event_id: null,
        location: null,
        color_code: null
      };

      const { data: jobRow, error: jobErr } = await supabase?.from('jobs')?.insert([job])?.select()?.single();
      if (jobErr) throw jobErr;

      // Ensure a transaction exists even for drafts (0 total)
      const tx = {
        job_id: jobRow?.id,
        vehicle_id: vehicleId,
        total_amount: 0,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        transaction_status: 'pending',
        created_at: nowIso
      };
      const { error: txErr } = await supabase?.from('transactions')?.upsert([tx], { onConflict: 'job_id' });
      if (txErr) throw txErr;

      alert('✅ Draft saved. You can add items and details later.');
      setShowNewDealModal(false);
      setSelectedDeal(null);
      setDealLineItems([]);
      setStockSearchResults([]);
      await loadDeals();
    } catch (e) {
      console.error(e);
      setSubmitError(`Failed to save draft: ${e?.message}`);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  const handleSaveDeal = async () => {
    // If there are no items, save as Draft instead of blocking.
    if (!dealLineItems?.length) {
      await handleQuickSaveDraft();
      return;
    }

    try {
      setIsSubmittingDeal(true);
      setSubmitError('');

      const mainItem = dealLineItems?.[0];
      const totalDealValue = dealLineItems?.reduce((sum, item) => sum + (parseFloat(item?.totalPrice) || 0), 0);

      if (selectedDeal?.id) {
        // EDITING MODE - Update existing deal
        const dealUpdateData = {
          vendor_id: mainItem?.vendor?.id || null,
          description: mainItem?.description || `Updated Deal - ${dealLineItems?.length} items`,
          priority: mainItem?.priority?.toLowerCase() || 'medium',
          estimated_cost: totalDealValue,
          created_by: mainItem?.salesperson?.id || user?.id,
          delivery_coordinator_id: mainItem?.deliveryCoordinator?.id || null,
          customer_needs_loaner: mainItem?.needsLoaner || false,
          service_type: mainItem?.vendor ? 'vendor' : 'in_house'
        };

        // Promote draft once items exist
        if (selectedDeal?.job_status === 'draft' && dealLineItems?.length > 0) {
          dealUpdateData.job_status = 'pending';
        }

        // Update the deal
        const { error: updateErr } = await supabase?.from('jobs')?.update(dealUpdateData)?.eq('id', selectedDeal?.id);
        if (updateErr) throw updateErr;

        // Update the transaction
        const tx = {
          job_id: selectedDeal?.id,
          total_amount: totalDealValue,
          customer_name: mainItem?.customerName || '',
          customer_phone: mainItem?.customerPhone || '',
          customer_email: mainItem?.customerEmail || '',
          transaction_status: 'pending',
          created_at: new Date()?.toISOString()
        };
        const { error: txErr } = await supabase?.from('transactions')?.upsert([tx], { onConflict: 'job_id' });
        if (txErr) throw txErr;

        alert('✅ Deal saved successfully!');
        setShowNewDealModal(false);
        setSelectedDeal(null);
        setDealLineItems([]);
        setStockSearchResults([]);
        await loadDeals();
      } else {
        // CREATE MODE - Add new deal
        const nowIso = new Date()?.toISOString();

        const job = {
          vehicle_id: lineItemForm?.vehicleId || null,
          vendor_id: mainItem?.vendor?.id || null,
          description: mainItem?.description || `New Deal - ${dealLineItems?.length} items`,
          priority: mainItem?.priority?.toLowerCase() || 'medium',
          job_status: 'pending',
          title: `New Deal – ${mainItem?.customerName || 'Customer'}`,
          estimated_cost: totalDealValue,
          created_by: mainItem?.salesperson?.id || user?.id,
          delivery_coordinator_id: mainItem?.deliveryCoordinator?.id || null,
          customer_needs_loaner: mainItem?.needsLoaner || false,
          created_at: nowIso,
          promised_date: null,
          service_type: mainItem?.vendor ? 'vendor' : 'in_house',
          scheduled_start_time: null,
          scheduled_end_time: null,
          calendar_event_id: null,
          location: null,
          color_code: null
        };

        const { data: jobRow, error: jobErr } = await supabase?.from('jobs')?.insert([job])?.select()?.single();
        if (jobErr) throw jobErr;

        // Create transaction
        const tx = {
          job_id: jobRow?.id,
          vehicle_id: lineItemForm?.vehicleId || null,
          total_amount: totalDealValue,
          customer_name: mainItem?.customerName || '',
          customer_phone: mainItem?.customerPhone || '',
          customer_email: mainItem?.customerEmail || '',
          transaction_status: 'pending',
          created_at: nowIso
        };
        const { error: txErr } = await supabase?.from('transactions')?.insert([tx]);
        if (txErr) throw txErr;

        alert('✅ Deal created successfully!');
        setShowNewDealModal(false);
        setSelectedDeal(null);
        setDealLineItems([]);
        setStockSearchResults([]);
        await loadDeals();
      }
    } catch (e) {
      console.error(e);
      setSubmitError(`Failed to save deal: ${e?.message}`);
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  // Helper function for missing bits banner
  const missingBits = (deal) => {
    const needs = [];
    if (!deal?.items?.length) needs?.push('line items');
    if (!deal?.salesperson || deal?.salesperson === 'Unassigned') needs?.push('salesperson');
    return needs;
  };

  const loadDeals = async () => {
    try {
      const data = await getAllDeals();
      setRows(data);
    } catch (e) {
      alert(e?.message || 'Failed to load deals');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAllDeals();
        if (alive) setRows(data);
      } catch (e) {
        alert(e?.message || 'Failed to load deals');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Deal Tracker</h1>
        <div className="flex items-center space-x-3">
          <ExportButton
            exportType="jobs"
            filters={exportFilters}
            onExportStart={() => console.log('Starting export...')}
            onExportComplete={(recordCount, filename) => console.log(`Export complete: ${recordCount} records exported to ${filename}`)}
            onExportError={(errorMessage) => alert(`Export failed: ${errorMessage}`)}
            variant="outline"
            size="sm"
          />
          <button
            data-testid="new-deal-btn"
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setShowNewDealModal(true)}
          >
            New Deal
          </button>
        </div>
      </div>
      {/* Draft nudge banner */}
      {kpis?.drafts > 0 && (
        <div className="mt-3 p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-sm flex items-center justify-between">
          <span>⏳ You have {kpis?.drafts} draft deal{kpis?.drafts > 1 ? 's' : ''} to finish.</span>
          <Button size="sm" variant="ghost" onClick={() => setFilterStatus('draft')} className="text-amber-700 hover:text-amber-800">View drafts</Button>
        </div>
      )}
      {/* KPI Row with Drafts */}
      <div className="mb-6 p-4 bg-white border rounded">
        <KpiRow
          active={kpis?.active}
          revenue={kpis?.revenue}
          profit={kpis?.profit}
          margin={kpis?.margin}
          pending={kpis?.pending}
        />
        <div className={`bg-white p-6 rounded-xl border shadow-sm`}>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-gray-100 mr-4">
              <Icon name="File" size={24} className="text-gray-700" />
            </div>
            <div>
              <h3 className={`text-gray-600 text-sm font-medium uppercase tracking-wide`}>Drafts</h3>
              <p className={`text-gray-900 text-2xl font-bold`}>{kpis?.drafts}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Filter chips including Draft */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {['all', 'draft', 'pending', 'in_progress', 'completed']?.map(status => (
          <button
            key={status}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              filterStatus === status 
                ? 'bg-blue-100 text-blue-800' :'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? `All (${rows?.length || 0})` :
             status === 'draft' ? `Draft (${kpis?.drafts})` :
             status === 'in_progress' ? `Active (${kpis?.active})` :
             status === 'pending' ? `Pending (${kpis?.pending})` :
             status?.charAt(0)?.toUpperCase() + status?.slice(1)}
          </button>
        ))}
      </div>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 text-left text-sm text-gray-600">
            <tr>
              <th className="px-4 py-2">Job #</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">DC / Sales</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Scheduling</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr><td className="px-4 py-8 text-center" colSpan={8}>Loading...</td></tr>
            ) : filteredDeals?.length === 0 ? (
              <tr><td className="px-4 py-8 text-center" colSpan={8}>No deals</td></tr>
            ) : filteredDeals?.map(d => (
              <tr key={d?.id} className="border-t hover:bg-gray-50/70">
                <td className="px-4 py-2">{d?.job_number || d?.id}</td>
                <td className="px-4 py-2">
                  <div>
                    {d?.title}
                    {d?.job_status === 'draft' && (
                      <div className="mt-2 p-2 rounded border bg-amber-50 border-amber-300 text-amber-800 text-xs">
                        ⏳ Draft – needs {missingBits(d)?.join(', ') || 'details'}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {d?.vehicle
                    ? `${d?.vehicle?.year || ''} ${d?.vehicle?.make || ''} ${d?.vehicle?.model || ''}${
                        d?.vehicle?.stock_number ? ' • Stock: ' + d?.vehicle?.stock_number : ''
                      }`?.trim()
                    : '-'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-col space-y-1">
                    {d?.delivery_coordinator_name && (
                      <div className="text-xs">
                        <span className="text-gray-500">DC:</span> {formatStaffName(d?.delivery_coordinator_name)}
                      </div>
                    )}
                    {d?.sales_consultant_name && (
                      <div className="text-xs">
                        <span className="text-gray-500">Sales:</span> {formatStaffName(d?.sales_consultant_name)}
                      </div>
                    )}
                    {!d?.delivery_coordinator_name && !d?.sales_consultant_name && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <ServiceLocationTag jobParts={d?.job_parts} />
                </td>
                <td className="px-4 py-2"><StatusPill status={d?.job_status} /></td>
                <td className="px-4 py-2">
                  <SchedulingStatus jobParts={d?.job_parts} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="px-3 py-1 rounded border hover:bg-gray-50 mr-2"
                    onClick={() => navigate(`/deals/edit/${d?.id}`)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* New Deal Modal */}
      {showNewDealModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Deal</h3>
            
            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer Name *</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg bg-white"
                  value={lineItemForm?.customerName || ''}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, customerName: e?.target?.value }))}
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Customer Phone</label>
                <input
                  type="tel"
                  className="w-full p-3 border rounded-lg bg-white"
                  value={lineItemForm?.customerPhone || ''}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, customerPhone: e?.target?.value }))}
                  placeholder="Enter customer phone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Customer Email</label>
                <input
                  type="email"
                  className="w-full p-3 border rounded-lg bg-white"
                  value={lineItemForm?.customerEmail || ''}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, customerEmail: e?.target?.value }))}
                  placeholder="Enter customer email"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => {
                  setShowNewDealModal(false);
                  setLineItemForm({});
                  setSubmitError('');
                }}
              >
                Cancel
              </button>
              <Button
                onClick={handleQuickSaveDraft}
                disabled={!lineItemForm?.customerName?.trim() || isSubmittingDeal}
                className="flex-1"
              >
                {isSubmittingDeal ? 'Creating...' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}