import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

const SeasonalHeatMap = ({ data = { monthly: [], seasonal: [] }, title }) => {
  const { monthly = [], seasonal = [] } = data;

  const getIntensityColor = (value, maxValue) => {
    if (maxValue === 0) return 'bg-gray-100';
    const intensity = value / maxValue;
    if (intensity === 0) return 'bg-gray-100';
    if (intensity <= 0.25) return 'bg-blue-100';
    if (intensity <= 0.5) return 'bg-blue-200';
    if (intensity <= 0.75) return 'bg-blue-400';
    return 'bg-blue-600';
  };

  const getTextColor = (value, maxValue) => {
    if (maxValue === 0) return 'text-gray-600';
    const intensity = value / maxValue;
    return intensity > 0.5 ? 'text-white' : 'text-gray-800';
  };

  const maxMonthlyClaims = Math.max(...(monthly?.map(item => item?.claim_count) || [0]));
  const maxSeasonalClaims = Math.max(...(seasonal?.map(item => item?.claim_count) || [0]));

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Create full year data with missing months as 0
  const fullYearData = monthNames?.map((name, index) => {
    const monthData = monthly?.find(item => 
      item?.month === (index + 1) || item?.month_name?.toLowerCase()?.includes(name?.toLowerCase())
    );
    return {
      month: index + 1,
      month_name: name,
      claim_count: monthData?.claim_count || 0,
      total_cost: monthData?.total_cost || 0,
      top_categories: monthData?.top_categories || []
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          Claim volume heat map
        </div>
      </div>

      {/* Monthly Heat Map */}
      <div className="mb-8">
        <h4 className="text-md font-medium text-gray-800 mb-4">Monthly Distribution</h4>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {fullYearData?.map((month) => {
            const bgColor = getIntensityColor(month?.claim_count, maxMonthlyClaims);
            const textColor = getTextColor(month?.claim_count, maxMonthlyClaims);
            
            return (
              <div
                key={month?.month}
                className={`relative group ${bgColor} ${textColor} rounded-lg p-3 text-center transition-all hover:scale-105 cursor-pointer`}
              >
                <div className="text-xs font-medium mb-1">{month?.month_name}</div>
                <div className="text-lg font-bold">{month?.claim_count}</div>
                
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none min-w-max">
                  <div className="font-medium">{month?.month_name}</div>
                  <div>Claims: {month?.claim_count}</div>
                  <div>Cost: ${parseFloat(month?.total_cost)?.toLocaleString()}</div>
                  {month?.top_categories?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-600">
                      <div className="text-xs">Top Categories:</div>
                      {month?.top_categories?.slice(0, 2)?.map((cat, idx) => (
                        <div key={idx} className="text-xs">{cat?.name}: {cat?.count}</div>
                      ))}
                    </div>
                  )}
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600">Less</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <div className="w-4 h-4 bg-blue-200 rounded"></div>
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
          </div>
          <span className="text-sm text-gray-600">More</span>
        </div>
      </div>

      {/* Seasonal Summary */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-4">Seasonal Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {seasonal?.map((season) => {
            const bgColor = getIntensityColor(season?.claim_count, maxSeasonalClaims);
            const textColor = getTextColor(season?.claim_count, maxSeasonalClaims);
            
            return (
              <div
                key={season?.season}
                className={`${bgColor} ${textColor} rounded-lg p-4 text-center transition-all hover:scale-105`}
              >
                <div className="text-sm font-medium mb-2">{season?.season}</div>
                <div className="text-xl font-bold mb-1">{season?.claim_count}</div>
                <div className="text-sm opacity-90">{season?.percentage}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {monthly?.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-900 mb-2">Seasonal Insights</h5>
              <div className="text-sm text-blue-800 space-y-1">
                {seasonal?.length > 0 && (
                  <>
                    <p>
                      <span className="font-medium">Peak Season:</span> {
                        seasonal?.reduce((max, season) => 
                          season?.claim_count > max?.claim_count ? season : max
                        )?.season
                      }
                    </p>
                    <p>
                      <span className="font-medium">Busiest Month:</span> {
                        monthly?.reduce((max, month) => 
                          month?.claim_count > max?.claim_count ? month : max
                        )?.month_name
                      }
                    </p>
                    {monthly?.length >= 12 && (
                      <p>
                        <span className="font-medium">Annual Claims:</span> {
                          monthly?.reduce((sum, month) => sum + month?.claim_count, 0)?.toLocaleString()
                        }
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {monthly?.length === 0 && seasonal?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No seasonal data available</p>
          <p className="text-sm">Seasonal patterns will appear once claims data is collected</p>
        </div>
      )}
    </div>
  );
};

export default SeasonalHeatMap;