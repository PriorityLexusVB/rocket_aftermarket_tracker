import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VendorHeader from './components/VendorHeader'
import JobQueueTable from './components/JobQueueTable'
import CommunicationPanel from './components/CommunicationPanel'
import StatusWorkflow from './components/StatusWorkflow'
import QuickStats from './components/QuickStats'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'

const VendorJobDashboard = () => {
  const { vendorId } = useParams()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState([])
  const [viewMode, setViewMode] = useState('table') // 'table' or 'workflow'

  // Mock vendor data
  const vendor = {
    id: vendorId || 'VND001',
    name: 'Premium Auto Detailing',
    email: 'contact@premiumautodetailing.com',
    phone: '(555) 123-4567',
    location: 'Downtown Service Center',
    status: 'Active',
    joinDate: 'Jan 2023',
    unreadMessages: 2,
    metrics: {
      totalJobs: 156,
      completedJobs: 142,
      performanceScore: 94,
      avgCompletionTime: 18,
    },
  }

  // Mock jobs data
  const [jobs, setJobs] = useState([
    {
      id: 'JOB001',
      jobId: 'AF-2024-001',
      vehicle: {
        year: '2023',
        make: 'Toyota',
        model: 'Camry',
        vin: '1HGBH41JXMN109186',
      },
      product: 'ToughGuard Paint Protection',
      assignedDate: '2024-01-15',
      dueDate: '2024-01-20',
      status: 'In Progress',
      priority: 'High',
    },
    {
      id: 'JOB002',
      jobId: 'AF-2024-002',
      vehicle: {
        year: '2024',
        make: 'Honda',
        model: 'Accord',
        vin: '2HGBH41JXMN109187',
      },
      product: 'Windshield Protection Film',
      assignedDate: '2024-01-18',
      dueDate: '2024-01-22',
      status: 'Pending',
      priority: 'Medium',
    },
    {
      id: 'JOB003',
      jobId: 'AF-2024-003',
      vehicle: {
        year: '2023',
        make: 'Ford',
        model: 'F-150',
        vin: '3HGBH41JXMN109188',
      },
      product: 'Ceramic Window Tint',
      assignedDate: '2024-01-10',
      dueDate: '2024-01-19',
      status: 'Complete',
      priority: 'Low',
    },
    {
      id: 'JOB004',
      jobId: 'AF-2024-004',
      vehicle: {
        year: '2024',
        make: 'BMW',
        model: 'X5',
        vin: '4HGBH41JXMN109189',
      },
      product: 'Full Vehicle Wrap',
      assignedDate: '2024-01-12',
      dueDate: '2024-01-18',
      status: 'Pending',
      priority: 'High',
    },
  ])

  // Mock communication messages
  const [messages, setMessages] = useState([
    {
      id: 'MSG001',
      sender: 'You',
      content:
        'Hi! Job AF-2024-001 has been assigned to you. Please confirm receipt and estimated completion time.',
      timestamp: new Date('2024-01-15T09:00:00'),
      status: 'delivered',
      jobReference: 'AF-2024-001',
    },
    {
      id: 'MSG002',
      sender: 'Premium Auto Detailing',
      content: 'Received! Will start on the Toyota Camry today. Estimated completion by Friday.',
      timestamp: new Date('2024-01-15T09:15:00'),
      status: 'read',
    },
    {
      id: 'MSG003',
      sender: 'You',
      content:
        'Great! Please update status when you begin work. Customer is expecting Friday delivery.',
      timestamp: new Date('2024-01-15T09:20:00'),
      status: 'delivered',
    },
  ])

  // Mock stats data
  const stats = {
    totalJobs: jobs?.length,
    pendingJobs: jobs?.filter((job) => job?.status === 'Pending')?.length,
    inProgressJobs: jobs?.filter((job) => job?.status === 'In Progress')?.length,
    completedJobs: jobs?.filter((job) => job?.status === 'Complete')?.length,
    overdueJobs: jobs?.filter(
      (job) => new Date(job.dueDate) < new Date() && job?.status !== 'Complete'
    )?.length,
    avgCompletionTime: 18,
    totalJobsChange: 5,
    pendingJobsChange: -2,
    inProgressJobsChange: 1,
    completedJobsChange: 3,
    overdueJobsChange: -1,
    avgCompletionTimeChange: -2,
  }

  const handleStatusUpdate = (jobId, newStatus) => {
    setJobs((prevJobs) =>
      prevJobs?.map((job) => (job?.id === jobId ? { ...job, status: newStatus } : job))
    )

    // Add system message for status update
    const job = jobs?.find((j) => j?.id === jobId)
    if (job) {
      const newMessage = {
        id: `MSG${Date.now()}`,
        sender: 'System',
        content: `Job ${job?.jobId} status updated to: ${newStatus}`,
        timestamp: new Date(),
        status: 'system',
        jobReference: job?.jobId,
      }
      setMessages((prev) => [...prev, newMessage])
    }
  }

  const handleBulkUpdate = (jobIds, newStatus) => {
    setJobs((prevJobs) =>
      prevJobs?.map((job) => (jobIds?.includes(job?.id) ? { ...job, status: newStatus } : job))
    )

    // Clear selection after bulk update
    setSelectedJobs([])

    // Add system message for bulk update
    const newMessage = {
      id: `MSG${Date.now()}`,
      sender: 'System',
      content: `${jobIds?.length} jobs updated to: ${newStatus}`,
      timestamp: new Date(),
      status: 'system',
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const handleSendMessage = (messageContent) => {
    const newMessage = {
      id: `MSG${Date.now()}`,
      sender: 'You',
      content: messageContent,
      timestamp: new Date(),
      status: 'sent',
    }
    setMessages((prev) => [...prev, newMessage])

    // Simulate delivery status update
    setTimeout(() => {
      setMessages((prev) =>
        prev?.map((msg) => (msg?.id === newMessage?.id ? { ...msg, status: 'delivered' } : msg))
      )
    }, 1000)
  }

  const handleSendSMS = () => {
    console.log('Opening SMS composer for vendor:', vendor?.name)
  }

  const handleCallVendor = () => {
    window.open(`tel:${vendor?.phone}`, '_self')
  }

  const handleEmailVendor = () => {
    window.open(`mailto:${vendor?.email}`, '_self')
  }

  const handleExportReport = () => {
    console.log('Exporting vendor job report...')
    // Mock export functionality
    const csvContent = jobs
      ?.map(
        (job) =>
          `${job?.jobId},${job?.vehicle?.year} ${job?.vehicle?.make} ${job?.vehicle?.model},${job?.product},${job?.status},${job?.assignedDate},${job?.dueDate}`
      )
      ?.join('\n')

    const blob = new Blob([`Job ID,Vehicle,Product,Status,Assigned,Due Date\n${csvContent}`], {
      type: 'text/csv',
    })
    const url = window.URL?.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendor-${vendor?.id}-jobs-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
    a?.click()
    window.URL?.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main
        className={`transition-all duration-300 pt-16 ${isSidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}
      >
        <div className="p-6 space-y-6">
          {/* Back Navigation */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/vendor-operations-center')}
              iconName="ArrowLeft"
              iconPosition="left"
            >
              Back to Vendors
            </Button>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center gap-3">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
                iconName="Table"
                iconPosition="left"
              >
                Table View
              </Button>
              <Button
                variant={viewMode === 'workflow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('workflow')}
                iconName="Workflow"
                iconPosition="left"
              >
                Workflow View
              </Button>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                onClick={handleExportReport}
                iconName="Download"
                iconPosition="left"
              >
                Export Report
              </Button>
            </div>
          </div>

          {/* Vendor Header */}
          <VendorHeader
            vendor={vendor}
            onSendMessage={handleSendSMS}
            onCallVendor={handleCallVendor}
            onEmailVendor={handleEmailVendor}
          />

          {/* Quick Stats */}
          <QuickStats stats={stats} />

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              {viewMode === 'table' ? (
                <JobQueueTable
                  jobs={jobs}
                  onStatusUpdate={handleStatusUpdate}
                  onBulkUpdate={handleBulkUpdate}
                  selectedJobs={selectedJobs}
                  onJobSelect={setSelectedJobs}
                />
              ) : (
                <StatusWorkflow
                  jobs={jobs}
                  onStatusUpdate={handleStatusUpdate}
                  onBulkUpdate={handleBulkUpdate}
                />
              )}
            </div>

            <div className="space-y-6">
              <CommunicationPanel messages={messages} onSendMessage={handleSendMessage} />
            </div>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon name="Keyboard" size={20} className="text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground mb-2">Keyboard Shortcuts</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-mono bg-muted px-2 py-1 rounded">1</span> Mark as Pending
                  </div>
                  <div>
                    <span className="font-mono bg-muted px-2 py-1 rounded">2</span> Mark as In
                    Progress
                  </div>
                  <div>
                    <span className="font-mono bg-muted px-2 py-1 rounded">3</span> Mark as Complete
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Select jobs first, then use keyboard shortcuts for quick status updates
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VendorJobDashboard
