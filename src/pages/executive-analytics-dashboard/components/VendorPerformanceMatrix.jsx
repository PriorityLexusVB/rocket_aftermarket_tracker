import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const VendorPerformanceMatrix = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState('efficiency')

  const getPerformanceScore = (vendor) => {
    const completionWeight = 0.4
    const turnaroundWeight = 0.3
    const profitWeight = 0.3

    const completionScore = vendor?.completionRate / 100
    const turnaroundScore = Math.max(0, (14 - vendor?.avgTurnaround) / 14) // 14 days max
    const profitScore = Math.min(1, vendor?.profitContribution / 50000) // $50k max

    return (
      (completionScore * completionWeight +
        turnaroundScore * turnaroundWeight +
        profitScore * profitWeight) *
      100
    )
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success'
    if (score >= 60) return 'text-warning'
    return 'text-error'
  }

  const getScoreBadge = (score) => {
    if (score >= 80) return 'bg-success/10 text-success border-success/20'
    if (score >= 60) return 'bg-warning/10 text-warning border-warning/20'
    return 'bg-error/10 text-error border-error/20'
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })?.format(value)
  }

  const metrics = [
    { id: 'efficiency', label: 'Overall Efficiency', icon: 'Zap' },
    { id: 'completion', label: 'Completion Rate', icon: 'CheckCircle' },
    { id: 'turnaround', label: 'Turnaround Time', icon: 'Clock' },
    { id: 'profit', label: 'Profit Contribution', icon: 'DollarSign' },
  ]

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Vendor Performance Matrix</h3>
          <Button variant="outline" size="sm" iconName="Download" iconPosition="left">
            Export
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {metrics?.map((metric) => (
            <Button
              key={metric?.id}
              variant={selectedMetric === metric?.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMetric(metric?.id)}
              iconName={metric?.icon}
              iconPosition="left"
            >
              {metric?.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((vendor) => {
            const score = getPerformanceScore(vendor)

            return (
              <div
                key={vendor?.id}
                className="border border-border rounded-lg p-4 hover:shadow-elevation-1 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-lg">
                      <Icon name="Building" size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{vendor?.name}</h4>
                      <p className="text-sm text-muted-foreground">{vendor?.specialty}</p>
                    </div>
                  </div>

                  <div
                    className={`px-2 py-1 rounded-full border text-xs font-medium ${getScoreBadge(score)}`}
                  >
                    {score?.toFixed(0)}%
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon name="CheckCircle" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Completion</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {vendor?.completionRate}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon name="Clock" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Avg Time</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {vendor?.avgTurnaround} days
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon name="DollarSign" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Profit</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(vendor?.profitContribution)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon name="Briefcase" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Active Jobs</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {vendor?.activeJobs}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Performance Score</span>
                    <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
                      {score?.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-error'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VendorPerformanceMatrix
