import React, { useState, useMemo } from 'react';
import { Package, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';

const ProductPerformanceMatrix = ({ data, selectedCategory }) => {
  const [sortBy, setSortBy] = useState('total_revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filter and sort data
  const processedData = React.useMemo(() => {
    let filtered = data || [];
    
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered?.filter(item => item?.category === selectedCategory);
    }

    return filtered?.sort((a, b) => {
      const valueA = parseFloat(a?.[sortBy]) || 0;
      const valueB = parseFloat(b?.[sortBy]) || 0;
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [data, selectedCategory, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'desc' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />;
  };

  // Calculate performance score (simple scoring based on revenue and quantity)
  const getPerformanceScore = (item) => {
    const maxRevenue = Math.max(...processedData?.map(d => parseFloat(d?.total_revenue) || 0));
    const maxQuantity = Math.max(...processedData?.map(d => d?.total_quantity_sold || 0));
    
    if (maxRevenue === 0 && maxQuantity === 0) return 0;
    
    const revenueScore = maxRevenue > 0 ? (parseFloat(item?.total_revenue) || 0) / maxRevenue * 50 : 0;
    const quantityScore = maxQuantity > 0 ? (item?.total_quantity_sold || 0) / maxQuantity * 50 : 0;
    
    return Math.round(revenueScore + quantityScore);
  };

  const getPerformanceColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getPerformanceLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Below Average';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Package className="w-6 h-6 text-indigo-600 mr-2" />
            Product Performance Matrix
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Category-wise product analysis with performance scoring
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
        </div>
      </div>
      {processedData?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('products_count')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Products</span>
                    {getSortIcon('products_count')}
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total_quantity_sold')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Quantity Sold</span>
                    {getSortIcon('total_quantity_sold')}
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total_revenue')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Revenue</span>
                    {getSortIcon('total_revenue')}
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('avg_price_per_unit')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Avg Price</span>
                    {getSortIcon('avg_price_per_unit')}
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Performance</th>
              </tr>
            </thead>
            <tbody>
              {processedData?.map((category, index) => {
                const performanceScore = getPerformanceScore(category);
                return (
                  <tr 
                    key={category?.category} 
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-semibold text-gray-900">{category?.category}</div>
                        <div className="text-sm text-gray-500">
                          {category?.products?.length || 0} unique products
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <ShoppingCart className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="font-semibold">{category?.products_count}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-blue-600">
                        {category?.total_quantity_sold?.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                        <span className="font-semibold text-green-600">
                          {parseFloat(category?.total_revenue)?.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-700">
                        ${parseFloat(category?.avg_price_per_unit)?.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getPerformanceColor(performanceScore)}`}
                              style={{ width: `${performanceScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            {performanceScore}%
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          performanceScore >= 80 
                            ? 'bg-green-100 text-green-800' 
                            : performanceScore >= 60 
                            ? 'bg-yellow-100 text-yellow-800'
                            : performanceScore >= 40
                            ? 'bg-orange-100 text-orange-800' :'bg-red-100 text-red-800'
                        }`}>
                          {getPerformanceLabel(performanceScore)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">No Performance Data</h3>
          <p className="text-gray-400">
            {selectedCategory === 'all' ?'No product categories found with sales data'
              : `No data available for ${selectedCategory} category`
            }
          </p>
        </div>
      )}
      {/* Performance Legend */}
      {processedData?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Performance Score:</span>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Excellent (80-100%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Good (60-79%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Average (40-59%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Below Average (&lt;40%)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPerformanceMatrix;