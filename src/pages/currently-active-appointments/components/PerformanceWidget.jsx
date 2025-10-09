import React from 'react';
import { X, TrendingUp, Clock, CheckCircle, BarChart3, Calendar } from 'lucide-react';

const PerformanceWidget = ({ metrics, onClose }) => {
  const formatHours = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours?.toFixed(1)}h`;
  };

  const getCompletionRateColor = (rate) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompletionRateBg = (rate) => {
    if (rate >= 80) return 'bg-green-50 border-green-200';
    if (rate >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200/50 mx-8 mb-6 rounded-3xl overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Workflow Performance</h3>
              <p className="text-sm text-gray-600">Real-time efficiency metrics</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-200"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Today's Completion */}
          <div className={`rounded-2xl border-2 p-4 ${getCompletionRateBg(metrics?.todayCompletionRate || 0)}`}>
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <div className={`text-xs font-semibold ${getCompletionRateColor(metrics?.todayCompletionRate || 0)}`}>
                {Math.round(metrics?.todayCompletionRate || 0)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">Today</div>
              <div className="text-xs text-gray-600">
                {metrics?.todayCompleted || 0} of {metrics?.todayTotal || 0} completed
              </div>
            </div>
          </div>

          {/* This Week's Completion */}
          <div className={`rounded-2xl border-2 p-4 ${getCompletionRateBg(metrics?.weekCompletionRate || 0)}`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              <div className={`text-xs font-semibold ${getCompletionRateColor(metrics?.weekCompletionRate || 0)}`}>
                {Math.round(metrics?.weekCompletionRate || 0)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">This Week</div>
              <div className="text-xs text-gray-600">
                {metrics?.weekCompleted || 0} of {metrics?.weekTotal || 0} completed
              </div>
            </div>
          </div>

          {/* Average Completion Time */}
          <div className="rounded-2xl border-2 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <div className="text-xs font-semibold text-blue-600">
                {formatHours(metrics?.avgCompletionTime || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">Avg Time</div>
              <div className="text-xs text-gray-600">Per job completion</div>
            </div>
          </div>

          {/* Efficiency Score */}
          <div className="rounded-2xl border-2 p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-purple-600" />
              <div className="text-xs font-semibold text-purple-600">
                {metrics?.weekCompletionRate ? (
                  metrics?.weekCompletionRate > 75 ? 'Excellent' :
                  metrics?.weekCompletionRate > 60 ? 'Good': 'Needs Improvement' ) :'No Data'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">Efficiency</div>
              <div className="text-xs text-gray-600">Overall rating</div>
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="mt-6 pt-6 border-t border-gray-200/50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance Trend */}
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
              <div className={`w-2 h-2 rounded-full ${
                (metrics?.weekCompletionRate || 0) > (metrics?.todayCompletionRate || 0) ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div className="text-xs text-gray-700">
                {(metrics?.weekCompletionRate || 0) > (metrics?.todayCompletionRate || 0) 
                  ? 'Weekly performance is above today\'s rate' 
                  : 'Today is performing better than weekly average'
                }
              </div>
            </div>

            {/* Time Efficiency */}
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
              <div className={`w-2 h-2 rounded-full ${
                (metrics?.avgCompletionTime || 0) < 24 ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              <div className="text-xs text-gray-700">
                {(metrics?.avgCompletionTime || 0) < 24 
                  ? 'Jobs are completing within 24 hours' 
                  : 'Jobs taking longer than 24 hours on average'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceWidget;