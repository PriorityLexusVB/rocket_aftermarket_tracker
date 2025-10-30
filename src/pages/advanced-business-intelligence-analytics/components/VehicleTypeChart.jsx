import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Car, TrendingUp } from 'lucide-react';

const VehicleTypeChart = ({ data }) => {
  // Process data for charts
  const processVehicleTypeData = () => {
    if (!data || (!data?.new && !data?.used)) return [];
    
    const newVehiclesRevenue = data?.new?.reduce((sum, item) => sum + item?.total_price, 0) || 0;
    const usedVehiclesRevenue = data?.used?.reduce((sum, item) => sum + item?.total_price, 0) || 0;
    
    const newVehiclesCount = data?.new?.length || 0;
    const usedVehiclesCount = data?.used?.length || 0;

    return [
      {
        name: 'New Vehicles',
        value: newVehiclesRevenue,
        count: newVehiclesCount,
        color: '#3b82f6'
      },
      {
        name: 'Used Vehicles',
        value: usedVehiclesRevenue,
        count: usedVehiclesCount,
        color: '#10b981'
      }
    ];
  };

  // Process popular models data
  const getPopularModels = () => {
    if (!data || (!data?.new && !data?.used)) return [];
    
    const allVehicles = [...(data?.new || []), ...(data?.used || [])];
    const modelCounts = {};

    allVehicles?.forEach(vehicle => {
      const key = `${vehicle?.vehicle_make} ${vehicle?.vehicle_model}`;
      if (!modelCounts?.[key]) {
        modelCounts[key] = {
          model: key,
          count: 0,
          revenue: 0,
          make: vehicle?.vehicle_make,
          model_name: vehicle?.vehicle_model
        };
      }
      modelCounts[key].count += 1;
      modelCounts[key].revenue += vehicle?.total_price;
    });

    return Object.values(modelCounts)?.sort((a, b) => b?.revenue - a?.revenue)?.slice(0, 6);
  };

  const pieData = processVehicleTypeData();
  const popularModels = getPopularModels();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{data?.name}</p>
          <p className="text-green-600">Revenue: ${data?.value?.toLocaleString()}</p>
          <p className="text-blue-600">Products: {data?.count}</p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{data?.model}</p>
          <p className="text-green-600">Revenue: ${data?.revenue?.toLocaleString()}</p>
          <p className="text-blue-600">Products Sold: {data?.count}</p>
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
            <Car className="w-6 h-6 text-indigo-600 mr-2" />
            Vehicle Type Analysis
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Product sales distribution by vehicle age category
          </p>
        </div>
        <div className="flex items-center text-green-600">
          <TrendingUp className="w-5 h-5 mr-1" />
          <span className="text-sm font-semibold">Active</span>
        </div>
      </div>
      {/* Pie Chart */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Revenue Distribution</h4>
        {pieData?.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    `${name}: ${(percent * 100)?.toFixed(1)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry?.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: entry?.color }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No vehicle type data available</p>
            </div>
          </div>
        )}
      </div>
      {/* Popular Models Bar Chart */}
      <div>
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Models</h4>
        {popularModels?.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={popularModels}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <XAxis 
                  dataKey="model" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No model performance data available</p>
            </div>
          </div>
        )}
      </div>
      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {data?.new?.length || 0}
            </div>
            <div className="text-sm text-gray-600">New Vehicle Products</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data?.used?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Used Vehicle Products</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleTypeChart;