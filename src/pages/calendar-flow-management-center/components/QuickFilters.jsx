import React from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  UserX, 
  CheckCircle,
  Filter,
  Check
} from 'lucide-react';
import Icon from '../../../components/AppIcon';


const QuickFilters = ({ filters, onFiltersChange, jobCounts }) => {
  const filterChips = [
    {
      id: 'today',
      label: 'Today',
      icon: Calendar,
      count: jobCounts?.today || 0,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      activeColor: 'bg-blue-600 text-white border-blue-600'
    },
    {
      id: 'in_progress',
      label: 'In-Progress',
      icon: Clock,
      count: jobCounts?.inProgress || 0,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      activeColor: 'bg-yellow-600 text-white border-yellow-600'
    },
    {
      id: 'overdue',
      label: 'Overdue',
      icon: AlertTriangle,
      count: jobCounts?.overdue || 0,
      color: 'bg-red-50 text-red-700 border-red-200',
      activeColor: 'bg-red-600 text-white border-red-600'
    },
    {
      id: 'no_show',
      label: 'No-Show',
      icon: UserX,
      count: jobCounts?.noShow || 0,
      color: 'bg-gray-50 text-gray-700 border-gray-200',
      activeColor: 'bg-gray-600 text-white border-gray-600'
    },
    {
      id: 'completed',
      label: 'Completed',
      icon: CheckCircle,
      count: jobCounts?.completed || 0,
      color: 'bg-green-50 text-green-700 border-green-200',
      activeColor: 'bg-green-600 text-white border-green-600'
    }
  ];

  const isStatusActive = (statusId) => {
    return filters?.statuses?.includes(statusId);
  };

  const toggleStatus = (statusId) => {
    const currentStatuses = filters?.statuses || [];
    const newStatuses = currentStatuses?.includes(statusId)
      ? currentStatuses?.filter(s => s !== statusId)
      : [...currentStatuses, statusId];
    
    onFiltersChange?.({ ...filters, statuses: newStatuses });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Status Filter Chips */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-sm text-gray-600 mr-4">
            <Filter className="h-4 w-4 mr-2" />
            Quick Filters:
          </div>
          
          {filterChips?.map(chip => {
            const Icon = chip?.icon;
            const isActive = isStatusActive(chip?.id);
            
            return (
              <button
                key={chip?.id}
                onClick={() => toggleStatus(chip?.id)}
                className={`
                  flex items-center px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200
                  ${isActive ? chip?.activeColor : chip?.color}
                  hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                `}
              >
                {/* Improved checkbox with better contrast and visibility */}
                <div className={`
                  flex items-center justify-center w-4 h-4 mr-2 rounded border-2 transition-all duration-200
                  ${isActive 
                    ? 'bg-white border-white' :'bg-transparent border-gray-400 border-opacity-60'
                  }
                `}>
                  <Check 
                    className={`h-3 w-3 transition-all duration-200 ${
                      isActive 
                        ? 'text-gray-700 opacity-100' :'text-transparent opacity-0'
                    }`} 
                  />
                </div>
                
                <Icon className="h-4 w-4 mr-2" />
                {chip?.label}
                {chip?.count > 0 && (
                  <span className={`
                    ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                    ${isActive 
                      ? 'bg-white bg-opacity-20' :'bg-gray-100 text-gray-800'
                    }
                  `}>
                    {chip?.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Additional Filters */}
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-600">
            Show:
          </div>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters?.showUnassigned || false}
              onChange={(e) => onFiltersChange?.({ 
                ...filters, 
                showUnassigned: e?.target?.checked 
              })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 h-4 w-4"
            />
            <span className="ml-2 text-sm text-gray-700">Unassigned Jobs</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default QuickFilters;