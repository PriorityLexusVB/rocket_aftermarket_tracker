import React from 'react';
import Icon from '../../../components/AppIcon';

const StatsOverview = ({ stats, userRole = 'staff' }) => {
  const statCards = [
    {
      id: 'total',
      title: 'Total Vehicles',
      value: stats?.totalVehicles || 0,
      icon: 'Car',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: stats?.vehicleChange || 0,
      changeType: stats?.vehicleChange >= 0 ? 'increase' : 'decrease'
    },
    {
      id: 'available',
      title: 'Available',
      value: stats?.availableVehicles || 0,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: stats?.availableChange || 0,
      changeType: stats?.availableChange >= 0 ? 'increase' : 'decrease'
    },
    {
      id: 'in-work',
      title: 'In Work',
      value: stats?.inWorkVehicles || 0,
      icon: 'Clock',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      change: stats?.inWorkChange || 0,
      changeType: stats?.inWorkChange >= 0 ? 'increase' : 'decrease'
    },
    {
      id: 'completed',
      title: 'Completed',
      value: stats?.completedVehicles || 0,
      icon: 'CheckCircle2',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: stats?.completedChange || 0,
      changeType: stats?.completedChange >= 0 ? 'increase' : 'decrease'
    }
  ];

  // Add profit stats for managers
  if (userRole === 'manager') {
    statCards?.push({
      id: 'profit',
      title: 'Total Profit',
      value: `$${(stats?.totalProfit || 0)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: 'DollarSign',
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: stats?.profitChange || 0,
      changeType: stats?.profitChange >= 0 ? 'increase' : 'decrease',
      isMonetary: true
    });
  }

  const getChangeIcon = (changeType) => {
    return changeType === 'increase' ? 'TrendingUp' : 'TrendingDown';
  };

  const getChangeColor = (changeType) => {
    return changeType === 'increase' ? 'text-success' : 'text-error';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-6">
      {statCards?.map((stat) => (
        <div
          key={stat?.id}
          className="bg-card rounded-lg border border-border shadow-elevation-1 p-6 hover:shadow-elevation-2 transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${stat?.bgColor}`}>
              <Icon name={stat?.icon} size={24} className={stat?.color} />
            </div>
            
            {stat?.change !== 0 && (
              <div className={`flex items-center space-x-1 ${getChangeColor(stat?.changeType)}`}>
                <Icon name={getChangeIcon(stat?.changeType)} size={16} />
                <span className="text-sm font-medium">
                  {stat?.isMonetary ? '$' : ''}{Math.abs(stat?.change)}
                  {!stat?.isMonetary ? '%' : ''}
                </span>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-1">
              {stat?.value}
            </h3>
            <p className="text-sm text-muted-foreground">
              {stat?.title}
            </p>
          </div>
          
          {stat?.change !== 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {stat?.changeType === 'increase' ? '+' : ''}{stat?.change}
                {stat?.isMonetary ? '' : '%'} from last month
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatsOverview;