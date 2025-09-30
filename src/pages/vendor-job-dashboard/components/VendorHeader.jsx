import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const VendorHeader = ({ vendor, onSendMessage, onCallVendor, onEmailVendor }) => {
  const getPerformanceColor = (score) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-success text-success-foreground';
      case 'Busy': return 'bg-warning text-warning-foreground';
      case 'Inactive': return 'bg-error text-error-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Vendor Info */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="User" size={32} className="text-primary" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-foreground">{vendor?.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(vendor?.status)}`}>
                {vendor?.status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="Phone" size={16} />
                <span>{vendor?.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="Mail" size={16} />
                <span>{vendor?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="MapPin" size={16} />
                <span>{vendor?.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="Calendar" size={16} />
                <span>Joined {vendor?.joinDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{vendor?.metrics?.totalJobs}</div>
            <div className="text-sm text-muted-foreground">Total Jobs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{vendor?.metrics?.completedJobs}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getPerformanceColor(vendor?.metrics?.performanceScore)}`}>
              {vendor?.metrics?.performanceScore}%
            </div>
            <div className="text-sm text-muted-foreground">Performance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{vendor?.metrics?.avgCompletionTime}h</div>
            <div className="text-sm text-muted-foreground">Avg Time</div>
          </div>
        </div>
      </div>
      {/* Communication Actions */}
      <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-border">
        <Button
          variant="default"
          iconName="MessageSquare"
          iconPosition="left"
          onClick={onSendMessage}
        >
          Send SMS
        </Button>
        <Button
          variant="outline"
          iconName="Phone"
          iconPosition="left"
          onClick={onCallVendor}
        >
          Call Vendor
        </Button>
        <Button
          variant="outline"
          iconName="Mail"
          iconPosition="left"
          onClick={onEmailVendor}
        >
          Send Email
        </Button>
        <Button
          variant="ghost"
          iconName="MessageCircle"
          iconPosition="left"
        >
          View Messages ({vendor?.unreadMessages})
        </Button>
      </div>
    </div>
  );
};

export default VendorHeader;