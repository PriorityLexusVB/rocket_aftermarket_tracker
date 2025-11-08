import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VendorListTable from './components/VendorListTable'
import VendorDetailSidebar from './components/VendorDetailSidebar'
import PerformanceDashboard from './components/PerformanceDashboard'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { getVendorVehicles, getVendorJobs, getVendors } from '../../services/vendorService'

const VendorOperationsCenter = () => {
  const { userProfile, isManager, isVendor, vendorId } = useAuth()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [activeView, setActiveView] = useState('vendors') // 'vendors' or 'dashboard'
  const [userRole] = useState('manager') // Mock user role
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Mock vendor data
  const [vendors, setVendors] = useState([
    {
      id: 'VND001',
      name: 'AutoTint Pro',
      contact: {
        phone: '(555) 123-4567',
        email: 'contact@autotintpro.com',
        address: '123 Main St, Cityville, ST 12345',
      },
      specialties: ['Window Tinting', 'Paint Protection'],
      status: 'available',
      activeJobs: 5,
      overdueJobs: 0,
      totalJobs: 127,
      completionRate: 94,
      avgTurnaroundTime: 2.1,
      lastActive: '2 hours ago',
      recentJobs: [
        {
          id: 'JOB001',
          vehicleInfo: '2023 Honda Civic - ABC123',
          serviceType: 'Window Tinting',
          status: 'in-progress',
          dueDate: '2025-09-25',
          overdueDays: 0,
        },
        {
          id: 'JOB002',
          vehicleInfo: '2022 Toyota Camry - XYZ789',
          serviceType: 'Paint Protection',
          status: 'pending',
          dueDate: '2025-09-26',
          overdueDays: 0,
        },
      ],
      smsHistory: [
        {
          id: 'SMS001',
          message: 'New job assigned: 2023 Honda Civic window tinting',
          timestamp: '2025-09-22 14:30',
          status: 'delivered',
        },
        {
          id: 'SMS002',
          message: 'Please confirm completion of Toyota Camry job',
          timestamp: '2025-09-21 10:15',
          status: 'delivered',
        },
      ],
    },
    {
      id: 'VND002',
      name: 'Shield Masters',
      contact: {
        phone: '(555) 234-5678',
        email: 'info@shieldmasters.com',
        address: '456 Oak Ave, Townsburg, ST 23456',
      },
      specialties: ['Paint Protection', 'Windshield Protection'],
      status: 'busy',
      activeJobs: 8,
      overdueJobs: 2,
      totalJobs: 89,
      completionRate: 87,
      avgTurnaroundTime: 3.2,
      lastActive: '1 hour ago',
      recentJobs: [
        {
          id: 'JOB003',
          vehicleInfo: '2024 BMW X5 - BMW456',
          serviceType: 'Paint Protection',
          status: 'overdue',
          dueDate: '2025-09-20',
          overdueDays: 2,
        },
        {
          id: 'JOB004',
          vehicleInfo: '2023 Mercedes C-Class - MBZ789',
          serviceType: 'Windshield Protection',
          status: 'in-progress',
          dueDate: '2025-09-24',
          overdueDays: 0,
        },
      ],
      smsHistory: [
        {
          id: 'SMS003',
          message: 'Urgent: BMW X5 job is overdue. Please update status.',
          timestamp: '2025-09-22 09:00',
          status: 'delivered',
        },
      ],
    },
    {
      id: 'VND003',
      name: 'Wrap Experts',
      contact: {
        phone: '(555) 345-6789',
        email: 'hello@wrapexperts.com',
        address: '789 Pine St, Villagetown, ST 34567',
      },
      specialties: ['Vehicle Wraps', 'Custom Graphics'],
      status: 'available',
      activeJobs: 3,
      overdueJobs: 0,
      totalJobs: 156,
      completionRate: 96,
      avgTurnaroundTime: 4.5,
      lastActive: '30 minutes ago',
      recentJobs: [
        {
          id: 'JOB005',
          vehicleInfo: '2023 Ford F-150 - FRD123',
          serviceType: 'Vehicle Wraps',
          status: 'completed',
          dueDate: '2025-09-22',
          overdueDays: 0,
        },
      ],
      smsHistory: [
        {
          id: 'SMS004',
          message: 'Ford F-150 wrap completed successfully',
          timestamp: '2025-09-22 13:45',
          status: 'delivered',
        },
      ],
    },
    {
      id: 'VND004',
      name: 'Detail Kings',
      contact: {
        phone: '(555) 456-7890',
        email: 'service@detailkings.com',
        address: '321 Elm Dr, Hamletville, ST 45678',
      },
      specialties: ['Detailing Services', 'Ceramic Coating'],
      status: 'unavailable',
      activeJobs: 0,
      overdueJobs: 0,
      totalJobs: 203,
      completionRate: 92,
      avgTurnaroundTime: 1.8,
      lastActive: '1 day ago',
      recentJobs: [],
      smsHistory: [
        {
          id: 'SMS005',
          message: 'Will be unavailable until next week due to equipment maintenance',
          timestamp: '2025-09-21 16:00',
          status: 'delivered',
        },
      ],
    },
    {
      id: 'VND005',
      name: 'Glass Guard',
      contact: {
        phone: '(555) 567-8901',
        email: 'contact@glassguard.com',
        address: '654 Maple Ln, Boroughtown, ST 56789',
      },
      specialties: ['Windshield Protection', 'Window Tinting'],
      status: 'available',
      activeJobs: 6,
      overdueJobs: 1,
      totalJobs: 78,
      completionRate: 89,
      avgTurnaroundTime: 2.9,
      lastActive: '4 hours ago',
      recentJobs: [
        {
          id: 'JOB006',
          vehicleInfo: '2022 Audi A4 - AUD456',
          serviceType: 'Windshield Protection',
          status: 'overdue',
          dueDate: '2025-09-21',
          overdueDays: 1,
        },
      ],
      smsHistory: [
        {
          id: 'SMS006',
          message: 'Audi A4 windshield protection job is overdue',
          timestamp: '2025-09-22 08:30',
          status: 'delivered',
        },
      ],
    },
  ])

  // Mock performance data
  const [performanceData] = useState({
    totalVendors: 5,
    activeJobs: 22,
    overdueJobs: 3,
    avgCompletionRate: 91.6,
    avgTurnaround: 2.9,
    topPerformers: [
      {
        id: 'VND003',
        name: 'Wrap Experts',
        specialty: 'Vehicle Wraps',
        completionRate: 96,
        jobsCompleted: 156,
      },
      {
        id: 'VND001',
        name: 'AutoTint Pro',
        specialty: 'Window Tinting',
        completionRate: 94,
        jobsCompleted: 127,
      },
      {
        id: 'VND004',
        name: 'Detail Kings',
        specialty: 'Detailing',
        completionRate: 92,
        jobsCompleted: 203,
      },
      {
        id: 'VND005',
        name: 'Glass Guard',
        specialty: 'Windshield Protection',
        completionRate: 89,
        jobsCompleted: 78,
      },
      {
        id: 'VND002',
        name: 'Shield Masters',
        specialty: 'Paint Protection',
        completionRate: 87,
        jobsCompleted: 89,
      },
    ],
    recentActivity: [
      {
        id: 'ACT001',
        type: 'job_completed',
        description: 'Wrap Experts completed Ford F-150 vehicle wrap',
        timestamp: '2 hours ago',
      },
      {
        id: 'ACT002',
        type: 'job_assigned',
        description: 'New paint protection job assigned to AutoTint Pro',
        timestamp: '4 hours ago',
      },
      {
        id: 'ACT003',
        type: 'status_update',
        description: 'Shield Masters updated BMW X5 job status to overdue',
        timestamp: '6 hours ago',
      },
      {
        id: 'ACT004',
        type: 'job_completed',
        description: 'Glass Guard completed Audi A4 windshield protection',
        timestamp: '1 day ago',
      },
    ],
  })

  useEffect(() => {
    document.title = 'Vendor Operations Center - Rocket Aftermarket Tracker'
  }, [])

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor)
  }

  const handleVendorUpdate = (updatedVendor) => {
    // In a real app, this would update the vendor in the database
    console.log('Updating vendor:', updatedVendor)
  }

  const handleBulkAction = (action, vendorIds) => {
    switch (action) {
      case 'sms':
        console.log('Sending SMS to vendors:', vendorIds)
        // Mock SMS sending
        alert(`SMS sent to ${vendorIds?.length} vendor${vendorIds?.length > 1 ? 's' : ''}`)
        break
      case 'reassign':
        console.log('Reassigning jobs for vendors:', vendorIds)
        alert(
          `Job reassignment initiated for ${vendorIds?.length} vendor${vendorIds?.length > 1 ? 's' : ''}`
        )
        break
      case 'export':
        console.log('Exporting vendor data:', vendorIds)
        alert('Vendor data export started. Download will begin shortly.')
        break
      case 'create':
        console.log('Creating new vendor')
        alert('New vendor creation form would open here')
        break
      default:
        console.log('Unknown action:', action)
    }
  }

  const handleSendSMS = (vendorId, message) => {
    console.log(`Sending SMS to vendor ${vendorId}:`, message)
    alert(`SMS sent successfully to vendor ${vendorId}`)
  }

  const handleAssignJob = (vendorId, jobData) => {
    console.log(`Assigning job to vendor ${vendorId}:`, jobData)
    alert(`Job assigned successfully to vendor ${vendorId}`)
  }

  const handleDrillDown = (type, id) => {
    console.log('Drilling down into:', type, id)
    // In a real app, this would navigate to detailed views
    switch (type) {
      case 'completion-rate':
        alert('Opening detailed completion rate analysis')
        break
      case 'turnaround-time':
        alert('Opening turnaround time breakdown')
        break
      case 'specialty-distribution':
        alert('Opening specialty distribution details')
        break
      case 'top-performers':
        alert('Opening top performers detailed view')
        break
      case 'activity':
        alert(`Opening activity details for ${id}`)
        break
      default:
        alert('Opening detailed view')
    }
  }

  useEffect(() => {
    const initializeVendorOperations = async () => {
      try {
        setLoading(true)

        // For vendor users, load only their assigned data
        if (isVendor && vendorId) {
          const [vendorVehicles, vendorJobs] = await Promise.all([
            getVendorVehicles(vendorId),
            getVendorJobs(vendorId),
          ])

          setVendors([
            {
              id: vendorId,
              name: userProfile?.vendor?.name || 'Your Vendor',
              vehicles: vendorVehicles || [],
              jobs: vendorJobs || [],
            },
          ])

          if (vendorVehicles?.length > 0) {
            setSelectedVendor(vendorId)
          }
        } else if (isManager) {
          // For managers, load all vendor data as before
          const vendorsData = await getVendors()
          setVendors(vendorsData || [])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error initializing vendor operations:', error)
        setError('Failed to load vendor operations data')
        setLoading(false)
      }
    }

    initializeVendorOperations()
  }, [userProfile, isManager, isVendor, vendorId])

  // Add access control check
  if (!isManager && !isVendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You need manager privileges or vendor access to view this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Vendor Operations Center</h1>
                <p className="text-muted-foreground">
                  Manage vendor relationships, track performance, and assign jobs
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex bg-muted rounded-lg p-1">
                  <Button
                    variant={activeView === 'vendors' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveView('vendors')}
                    className="px-4"
                  >
                    <Icon name="Users" size={16} className="mr-2" />
                    Vendors
                  </Button>
                  <Button
                    variant={activeView === 'dashboard' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveView('dashboard')}
                    className="px-4"
                  >
                    <Icon name="BarChart3" size={16} className="mr-2" />
                    Dashboard
                  </Button>
                </div>

                <Button
                  variant="outline"
                  iconName="Download"
                  iconPosition="left"
                  onClick={() => handleBulkAction('export', [])}
                >
                  Export Report
                </Button>

                <Button
                  variant="outline"
                  iconName="RefreshCw"
                  onClick={() => window.location?.reload()}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon name="Users" size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-xl font-semibold text-foreground">{vendors?.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Icon name="Clock" size={20} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                    <p className="text-xl font-semibold text-foreground">
                      {vendors?.reduce((sum, v) => sum + v?.activeJobs, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-error/10 rounded-lg">
                    <Icon name="AlertTriangle" size={20} className="text-error" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue Jobs</p>
                    <p className="text-xl font-semibold text-foreground">
                      {vendors?.reduce((sum, v) => sum + v?.overdueJobs, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Icon name="TrendingUp" size={20} className="text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Performance</p>
                    <p className="text-xl font-semibold text-foreground">
                      {Math.round(
                        vendors?.reduce((sum, v) => sum + v?.completionRate, 0) / vendors?.length
                      )}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {activeView === 'vendors' ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Vendor List - 60% width */}
              <div className="xl:col-span-3">
                <VendorListTable
                  vendors={vendors}
                  selectedVendor={selectedVendor}
                  onVendorSelect={handleVendorSelect}
                  onVendorUpdate={handleVendorUpdate}
                  onBulkAction={handleBulkAction}
                  userRole={userRole}
                />
              </div>

              {/* Vendor Detail Sidebar - 40% width */}
              <div className="xl:col-span-2">
                <VendorDetailSidebar
                  vendor={selectedVendor}
                  onClose={() => setSelectedVendor(null)}
                  onSendSMS={handleSendSMS}
                  onAssignJob={handleAssignJob}
                  userRole={userRole}
                />
              </div>
            </div>
          ) : (
            <PerformanceDashboard performanceData={performanceData} onDrillDown={handleDrillDown} />
          )}
        </div>
      </main>
    </div>
  )
}

export default VendorOperationsCenter
