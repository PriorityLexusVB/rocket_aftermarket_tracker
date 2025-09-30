import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useOverdueJobs } from '../../../services/advancedFeaturesService';

const OverdueJobsWidget = ({ className = '' }) => {
  const navigate = useNavigate();
  const { overdueJobs, loading } = useOverdueJobs();

  const getSeverityStats = () => {
    if (!overdueJobs?.length) return { critical: 0, high: 0, medium: 0, low: 0 };

    return overdueJobs?.reduce((acc, job) => {
      acc[job?.severity_level] = (acc?.[job?.severity_level] || 0) + 1;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 });
  };

  const severityStats = getSeverityStats();
  const totalOverdue = overdueJobs?.length || 0;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon name="AlertTriangle" size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-foreground">Overdue Jobs</h3>
        </div>
        
        {totalOverdue > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/kanban-status-board?filter=overdue')}
            iconName="ExternalLink"
            iconPosition="right"
            className="text-sm"
          >
            View All
          </Button>
        )}
      </div>

      {totalOverdue === 0 ? (
        <div className="text-center py-8">
          <Icon name="CheckCircle" size={48} className="mx-auto text-green-500 mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">All Caught Up!</h4>
          <p className="text-muted-foreground">No overdue jobs at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total Count */}
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-1">
              {totalOverdue}
            </div>
            <div className="text-sm text-muted-foreground">
              Job{totalOverdue !== 1 ? 's' : ''} Overdue
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {Object?.entries(severityStats)?.map(([severity, count]) => {
              if (count === 0) return null;
              
              return (
                <div
                  key={severity}
                  className={`p-3 rounded-lg border ${getSeverityColor(severity)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{severity}</span>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Overdue Jobs */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Most Urgent</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {overdueJobs
                ?.sort((a, b) => b?.days_overdue - a?.days_overdue)
                ?.slice(0, 3)
                ?.map((job) => (
                  <div
                    key={job?.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full ${
                        job?.severity_level === 'critical' ? 'bg-red-500' :
                        job?.severity_level === 'high' ? 'bg-orange-500' :
                        job?.severity_level === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {job?.job_number}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {job?.vehicle_info}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-red-600">
                        {job?.days_overdue}d
                      </div>
                      <div className="text-xs text-muted-foreground">
                        overdue
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/kanban-status-board?filter=overdue')}
              className="flex-1"
            >
              Manage Overdue
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/vendor-operations-center')}
              className="flex-1"
            >
              Contact Vendors
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueJobsWidget;