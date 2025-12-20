import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import useTenant from '../../hooks/useTenant'
import AppLayout from '../../components/layouts/AppLayout'
import UIButton from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import QRCodeGenerator from '../../components/common/QRCodeGenerator'
import {
  Users,
  Package,
  MessageSquare,
  Building,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  QrCode,
} from 'lucide-react'
import { useLogger } from '../../hooks/useLogger'
import { clearDropdownCache } from '../../services/dropdownService'
import { vendorService } from '../../services/vendorService'
import { vendorInsertSchema } from '../../db/schemas'

const AdminPage = () => {
  const { userProfile, user, loading: authLoading } = useAuth()
  const { orgId } = useTenant()
  const { logBusinessAction, logError: logErr } = useLogger()
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

  // Loading states
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [editingItem, setEditingItem] = useState(null)

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
    { id: 'smsTemplates', label: 'SMS Templates', icon: MessageSquare },
    { id: 'qrCodes', label: 'QR Code Generator', icon: QrCode },
  ]

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
    console.log('=== ADMIN ACCESS DEBUG ===')

    try {
      // Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabase?.auth?.getSession()
      console.log('Current session:', {
        hasSession: !!session,
        sessionError,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      })

      if (session?.user) {
        console.log('Auth user:', {
          id: session?.user?.id,
          email: session?.user?.email,
          role: session?.user?.role,
        })

        // Try to fetch user profile directly with detailed error logging
        console.log('Attempting to fetch user profile...')
        const { data: profile, error: profileError } = await supabase
          ?.from('user_profiles')
          ?.select('*')
          ?.eq('id', session?.user?.id)
          ?.single()

        console.log('Direct profile fetch result:', {
          profile: profile,
          profileError: profileError,
          hasProfile: !!profile,
        })

        setDebugInfo({
          authUser: session?.user,
          userProfile: profile,
          profileLoadError: profileError,
          showDebug: true,
        })
      } else {
        console.log('No authenticated user found')
        setDebugInfo({
          authUser: null,
          userProfile: null,
          profileLoadError: { message: 'No authenticated user' },
          showDebug: true,
        })
      }

      // Test basic database access
      console.log('Testing database access...')
      const { data: testData, error: testError } = await supabase
        ?.from('user_profiles')
        ?.select('id, full_name, role')
        ?.limit(5)

      console.log('Database access test:', {
        canAccess: !testError,
        recordCount: testData?.length || 0,
        error: testError,
      })
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
      console.log('Loading user accounts...')

      let q = supabase
        ?.from('user_profiles')
        ?.select('*', { count: 'exact' })
        ?.in('role', ['admin', 'manager'])
      if (onlyMyOrg && orgId) q = q?.eq('org_id', orgId)
      q = q?.order('created_at', { ascending: false })

      const { data, error } = await q

      if (error) {
        console.error('User accounts query error:', error)
        throw error
      }

      console.log(`User accounts: ${data?.length || 0} records`)
      setUserAccounts(data || [])
    } catch (error) {
      console.error('Error loading user accounts:', error)
    }
  }, [onlyMyOrg, orgId])

  const loadStaffRecords = useCallback(async () => {
    try {
      console.log('Loading staff records...')

      let q = supabase?.from('user_profiles')?.select('*', { count: 'exact' })?.eq('role', 'staff')
      if (onlyMyOrg && orgId) q = q?.eq('org_id', orgId)
      q = q?.order('created_at', { ascending: false })

      const { data, error } = await q

      if (error) {
        console.error('Staff records query error:', error)
        throw error
      }

      console.log(`Staff records: ${data?.length || 0} staff members found`)
      setStaffRecords(data || [])
    } catch (error) {
      console.error('Error loading staff records:', error)
    }
  }, [onlyMyOrg, orgId])

  const loadOrganizations = useCallback(async () => {
    try {
      console.log('Loading organizations...')

      let q = supabase?.from('organizations')?.select('*', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q?.eq('id', orgId)
      q = q?.order('created_at', { ascending: false })

      const { data, error } = await q

      if (error) {
        console.error('Organizations query error:', error)
        throw error
      }

      console.log(`Organizations: ${data?.length || 0} records`)
      setOrganizations(data || [])
    } catch (error) {
      console.error('Error loading organizations:', error)
    }
  }, [onlyMyOrg, orgId])

  // Enhanced data loading with better error handling
  const loadAllData = useCallback(async () => {
    console.log('Loading admin data...')

    try {
      const results = await Promise.allSettled([
        loadUserAccounts(),
        loadStaffRecords(),
        loadVendors(),
        loadProducts(),
        loadSmsTemplates(),
        loadOrganizations(),
      ])

      results?.forEach((result, index) => {
        const sections = [
          'User Accounts',
          'Staff Records',
          'Vendors',
          'Products',
          'SMS Templates',
          'Organizations',
        ]
        if (result?.status === 'rejected') {
          console.error(`Failed to load ${sections?.[index]}:`, result?.reason)
        } else {
          console.log(`Successfully loaded ${sections?.[index]}`)
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
  ])

  // Initialize admin panel - check auth and load data
  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        console.log('Admin panel initializing...', {
          authLoading,
          user: !!user,
          userProfile: !!userProfile,
        })

        // First check if Supabase is available
        if (!supabase) {
          setError('Database connection unavailable. Please refresh the page.')
          setLoading(false)
          return
        }

        // Test database connection
        const { error: connectionError } = await supabase
          ?.from('user_profiles')
          ?.select('id')
          ?.limit(1)

        if (connectionError) {
          console.error('Database connection failed:', connectionError)
          setError('Unable to connect to database. Please check your Supabase configuration.')
          setLoading(false)
          return
        }

        // Load admin data regardless of auth status (for demo purposes)
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
      alert('No organization detected for current user')
      return
    }
    try {
      setSubmitting(true)
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({ org_id: orgId, is_active: true })
        ?.eq('id', profileId)
      if (error) throw error
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
      alert('Failed to attach to org: ' + (e?.message || 'Unknown error'))
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
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({ org_id: orgId, is_active: true })
        ?.is('org_id', null)
        ?.eq('role', 'staff')
      if (error) throw error
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
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({ org_id: orgId, is_active: true })
        ?.is('org_id', null)
        ?.in('role', ['admin', 'manager'])
      if (error) throw error
      setAccountsActionMsg('Assigned org to admin/manager accounts without org.')
      await loadUserAccounts()
    } catch (e) {
      console.error('assignOrgToAccounts error:', e)
      setAccountsActionMsg(e?.message || 'Failed to assign org to accounts')
    } finally {
      setSubmitting(false)
    }
  }

  const loadVendors = useCallback(async () => {
    try {
      console.log('Loading vendors...')

      let q = supabase?.from('vendors')?.select('*', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q?.eq('org_id', orgId)
      q = q?.order('created_at', { ascending: false })

      const { data, error } = await q

      if (error) {
        console.error('Vendors query error:', error)
        throw error
      }

      console.log(`Vendors query result: ${data?.length || 0} records`)
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }, [onlyMyOrg, orgId])

  const loadProducts = useCallback(async () => {
    try {
      console.log('Loading products...')

      let q = supabase?.from('products')?.select('*, vendors(name)', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q?.eq('org_id', orgId)
      q = q?.order('created_at', { ascending: false })

      const { data, error } = await q

      if (error) {
        console.error('Products query error:', error)
        throw error
      }

      console.log(`Products query result: ${data?.length || 0} records`)
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }, [onlyMyOrg, orgId])

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
      const { error } = await supabase
        ?.from('vendors')
        ?.update({ org_id: orgId })
        ?.is('org_id', null)
      if (error) throw error
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
      const { error } = await supabase
        ?.from('products')
        ?.update({ org_id: orgId })
        ?.is('org_id', null)
      if (error) throw error
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

  const loadSmsTemplates = useCallback(async () => {
    try {
      console.log('Loading SMS templates...')

      const { data, error } = await supabase
        ?.from('sms_templates')
        ?.select('*', { count: 'exact' })
        ?.order('created_at', { ascending: false })

      if (error) {
        console.error('SMS templates query error:', error)
        throw error
      }

      console.log(`SMS templates query result: ${data?.length || 0} records`)
      setSmsTemplates(data || [])
    } catch (error) {
      console.error('Error loading SMS templates:', error)
    }
  }, [])

  const openModal = (type, item = null) => {
    setModalType(type)
    setEditingItem(item)
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
              orgId: item.org_id || orgId || null,
              isActive: item.is_active !== undefined ? item.is_active : true,
            }
          : {
              name: '',
              contactPerson: '',
              phone: '',
              email: '',
              specialty: '',
              rating: '',
              orgId: orgId || null,
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
          org_id: orgId || null,
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
    setSubmitting(true)

    try {
      if (modalType === 'userAccount') {
        await handleUserAccountSubmit()
      } else if (modalType === 'staff') {
        await handleStaffSubmit()
      } else if (modalType === 'vendor') {
        // Section 20: handleVendorSubmit is react-hook-form's handleSubmit wrapper
        // Call it directly to trigger validation and submission
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
      alert('Error: ' + error?.message)
    } finally {
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
      if (orgId && editingItem?.org_id && editingItem?.org_id !== orgId) {
        const doReassign = window.confirm(
          'This user belongs to another organization. Reassign to your org and continue editing?'
        )
        if (!doReassign) {
          throw new Error('Edit cancelled. User belongs to another organization.')
        }
        const { error: reassignErr } = await supabase
          ?.from('user_profiles')
          ?.update({ org_id: orgId, is_active: true })
          ?.eq('id', editingItem?.id)
        if (reassignErr) throw reassignErr
      }
      // Update existing user
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update({
          full_name: userAccountForm?.full_name,
          email: userAccountForm?.email,
          role: userAccountForm?.role,
          department: userAccountForm?.department,
          phone: userAccountForm?.phone,
        })
        ?.eq('id', editingItem?.id)

      if (error) throw error
    } else {
      // Create new user with auth account
      if (!userAccountForm?.password) {
        throw new Error('Password is required for new users')
      }

      const { error: authError } = await supabase?.auth?.signUp({
        email: userAccountForm?.email,
        password: userAccountForm?.password,
        options: {
          data: {
            full_name: userAccountForm?.full_name,
            role: userAccountForm?.role,
            department: userAccountForm?.department,
            phone: userAccountForm?.phone,
          },
        },
      })

      if (authError) throw authError
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
      org_id: staffForm?.org_id || orgId || null,
    }

    if (editingItem) {
      // If editing a staff in another org, optionally reassign to current org before updating
      if (orgId && editingItem?.org_id && editingItem?.org_id !== orgId) {
        const doReassign = window.confirm(
          'This staff profile belongs to another organization. Reassign to your org and continue editing?'
        )
        if (!doReassign) {
          throw new Error('Edit cancelled. Staff belongs to another organization.')
        }
        const { error: reassignErr } = await supabase
          ?.from('user_profiles')
          ?.update({ org_id: orgId, is_active: true })
          ?.eq('id', editingItem?.id)
        if (reassignErr) throw reassignErr
      }
      const { error } = await supabase
        ?.from('user_profiles')
        ?.update(staffData)
        ?.eq('id', editingItem?.id)

      if (error) throw error
    } else {
      // If an email is provided, provision an auth account so the trigger creates the profile
      if (staffData.email) {
        const autoPassword = generateStrongPassword()
        const { data: authData, error: authError } = await supabase?.auth?.signUp({
          email: staffData.email,
          password: autoPassword,
          options: {
            data: {
              full_name: staffData.full_name,
              role: 'staff',
              department: staffData.department,
            },
          },
        })
        if (authError) throw authError

        // Best-effort: update org/phone on the newly created profile row
        const createdUserId = authData?.user?.id
        if (createdUserId) {
          const { error: upErr } = await supabase
            ?.from('user_profiles')
            ?.update({ org_id: staffData.org_id, phone: staffData.phone, is_active: true })
            ?.or(`id.eq.${createdUserId},auth_user_id.eq.${createdUserId}`)
          if (upErr) {
            // Non-fatal; log and continue
            console.warn('Post-signUp profile update failed:', upErr?.message)
          }
        }
      } else {
        // No email: create a directory-only staff profile (no login) — allowed by relaxed schema
        const { error } = await supabase?.from('user_profiles')?.insert([staffData])
        if (error) throw error
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
    if (editingItem) {
      await vendorService.updateVendor(editingItem?.id, formData)
    } else {
      await vendorService.createVendor(formData)
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
      org_id: productForm?.org_id || orgId || null,
    }

    if (editingItem) {
      const { error } = await supabase
        ?.from('products')
        ?.update(productData)
        ?.eq('id', editingItem?.id)

      if (error) throw error
    } else {
      const { error } = await supabase?.from('products')?.insert([productData])

      if (error) throw error
    }

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

    if (editingItem) {
      const { error } = await supabase
        ?.from('sms_templates')
        ?.update(templateData)
        ?.eq('id', editingItem?.id)

      if (error) throw error
    } else {
      const { error } = await supabase?.from('sms_templates')?.insert([templateData])

      if (error) throw error
    }

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
      console.log(`Deleting from ${table} with id: ${id}`)

      // For user_profiles, clean up foreign key dependencies
      if (table === 'user_profiles') {
        console.log('Cleaning up foreign key dependencies...')

        // Clean up foreign key references
        const cleanupPromises = [
          supabase
            ?.from('jobs')
            ?.update({
              assigned_to: null,
              created_by: null,
              delivery_coordinator_id: null,
            })
            ?.or(`assigned_to.eq.${id},created_by.eq.${id},delivery_coordinator_id.eq.${id}`),
        ]

        cleanupPromises?.push(
          supabase?.from('transactions')?.update({ processed_by: null })?.eq('processed_by', id)
        )

        cleanupPromises?.push(
          supabase?.from('vehicles')?.update({ created_by: null })?.eq('created_by', id)
        )

        cleanupPromises?.push(
          supabase?.from('vendors')?.update({ created_by: null })?.eq('created_by', id)
        )

        cleanupPromises?.push(
          supabase?.from('products')?.update({ created_by: null })?.eq('created_by', id)
        )

        cleanupPromises?.push(
          supabase?.from('sms_templates')?.update({ created_by: null })?.eq('created_by', id)
        )

        // Clean up dependent records
        cleanupPromises?.push(supabase?.from('filter_presets')?.delete()?.eq('user_id', id))

        cleanupPromises?.push(
          supabase?.from('notification_preferences')?.delete()?.eq('user_id', id)
        )

        cleanupPromises?.push(supabase?.from('activity_history')?.delete()?.eq('performed_by', id))

        cleanupPromises?.push(supabase?.from('communications')?.delete()?.eq('sent_by', id))

        // Wait for all cleanup operations
        await Promise.allSettled(cleanupPromises)
        console.log('Foreign key cleanup completed')
      }

      // Perform the actual deletion
      const { error: deleteError } = await supabase?.from(table)?.delete()?.eq('id', id)

      if (deleteError) {
        console.error('Delete operation failed:', deleteError)
        throw deleteError
      }

      console.log('Delete operation successful')

      // Immediately update state to remove the deleted item - this is the critical fix
      if (table === 'user_profiles') {
        if (itemType === 'userAccount') {
          setUserAccounts((prev) => {
            const filtered = prev?.filter((item) => item?.id !== id)
            console.log(`User accounts updated: ${filtered?.length} remaining`)
            return filtered || []
          })
          setAccountsActionMsg('User account deleted.')
        } else {
          setStaffRecords((prev) => {
            const filtered = prev?.filter((item) => item?.id !== id)
            console.log(`Staff records updated: ${filtered?.length} remaining`)
            return filtered || []
          })
          setStaffActionMsg('Staff profile deleted.')
        }

        // Force a complete refresh after successful deletion with proper delay
        setTimeout(async () => {
          try {
            await Promise.all([loadUserAccounts(), loadStaffRecords()])
            console.log('Data reloaded successfully after deletion')
          } catch (refreshError) {
            console.error('Error refreshing data after deletion:', refreshError)
          }
        }, 500)
      } else if (table === 'vendors') {
        setVendors((prev) => {
          const filtered = prev?.filter((item) => item?.id !== id)
          console.log(`Vendors updated: ${filtered?.length} remaining`)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadVendors()
            console.log('Vendors reloaded successfully')
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
          console.log(`Products updated: ${filtered?.length} remaining`)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadProducts()
            console.log('Products reloaded successfully')
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
          console.log(`SMS templates updated: ${filtered?.length} remaining`)
          return filtered || []
        })
        setTimeout(async () => {
          try {
            await loadSmsTemplates()
            console.log('SMS templates reloaded successfully')
          } catch (refreshError) {
            console.error('Error refreshing SMS templates:', refreshError)
          }
        }, 500)
      }

      // Show success message
      console.log(`Successfully deleted item from ${table}`)
      // Auto clear messages after a short while
      setTimeout(() => {
        setAccountsActionMsg('')
        setStaffActionMsg('')
      }, 3000)
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Error deleting item: ' + (error?.message || 'Unknown error'))

      // On error, force refresh all data to ensure UI is in sync
      setTimeout(async () => {
        try {
          await loadAllData()
          console.log('All data reloaded after error')
        } catch (refreshError) {
          console.error('Error refreshing all data after deletion error:', refreshError)
        }
      }, 1000)
    } finally {
      setSubmitting(false)
      setDeletingId(null)
    }
  }

  // Render functions for each tab
  const renderUserAccountsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">User Accounts ({userAccounts.length})</h3>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600 appearance-auto"
              checked={onlyMyOrg}
              onChange={(e) => setOnlyMyOrg(e.target.checked)}
            />
            <span className="text-sm">Only my org</span>
          </label>
          <UIButton
            onClick={assignOrgToAccounts}
            disabled={!orgId || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Building className="w-4 h-4" />
            Assign Org to Accounts
          </UIButton>
          <UIButton
            onClick={() => openModal('userAccount')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User Account
          </UIButton>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-600">
        Tip: You can edit any account. If it belongs to another org, you’ll be prompted to reassign
        it to your org on save. Or click the building icon to attach immediately.
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          value={accountsQuery}
          onChange={(e) => setAccountsQuery(e.target.value)}
          placeholder="Search by name or email"
          className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-sm"
        />
        <select
          value={accountsDeptFilter}
          onChange={(e) => setAccountsDeptFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-xs"
        >
          <option value="">All departments</option>
          {userDepartmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Org
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(userAccounts || [])
              .filter((a) => {
                const q = accountsQuery.trim().toLowerCase()
                if (!q) return true
                return (
                  String(a?.full_name || '')
                    .toLowerCase()
                    .includes(q) ||
                  String(a?.email || '')
                    .toLowerCase()
                    .includes(q)
                )
              })
              .filter((a) => {
                if (!accountsDeptFilter) return true
                return String(a?.department || '') === accountsDeptFilter
              })
              .map((account) => (
                <tr key={account?.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account?.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account?.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account?.role === 'admin'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {account?.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account?.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>{account?.org_id ? String(account?.org_id).slice(0, 8) : '—'}</span>
                      {orgId && account?.org_id && account?.org_id !== orgId ? (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                          Other org
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account?.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {account?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal('userAccount', account)}
                        className="text-blue-600 hover:text-blue-900"
                        title={
                          orgId && account?.org_id && account?.org_id !== orgId
                            ? 'Edit user (will prompt to reassign to your org on save)'
                            : 'Edit user'
                        }
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {orgId && account?.org_id && account?.org_id !== orgId && (
                        <button
                          title="Attach to my org"
                          onClick={() => attachProfileToMyOrg(account?.id)}
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          disabled={submitting}
                        >
                          <Building className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete('user_profiles', account?.id, 'userAccount')}
                        disabled={deletingId === account?.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {userAccounts?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No user accounts found. Click "Add User Account" to create one.
        </div>
      )}
      {accountsActionMsg ? (
        <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{accountsActionMsg}</div>
      ) : null}
    </div>
  )

  const renderStaffRecordsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Staff Records ({staffRecords.length})</h3>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600 appearance-auto"
              checked={onlyMyOrg}
              onChange={(e) => setOnlyMyOrg(e.target.checked)}
            />
            <span className="text-sm">Only my org</span>
          </label>
          <UIButton
            onClick={assignOrgToActiveStaff}
            disabled={!orgId || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Building className="w-4 h-4" />
            Assign Org to Staff
          </UIButton>
          <UIButton
            onClick={() => openModal('staff')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </UIButton>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-600">
        Tip: You can edit any staff profile. If it belongs to another org, you’ll be prompted to
        reassign it to your org on save. Or click the building icon to attach immediately.
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          value={staffQuery}
          onChange={(e) => setStaffQuery(e.target.value)}
          placeholder="Search by name, phone or email"
          className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-sm"
        />
        <select
          value={staffDeptFilter}
          onChange={(e) => setStaffDeptFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md w-full md:max-w-xs"
        >
          <option value="">All departments</option>
          {staffDepartmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Org
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(staffRecords || [])
              .filter((s) => {
                const q = staffQuery.trim().toLowerCase()
                if (!q) return true
                return (
                  String(s?.full_name || '')
                    .toLowerCase()
                    .includes(q) ||
                  String(s?.phone || '')
                    .toLowerCase()
                    .includes(q) ||
                  String(s?.email || '')
                    .toLowerCase()
                    .includes(q)
                )
              })
              .filter((s) => {
                if (!staffDeptFilter) return true
                return String(s?.department || '') === staffDeptFilter
              })
              .map((staff) => (
                <tr key={staff?.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {staff?.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff?.department === 'Sales Consultants'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {staff?.department}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {staff?.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {staff?.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>{staff?.org_id ? String(staff?.org_id).slice(0, 8) : '—'}</span>
                      {orgId && staff?.org_id && staff?.org_id !== orgId ? (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                          Other org
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {staff?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal('staff', staff)}
                        className="text-blue-600 hover:text-blue-900"
                        title={
                          orgId && staff?.org_id && staff?.org_id !== orgId
                            ? 'Edit staff (will prompt to reassign to your org on save)'
                            : 'Edit staff'
                        }
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {orgId && staff?.org_id && staff?.org_id !== orgId && (
                        <button
                          title="Attach to my org"
                          onClick={() => attachProfileToMyOrg(staff?.id)}
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          disabled={submitting}
                        >
                          <Building className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete('user_profiles', staff?.id, 'staff')}
                        disabled={deletingId === staff?.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {staffRecords?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No staff records found. Click "Add Staff Member" to create one.
        </div>
      )}
      {staffActionMsg ? (
        <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{staffActionMsg}</div>
      ) : null}
    </div>
  )

  const renderVendorsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Vendors ({vendors.length})</h3>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600 appearance-auto"
              checked={onlyMyOrg}
              onChange={(e) => setOnlyMyOrg(e.target.checked)}
            />
            <span className="text-sm">Only my org</span>
          </label>
          <UIButton
            onClick={assignOrgToVendors}
            disabled={!orgId || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Building className="w-4 h-4" />
            Assign Org to Vendors
          </UIButton>
          <UIButton
            onClick={() => openModal('vendor')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </UIButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Person
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Specialty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors?.map((vendor) => (
              <tr key={vendor?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {vendor?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.contact_person || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.phone || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.specialty || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor?.rating ? `${vendor?.rating}/5` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      vendor?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vendor?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('vendor', vendor)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('vendors', vendor?.id)}
                      disabled={deletingId === vendor?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vendors?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No vendors found. Click "Add Vendor" to create one.
        </div>
      )}
      {vendorsActionMsg ? (
        <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{vendorsActionMsg}</div>
      ) : null}
    </div>
  )

  const renderProductsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Aftermarket Products ({products.length})</h3>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600 appearance-auto"
              checked={onlyMyOrg}
              onChange={(e) => setOnlyMyOrg(e.target.checked)}
            />
            <span className="text-sm">Only my org</span>
          </label>
          <UIButton
            onClick={assignOrgToProducts}
            disabled={!orgId || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Building className="w-4 h-4" />
            Assign Org to Products
          </UIButton>
          <UIButton
            onClick={() => openModal('product')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </UIButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Op Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products?.map((product) => (
              <tr key={product?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product?.brand || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product?.category || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                    {product?.op_code || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${product?.cost || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${product?.unit_price || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('product', product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('products', product?.id)}
                      disabled={deletingId === product?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No products found. Click "Add Product" to create one.
        </div>
      )}
      {productsActionMsg ? (
        <div className="mt-3 p-3 rounded bg-blue-50 text-blue-700">{productsActionMsg}</div>
      ) : null}
    </div>
  )

  const renderSmsTemplatesTab = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">SMS Templates ({smsTemplates?.length || 0})</h3>
        <UIButton
          onClick={() => openModal('template')}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </UIButton>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message Preview
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {smsTemplates?.map((template) => (
              <tr key={template?.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {template?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {template?.template_type?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {template?.message_template}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      template?.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {template?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal('template', template)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('sms_templates', template?.id)}
                      disabled={deletingId === template?.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {smsTemplates?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No SMS templates found. Click "Add Template" to create one.
        </div>
      )}
    </div>
  )

  // New QR Code Generator Tab
  const renderQRCodeTab = () => {
    const guestClaimsUrl = `${window?.location?.origin}/guest-claims-submission-form`

    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold mb-2">QR Code Generator</h3>
          <p className="text-gray-600">
            Generate QR codes for easy access to your guest claims form and other important links.
          </p>
        </div>

        {/* Guest Claims Form QR Code */}
        <div>
          <QRCodeGenerator
            url={guestClaimsUrl}
            title="Guest Claims Submission Form"
            description="Generate a QR code for customers to quickly access your guest claims form. Perfect for printing on business cards, flyers, or displaying in your shop."
            size={250}
            showControls={true}
          />
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">How to Use QR Codes:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h5 className="font-medium mb-2">📱 For Customers:</h5>
              <ul className="space-y-1">
                <li>• Open camera app on smartphone</li>
                <li>• Point camera at QR code</li>
                <li>• Tap notification to open claims form</li>
                <li>• No app download required</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">🖨️ For Your Business:</h5>
              <ul className="space-y-1">
                <li>• Download and print QR codes</li>
                <li>• Add to business cards</li>
                <li>• Display in waiting areas</li>
                <li>• Include in email signatures</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-3">QR Code Benefits:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-green-600">95%</div>
              <div className="text-gray-600">Smartphone QR Support</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-blue-600">3x</div>
              <div className="text-gray-600">Faster Than Typing URLs</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-purple-600">100%</div>
              <div className="text-gray-600">Contactless Access</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Modal rendering function
  const renderModal = () => {
    if (!showModal) return null

    const getModalTitle = () => {
      switch (modalType) {
        case 'userAccount':
          return editingItem ? 'Edit User Account' : 'Add User Account'
        case 'staff':
          return editingItem ? 'Edit Staff Member' : 'Add Staff Member'
        case 'vendor':
          return editingItem ? 'Edit Vendor' : 'Add Vendor'
        case 'product':
          return editingItem ? 'Edit Product' : 'Add Product'
        case 'template':
          return editingItem ? 'Edit SMS Template' : 'Add SMS Template'
        default:
          return 'Form'
      }
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modalType === 'userAccount' && (
              <>
                <Input
                  label="Full Name"
                  value={userAccountForm?.full_name}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, full_name: e?.target?.value })
                  }
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={userAccountForm?.email}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, email: e?.target?.value })
                  }
                  required
                />
                {!editingItem && (
                  <Input
                    label="Password"
                    type="password"
                    value={userAccountForm?.password}
                    onChange={(e) =>
                      setUserAccountForm({ ...userAccountForm, password: e?.target?.value })
                    }
                    required
                  />
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={userAccountForm?.role}
                    onChange={(e) =>
                      setUserAccountForm({ ...userAccountForm, role: e?.target?.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {roleOptions?.map((option) => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={userAccountForm?.department}
                    onChange={(e) =>
                      setUserAccountForm({ ...userAccountForm, department: e?.target?.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Department</option>
                    {userDepartmentOptions?.map((option) => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Phone"
                  value={userAccountForm?.phone}
                  onChange={(e) =>
                    setUserAccountForm({ ...userAccountForm, phone: e?.target?.value })
                  }
                />
              </>
            )}

            {modalType === 'staff' && (
              <>
                <Input
                  label="Full Name"
                  value={staffForm?.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e?.target?.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={staffForm?.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e?.target?.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Department</option>
                    {staffDepartmentOptions?.map((option) => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Phone"
                  value={staffForm?.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e?.target?.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={staffForm?.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e?.target?.value })}
                />
              </>
            )}

            {modalType === 'vendor' && (
              <>
                <Input label="Vendor Name" {...vendorFormMethods.register('name')} required />
                {vendorFormMethods.formState.errors?.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.name.message}
                  </p>
                )}
                <Input label="Contact Person" {...vendorFormMethods.register('contactPerson')} />
                {vendorFormMethods.formState.errors?.contactPerson && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.contactPerson.message}
                  </p>
                )}
                <Input label="Phone" {...vendorFormMethods.register('phone')} />
                {vendorFormMethods.formState.errors?.phone && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.phone.message}
                  </p>
                )}
                <Input label="Email" type="email" {...vendorFormMethods.register('email')} />
                {vendorFormMethods.formState.errors?.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.email.message}
                  </p>
                )}
                <Input label="Specialty" {...vendorFormMethods.register('specialty')} />
                {vendorFormMethods.formState.errors?.specialty && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.specialty.message}
                  </p>
                )}
                <Input
                  label="Rating (0-5)"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  {...vendorFormMethods.register('rating')}
                />
                {vendorFormMethods.formState.errors?.rating && (
                  <p className="mt-1 text-sm text-red-600">
                    {vendorFormMethods.formState.errors.rating.message}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <select
                    {...vendorFormMethods.register('orgId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Unassigned</option>
                    {(organizations || []).map((org) => (
                      <option key={org?.id} value={org?.id}>
                        {org?.name}
                      </option>
                    ))}
                  </select>
                  {vendorFormMethods.formState.errors?.orgId && (
                    <p className="mt-1 text-sm text-red-600">
                      {vendorFormMethods.formState.errors.orgId.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...vendorFormMethods.register('isActive')}
                    className="rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Active Vendor</label>
                  {vendorFormMethods.formState.errors?.isActive && (
                    <p className="ml-2 text-sm text-red-600">
                      {vendorFormMethods.formState.errors.isActive.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {modalType === 'product' && (
              <>
                <Input
                  label="Product Name"
                  value={productForm?.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e?.target?.value })}
                  required
                />
                <Input
                  label="Brand"
                  value={productForm?.brand}
                  onChange={(e) => setProductForm({ ...productForm, brand: e?.target?.value })}
                />
                <Input
                  label="Category"
                  value={productForm?.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e?.target?.value })}
                />
                <Input
                  label="Op Code"
                  value={productForm?.op_code}
                  onChange={(e) => setProductForm({ ...productForm, op_code: e?.target?.value })}
                  placeholder="e.g., EN3, EN5"
                />
                <Input
                  label="Cost"
                  type="number"
                  step="0.01"
                  value={productForm?.cost}
                  onChange={(e) => setProductForm({ ...productForm, cost: e?.target?.value })}
                  required
                />
                <Input
                  label="Unit Price"
                  type="number"
                  step="0.01"
                  value={productForm?.unit_price}
                  onChange={(e) => setProductForm({ ...productForm, unit_price: e?.target?.value })}
                  required
                />
                <Input
                  label="Part Number"
                  value={productForm?.part_number}
                  onChange={(e) =>
                    setProductForm({ ...productForm, part_number: e?.target?.value })
                  }
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={productForm?.description}
                    onChange={(e) =>
                      setProductForm({ ...productForm, description: e?.target?.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={productForm?.org_id || ''}
                    onChange={(e) =>
                      setProductForm({ ...productForm, org_id: e?.target?.value || null })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Unassigned</option>
                    {(organizations || []).map((org) => (
                      <option key={org?.id} value={org?.id}>
                        {org?.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {modalType === 'template' && (
              <>
                <Input
                  label="Template Name"
                  value={templateForm?.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e?.target?.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Type
                  </label>
                  <select
                    value={templateForm?.template_type}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, template_type: e?.target?.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    {templateTypeOptions?.map((option) => (
                      <option key={option?.value} value={option?.value}>
                        {option?.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message Template ({templateForm?.message_template?.length || 0}/160)
                  </label>
                  <textarea
                    value={templateForm?.message_template}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, message_template: e?.target?.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="4"
                    maxLength="160"
                    placeholder="Use {{stock_number}}, {{vehicle_info}}, {{status}} as variables"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <UIButton
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </UIButton>
              <UIButton
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
              </UIButton>
            </div>
          </form>
        </div>
      </div>
    )
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
                    {user ? 'Authenticated' : 'Demo Mode'}
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
            <nav className="flex space-x-8 border-b border-gray-200">
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
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
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
            {activeTab === 'userAccounts' && renderUserAccountsTab()}
            {activeTab === 'staffRecords' && renderStaffRecordsTab()}
            {activeTab === 'vendors' && renderVendorsTab()}
            {activeTab === 'products' && renderProductsTab()}
            {activeTab === 'smsTemplates' && renderSmsTemplatesTab()}
            {activeTab === 'qrCodes' && renderQRCodeTab()}
          </div>
        </div>

        {/* Modal for Create/Edit */}
        {renderModal()}
      </div>
    </AppLayout>
  )
}

export default AdminPage
