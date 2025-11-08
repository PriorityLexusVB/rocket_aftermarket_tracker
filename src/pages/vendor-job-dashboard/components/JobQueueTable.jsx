import React, { useState, useEffect } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'

const JobQueueTable = ({ jobs, onStatusUpdate, onBulkUpdate, selectedJobs, onJobSelect }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' })
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (selectedJobs?.length > 0) {
        switch (e?.key) {
          case '1':
            handleBulkStatusUpdate('Pending')
            break
          case '2':
            handleBulkStatusUpdate('In Progress')
            break
          case '3':
            handleBulkStatusUpdate('Complete')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedJobs])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleBulkStatusUpdate = (newStatus) => {
    if (selectedJobs?.length > 0) {
      onBulkUpdate(selectedJobs, newStatus)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-warning/10 text-warning border-warning/20'
      case 'In Progress':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'Complete':
        return 'bg-success/10 text-success border-success/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'text-error'
      case 'Medium':
        return 'text-warning'
      case 'Low':
        return 'text-success'
      default:
        return 'text-muted-foreground'
    }
  }

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date() && dueDate !== 'Complete'
  }

  const filteredJobs = jobs?.filter((job) => {
    if (filterStatus === 'all') return true
    return job?.status === filterStatus
  })

  const sortedJobs = [...filteredJobs]?.sort((a, b) => {
    if (sortConfig?.key === 'dueDate') {
      const aDate = new Date(a[sortConfig.key])
      const bDate = new Date(b[sortConfig.key])
      return sortConfig?.direction === 'asc' ? aDate - bDate : bDate - aDate
    }

    const aValue = a?.[sortConfig?.key]
    const bValue = b?.[sortConfig?.key]

    if (aValue < bValue) return sortConfig?.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig?.direction === 'asc' ? 1 : -1
    return 0
  })

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Complete', label: 'Complete' },
  ]

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      {/* Table Header Actions */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">Job Queue</h2>
            {selectedJobs?.length > 0 && (
              <span className="text-sm text-muted-foreground">{selectedJobs?.length} selected</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Select
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Filter by status"
              className="w-40"
            />

            {selectedJobs?.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('Pending')}
                >
                  Mark Pending
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('In Progress')}
                >
                  Mark In Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('Complete')}
                >
                  Mark Complete
                </Button>
              </div>
            )}
          </div>
        </div>

        {selectedJobs?.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Tip: Use keyboard shortcuts 1=Pending, 2=In Progress, 3=Complete
          </div>
        )}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-12 p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedJobs?.length === jobs?.length}
                  onChange={(e) => {
                    if (e?.target?.checked) {
                      onJobSelect(jobs?.map((job) => job?.id))
                    } else {
                      onJobSelect([])
                    }
                  }}
                  className="rounded border-border"
                />
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('jobId')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Job ID
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">Vehicle</th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">Product</th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('assignedDate')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Assigned
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('dueDate')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Due Date
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">Priority</th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs?.map((job) => (
              <tr
                key={job?.id}
                className={`border-b border-border hover:bg-muted/30 transition-colors ${
                  isOverdue(job?.dueDate) && job?.status !== 'Complete' ? 'bg-error/5' : ''
                }`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedJobs?.includes(job?.id)}
                    onChange={(e) => {
                      if (e?.target?.checked) {
                        onJobSelect([...selectedJobs, job?.id])
                      } else {
                        onJobSelect(selectedJobs?.filter((id) => id !== job?.id))
                      }
                    }}
                    className="rounded border-border"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{job?.jobId}</span>
                    {isOverdue(job?.dueDate) && job?.status !== 'Complete' && (
                      <Icon name="AlertTriangle" size={16} className="text-error" />
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div>
                    <div className="font-medium text-sm">
                      {job?.vehicle?.year} {job?.vehicle?.make} {job?.vehicle?.model}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {job?.vehicle?.vin}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-sm">{job?.product}</div>
                </td>
                <td className="p-3">
                  <div className="text-sm">{job?.assignedDate}</div>
                </td>
                <td className="p-3">
                  <div
                    className={`text-sm ${isOverdue(job?.dueDate) && job?.status !== 'Complete' ? 'text-error font-medium' : ''}`}
                  >
                    {job?.dueDate}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`text-sm font-medium ${getPriorityColor(job?.priority)}`}>
                    {job?.priority}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(job?.status)}`}
                  >
                    {job?.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onStatusUpdate(job?.id, 'In Progress')}
                      disabled={job?.status === 'Complete'}
                    >
                      <Icon name="Play" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onStatusUpdate(job?.id, 'Complete')}
                      disabled={job?.status === 'Complete'}
                    >
                      <Icon name="Check" size={16} />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Icon name="MessageSquare" size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedJobs?.length === 0 && (
        <div className="p-8 text-center">
          <Icon name="Briefcase" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No jobs found</h3>
          <p className="text-muted-foreground">No jobs match the current filter criteria.</p>
        </div>
      )}
    </div>
  )
}

export default JobQueueTable
