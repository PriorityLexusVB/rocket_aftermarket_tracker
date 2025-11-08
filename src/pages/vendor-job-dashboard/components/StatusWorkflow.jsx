import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const StatusWorkflow = ({ jobs, onStatusUpdate, onBulkUpdate }) => {
  const [draggedJob, setDraggedJob] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  const statusColumns = [
    {
      id: 'Pending',
      title: 'Pending',
      icon: 'Clock',
      color: 'warning',
      description: 'Awaiting start',
    },
    {
      id: 'In Progress',
      title: 'In Progress',
      icon: 'Play',
      color: 'primary',
      description: 'Currently working',
    },
    {
      id: 'Complete',
      title: 'Complete',
      icon: 'CheckCircle',
      color: 'success',
      description: 'Finished jobs',
    },
  ]

  const getJobsByStatus = (status) => {
    return jobs?.filter((job) => job?.status === status)
  }

  const handleDragStart = (e, job) => {
    setDraggedJob(job)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, columnId) => {
    e?.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e, newStatus) => {
    e?.preventDefault()
    if (draggedJob && draggedJob?.status !== newStatus) {
      onStatusUpdate(draggedJob?.id, newStatus)
    }
    setDraggedJob(null)
    setDragOverColumn(null)
  }

  const getColumnColor = (color) => {
    switch (color) {
      case 'warning':
        return 'border-warning bg-warning/5'
      case 'primary':
        return 'border-primary bg-primary/5'
      case 'success':
        return 'border-success bg-success/5'
      default:
        return 'border-border bg-muted/5'
    }
  }

  const getJobPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'border-l-error'
      case 'Medium':
        return 'border-l-warning'
      case 'Low':
        return 'border-l-success'
      default:
        return 'border-l-muted'
    }
  }

  const isOverdue = (dueDate, status) => {
    return new Date(dueDate) < new Date() && status !== 'Complete'
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon name="Workflow" size={24} className="text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Status Workflow</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          Drag jobs between columns to update status
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {statusColumns?.map((column) => {
          const columnJobs = getJobsByStatus(column?.id)
          const isDragOver = dragOverColumn === column?.id

          return (
            <div
              key={column?.id}
              className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                isDragOver ? getColumnColor(column?.color) : 'border-border bg-muted/20'
              }`}
              onDragOver={(e) => handleDragOver(e, column?.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column?.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name={column?.icon} size={20} className={`text-${column?.color}`} />
                  <h4 className="font-medium text-foreground">{column?.title}</h4>
                  <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                    {columnJobs?.length}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-4">{column?.description}</div>
              {/* Jobs */}
              <div className="space-y-3 min-h-[200px]">
                {columnJobs?.map((job) => (
                  <div
                    key={job?.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job)}
                    className={`bg-card border border-l-4 ${getJobPriorityColor(job?.priority)} rounded-lg p-3 cursor-move hover:shadow-elevation-2 transition-all duration-200 ${
                      isOverdue(job?.dueDate, job?.status) ? 'bg-error/5 border-error/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-mono text-sm font-medium text-foreground">
                        {job?.jobId}
                      </div>
                      <div className="flex items-center gap-1">
                        {isOverdue(job?.dueDate, job?.status) && (
                          <Icon name="AlertTriangle" size={14} className="text-error" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            job?.priority === 'High'
                              ? 'text-error'
                              : job?.priority === 'Medium'
                                ? 'text-warning'
                                : 'text-success'
                          }`}
                        >
                          {job?.priority}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-foreground mb-1">
                      {job?.vehicle?.year} {job?.vehicle?.make} {job?.vehicle?.model}
                    </div>

                    <div className="text-xs text-muted-foreground mb-2">{job?.product}</div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Due: {job?.dueDate}</span>
                      <div className="flex items-center gap-1">
                        <Icon name="Calendar" size={12} />
                        <span>{job?.assignedDate}</span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onStatusUpdate(job?.id, 'In Progress')}
                        disabled={job?.status === 'Complete'}
                      >
                        <Icon name="Play" size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onStatusUpdate(job?.id, 'Complete')}
                        disabled={job?.status === 'Complete'}
                      >
                        <Icon name="Check" size={12} />
                      </Button>
                      <Button variant="ghost" size="xs">
                        <Icon name="MessageSquare" size={12} />
                      </Button>
                    </div>
                  </div>
                ))}

                {columnJobs?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Icon name={column?.icon} size={32} className="text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No {column?.title?.toLowerCase()} jobs
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* Workflow Tips */}
      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={16} className="text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Workflow Tips:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Drag jobs between columns to update status automatically</li>
              <li>• Red border indicates overdue jobs requiring immediate attention</li>
              <li>• Use keyboard shortcuts: 1=Pending, 2=In Progress, 3=Complete</li>
              <li>• Priority levels: High (red), Medium (yellow), Low (green)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusWorkflow
