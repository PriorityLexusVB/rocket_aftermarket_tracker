import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon, 
  trend = "up",
  positive = "up",
  className = "" 
}) => {
  const isPositive = (positive === "up" && trend === "up") || (positive === "down" && trend === "down");
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const changeBg = isPositive ? "bg-green-50" : "bg-red-50";
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${changeBg} ${changeColor}`}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(change)}%
              </div>
              <span className="text-xs text-gray-500">{changeLabel}</span>
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 ml-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;