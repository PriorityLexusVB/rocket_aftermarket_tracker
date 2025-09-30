import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PerformanceDashboard = ({ performanceData, onDrillDown }) => {
  const COLORS = ['#1E40AF', '#059669', '#F59E0B', '#DC2626', '#7C3AED'];

  const completionRateData = [
    { name: 'Jan', rate: 92 },
    { name: 'Feb', rate: 88 },
    { name: 'Mar', rate: 95 },
    { name: 'Apr', rate: 91 },
    { name: 'May', rate: 89 },
    { name: 'Jun', rate: 94 }
  ];

  const turnaroundTimeData = [
    { vendor: 'AutoTint Pro', avgTime: 2.1 },
    { vendor: 'Shield Masters', avgTime: 3.2 },
    { vendor: 'Wrap Experts', avgTime: 4.5 },
    { vendor: 'Detail Kings', avgTime: 1.8 },
    { vendor: 'Glass Guard', avgTime: 2.9 }
  ];

  const specialtyDistribution = [
    { name: 'Window Tinting', value: 35, count: 142 },
    { name: 'Paint Protection', value: 28, count: 113 },
    { name: 'Vehicle Wraps', value: 18, count: 72 },
    { name: 'Windshield Protection', value: 12, count: 48 },
    { name: 'Detailing', value: 7, count: 28 }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Vendors</p>
              <p className="text-2xl font-semibold text-foreground">{performanceData?.totalVendors}</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="Users" size={20} className="text-primary" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1">
            <Icon name="TrendingUp" size={14} className="text-success" />
            <span className="text-xs text-success">+12% from last month</span>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="text-2xl font-semibold text-foreground">{performanceData?.activeJobs}</p>
            </div>
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon name="Clock" size={20} className="text-warning" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1">
            <Icon name="AlertTriangle" size={14} className="text-error" />
            <span className="text-xs text-error">{performanceData?.overdueJobs} overdue</span>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Completion Rate</p>
              <p className="text-2xl font-semibold text-foreground">{performanceData?.avgCompletionRate}%</p>
            </div>
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon name="CheckCircle" size={20} className="text-success" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1">
            <Icon name="TrendingUp" size={14} className="text-success" />
            <span className="text-xs text-success">+3.2% improvement</span>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Turnaround</p>
              <p className="text-2xl font-semibold text-foreground">{performanceData?.avgTurnaround}d</p>
            </div>
            <div className="p-2 bg-accent/10 rounded-lg">
              <Icon name="Timer" size={20} className="text-accent" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1">
            <Icon name="TrendingDown" size={14} className="text-success" />
            <span className="text-xs text-success">-0.5d faster</span>
          </div>
        </div>
      </div>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Rate Trend */}
        <div className="bg-card p-6 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Completion Rate Trend</h3>
            <Button
              variant="ghost"
              size="sm"
              iconName="ExternalLink"
              onClick={() => onDrillDown('completion-rate')}
            >
              View Details
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="var(--color-primary)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Turnaround Time by Vendor */}
        <div className="bg-card p-6 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Turnaround Time by Vendor</h3>
            <Button
              variant="ghost"
              size="sm"
              iconName="ExternalLink"
              onClick={() => onDrillDown('turnaround-time')}
            >
              View Details
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnaroundTimeData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-muted-foreground)" />
                <YAxis dataKey="vendor" type="category" stroke="var(--color-muted-foreground)" width={80} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="avgTime" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* Specialty Distribution and Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Specialty Distribution */}
        <div className="bg-card p-6 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Job Distribution by Specialty</h3>
            <Button
              variant="ghost"
              size="sm"
              iconName="ExternalLink"
              onClick={() => onDrillDown('specialty-distribution')}
            >
              View Details
            </Button>
          </div>
          <div className="flex items-center space-x-6">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={specialtyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {specialtyDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS?.[index % COLORS?.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {specialtyDistribution?.map((item, index) => (
                <div key={item?.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS?.[index % COLORS?.length] }}
                    />
                    <span className="text-sm text-foreground">{item?.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{item?.value}%</div>
                    <div className="text-xs text-muted-foreground">{item?.count} jobs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-card p-6 rounded-lg border border-border shadow-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Top Performing Vendors</h3>
            <Button
              variant="ghost"
              size="sm"
              iconName="ExternalLink"
              onClick={() => onDrillDown('top-performers')}
            >
              View All
            </Button>
          </div>
          <div className="space-y-4">
            {performanceData?.topPerformers?.map((vendor, index) => (
              <div key={vendor?.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-amber-600 text-white': 'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{vendor?.name}</div>
                    <div className="text-sm text-muted-foreground">{vendor?.specialty}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-success">{vendor?.completionRate}%</div>
                  <div className="text-xs text-muted-foreground">{vendor?.jobsCompleted} jobs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Recent Activity */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-elevation-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Vendor Activity</h3>
          <Button
            variant="ghost"
            size="sm"
            iconName="RefreshCw"
            onClick={() => window.location?.reload()}
          >
            Refresh
          </Button>
        </div>
        <div className="space-y-3">
          {performanceData?.recentActivity?.map((activity) => (
            <div key={activity?.id} className="flex items-center space-x-4 p-3 bg-muted/20 rounded-lg">
              <div className={`p-2 rounded-lg ${
                activity?.type === 'job_completed' ? 'bg-success/10' :
                activity?.type === 'job_assigned' ? 'bg-primary/10' :
                activity?.type === 'status_update'? 'bg-warning/10' : 'bg-muted'
              }`}>
                <Icon 
                  name={
                    activity?.type === 'job_completed' ? 'CheckCircle' :
                    activity?.type === 'job_assigned' ? 'Plus' :
                    activity?.type === 'status_update'? 'Clock' : 'Activity'
                  } 
                  size={16} 
                  className={
                    activity?.type === 'job_completed' ? 'text-success' :
                    activity?.type === 'job_assigned' ? 'text-primary' :
                    activity?.type === 'status_update'? 'text-warning' : 'text-muted-foreground'
                  }
                />
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">{activity?.description}</div>
                <div className="text-xs text-muted-foreground">{activity?.timestamp}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconName="ExternalLink"
                onClick={() => onDrillDown('activity', activity?.id)}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;