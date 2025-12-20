import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'

const VendorDetailSidebar = ({ vendor, onClose, onSendSMS, onAssignJob }) => {
  const [smsMessage, setSmsMessage] = useState('')
  const [jobAssignment, setJobAssignment] = useState({
    vehicleId: '',
    serviceType: '',
    priority: 'normal',
    estimatedCompletion: '',
  })

  if (!vendor) {
    return (
      <div className="w-full h-full bg-card border-l border-border flex items-center justify-center">
        <div className="text-center">
          <Icon name="Users" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Select a Vendor</h3>
          <p className="text-muted-foreground">
            Choose a vendor from the list to view details and manage jobs
          </p>
        </div>
      </div>
    )
  }

  const serviceTypeOptions = [
    { value: '', label: 'Select Service Type' },
    { value: 'tint', label: 'Window Tinting' },
    { value: 'protection', label: 'Paint Protection Film' },
    { value: 'wraps', label: 'Vehicle Wraps' },
    { value: 'windshield', label: 'Windshield Protection' },
    { value: 'detailing', label: 'Detailing Services' },
  ]

  const priorityOptions = [
    { value: 'low', label: 'Low Priority' },
    { value: 'normal', label: 'Normal Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'urgent', label: 'Urgent' },
  ]

  const handleSendSMS = () => {
    if (smsMessage?.trim()) {
      onSendSMS(vendor?.id, smsMessage)
      setSmsMessage('')
    }
  }

  const handleAssignJob = () => {
    if (jobAssignment?.vehicleId && jobAssignment?.serviceType) {
      onAssignJob(vendor?.id, jobAssignment)
      setJobAssignment({
        vehicleId: '',
        serviceType: '',
        priority: 'normal',
        estimatedCompletion: '',
      })
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'text-success bg-success/10'
      case 'busy':
        return 'text-warning bg-warning/10'
      case 'unavailable':
        return 'text-error bg-error/10'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'text-warning bg-warning/10'
      case 'in-progress':
        return 'text-primary bg-primary/10'
      case 'completed':
        return 'text-success bg-success/10'
      case 'overdue':
        return 'text-error bg-error/10'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <div className="w-full h-full bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Vendor Details</h2>
          <Button variant="ghost" size="icon" iconName="X" onClick={onClose} className="w-8 h-8" />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-foreground">{vendor?.name}</h3>
            <p className="text-sm text-muted-foreground">ID: {vendor?.id}</p>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 text-sm rounded-full capitalize ${getStatusColor(vendor?.status)}`}
            >
              {vendor?.status}
            </span>
            <span className="text-sm text-muted-foreground">Last active: {vendor?.lastActive}</span>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Contact Information */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Contact Information</h4>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Icon name="Phone" size={16} className="text-muted-foreground" />
              <span className="text-sm text-foreground">{vendor?.contact?.phone}</span>
              <Button
                variant="ghost"
                size="sm"
                iconName="Phone"
                onClick={() => window.open(`tel:${vendor?.contact?.phone}`)}
              >
                Call
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <Icon name="Mail" size={16} className="text-muted-foreground" />
              <span className="text-sm text-foreground">{vendor?.contact?.email}</span>
              <Button
                variant="ghost"
                size="sm"
                iconName="Mail"
                onClick={() => window.open(`mailto:${vendor?.contact?.email}`)}
              >
                Email
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <Icon name="MapPin" size={16} className="text-muted-foreground" />
              <span className="text-sm text-foreground">{vendor?.contact?.address}</span>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Specialties</h4>
          <div className="flex flex-wrap gap-2">
            {vendor?.specialties?.map((specialty) => (
              <span
                key={specialty}
                className="px-3 py-1 text-sm bg-accent/10 text-accent rounded-full"
              >
                {specialty}
              </span>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Performance Metrics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-foreground">{vendor?.completionRate}%</div>
              <div className="text-xs text-muted-foreground">Completion Rate</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-foreground">
                {vendor?.avgTurnaroundTime}d
              </div>
              <div className="text-xs text-muted-foreground">Avg Turnaround</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-foreground">{vendor?.activeJobs}</div>
              <div className="text-xs text-muted-foreground">Active Jobs</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-foreground">{vendor?.totalJobs}</div>
              <div className="text-xs text-muted-foreground">Total Jobs</div>
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Recent Jobs</h4>
          <div className="space-y-3">
            {vendor?.recentJobs?.map((job) => (
              <div key={job?.id} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{job?.vehicleInfo}</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getJobStatusColor(job?.status)}`}
                  >
                    {job?.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {job?.serviceType} • Due: {job?.dueDate}
                </div>
                {job?.status === 'overdue' && (
                  <div className="text-xs text-error mt-1">Overdue by {job?.overdueDays} days</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SMS Communication */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Quick SMS</h4>
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Type your message..."
              value={smsMessage}
              onChange={(e) => setSmsMessage(e?.target?.value)}
              className="w-full"
            />
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSmsMessage('Job assignment update available. Please check your dashboard.')
                }
                className="flex-1"
              >
                Job Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSmsMessage('Please confirm receipt of new job assignment.')}
                className="flex-1"
              >
                Confirmation
              </Button>
            </div>
            <Button
              variant="default"
              iconName="Send"
              iconPosition="left"
              onClick={handleSendSMS}
              disabled={!smsMessage?.trim()}
              className="w-full"
            >
              Send SMS
            </Button>
          </div>
        </div>

        {/* Job Assignment */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Assign New Job</h4>
          <div className="space-y-3">
            <Input
              type="text"
              label="Vehicle ID/VIN"
              placeholder="Enter vehicle identifier"
              value={jobAssignment?.vehicleId}
              onChange={(e) =>
                setJobAssignment((prev) => ({ ...prev, vehicleId: e?.target?.value }))
              }
            />

            <Select
              label="Service Type"
              options={serviceTypeOptions}
              value={jobAssignment?.serviceType}
              onChange={(value) => setJobAssignment((prev) => ({ ...prev, serviceType: value }))}
            />

            <Select
              label="Priority"
              options={priorityOptions}
              value={jobAssignment?.priority}
              onChange={(value) => setJobAssignment((prev) => ({ ...prev, priority: value }))}
            />

            <Input
              type="date"
              label="Estimated Completion"
              value={jobAssignment?.estimatedCompletion}
              onChange={(e) =>
                setJobAssignment((prev) => ({ ...prev, estimatedCompletion: e?.target?.value }))
              }
            />

            <Button
              variant="default"
              iconName="Plus"
              iconPosition="left"
              onClick={handleAssignJob}
              disabled={!jobAssignment?.vehicleId || !jobAssignment?.serviceType}
              className="w-full"
            >
              Assign Job
            </Button>
          </div>
        </div>

        {/* SMS History */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">SMS History</h4>
          <div className="space-y-2">
            {vendor?.smsHistory?.map((sms) => (
              <div key={sms?.id} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{sms?.timestamp}</span>
                  <div className="flex items-center space-x-1">
                    <Icon
                      name={
                        sms?.status === 'delivered'
                          ? 'Check'
                          : sms?.status === 'failed'
                            ? 'X'
                            : 'Clock'
                      }
                      size={12}
                      className={
                        sms?.status === 'delivered'
                          ? 'text-success'
                          : sms?.status === 'failed'
                            ? 'text-error'
                            : 'text-warning'
                      }
                    />
                    <span className="text-xs text-muted-foreground capitalize">{sms?.status}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground">{sms?.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VendorDetailSidebar
