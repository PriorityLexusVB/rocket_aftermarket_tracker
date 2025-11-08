import React from 'react'
import Icon from '../../../components/AppIcon'

const MetricsCard = ({ title, value, change, changeType, icon, trend, description }) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success'
    if (changeType === 'negative') return 'text-error'
    return 'text-muted-foreground'
  }

  const getChangeIcon = () => {
    if (changeType === 'positive') return 'TrendingUp'
    if (changeType === 'negative') return 'TrendingDown'
    return 'Minus'
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name={icon} size={20} className="text-primary" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>

          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>

        {change && (
          <div className="flex items-center space-x-1 ml-4">
            <Icon name={getChangeIcon()} size={16} className={getChangeColor()} />
            <span className={`text-sm font-medium ${getChangeColor()}`}>{change}</span>
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Trend</span>
            <span className={trend?.direction === 'up' ? 'text-success' : 'text-error'}>
              {trend?.value}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MetricsCard
