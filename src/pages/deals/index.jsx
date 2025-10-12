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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })?.format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString)?.toLocaleDateString();
  };

  const getStatusBadge = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors?.[status] || colors?.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-gray-600">Manage customer deals and transactions</p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          New Deal
        </Button>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {/* Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingDeal ? 'Edit Deal' : 'Create New Deal'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sales Person
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
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
            {deals?.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <div className="text-center">
                    <p className="text-lg font-medium">No deals found</p>
                    <p className="text-gray-400 mb-4">Get started by creating your first deal</p>
                    <Button
                      onClick={handleAddNew}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Create Deal
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              deals?.map((deal) => (
                <tr key={deal?.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        #{deal?.job_number || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(deal?.created_at)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {deal?.vehicles?.owner_name || deal?.transactions?.[0]?.customer_name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {deal?.vehicles?.owner_phone || deal?.transactions?.[0]?.customer_phone || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {deal?.vehicles ? 
                        `${deal?.vehicles?.year} ${deal?.vehicles?.make} ${deal?.vehicles?.model}` : 
                        deal?.title || 'N/A'
                      }
                    </div>
                    {deal?.vehicles?.stock_number && (
                      <div className="text-sm text-gray-500">
                        Stock: {deal?.vehicles?.stock_number}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {deal?.sales_person?.full_name || deal?.assigned_user?.full_name || 'Unassigned'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(deal?.estimated_cost || deal?.transactions?.[0]?.total_amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(deal?.job_status)}`}>
                      {deal?.job_status?.replace('_', ' ')?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(deal)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(deal?.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DealsPage;