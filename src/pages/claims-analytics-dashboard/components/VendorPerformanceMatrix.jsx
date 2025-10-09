import React, { useState, useMemo } from 'react';
import { Star, Clock, DollarSign, Award } from 'lucide-react';

const VendorPerformanceMatrix = ({ data = [], title }) => {
  const [sortBy, setSortBy] = React.useState('efficiency_score');
  const [sortOrder, setSortOrder] = React.useState('desc');

  const sortedData = React.useMemo(() => {
    return [...data]?.sort((a, b) => {
      const aValue = parseFloat(a?.[sortBy]) || 0;
      const bValue = parseFloat(b?.[sortBy]) || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [data, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getPerformanceBadge = (score) => {
    if (score >= 85) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 70) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (score >= 55) return { label: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Needs Improvement', color: 'bg-red-100 text-red-800' };
  };

  const getRatingStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars?.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars?.push(<Star key="half" className="h-4 w-4 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars?.push(<Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />);
    }
    
    return stars;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Award className="h-4 w-4" />
          Performance ranking by efficiency score
        </div>
      </div>
      {sortedData?.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Vendor</th>
                  <th 
                    className="text-center py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('efficiency_score')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Efficiency Score
                      {sortBy === 'efficiency_score' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-center py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('total_claims')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Claims
                      {sortBy === 'total_claims' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-center py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('completion_rate')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Completion Rate
                      {sortBy === 'completion_rate' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-center py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('avg_resolution_time')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Avg Resolution
                      {sortBy === 'avg_resolution_time' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Cost Impact</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedData?.map((vendor, index) => {
                  const performance = getPerformanceBadge(parseFloat(vendor?.efficiency_score) || 0);
                  return (
                    <tr key={vendor?.vendor_id} className="hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{vendor?.vendor_name}</span>
                            {index < 3 && (
                              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                Top {index + 1}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{vendor?.specialty}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-bold text-gray-900">
                            {vendor?.efficiency_score}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${performance?.color}`}>
                            {performance?.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{vendor?.total_claims}</p>
                          <p className="text-gray-600">
                            {vendor?.completed_claims} completed
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{vendor?.completion_rate}%</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, parseFloat(vendor?.completion_rate) || 0)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {vendor?.avg_resolution_time} days
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="text-sm">
                          <div className="flex items-center justify-center gap-1">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {parseFloat(vendor?.total_claim_cost)?.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-600">
                            {vendor?.cost_variance_percentage}% variance
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getRatingStars(parseFloat(vendor?.vendor_rating) || 0)}
                        </div>
                        <span className="text-sm text-gray-600">
                          {vendor?.vendor_rating || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {sortedData?.map((vendor, index) => {
              const performance = getPerformanceBadge(parseFloat(vendor?.efficiency_score) || 0);
              return (
                <div key={vendor?.vendor_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{vendor?.vendor_name}</h4>
                        {index < 3 && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Top {index + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{vendor?.specialty}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${performance?.color}`}>
                      {performance?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Efficiency Score</p>
                      <p className="font-medium text-gray-900">{vendor?.efficiency_score}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Claims</p>
                      <p className="font-medium text-gray-900">{vendor?.total_claims}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Completion Rate</p>
                      <p className="font-medium text-gray-900">{vendor?.completion_rate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Resolution</p>
                      <p className="font-medium text-gray-900">{vendor?.avg_resolution_time} days</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      {getRatingStars(parseFloat(vendor?.vendor_rating) || 0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      ${parseFloat(vendor?.total_claim_cost)?.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Award className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No vendor performance data available</p>
          <p className="text-sm">Vendor metrics will appear once claims are processed</p>
        </div>
      )}
    </div>
  );
};

export default VendorPerformanceMatrix;