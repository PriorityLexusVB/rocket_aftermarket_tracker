import React from 'react';
import { Clock, AlertCircle, CheckCircle, XCircle, DollarSign, TrendingUp } from 'lucide-react';

const ClaimStatsWidget = ({ stats }) => {
  if (!stats) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'under_review': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'denied': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'resolved': return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount || 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Claims */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Claims</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.total}</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-sm text-gray-600">
            {stats?.recentClaims} new in last 30 days
          </span>
        </div>
      </div>
      {/* Total Amount */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalAmount)}</p>
          </div>
          <div className="p-3 bg-green-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-sm text-gray-600">
            Avg: {formatCurrency(stats?.avgAmount)}
          </span>
        </div>
      </div>
      {/* Status Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-600">By Status</p>
          <div className="p-2 bg-yellow-100 rounded-lg">
            <TrendingUp className="w-4 h-4 text-yellow-600" />
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(stats?.byStatus || {})?.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(status)}
                <span className="text-sm text-gray-700 capitalize">
                  {status?.replace('_', ' ')}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Priority Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-600">By Priority</p>
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(stats?.byPriority || {})?.map(([priority, count]) => (
            <div key={priority} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`} />
                <span className="text-sm text-gray-700 capitalize">{priority}</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export default ClaimStatsWidget;