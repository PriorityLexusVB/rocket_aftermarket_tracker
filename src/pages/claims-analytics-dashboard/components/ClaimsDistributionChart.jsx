import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const ClaimsDistributionChart = ({ data = [], title }) => {
  const [viewType, setViewType] = React.useState('pie');

  const chartData = data?.map((item, index) => ({
    name: item?.category,
    value: item?.total_claims,
    cost: parseFloat(item?.total_cost) || 0,
    completion_rate: parseFloat(item?.completion_rate) || 0,
    color: COLORS?.[index % COLORS?.length]
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data?.name}</p>
          <p className="text-sm text-blue-600">Claims: {data?.value}</p>
          <p className="text-sm text-green-600">Cost: ${data?.cost?.toLocaleString()}</p>
          <p className="text-sm text-purple-600">Completion: {data?.completion_rate}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewType('pie')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewType === 'pie' ?'bg-white text-blue-600 shadow-sm' :'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pie Chart
          </button>
          <button
            onClick={() => setViewType('bar')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewType === 'bar' ?'bg-white text-blue-600 shadow-sm' :'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bar Chart
          </button>
        </div>
      </div>
      {chartData?.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100)?.toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry?.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                  {chartData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry?.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No claims data available</p>
            <p className="text-sm">Claims will appear here once data is available</p>
          </div>
        </div>
      )}
      {/* Summary Stats */}
      {chartData?.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {chartData?.reduce((sum, item) => sum + item?.value, 0)}
            </p>
            <p className="text-sm text-gray-600">Total Claims</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {chartData?.length}
            </p>
            <p className="text-sm text-gray-600">Categories</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              ${chartData?.reduce((sum, item) => sum + item?.cost, 0)?.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Total Cost</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {chartData?.length > 0 
                ? (chartData?.reduce((sum, item) => sum + item?.completion_rate, 0) / chartData?.length)?.toFixed(1)
                : 0}%
            </p>
            <p className="text-sm text-gray-600">Avg Completion</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsDistributionChart;