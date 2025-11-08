import React from 'react'
import Icon from '../../../components/AppIcon'

const SecurityBadges = () => {
  const securityFeatures = [
    {
      icon: 'Shield',
      label: 'SSL Encrypted',
      description: '256-bit encryption',
    },
    {
      icon: 'Lock',
      label: 'Secure Login',
      description: 'Multi-factor ready',
    },
    {
      icon: 'Database',
      label: 'Data Protected',
      description: 'Enterprise grade',
    },
    {
      icon: 'CheckCircle',
      label: 'Verified System',
      description: 'SOC 2 compliant',
    },
  ]

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-4">
        {securityFeatures?.map((feature, index) => (
          <div
            key={index}
            className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg border border-border/50"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-success/10 rounded-full">
              <Icon name={feature?.icon} size={16} className="text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{feature?.label}</p>
              <p className="text-xs text-muted-foreground truncate">{feature?.description}</p>
            </div>
          </div>
        ))}
      </div>
      {/* System Status */}
      <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
        <span>All systems operational</span>
        <span>•</span>
        <span>Last updated: {new Date()?.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

export default SecurityBadges
