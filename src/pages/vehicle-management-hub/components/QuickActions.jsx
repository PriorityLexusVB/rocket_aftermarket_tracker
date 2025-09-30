import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onRefresh, lastUpdated, onAddVehicle }) => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'add-vehicle',
      title: 'Add New Vehicle',
      description: 'Add vehicle to inventory',
      icon: 'Plus',
      color: 'bg-primary text-primary-foreground',
      action: onAddVehicle,
      isPrimary: true
    },
    {
      id: 'add-sale',
      title: 'Add Sale',
      description: 'Log new aftermarket sale',
      icon: 'ShoppingCart',
      color: 'bg-secondary text-secondary-foreground',
      action: () => navigate('/sales-transaction-interface')
    },
    {
      id: 'view-vendors',
      title: 'Vendors',
      description: 'Manage vendor operations',
      icon: 'Users',
      color: 'bg-accent text-accent-foreground',
      action: () => navigate('/vendor-operations-center')
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Generate business reports',
      icon: 'FileText',
      color: 'bg-success text-success-foreground',
      action: () => navigate('/business-intelligence-reports')
    }
  ];

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const updated = new Date(timestamp);
    const diffInMinutes = Math.floor((now - updated) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return updated?.toLocaleDateString();
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-1 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatLastUpdated(lastUpdated)}
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          iconName="RefreshCw"
          iconPosition="left"
        >
          Refresh
        </Button>
      </div>
      {/* Primary Action - Add New Vehicle */}
      <div className="mb-4">
        <button
          onClick={quickActions?.[0]?.action}
          className="w-full group p-6 rounded-lg border-2 border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 hover:shadow-elevation-2 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-4 mb-3">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${quickActions?.[0]?.color} group-hover:scale-110 transition-transform duration-200`}>
              <Icon name={quickActions?.[0]?.icon} size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                {quickActions?.[0]?.title}
              </h4>
              <p className="text-base text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                {quickActions?.[0]?.description}
              </p>
            </div>
            <Icon name="ChevronRight" size={20} className="text-muted-foreground group-hover:text-primary transition-colors duration-200" />
          </div>
        </button>
      </div>
      {/* Other Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickActions?.slice(1)?.map((action) => (
          <button
            key={action?.id}
            onClick={action?.action}
            className="group p-4 rounded-lg border border-border hover:border-primary/50 hover:shadow-elevation-2 transition-all duration-200 text-left bg-background hover:bg-muted/50"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${action?.color} group-hover:scale-110 transition-transform duration-200`}>
                <Icon name={action?.icon} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200">
                  {action?.title}
                </h4>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-200">
              {action?.description}
            </p>
          </button>
        ))}
      </div>
      {/* Keyboard Shortcuts Info */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Keyboard shortcuts:</span>
          <div className="flex items-center space-x-4">
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+N</kbd> Add Vehicle</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+F</kbd> Search</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+R</kbd> Refresh</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;