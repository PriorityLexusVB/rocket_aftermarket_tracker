import React, { useEffect, useMemo, useState } from 'react'
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
import vendorService, { getVendorJobs } from '../../services/vendorService'

const VendorJobDashboard = () => {
  const { vendorId } = useParams()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState([])
  const [viewMode, setViewMode] = useState('table') // 'table' or 'workflow'

  const [vendorRow, setVendorRow] = useState(null)
  const [jobs, setJobs] = useState([])
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const normalizeStatus = (status) => {
    if (!status) return ''
    const s = String(status).toLowerCase()
    if (s.includes('progress')) return 'In Progress'
    if (s.startsWith('complete')) return 'Complete'
    if (s.startsWith('pending')) return 'Pending'
    // Title-case fallback
    return String(status)
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!vendorId) {
        setVendorRow(null)
        setJobs([])
        setMessages([])
        setLoadError('')
        return
      }

      setIsLoading(true)
      setLoadError('')

      try {
        const row = await vendorService.getById(vendorId)
        if (!cancelled) setVendorRow(row)
      } catch (e) {
        console.error('VendorJobDashboard: vendor load failed', e)
      }

      try {
        const rows = await getVendorJobs(vendorId)
        const mapped = (rows || []).map((r) => {
          const assignedDate = r?.scheduled_start ?? r?.created_at ?? null
          const dueDate = r?.scheduled_end ?? null
          return {
            id: r?.job_id ?? r?.id,
            jobId: r?.job_number ?? r?.job_id ?? '',
            vehicle: {
              year: '',
              make: r?.vehicle_info ?? '',
              model: '',
              vin: '',
            },
            product: r?.job_title ?? '',
            assignedDate: assignedDate ? new Date(assignedDate).toISOString().slice(0, 10) : '',
            dueDate: dueDate ? new Date(dueDate).toISOString().slice(0, 10) : '',
            status: normalizeStatus(r?.job_status),
            priority: undefined,
          }
        })

        if (!cancelled) setJobs(mapped)
      } catch (e) {
        console.error('VendorJobDashboard: jobs load failed', e)
        if (!cancelled) setLoadError('Unable to load vendor jobs.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [vendorId])

  const vendor = useMemo(() => {
    const joinDate = vendorRow?.created_at
      ? new Date(vendorRow.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : null

    const completedJobs = jobs?.filter((j) => j?.status === 'Complete')?.length ?? 0

    return {
      id: vendorId || vendorRow?.id || null,
      name: vendorRow?.name || 'Vendor',
      email: vendorRow?.email || null,
      phone: vendorRow?.phone || null,
      location: vendorRow?.address || null,
      status: vendorRow?.is_active === false ? 'Inactive' : 'Active',
      joinDate: joinDate,
      unreadMessages: 0,
      metrics: {
        totalJobs: jobs?.length ?? 0,
        completedJobs,
        performanceScore: null,
        avgCompletionTime: null,
      },
    }
  }, [jobs, vendorId, vendorRow])

  const stats = useMemo(() => {
    const totalJobs = jobs?.length ?? 0
    const pendingJobs = jobs?.filter((job) => job?.status === 'Pending')?.length ?? 0
    const inProgressJobs = jobs?.filter((job) => job?.status === 'In Progress')?.length ?? 0
    const completedJobs = jobs?.filter((job) => job?.status === 'Complete')?.length ?? 0
    const overdueJobs =
      jobs?.filter(
        (job) => job?.dueDate && new Date(job.dueDate) < new Date() && job?.status !== 'Complete'
      )?.length ?? 0

    return {
      totalJobs,
      pendingJobs,
      inProgressJobs,
      completedJobs,
      overdueJobs,
      avgCompletionTime: null,
    }
  }, [jobs])

  const handleStatusUpdate = (jobId, newStatus) => {
    console.warn('VendorJobDashboard: status update not implemented', { jobId, newStatus })
  }

  const handleBulkUpdate = (jobIds, newStatus) => {
    setSelectedJobs([])
    console.warn('VendorJobDashboard: bulk update not implemented', { jobIds, newStatus })
  }

  const handleSendMessage = (messageContent) => {
    console.warn('VendorJobDashboard: SMS sending not implemented')
    const newMessage = {
      id: `MSG${Date.now()}`,
      sender: 'You',
      content: messageContent,
      timestamp: new Date(),
      status: 'failed',
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const handleSendSMS = () => {
    console.warn('VendorJobDashboard: SMS composer not implemented', { vendorId })
  }

  const handleCallVendor = () => {
    window.open(`tel:${vendor?.phone}`, '_self')
  }

  const handleEmailVendor = () => {
    window.open(`mailto:${vendor?.email}`, '_self')
  }

  const handleExportReport = () => {
    console.log('Exporting vendor job report...')
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

          {loadError ? (
            <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4">
              {loadError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading vendor data…</div>
          ) : null}

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
