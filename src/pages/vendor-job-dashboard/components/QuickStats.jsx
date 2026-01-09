import React from 'react'
import Icon from '../../../components/AppIcon'

const QuickStats = ({ stats }) => {
  const statCards = [
    {
      id: 'total',
      title: 'Total Jobs',
      value: stats?.totalJobs,
      icon: 'Briefcase',
      color: 'primary',
    },
    {
      id: 'pending',
      title: 'Pending',
      value: stats?.pendingJobs,
      icon: 'Clock',
      color: 'warning',
    },
    {
      id: 'inProgress',
      title: 'In Progress',
      value: stats?.inProgressJobs,
      icon: 'Play',
      color: 'primary',
    },
    {
      id: 'completed',
      title: 'Completed',
      value: stats?.completedJobs,
      icon: 'CheckCircle',
      color: 'success',
    },
    {
      id: 'overdue',
      title: 'Overdue',
      value: stats?.overdueJobs,
      icon: 'AlertTriangle',
      color: 'error',
    },
    {
      id: 'avgTime',
      title: 'Avg Completion',
      value:
        stats?.avgCompletionTime === null || stats?.avgCompletionTime === undefined
          ? '—'
          : `${stats?.avgCompletionTime}h`,
      icon: 'Timer',
      color: 'secondary',
    },
  ]

  const getIconColor = (color) => {
    switch (color) {
      case 'primary':
        return 'text-primary'
      case 'warning':
        return 'text-warning'
      case 'success':
        return 'text-success'
      case 'error':
        return 'text-error'
      case 'secondary':
        return 'text-secondary'
      default:
        return 'text-muted-foreground'
    }
  }

  const getBackgroundColor = (color) => {
    switch (color) {
      case 'primary':
        return 'bg-primary/10'
      case 'warning':
        return 'bg-warning/10'
      case 'success':
        return 'bg-success/10'
      case 'error':
        return 'bg-error/10'
      case 'secondary':
        return 'bg-secondary/10'
      default:
        return 'bg-muted/10'
    }
  }

  const getChangeColor = (changeType) => {
    return changeType === 'positive' ? 'text-success' : 'text-error'
  }

  const getChangeIcon = (changeType) => {
    return changeType === 'positive' ? 'TrendingUp' : 'TrendingDown'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards?.map((stat) => (
        <div
          key={stat?.id}
          className="bg-card border border-border rounded-lg p-4 shadow-elevation-1 hover:shadow-elevation-2 transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-lg ${getBackgroundColor(stat?.color)} flex items-center justify-center`}
            >
              <Icon name={stat?.icon} size={20} className={getIconColor(stat?.color)} />
            </div>
            {stat?.change !== undefined && (
              <div className={`flex items-center gap-1 ${getChangeColor(stat?.changeType)}`}>
                <Icon name={getChangeIcon(stat?.changeType)} size={14} />
                <span className="text-xs font-medium">{Math.abs(stat?.change)}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{stat?.value}</div>
            <div className="text-sm text-muted-foreground">{stat?.title}</div>
          </div>

          {stat?.change !== undefined && (
            <div className="mt-2 text-xs text-muted-foreground">vs last period</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default QuickStats
