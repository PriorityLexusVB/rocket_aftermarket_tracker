import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import useTenant from '../../hooks/useTenant'
import AppLayout from '../../components/layouts/AppLayout'
import UIButton from '../../components/ui/Button'
import {
  Users,
  Package,
  MessageSquare,
  Building,
  UserCheck,
  AlertCircle,
  RefreshCw,
  QrCode,
} from 'lucide-react'
import { useLogger } from '../../hooks/useLogger'
import { clearDropdownCache } from '../../services/dropdownService'
import adminService from '../../services/adminService'
import { vendorService } from '../../services/vendorService'
import { vendorInsertSchema } from '../../db/schemas'
import {
  SMS_TEMPLATES_TABLE_AVAILABLE,
  disableSmsTemplatesCapability,
} from '../../utils/capabilityTelemetry'
import UserAccountsTab from './components/UserAccountsTab'
import StaffRecordsTab from './components/StaffRecordsTab'
import VendorsTab from './components/VendorsTab'
import ProductsTab from './components/ProductsTab'
import SmsTemplatesTab from './components/SmsTemplatesTab'
import QRCodeTab from './components/QRCodeTab'
import AdminModal from './components/AdminModal'
import { useToast } from '@/components/ui/ToastProvider'

const AdminPage = () => {
  const { userProfile, user, loading: authLoading } = useAuth()
  const { orgId } = useTenant()
  const effectiveOrgId = orgId || userProfile?.dealer_id || userProfile?.org_id || null
  const { logBusinessAction, logError: logErr } = useLogger()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('userAccounts')
  const [error, setError] = useState(null)
  const [onlyMyOrg, setOnlyMyOrg] = useState(true)
  const [staffActionMsg, setStaffActionMsg] = useState('')
  const [accountsActionMsg, setAccountsActionMsg] = useState('')
  const [vendorsActionMsg, setVendorsActionMsg] = useState('')
  const [productsActionMsg, setProductsActionMsg] = useState('')
  // Quick filters
  const [accountsQuery, setAccountsQuery] = useState('')
  const [accountsDeptFilter, setAccountsDeptFilter] = useState('')
  const [staffQuery, setStaffQuery] = useState('')
  const [staffDeptFilter, setStaffDeptFilter] = useState('')

  // Debug states
  const [debugInfo, setDebugInfo] = useState({
    authUser: null,
    userProfile: null,
    profileLoadError: null,
    showDebug: false,
  })

  // States for different sections
  const [userAccounts, setUserAccounts] = useState([])
  const [staffRecords, setStaffRecords] = useState([])
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [smsTemplates, setSmsTemplates] = useState([])

  const [smsTemplatesAvailable, setSmsTemplatesAvailable] = useState(
    SMS_TEMPLATES_TABLE_AVAILABLE !== false
  )

  // Loading states
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [submitError, setSubmitError] = useState('')

  // Form states
  const [userAccountForm, setUserAccountForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'manager',
    department: '',
    phone: '',
  })

  const [staffForm, setStaffForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    department: '',
  })

  // Section 20: React Hook Form for Vendor with Zod validation
  const vendorFormMethods = useForm({
    resolver: zodResolver(vendorInsertSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      specialty: '',
      rating: '',
      orgId: null,
    },
  })

  const [productForm, setProductForm] = useState({
    name: '',
    brand: '',
    category: '',
    cost: '',
    unit_price: '',
    part_number: '',
    description: '',
    op_code: '',
    dealer_id: null,
    // legacy fallback (do not write to DB)
    org_id: null,
  })

  const [templateForm, setTemplateForm] = useState({
    name: '',
    message_template: '',
    template_type: 'job_status',
  })

  const tabs = [
    { id: 'userAccounts', label: 'User Accounts', icon: UserCheck },
    { id: 'staffRecords', label: 'Staff Records', icon: Users },
    { id: 'vendors', label: 'Vendors', icon: Building },
    { id: 'products', label: 'Aftermarket Products', icon: Package },
    ...(smsTemplatesAvailable
      ? [{ id: 'smsTemplates', label: 'SMS Templates', icon: MessageSquare }]
      : []),
    { id: 'qrCodes', label: 'QR Code Generator', icon: QrCode },
  ]

  useEffect(() => {
    if (!smsTemplatesAvailable && activeTab === 'smsTemplates') {
      setActiveTab('userAccounts')
    }
  }, [smsTemplatesAvailable, activeTab])

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'vendor', label: 'Vendor' },
  ]

  const userDepartmentOptions = [
    { value: 'Delivery Coordinator', label: 'Delivery Coordinator' },
    { value: 'Managers', label: 'Managers' },
    { value: 'Finance Manager', label: 'Finance Manager' },
  ]

  const staffDepartmentOptions = [
    { value: 'Sales Consultants', label: 'Sales Consultants' },
    { value: 'Finance Manager', label: 'Finance Manager' },
  ]

  const templateTypeOptions = [
    { value: 'job_status', label: 'Job Status' },
    { value: 'overdue_alert', label: 'Overdue Alert' },
    { value: 'customer_notification', label: 'Customer Notification' },
    { value: 'vendor_assignment', label: 'Vendor Assignment' },
    { value: 'completion_notice', label: 'Completion Notice' },
  ]

  // Debug function to check current user status
  const debugAuthState = async () => {
    try {
      const res = await adminService.debugAuthState()

      const session = res?.session

      if (session?.user) {
        setDebugInfo({
          authUser: session?.user,
          userProfile: res?.profile,
          profileLoadError: res?.profileError,
          showDebug: true,
        })
      } else {
        setDebugInfo({
          authUser: null,
          userProfile: null,
          profileLoadError: res?.sessionError || { message: 'No authenticated user' },
          showDebug: true,
        })
      }
    } catch (error) {
      console.error('Debug error:', error)
      setDebugInfo((prev) => ({
        ...prev,
        profileLoadError: error,
        showDebug: true,
      }))
    }
  }

  const loadUserAccounts = useCallback(async () => {
    try {
      const { data, error } = await adminService.listUserAccounts({
        orgId: effectiveOrgId,
        onlyMyOrg,
      })

      if (error) throw new Error(error?.message || 'Failed to load user accounts')

      setUserAccounts(data || [])
    } catch (error) {
      console.error('Error loading user accounts:', error)
    }
  }, [onlyMyOrg, effectiveOrgId])

  const loadStaffRecords = useCallback(async () => {
    try {
      const { data, error } = await adminService.listStaffRecords({
        orgId: effectiveOrgId,
        onlyMyOrg,
      })

      if (error) throw new Error(error?.message || 'Failed to load staff records')

      setStaffRecords(data || [])
    } catch (error) {
      console.error('Error loading staff records:', error)
    }
  }, [onlyMyOrg, effectiveOrgId])

  const loadVendors = useCallback(async () => {
    try {
      const { data, error } = await adminService.listVendors({ orgId: effectiveOrgId, onlyMyOrg })

      if (error) throw new Error(error?.message || 'Failed to load vendors')

      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }, [onlyMyOrg, effectiveOrgId])

  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await adminService.listProducts({ orgId: effectiveOrgId, onlyMyOrg })

      if (error) throw new Error(error?.message || 'Failed to load products')

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }, [onlyMyOrg, effectiveOrgId])

  const loadSmsTemplates = useCallback(async () => {
    try {
      if (smsTemplatesAvailable === false) {
        setSmsTemplates([])
        setSmsTemplatesAvailable(false)
        return
      }

      const { data, error } = await adminService.listSmsTemplates()

      if (error) throw new Error(error?.message || 'Failed to load SMS templates')

      setSmsTemplates(data || [])
    } catch (error) {
      const msg = String(error?.message || error || '').toLowerCase()
      if (msg.includes('sms_templates') && msg.includes('could not find the table')) {
        disableSmsTemplatesCapability()
        setSmsTemplates([])
        setSmsTemplatesAvailable(false)
        return
      }
      console.error('Error loading SMS templates:', error)
    }
  }, [smsTemplatesAvailable])

  const loadOrganizations = useCallback(async () => {
    try {
      const { data, error } = await adminService.listOrganizations({
        orgId: effectiveOrgId,
        onlyMyOrg,
      })

      if (error) throw new Error(error?.message || 'Failed to load organizations')

      setOrganizations(data || [])
    } catch (error) {
      console.error('Error loading organizations:', error)
    }
  }, [onlyMyOrg, effectiveOrgId])

  // Enhanced data loading with better error handling
  const loadAllData = useCallback(async () => {
    try {
      const tasks = [
        loadUserAccounts(),
        loadStaffRecords(),
        loadVendors(),
        loadProducts(),
        loadOrganizations(),
      ]
      if (smsTemplatesAvailable) tasks.splice(4, 0, loadSmsTemplates())

      const results = await Promise.allSettled(tasks)

      results?.forEach((result, index) => {
        const sections = smsTemplatesAvailable
          ? [
              'User Accounts',
              'Staff Records',
              'Vendors',
              'Products',
              'SMS Templates',
              'Organizations',
            ]
          : ['User Accounts', 'Staff Records', 'Vendors', 'Products', 'Organizations']
        if (result?.status === 'rejected') {
          console.error(`Failed to load ${sections?.[index]}:`, result?.reason)
        }
      })
    } catch (error) {
      console.error('Error loading admin data:', error)
      setError('Failed to load some admin data. Please try refreshing the page.')
    }
  }, [
    loadOrganizations,
    loadProducts,
    loadSmsTemplates,
    loadStaffRecords,
    loadUserAccounts,
    loadVendors,
    smsTemplatesAvailable,
  ])

  // Initialize admin panel - check auth and load data
  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        const conn = await adminService.checkConnection()

        // Hard fail only when client itself is unavailable
        if (!conn?.ok && String(conn?.error?.message || '').includes('unavailable')) {
          setError('Database connection unavailable. Please refresh the page.')
          setLoading(false)
          return
        }

        // Connection check is best-effort; warn but allow UI to render so tests can proceed
        if (!conn?.ok) {
          console.warn('Database connection check failed (non-blocking):', conn?.error)
        }

        await loadAllData()

        setLoading(false)
      } catch (error) {
        console.error('Admin initialization failed:', error)
        setError('Failed to initialize admin panel: ' + error?.message)
        setLoading(false)
      }
    }

    // Wait for auth to complete initialization, then proceed
    if (!authLoading) {
      initializeAdmin()
    }
  }, [authLoading, loadAllData, user, userProfile])

  // Attach/assign a single profile to current org
  const attachProfileToMyOrg = async (profileId) => {
    if (!orgId) {
      toast?.error?.('No organization found — please log out and log back in, or contact your manager.')
      return
    }
    try {
      setSubmitting(true)
      await adminService.attachProfileToOrg({ profileId, orgId })
      await Promise.all([loadUserAccounts(), loadStaffRecords()])
      try {
        await logBusinessAction?.(
          'attach_profile_to_org',
          'admin',
          profileId,
          'Attached user profile to current org',
          { orgId }
        )
      } catch {}
    } catch (e) {
      console.error('attachProfileToMyOrg error:', e)
      toast?.error?.(`Couldn't add user to your organization. Try again or contact support if the problem continues.`)
      try {
        await logErr?.(e, { where: 'attachProfileToMyOrg', orgId, profileId })
      } catch {}
    } finally {
      setSubmitting(false)
    }
  }

  // Assign current org to all active staff missing org
  const assignOrgToActiveStaff = async () => {
    setStaffActionMsg('')
    if (!orgId) {
      setStaffActionMsg('No organization detected for current user.')
      return
    }
    try {
      setSubmitting(true)
      await adminService.assignOrgToActiveStaff({ orgId })
      setStaffActionMsg('Assigned org to active staff without org.')
      await loadStaffRecords()
      try {
        await logBusinessAction?.(
          'assign_org_staff',
          'system',
          null,
          'Assigned org to staff without org',
          { orgId }
        )
      } catch {}
    } catch (e) {
      console.error('assignOrgToActiveStaff error:', e)
      setStaffActionMsg(e?.message || 'Failed to assign org to staff')
      try {
        await logErr?.(e, { where: 'assignOrgToActiveStaff', orgId })
      } catch {}
    } finally {
      setSubmitting(false)
    }
  }

  // Assign current org to all active admin/manager accounts missing org
  const assignOrgToAccounts = async () => {
    setAccountsActionMsg('')
    if (!orgId) {
      setAccountsActionMsg('No organization detected for current user.')
      return
    }
    try {
      setSubmitting(true)
      await adminService.assignOrgToAccounts({ orgId })
      setAccountsActionMsg('Assigned org to admin/manager accounts without org.')
      await loadUserAccounts()
    } catch (e) {
      console.error('assignOrgToAccounts error:', e)
      setAccountsActionMsg(e?.message || 'Failed to assign org to accounts')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    // Refresh dependent data whenever org or org-scope toggle changes
    loadStaffRecords()
    loadUserAccounts()
    loadVendors()
    loadProducts()
  }, [loadProducts, loadStaffRecords, loadUserAccounts, loadVendors])

  // Assign current org to vendors with null org
  const assignOrgToVendors = async () => {
    setVendorsActionMsg('')
    if (!orgId) {
      setVendorsActionMsg('No organization detected for current user.')
      return
    }
    try {
      setSubmitting(true)
      await adminService.assignOrgToVendors({ orgId })
      setVendorsActionMsg('Assigned org to vendors without org.')
      await loadVendors()
      try {
        await logBusinessAction?.(
          'assign_org_vendors',
          'system',
          null,
          'Assigned org to vendors without org',
          { orgId }
        )
      } catch {}
    } catch (e) {
      console.error('assignOrgToVendors error:', e)
      setVendorsActionMsg(e?.message || 'Failed to assign org to vendors')
      try {
        await logErr?.(e, { where: 'assignOrgToVendors', orgId })
      } catch {}
    } finally {
      setSubmitting(false)
    }
  }

  // Assign current org to products with null org
  const assignOrgToProducts = async () => {
    setProductsActionMsg('')
    if (!orgId) {
      setProductsActionMsg('No organization detected for current user.')
      return
    }
    try {
      setSubmitting(true)
      await adminService.assignOrgToProducts({ orgId })
      setProductsActionMsg('Assigned org to products without org.')
      await loadProducts()
      try {
        await logBusinessAction?.(
          'assign_org_products',
          'system',
          null,
          'Assigned org to products without org',
          { orgId }
        )
      } catch {}
    } catch (e) {
      console.error('assignOrgToProducts error:', e)
      setProductsActionMsg(e?.message || 'Failed to assign org to products')
      try {
        await logErr?.(e, { where: 'assignOrgToProducts', orgId })
      } catch {}
    } finally {
      setSubmitting(false)
    }
  }

  const openModal = (type, item = null) => {
    setModalType(type)
    setEditingItem(item)
    setSubmitError('')
    setShowModal(true)

    // Reset forms
    if (type === 'userAccount') {
      setUserAccountForm(
        item || {
          full_name: '',
          email: '',
          password: '',
          role: 'manager',
          department: '',
          phone: '',
        }
      )
    } else if (type === 'staff') {
      setStaffForm(
        item || {
          full_name: '',
          phone: '',
          email: '',
          department: '',
        }
      )
    } else if (type === 'vendor') {
      // Section 20: Use react-hook-form reset
      vendorFormMethods.reset(
        item
          ? {
              name: item.name || '',
              contactPerson: item.contact_person || '',
              phone: item.phone || '',
              email: item.email || '',
              specialty: item.specialty || '',
              rating: item.rating?.toString() || '',
              orgId: item.dealer_id || item.org_id || effectiveOrgId || null,
              isActive: item.is_active !== undefined ? item.is_active : true,
            }
          : {
              name: '',
              contactPerson: '',
              phone: '',
              email: '',
              specialty: '',
              rating: '',
              orgId: effectiveOrgId || null,
              isActive: true,
            }
      )
    } else if (type === 'product') {
      setProductForm(
        item || {
          name: '',
          brand: '',
          category: '',
          cost: '',
          unit_price: '',
          part_number: '',
          description: '',
          op_code: '',
          dealer_id: effectiveOrgId || null,
        }
      )
    } else if (type === 'template') {
      setTemplateForm(
        item || {
          name: '',
          message_template: '',
          template_type: 'job_status',
        }
      )
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (submitting || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    try {
      if (modalType === 'userAccount') {
        await handleUserAccountSubmit()
      } else if (modalType === 'staff') {
        await handleStaffSubmit()
      } else if (modalType === 'vendor') {
        // Section 20: react-hook-form does NOT throw on validation failure.
        // If invalid, keep the modal open so inline errors remain visible.
        const isValid = await vendorFormMethods.trigger()
        if (!isValid) return

        // Valid: proceed with the RHF submission handler.
        await handleVendorSubmit()
      } else if (modalType === 'product') {
        await handleProductSubmit()
      } else if (modalType === 'template') {
        await handleTemplateSubmit()
      }

      setShowModal(false)
      setEditingItem(null)
    } catch (error) {
      console.error('Error submitting form:', error)
      const msg = error?.issues
        ? error.issues.map((i) => i.message).join(', ')
        : error?.message || 'An unexpected error occurred.'
      setSubmitError(msg)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Generate a decent random password when auto-provisioning staff accounts
  const generateStrongPassword = (length = 16) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-='
    const cryptoSource = globalThis?.crypto
    if (!cryptoSource?.getRandomValues) {
      throw new Error(
        'Secure random generator (crypto.getRandomValues) unavailable. Password generation requires a modern browser or secure execution environment.'
      )
    }
    const array = new Uint32Array(length)
    cryptoSource.getRandomValues(array)

    let pwd = ''
    for (let i = 0; i < length; i++) {
      pwd += chars[array[i] % chars.length]
    }
    return pwd
  }

  const handleUserAccountSubmit = async () => {
    if (editingItem) {
      // If editing a user in another org, optionally reassign to current org before updating
      const editingTenantId = editingItem?.dealer_id ?? editingItem?.org_id
      if (orgId && editingTenantId && editingTenantId !== orgId) {
        const doReassign = window.confirm(
          'This user belongs to another organization. Reassign to your org and continue editing?'
        )
        if (!doReassign) {
          throw new Error('Edit cancelled. User belongs to another organization.')
        }
        await adminService.attachProfileToOrg({ profileId: editingItem?.id, orgId })
      }
      // Update existing user
      await adminService.updateUserProfile(editingItem?.id, {
        full_name: userAccountForm?.full_name,
        email: userAccountForm?.email,
        role: userAccountForm?.role,
        department: userAccountForm?.department,
        phone: userAccountForm?.phone,
      })
    } else {
      // Create new user with auth account
      if (!userAccountForm?.password) {
        throw new Error('Password is required for new users')
      }

      await adminService.createUserAccountWithLogin({
        email: userAccountForm?.email,
        password: userAccountForm?.password,
        metadata: {
          full_name: userAccountForm?.full_name,
          role: userAccountForm?.role,
          department: userAccountForm?.department,
          phone: userAccountForm?.phone,
        },
      })
    }

    await loadUserAccounts()
    setAccountsActionMsg('User account saved.')
    setTimeout(() => setAccountsActionMsg(''), 3000)
  }

  const handleStaffSubmit = async () => {
    const staffData = {
      full_name: staffForm?.full_name,
      phone: staffForm?.phone || null,
      email: staffForm?.email || null,
      department: staffForm?.department,
      role: 'staff', // Always staff role for directory entries
      is_active: true,
      vendor_id: null,
      dealer_id: staffForm?.dealer_id || staffForm?.org_id || orgId || null,
    }

    if (editingItem) {
      // If editing a staff in another org, optionally reassign to current org before updating
      const editingTenantId = editingItem?.dealer_id ?? editingItem?.org_id
      if (orgId && editingTenantId && editingTenantId !== orgId) {
        const doReassign = window.confirm(
          'This staff profile belongs to another organization. Reassign to your org and continue editing?'
        )
        if (!doReassign) {
          throw new Error('Edit cancelled. Staff belongs to another organization.')
        }
        await adminService.attachProfileToOrg({ profileId: editingItem?.id, orgId })
      }

      await adminService.updateUserProfile(editingItem?.id, staffData)
    } else {
      // If an email is provided, provision an auth account so the trigger creates the profile
      if (staffData.email) {
        const autoPassword = generateStrongPassword()

        await adminService.createStaffWithOptionalLogin({
          ...staffData,
          autoPassword,
        })
      } else {
        // No email: create a directory-only staff profile (no login) — allowed by relaxed schema
        await adminService.createStaffWithOptionalLogin(staffData)
      }
    }

    await loadStaffRecords()
    try {
      // Invalidate dropdown caches so staff options refresh immediately across the app
      clearDropdownCache()
    } catch {}
    setStaffActionMsg('Staff profile saved.')
    setTimeout(() => setStaffActionMsg(''), 3000)
  }

  // Section 20: Typed vendor submit using vendorService
  const handleVendorSubmit = vendorFormMethods.handleSubmit(async (formData) => {
    const payload = {
      ...formData,
      orgId: formData?.orgId || effectiveOrgId || null,
    }
    if (editingItem) {
      await vendorService.updateVendor(editingItem?.id, payload)
    } else {
      await vendorService.createVendor(payload)
    }

    await loadVendors()
    try {
      clearDropdownCache()
    } catch {}
  })

  const handleProductSubmit = async () => {
    const productData = {
      name: productForm?.name,
      brand: productForm?.brand,
      category: productForm?.category,
      cost: productForm?.cost ? parseFloat(productForm?.cost) : 0,
      unit_price: productForm?.unit_price ? parseFloat(productForm?.unit_price) : 0,
      part_number: productForm?.part_number,
      description: productForm?.description,
      op_code: productForm?.op_code || null,
      dealer_id: productForm?.dealer_id || productForm?.org_id || effectiveOrgId || null,
    }

    await adminService.saveProduct({ editingId: editingItem?.id ?? null, productData })

    await loadProducts()
    try {
      clearDropdownCache()
    } catch {}
  }

  const handleTemplateSubmit = async () => {
    // Ensure stock number appears first and message is under 160 chars
    let message = templateForm?.message_template
    if (!message?.startsWith('Stock #') && !message?.startsWith('{{stock')) {
      message = 'Stock #{{stock_number}}: ' + message
    }

    if (message?.length > 160) {
      throw new Error('SMS template must be under 160 characters')
    }

    const templateData = {
      name: templateForm?.name,
      message_template: message,
      template_type: templateForm?.template_type,
    }

    await adminService.saveSmsTemplate({ editingId: editingItem?.id ?? null, templateData })

    await loadSmsTemplates()
  }

  const handleDelete = async (table, id, itemType = null) => {
    // Friendlier confirm
    const context = (() => {
      if (table === 'user_profiles')
        return itemType === 'userAccount' ? 'this user account' : 'this staff profile'
      if (table === 'vendors') return 'this vendor'
      if (table === 'products') return 'this product'
      if (table === 'sms_templates') return 'this template'
      return 'this item'
    })()
    if (!confirm(`Are you sure you want to delete ${context}? This action cannot be undone.`))
      return

    setDeletingId(id)
    setSubmitting(true)

    try {
      if (table === 'user_profiles') {
        await adminService.deleteUserProfileWithCleanup(id)
      } else {
        await adminService.deleteRow(table, id)
      }

      // Immediately update state to remove the deleted item - this is the critical fix
      if (table === 'user_profiles') {
        if (itemType === 'userAccount') {
          setUserAccounts((prev) => {
            const filtered = prev?.filter((item) => item?.id !== id)
            return filtered || []
          })
          setAccountsActionMsg('User account deleted.')
        } else {
          setStaffRecords((prev) => {
            const filtered = prev?.filter((item) => item?.id !== id)
            return filtered || []
          })
          setStaffActionMsg('Staff profile deleted.')
        }

        // Force a complete refresh after successful deletion with proper delay
        setTimeout(async () => {
          try {
            await Promise.all([loadUserAccounts(), loadStaffRecords()])
          } catch (refreshError) {
            console.error('Error refreshing data after deletion:', refreshError)
          }
        }, 500)
      } else if (table === 'vendors') {
        setVendors((prev) => {
          const filtered = prev?.filter((item) => item?.id !== id)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadVendors()
          } catch (refreshError) {
            console.error('Error refreshing vendors:', refreshError)
          }
        }, 500)
        try {
          clearDropdownCache()
        } catch {}
      } else if (table === 'products') {
        setProducts((prev) => {
          const filtered = prev?.filter((item) => item?.id !== id)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadProducts()
          } catch (refreshError) {
            console.error('Error refreshing products:', refreshError)
          }
        }, 500)
        try {
          clearDropdownCache()
        } catch {}
      } else if (table === 'sms_templates') {
        setSmsTemplates((prev) => {
          const filtered = prev?.filter((item) => item?.id !== id)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadSmsTemplates()
          } catch (refreshError) {
            console.error('Error refreshing SMS templates:', refreshError)
          }
        }, 500)
      }

      // Show success message
      // Auto clear messages after a short while
      setTimeout(() => {
        setAccountsActionMsg('')
        setStaffActionMsg('')
      }, 3000)
    } catch (error) {
      console.error('Error deleting item:', error)
      toast?.error?.(`Couldn't delete ${context}. Try again or reload the page.`)

      // On error, force refresh all data to ensure UI is in sync
      setTimeout(async () => {
        try {
          await loadAllData()
        } catch (refreshError) {
          console.error('Error refreshing all data after deletion error:', refreshError)
        }
      }, 1000)
    } finally {
      setSubmitting(false)
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading admin panel...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Panel Error</h2>
              <p className="text-gray-600 mb-6">{error}</p>

              <div className="space-y-4">
                <UIButton
                  onClick={() => window.location?.reload()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </UIButton>

                <UIButton
                  onClick={debugAuthState}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Debug Connection
                </UIButton>

                <UIButton
                  onClick={() => (window.location.href = '/authentication-portal')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Go to Login
                </UIButton>
              </div>

              {debugInfo?.showDebug && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg text-left text-sm">
                  <h3 className="font-semibold mb-2">Debug Information:</h3>
                  <div className="space-y-1 font-mono text-xs">
                    <div>Auth User: {debugInfo?.authUser?.email || 'None'}</div>
                    <div>User ID: {debugInfo?.authUser?.id || 'None'}</div>
                    <div>Profile Found: {debugInfo?.userProfile ? 'Yes' : 'No'}</div>
                    <div>User Role: {debugInfo?.userProfile?.role || 'None'}</div>
                    <div>Department: {debugInfo?.userProfile?.department || 'None'}</div>
                    {debugInfo?.profileLoadError && (
                      <div className="text-red-600 mt-2">
                        Error: {debugInfo?.profileLoadError?.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Main admin interface
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Admin Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
            <p className="text-gray-600">
              Complete administrative management for Priority Automotive Tracker
            </p>

            {/* User Status Display */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">System Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="font-medium">Auth Status:</span>
                  <span className={`ml-1 ${user ? 'text-green-600' : 'text-orange-600'}`}>
                    {user ? 'Authenticated' : 'Unauthenticated'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">User Role:</span>
                  <span className="ml-1 text-blue-600">{userProfile?.role || 'Admin'}</span>
                </div>
                <div>
                  <span className="font-medium">Access Level:</span>
                  <span className="ml-1 text-green-600">Full Access</span>
                </div>
                <div>
                  <span className="font-medium">Database:</span>
                  <span className="ml-1 text-green-600">Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Status Summary */}
          <div className="mb-8 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Data Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="font-medium">User Accounts:</span>
                <span
                  className={`ml-1 ${userAccounts?.length > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {userAccounts?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Staff Records:</span>
                <span
                  className={`ml-1 ${staffRecords?.length > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {staffRecords?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Vendors:</span>
                <span className={`ml-1 ${vendors?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {vendors?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">Products:</span>
                <span
                  className={`ml-1 ${products?.length > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {products?.length || 0} found
                </span>
              </div>
              <div>
                <span className="font-medium">SMS Templates:</span>
                <span
                  className={`ml-1 ${smsTemplates?.length > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {smsTemplates?.length || 0} found
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex overflow-x-auto border-b border-gray-200 gap-1 pb-px">
              {tabs?.map((tab) => {
                const Icon = tab?.icon
                let count = 0
                if (tab?.id === 'userAccounts') count = userAccounts?.length || 0
                if (tab?.id === 'staffRecords') count = staffRecords?.length || 0
                if (tab?.id === 'vendors') count = vendors?.length || 0
                if (tab?.id === 'products') count = products?.length || 0
                if (tab?.id === 'smsTemplates') count = smsTemplates?.length || 0
                if (tab?.id === 'qrCodes') count = null // No count for QR codes

                return (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 ${
                      activeTab === tab?.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab?.label}
                    {count !== null && (
                      <span
                        className={`ml-1 px-2 py-1 text-xs rounded-full ${
                          count > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content - RESTORED WORKING FUNCTIONALITY */}
          <div className="bg-white rounded-lg shadow p-6">
            {activeTab === 'userAccounts' && (
              <UserAccountsTab
                userAccounts={userAccounts}
                onlyMyOrg={onlyMyOrg}
                setOnlyMyOrg={setOnlyMyOrg}
                orgId={orgId}
                submitting={submitting}
                deletingId={deletingId}
                accountsQuery={accountsQuery}
                setAccountsQuery={setAccountsQuery}
                accountsDeptFilter={accountsDeptFilter}
                setAccountsDeptFilter={setAccountsDeptFilter}
                userDepartmentOptions={userDepartmentOptions}
                accountsActionMsg={accountsActionMsg}
                assignOrgToAccounts={assignOrgToAccounts}
                openModal={openModal}
                attachProfileToMyOrg={attachProfileToMyOrg}
                handleDelete={handleDelete}
              />
            )}
            {activeTab === 'staffRecords' && (
              <StaffRecordsTab
                staffRecords={staffRecords}
                onlyMyOrg={onlyMyOrg}
                setOnlyMyOrg={setOnlyMyOrg}
                orgId={orgId}
                submitting={submitting}
                deletingId={deletingId}
                staffQuery={staffQuery}
                setStaffQuery={setStaffQuery}
                staffDeptFilter={staffDeptFilter}
                setStaffDeptFilter={setStaffDeptFilter}
                staffDepartmentOptions={staffDepartmentOptions}
                staffActionMsg={staffActionMsg}
                assignOrgToActiveStaff={assignOrgToActiveStaff}
                openModal={openModal}
                attachProfileToMyOrg={attachProfileToMyOrg}
                handleDelete={handleDelete}
              />
            )}
            {activeTab === 'vendors' && (
              <VendorsTab
                vendors={vendors}
                onlyMyOrg={onlyMyOrg}
                setOnlyMyOrg={setOnlyMyOrg}
                orgId={orgId}
                submitting={submitting}
                deletingId={deletingId}
                vendorsActionMsg={vendorsActionMsg}
                assignOrgToVendors={assignOrgToVendors}
                openModal={openModal}
                handleDelete={handleDelete}
              />
            )}
            {activeTab === 'products' && (
              <ProductsTab
                products={products}
                onlyMyOrg={onlyMyOrg}
                setOnlyMyOrg={setOnlyMyOrg}
                orgId={orgId}
                submitting={submitting}
                deletingId={deletingId}
                productsActionMsg={productsActionMsg}
                assignOrgToProducts={assignOrgToProducts}
                openModal={openModal}
                handleDelete={handleDelete}
              />
            )}
            {activeTab === 'smsTemplates' && (
              <SmsTemplatesTab
                smsTemplates={smsTemplates}
                deletingId={deletingId}
                openModal={openModal}
                handleDelete={handleDelete}
              />
            )}
            {activeTab === 'qrCodes' && <QRCodeTab />}
          </div>
        </div>

        {/* Modal for Create/Edit */}
        <AdminModal
          showModal={showModal}
          modalType={modalType}
          editingItem={editingItem}
          submitting={submitting}
          submittingRef={submittingRef}
          setShowModal={setShowModal}
          handleSubmit={handleSubmit}
          submitError={submitError}
          onClearSubmitError={() => setSubmitError('')}
          userAccountForm={userAccountForm}
          setUserAccountForm={setUserAccountForm}
          roleOptions={roleOptions}
          userDepartmentOptions={userDepartmentOptions}
          staffForm={staffForm}
          setStaffForm={setStaffForm}
          staffDepartmentOptions={staffDepartmentOptions}
          vendorFormMethods={vendorFormMethods}
          organizations={organizations}
          productForm={productForm}
          setProductForm={setProductForm}
          templateForm={templateForm}
          setTemplateForm={setTemplateForm}
          templateTypeOptions={templateTypeOptions}
        />
      </div>
    </AppLayout>
  )
}

export default AdminPage
