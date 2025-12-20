import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const ActionHistoryPanel = ({ actionHistory }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filter, setFilter] = useState('all')

  const getActionIcon = (action) => {
    switch (action?.type) {
      case 'created':
        return 'Plus'
      case 'updated':
        return 'Edit'
      case 'status_changed':
        return 'RefreshCw'
      case 'price_updated':
        return 'DollarSign'
      case 'deleted':
        return 'Trash2'
      case 'exported':
        return 'Download'
      default:
        return 'Activity'
    }
  }

  const getActionColor = (action) => {
    switch (action?.type) {
      case 'created':
        return 'text-success'
      case 'updated':
        return 'text-primary'
      case 'status_changed':
        return 'text-warning'
      case 'price_updated':
        return 'text-accent'
      case 'deleted':
        return 'text-error'
      case 'exported':
        return 'text-muted-foreground'
      default:
        return 'text-foreground'
    }
  }

  const filteredHistory = actionHistory?.filter((action) => {
    if (filter === 'all') return true
    return action?.type === filter
  })

  const displayedHistory = isExpanded ? filteredHistory : filteredHistory?.slice(0, 5)

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-lg">
              <Icon name="History" size={16} className="text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Action History</h3>
              <p className="text-xs text-muted-foreground">{actionHistory?.length} total actions</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e?.target?.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="status_changed">Status Changes</option>
              <option value="price_updated">Price Updates</option>
            </select>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsExpanded(!isExpanded)}
              iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'}
            />
          </div>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {displayedHistory?.length > 0 ? (
          <div className="p-4 space-y-3">
            {displayedHistory?.map((action) => (
              <div key={action?.id} className="flex items-start space-x-3">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full bg-muted ${getActionColor(action)}`}
                >
                  <Icon name={getActionIcon(action)} size={12} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{action?.user}</span> {action?.description}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(action.timestamp)?.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {action?.details && (
                    <p className="text-xs text-muted-foreground mt-1">{action?.details}</p>
                  )}

                  {action?.changes && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                      {Object.entries(action?.changes)?.map(([field, change]) => (
                        <div key={field} className="flex items-center space-x-2">
                          <span className="font-medium text-foreground">{field}:</span>
                          <span className="text-error">{change?.from}</span>
                          <Icon name="ArrowRight" size={10} className="text-muted-foreground" />
                          <span className="text-success">{change?.to}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Icon name="Clock" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No actions found for selected filter</p>
          </div>
        )}
      </div>
      {!isExpanded && filteredHistory?.length > 5 && (
        <div className="p-3 border-t border-border text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            iconName="ChevronDown"
            iconPosition="right"
          >
            Show {filteredHistory?.length - 5} more actions
          </Button>
        </div>
      )}
    </div>
  )
}

export default ActionHistoryPanel
