import React, { useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';

const ResolutionTrendsChart = ({ data = [], title, timeframe }) => {
  const [metric, setMetric] = React.useState('resolution_time');

  const chartData = data?.map(item => ({
    month: item?.month_name || item?.month,
    resolution_time: parseFloat(item?.avg_resolution_time) || 0,
    completion_rate: parseFloat(item?.completion_rate) || 0,
    total_claims: item?.total_claims || 0,
    cost: parseFloat(item?.total_cost) || 0
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-blue-600">Resolution Time: {data?.resolution_time} days</p>
            <p className="text-sm text-green-600">Completion Rate: {data?.completion_rate}%</p>
            <p className="text-sm text-purple-600">Total Claims: {data?.total_claims}</p>
            <p className="text-sm text-orange-600">Cost: ${data?.cost?.toLocaleString()}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const getMetricConfig = () => {
    switch (metric) {
      case 'resolution_time':
        return {
          dataKey: 'resolution_time',
          color: '#3B82F6',
          name: 'Avg Resolution Time (days)',
          yAxisLabel: 'Days'
        };
      case 'completion_rate':
        return {
          dataKey: 'completion_rate',
          color: '#10B981',
          name: 'Completion Rate (%)',
          yAxisLabel: 'Percentage'
        };
      case 'total_claims':
        return {
          dataKey: 'total_claims',
          color: '#8B5CF6',
          name: 'Total Claims',
          yAxisLabel: 'Count'
        };
      case 'cost':
        return {
          dataKey: 'cost',
          color: '#F59E0B',
          name: 'Total Cost ($)',
          yAxisLabel: 'Cost ($)'
        };
      default:
        return {
          dataKey: 'resolution_time',
          color: '#3B82F6',
          name: 'Avg Resolution Time (days)',
          yAxisLabel: 'Days'
        };
    }
  };

  const metricConfig = getMetricConfig();

  // Calculate trend
  const calculateTrend = () => {
    if (chartData?.length < 2) return null;
    const firstValue = chartData?.[0]?.[metricConfig?.dataKey] || 0;
    const lastValue = chartData?.[chartData?.length - 1]?.[metricConfig?.dataKey] || 0;
    const change = ((lastValue - firstValue) / firstValue * 100);
    return {
      value: change?.toFixed(1),
      direction: change > 0 ? 'up' : 'down',
      isPositive: (metric === 'completion_rate' && change > 0) || 
                  (metric === 'resolution_time' && change < 0) ||
                  (metric === 'total_claims' && change > 0)
    };
  };

  const trend = calculateTrend();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 capitalize">{timeframe} analysis</p>
        </div>
        
        <div className="flex items-center gap-4">
          {trend && (
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${trend?.isPositive ? 'text-green-600' : 'text-red-600'}`} />
              <span className={`text-sm font-medium ${trend?.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend?.value}%
              </span>
            </div>
          )}
          
          <select
            value={metric}
            onChange={(e) => setMetric(e?.target?.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="resolution_time">Resolution Time</option>
            <option value="completion_rate">Completion Rate</option>
            <option value="total_claims">Claim Volume</option>
            <option value="cost">Cost Impact</option>
          </select>
        </div>
      </div>
      {chartData?.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig?.color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={metricConfig?.color} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: metricConfig?.yAxisLabel, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey={metricConfig?.dataKey} 
                stroke={metricConfig?.color}
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorMetric)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No trend data available</p>
            <p className="text-sm">Trends will appear once claims are processed</p>
          </div>
        </div>
      )}
      {/* Key Insights */}
      {chartData?.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Average Resolution</span>
            </div>
            <p className="text-lg font-bold text-blue-900">
              {chartData?.length > 0 
                ? (chartData?.reduce((sum, item) => sum + item?.resolution_time, 0) / chartData?.length)?.toFixed(1)
                : 0} days
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Success Rate</span>
            </div>
            <p className="text-lg font-bold text-green-900">
              {chartData?.length > 0 
                ? (chartData?.reduce((sum, item) => sum + item?.completion_rate, 0) / chartData?.length)?.toFixed(1)
                : 0}%
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-purple-900">Total Volume</span>
            </div>
            <p className="text-lg font-bold text-purple-900">
              {chartData?.reduce((sum, item) => sum + item?.total_claims, 0)?.toLocaleString()} claims
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResolutionTrendsChart;