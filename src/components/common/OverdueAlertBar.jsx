import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from '../ui/Button';
import { useOverdueJobs } from '../../services/advancedFeaturesService';

const OverdueAlertBar = ({ className = '' }) => {
  const navigate = useNavigate();
  const { overdueJobs, loading } = useOverdueJobs();

  // Don't show anything while loading or if no overdue jobs
  if (loading || !overdueJobs?.length) {
    return null;
  }

  // Categorize overdue jobs by severity
  const criticalJobs = overdueJobs?.filter(job => job?.severity_level === 'critical');
  const highJobs = overdueJobs?.filter(job => job?.severity_level === 'high');
  const totalOverdue = overdueJobs?.length;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSeverityTextColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700';
      case 'high':
        return 'text-orange-700';
      case 'medium':
        return 'text-yellow-700';
      default:
        return 'text-blue-700';
    }
  };

  const handleViewOverdue = () => {
    navigate('/kanban-status-board?filter=overdue');
  };

  const handleDismiss = () => {
    // Store dismissal in localStorage with timestamp
    const dismissData = {
      timestamp: Date.now(),
      jobIds: overdueJobs?.map(job => job?.id)
    };
    localStorage.setItem('overdueAlertDismissed', JSON.stringify(dismissData));
  };

  // Check if alert was recently dismissed
  const checkDismissed = () => {
    try {
      const dismissed = localStorage.getItem('overdueAlertDismissed');
      if (dismissed) {
        const data = JSON.parse(dismissed);
        // Show alert again after 4 hours or if job list changed
        const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
        if (data?.timestamp > fourHoursAgo && 
            data?.jobIds?.length === overdueJobs?.length) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  if (checkDismissed()) {
    return null;
  }

  return (
    <div className={`bg-red-50 border-l-4 border-red-500 p-4 mb-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon 
              name="AlertTriangle" 
              size={24} 
              className="text-red-500 animate-pulse" 
            />
          </div>
          
          <div className="ml-3 flex-1">
            <div className="flex items-center space-x-4">
              <h3 className="text-sm font-medium text-red-800">
                {totalOverdue} Overdue Job{totalOverdue !== 1 ? 's' : ''} Require Attention
              </h3>
              
              <div className="flex items-center space-x-2">
                {criticalJobs?.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <div className={`w-2 h-2 rounded-full ${getSeverityColor('critical')} mr-1`} />
                    {criticalJobs?.length} Critical
                  </span>
                )}
                
                {highJobs?.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <div className={`w-2 h-2 rounded-full ${getSeverityColor('high')} mr-1`} />
                    {highJobs?.length} High
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                {overdueJobs?.slice(0, 3)?.map((job) => (
                  <div 
                    key={job?.id}
                    className="inline-flex items-center px-2 py-1 rounded bg-white border text-xs"
                  >
                    <div className={`w-2 h-2 rounded-full ${getSeverityColor(job?.severity_level)} mr-1`} />
                    <span className="font-medium">{job?.job_number}</span>
                    <span className="mx-1">-</span>
                    <span className={getSeverityTextColor(job?.severity_level)}>
                      {job?.days_overdue} days overdue
                    </span>
                  </div>
                ))}
                
                {overdueJobs?.length > 3 && (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs text-gray-600">
                    +{overdueJobs?.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewOverdue}
            iconName="Eye"
            iconPosition="left"
            className="border-red-300 text-red-700 hover:bg-red-50"
            aria-label="View all overdue jobs"
          >
            View All
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            iconName="X"
            className="text-red-500 hover:bg-red-100"
            aria-label="Dismiss overdue alert"
          />
        </div>
      </div>
    </div>
  );
};

export default OverdueAlertBar;