import React from 'react'
import { DollarSign, TrendingDown, TrendingUp, PieChart, AlertCircle } from 'lucide-react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

const FinancialImpactWidget = ({ data = {}, title }) => {
  const {
    total_estimated_cost = 0,
    total_actual_cost = 0,
    total_recovered = 0,
    net_financial_impact = 0,
    cost_accuracy_rate = 0,
    total_overruns = 0,
    total_savings = 0,
    recovery_rate = 0,
    category_breakdown = [],
  } = data

  // Prepare data for cost breakdown chart
  const costBreakdownData = category_breakdown?.slice(0, 5)?.map((item, index) => ({
    name: item?.category,
    value: parseFloat(item?.total_cost) || 0,
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']?.[index % 5],
  }))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })?.format(parseFloat(amount) || 0)
  }

  const getPerformanceColor = (value, isReverse = false) => {
    if (isReverse) {
      if (value >= 90) return 'text-green-600'
      if (value >= 75) return 'text-blue-600'
      if (value >= 60) return 'text-yellow-600'
      return 'text-red-600'
    } else {
      if (value <= 10) return 'text-green-600'
      if (value <= 25) return 'text-blue-600'
      if (value <= 40) return 'text-yellow-600'
      return 'text-red-600'
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data?.name}</p>
          <p className="text-sm text-gray-600">{formatCurrency(data?.value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <DollarSign className="h-4 w-4" />
          Cost impact and recovery analysis
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Total Cost</span>
          </div>
          <p className="text-lg font-bold text-blue-900">{formatCurrency(total_actual_cost)}</p>
          <p className="text-xs text-blue-700">
            vs {formatCurrency(total_estimated_cost)} estimated
          </p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Recovered</span>
          </div>
          <p className="text-lg font-bold text-green-900">{formatCurrency(total_recovered)}</p>
          <p className="text-xs text-green-700">{recovery_rate}% recovery rate</p>
        </div>

        <div
          className={`p-4 rounded-lg ${parseFloat(net_financial_impact) >= 0 ? 'bg-red-50' : 'bg-green-50'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            {parseFloat(net_financial_impact) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-600" />
            )}
            <span
              className={`text-sm font-medium ${parseFloat(net_financial_impact) >= 0 ? 'text-red-900' : 'text-green-900'}`}
            >
              Net Impact
            </span>
          </div>
          <p
            className={`text-lg font-bold ${parseFloat(net_financial_impact) >= 0 ? 'text-red-900' : 'text-green-900'}`}
          >
            {formatCurrency(net_financial_impact)}
          </p>
          <p
            className={`text-xs ${parseFloat(net_financial_impact) >= 0 ? 'text-red-700' : 'text-green-700'}`}
          >
            {parseFloat(net_financial_impact) >= 0 ? 'Cost exposure' : 'Recovered surplus'}
          </p>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Accuracy</span>
          </div>
          <p
            className={`text-lg font-bold ${getPerformanceColor(parseFloat(cost_accuracy_rate), true)}`}
          >
            {cost_accuracy_rate}%
          </p>
          <p className="text-xs text-purple-700">Cost estimation accuracy</p>
        </div>
      </div>

      {/* Cost Variance Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-4">Cost Variance Breakdown</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">Overruns</span>
              </div>
              <span className="font-bold text-red-900">{formatCurrency(total_overruns)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Savings</span>
              </div>
              <span className="font-bold text-green-900">{formatCurrency(total_savings)}</span>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Net Variance</span>
                <span
                  className={`font-bold ${
                    parseFloat(total_overruns) - parseFloat(total_savings) > 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {formatCurrency(parseFloat(total_overruns) - parseFloat(total_savings))}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-800 mb-4">Cost by Category</h4>
          {costBreakdownData?.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {costBreakdownData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry?.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) =>
                      value?.length > 15 ? `${value?.substring(0, 15)}...` : value
                    }
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <PieChart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No category data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown Table */}
      {category_breakdown?.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-4">Detailed Category Analysis</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-900">
                    Category
                  </th>
                  <th className="text-center py-2 px-4 text-sm font-medium text-gray-900">
                    Claims
                  </th>
                  <th className="text-center py-2 px-4 text-sm font-medium text-gray-900">
                    Total Cost
                  </th>
                  <th className="text-center py-2 px-4 text-sm font-medium text-gray-900">
                    Avg Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {category_breakdown?.map((category, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-medium text-gray-900">
                      {category?.category}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600 text-center">
                      {category?.claim_count}
                    </td>
                    <td className="py-2 px-4 text-sm font-medium text-gray-900 text-center">
                      {formatCurrency(category?.total_cost)}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600 text-center">
                      {formatCurrency(category?.avg_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Object.keys(data)?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No financial impact data available</p>
          <p className="text-sm">Financial metrics will appear once claims are processed</p>
        </div>
      )}
    </div>
  )
}

export default FinancialImpactWidget
