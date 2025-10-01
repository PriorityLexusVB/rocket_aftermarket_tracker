import React from 'react';
import Icon from '../../../components/AppIcon';

const SystemInfo = () => {
  const currentYear = new Date()?.getFullYear();
  
  const systemStats = [
    {
      label: 'Uptime',
      value: '99.9%',
      icon: 'Activity'
    },
    {
      label: 'Response Time',
      value: '<200ms',
      icon: 'Zap'
    },
    {
      label: 'Active Users',
      value: '24/7',
      icon: 'Users'
    }
  ];

  return (
    <div className="mt-8 space-y-6">
      {/* System Statistics */}
      <div className="grid grid-cols-3 gap-4">
        {systemStats?.map((stat, index) => (
          <div key={index} className="text-center p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full mx-auto mb-2">
              <Icon name={stat?.icon} size={16} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{stat?.value}</p>
            <p className="text-xs text-muted-foreground">{stat?.label}</p>
          </div>
        ))}
      </div>
      {/* Support Information */}
      <div className="p-4 bg-muted/30 border border-border rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-accent/10 rounded-full flex-shrink-0 mt-0.5">
            <Icon name="HelpCircle" size={16} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground mb-1">
              Need Help?
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Contact your system administrator or support team for assistance with login issues.
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <a 
                href="mailto:ashley.terminello@priorityautomotive.com" 
                className="text-primary hover:text-primary/80 transition-colors"
              >
                ashley.terminello@priorityautomotive.com
              </a>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Support</span>
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="text-center pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          © {currentYear} Rocket Aftermarket Tracker. All rights reserved.
        </p>
        <div className="flex items-center justify-center space-x-4 mt-2 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          <span>•</span>
          <span>v2.1.0</span>
        </div>
      </div>
    </div>
  );
};

export default SystemInfo;