import React from 'react';
import { ShoppingCart, Package, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DealAnalyticsWidget = ({ data }) => {
  // Process deal data for chart
  const processChartData = () => {
    if (!data?.deals || data?.deals?.length === 0) return [];
    
    // Group deals by products count ranges
    const ranges = {
      '1-2 Products': { range: '1-2 Products', count: 0, total_revenue: 0 },
      '3-5 Products': { range: '3-5 Products', count: 0, total_revenue: 0 },
      '6-10 Products': { range: '6-10 Products', count: 0, total_revenue: 0 },
      '10+ Products': { range: '10+ Products', count: 0, total_revenue: 0 }
    };

    data?.deals?.forEach(deal => {
      const productCount = deal?.products_count || 0;
      let rangeKey;
      
      if (productCount <= 2) rangeKey = '1-2 Products';
      else if (productCount <= 5) rangeKey = '3-5 Products';
      else if (productCount <= 10) rangeKey = '6-10 Products';
      else rangeKey = '10+ Products';

      ranges[rangeKey].count += 1;
      ranges[rangeKey].total_revenue += deal?.products_revenue || 0;
    });

    return Object.values(ranges)?.filter(range => range?.count > 0);
  };

  const chartData = processChartData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{label}</p>
          <p className="text-blue-600">Deals: {data?.count}</p>
          <p className="text-green-600">Revenue: ${data?.total_revenue?.toLocaleString()}</p>
          <p className="text-purple-600">Avg: ${(data?.total_revenue / data?.count)?.toFixed(0)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="w-6 h-6 text-indigo-600 mr-2" />
            Deal Analytics
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Product distribution and averages per transaction
          </p>
        </div>
        <div className="flex items-center text-green-600">
          <TrendingUp className="w-5 h-5 mr-1" />
          <span className="text-sm font-semibold">Trending</span>
        </div>
      </div>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Avg Products</p>
              <p className="text-xl font-bold text-blue-600">
                {data?.averages?.products_per_deal || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Avg Revenue</p>
              <p className="text-xl font-bold text-green-600">
                ${parseFloat(data?.averages?.revenue_per_deal || 0)?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-100">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Deals</p>
              <p className="text-xl font-bold text-purple-600">
                {data?.averages?.total_deals || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl border border-orange-100">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold text-orange-600">
                ${parseFloat(data?.averages?.total_revenue || 0)?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Deal Distribution Chart */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Deal Distribution by Product Count</h4>
        {chartData?.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No deal distribution data available</p>
            </div>
          </div>
        )}
      </div>
      {/* Recent Deals Summary */}
      {data?.deals && data?.deals?.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Recent High-Value Deals</h4>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {data?.deals?.sort((a, b) => (b?.products_revenue || 0) - (a?.products_revenue || 0))?.slice(0, 5)?.map((deal, index) => (
                <div 
                  key={deal?.job_id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-gray-900">
                      {deal?.job_number || `Deal #${index + 1}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {deal?.vehicle_info} • {deal?.products_count} products
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      ${deal?.products_revenue?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(deal.created_at)?.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
      {/* No Data State */}
      {(!data?.deals || data?.deals?.length === 0) && (
        <div className="text-center py-8">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">No Deal Data</h3>
          <p className="text-gray-400">
            No deal analytics data available to display
          </p>
        </div>
      )}
    </div>
  );
};

export default DealAnalyticsWidget;