import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui';
import DealForm from './DealForm';
import dealService from '../../services/dealService';

const DealsPage = () => {
  const [deals, setDeals] = useState([]);
  const [editingDeal, setEditingDeal] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await dealService?.getDeals();
      setDeals(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleAddNew = () => {
    setEditingDeal(null);
    setIsFormOpen(true);
  };

  const handleEdit = (deal) => {
    setEditingDeal(deal);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this deal?')) {
      try {
        await dealService?.deleteDeal(id);
        fetchDeals();
      } catch (err) {
        setError(err?.message || 'Failed to delete deal');
      }
    }
  };

  const handleSave = async (dealData) => {
    try {
      if (editingDeal) {
        await dealService?.updateDeal(editingDeal?.id, dealData);
      } else {
        await dealService?.createDeal(dealData);
      }
      fetchDeals();
      setIsFormOpen(false);
      setEditingDeal(null);
    } catch (err) {
      setError(err?.message || 'Failed to save deal');
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingDeal(null);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
      'in_progress': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      'scheduled': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }
    };
    
    const config = statusConfig?.[status] || statusConfig?.['pending'];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config?.bg} ${config?.text} ${config?.border}`}>
        {status?.replace('_', ' ')?.toUpperCase()}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    })?.format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString)?.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Deals Management</h1>
              <p className="text-gray-600 mt-1">Manage customer deals and transactions</p>
              <div className="flex items-center space-x-4 mt-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Total Deals: {deals?.length || 0}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Active: {deals?.filter(d => d?.job_status !== 'completed' && d?.job_status !== 'cancelled')?.length || 0}
                  </span>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleAddNew}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-all duration-200 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Deal</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingDeal ? 'Edit Deal' : 'Create New Deal'}
              </h2>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
              <DealForm 
                deal={editingDeal} 
                onSave={handleSave} 
                onCancel={handleCancel} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Deals Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Deal Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Sales Person
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deals?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 font-medium">No deals found</p>
                      <p className="text-gray-400 text-sm">Get started by creating your first deal</p>
                      <Button
                        onClick={handleAddNew}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                      >
                        Create Deal
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                deals?.map((deal) => (
                  <tr key={deal?.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          #{deal?.job_number || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(deal?.created_at)}
                        </div>
                        {deal?.promised_date && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                            Due: {formatDate(deal?.promised_date)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {deal?.vehicles?.owner_name || deal?.transactions?.[0]?.customer_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {deal?.vehicles?.owner_phone || deal?.transactions?.[0]?.customer_phone || 'No phone'}
                        </div>
                        {(deal?.vehicles?.owner_email || deal?.transactions?.[0]?.customer_email) && (
                          <div className="text-xs text-gray-400">
                            {deal?.vehicles?.owner_email || deal?.transactions?.[0]?.customer_email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {deal?.vehicles ? 
                            `${deal?.vehicles?.year} ${deal?.vehicles?.make} ${deal?.vehicles?.model}` : 
                            deal?.title || 'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {deal?.vehicles?.color && `${deal?.vehicles?.color} • `}
                          {deal?.vehicles?.stock_number ? `Stock: ${deal?.vehicles?.stock_number}` : 'No stock #'}
                        </div>
                        {deal?.vehicles?.vin && (
                          <div className="text-xs text-gray-400 font-mono">
                            VIN: {deal?.vehicles?.vin?.slice(-8)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {deal?.sales_person?.full_name || deal?.assigned_user?.full_name || 'Unassigned'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {deal?.delivery_coordinator?.full_name && `Delivery: ${deal?.delivery_coordinator?.full_name}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-bold text-green-600 text-lg">
                          {formatCurrency(deal?.estimated_cost || deal?.transactions?.[0]?.total_amount)}
                        </div>
                        {deal?.transactions?.[0]?.transaction_status && (
                          <div className="text-xs text-gray-500">
                            Payment: {deal?.transactions?.[0]?.transaction_status}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {getStatusBadge(deal?.job_status)}
                        {deal?.priority && deal?.priority !== 'medium' && (
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            deal?.priority === 'high' || deal?.priority === 'urgent' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {deal?.priority?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(deal)}
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(deal?.id)}
                          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Statistics */}
      {deals?.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    deals?.reduce((sum, deal) => 
                      sum + (parseFloat(deal?.estimated_cost || deal?.transactions?.[0]?.total_amount || 0)), 0
                    )
                  )}
                </p>
                <p className="text-gray-600">Total Value</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {deals?.filter(d => d?.job_status === 'completed')?.length}
                </p>
                <p className="text-gray-600">Completed</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {deals?.filter(d => d?.job_status === 'pending' || d?.job_status === 'in_progress')?.length}
                </p>
                <p className="text-gray-600">In Progress</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;