import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onQuickReport, isExporting }) => {
  const [recentReports, setRecentReports] = useState([
    {
      id: 1,
      name: 'Weekly Sales Summary',
      type: 'sales_summary',
      generatedAt: '2024-09-22T10:30:00Z',
      recordCount: 156,
      format: 'excel'
    },
    {
      id: 2,
      name: 'Vendor Performance Q3',
      type: 'vendor_performance',
      generatedAt: '2024-09-21T14:15:00Z',
      recordCount: 12,
      format: 'pdf'
    },
    {
      id: 3,
      name: 'Product Profitability',
      type: 'product_profitability',
      generatedAt: '2024-09-20T09:45:00Z',
      recordCount: 8,
      format: 'csv'
    }
  ]);

  const quickReportTemplates = [
    {
      id: 'daily_sales',
      name: 'Daily Sales Report',
      description: 'Today\'s sales transactions and profit summary',
      icon: 'Calendar',
      filters: {
        dateRange: 'today',
        reportType: 'sales_summary'
      }
    },
    {
      id: 'weekly_vendor',
      name: 'Weekly Vendor Performance',
      description: 'Last 7 days vendor job completion rates',
      icon: 'Users',
      filters: {
        dateRange: 'last7days',
        reportType: 'vendor_performance'
      }
    },
    {
      id: 'monthly_profit',
      name: 'Monthly Profit Analysis',
      description: 'Current month product profitability breakdown',
      icon: 'TrendingUp',
      filters: {
        dateRange: 'thisMonth',
        reportType: 'product_profitability'
      }
    },
    {
      id: 'overdue_jobs',
      name: 'Overdue Jobs Report',
      description: 'All pending and overdue vendor assignments',
      icon: 'AlertTriangle',
      filters: {
        dateRange: 'last30days',
        status: ['pending'],
        reportType: 'operational_efficiency'
      }
    }
  ];

  const handleQuickReport = (template) => {
    onQuickReport(template?.filters, template?.name);
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFormatIcon = (format) => {
    switch (format) {
      case 'excel': return 'FileSpreadsheet';
      case 'pdf': return 'FileText';
      case 'csv': return 'File';
      default: return 'File';
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Report Templates */}
      <div className="bg-card border border-border rounded-lg shadow-elevation-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Quick Reports</h3>
            <p className="text-sm text-muted-foreground">
              Generate common reports with pre-configured filters
            </p>
          </div>
          <Icon name="Zap" size={20} className="text-accent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickReportTemplates?.map((template) => (
            <div
              key={template?.id}
              className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => handleQuickReport(template)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Icon name={template?.icon} size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {template?.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {template?.description}
                  </p>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Recent Reports */}
      <div className="bg-card border border-border rounded-lg shadow-elevation-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Reports</h3>
            <p className="text-sm text-muted-foreground">
              Previously generated reports and exports
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconName="History"
            iconPosition="left"
          >
            View All
          </Button>
        </div>

        <div className="space-y-3">
          {recentReports?.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="FileX" size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No recent reports found</p>
            </div>
          ) : (
            recentReports?.map((report) => (
              <div
                key={report?.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-lg">
                    <Icon name={getFormatIcon(report?.format)} size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {report?.name}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(report?.generatedAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {report?.recordCount} records
                      </span>
                      <span className="text-xs text-accent uppercase font-medium">
                        {report?.format}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="Download"
                    aria-label="Download report"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="Share"
                    aria-label="Share report"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Keyboard Shortcuts */}
      <div className="bg-card border border-border rounded-lg shadow-elevation-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h3>
            <p className="text-sm text-muted-foreground">
              Speed up your workflow with these shortcuts
            </p>
          </div>
          <Icon name="Keyboard" size={20} className="text-muted-foreground" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Generate daily report</span>
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Ctrl</kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">D</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Export as CSV</span>
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Ctrl</kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">E</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reset filters</span>
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Ctrl</kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">R</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Focus search</span>
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">Ctrl</kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs">F</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;