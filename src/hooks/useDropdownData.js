import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import useTenant from './useTenant'
import { listVendorsByOrg } from '../services/vendorService'
import { listProductsByOrg } from '../services/productService'
import { listStaffByOrg } from '../services/staffService'
import { listSmsTemplatesByOrg } from '../services/smsTemplateService'
import {
  getDeliveryCoordinators,
  getSalesConsultants,
  getFinanceManagers,
  getUserProfiles,
  getVendors,
  getProducts,
  globalSearch,
} from '../services/dropdownService'

export function useDropdownData(options = {}) {
  const {
    loadOnMount = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes default
  } = options

  const [state, setState] = useState({
    dc: [],
    sales: [],
    finance: [],
    users: [],
    vendors: [],
    products: [],
    smsTemplates: [],
    loading: true,
    error: null,
    searchResults: null,
  })

  const [lastUpdate, setLastUpdate] = useState(null)

  const tenant = useTenant()
  const auth = useAuth()

  // Enhanced load data with tenant-aware services and better error handling
  const loadData = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      // If tenant is still loading, defer without throwing to avoid noisy error banners
      if (tenant.loading) {
        setState((prev) => ({ ...prev, loading: true }))
        return
      }

      // If no user session, prefer global safe fallbacks
      if (!tenant.session?.user) {
        console.warn('Dropdowns: no authenticated user; some queries may return empty due to RLS')
        setState((prev) => ({ ...prev, loading: false }))
        return
      }

      // If org is not present, fallback to global dropdownService calls
      const useTenantLists = Boolean(tenant.orgId)

      const promises = [
        getDeliveryCoordinators()?.catch((err) => {
          console.error('[dropdowns:dc] Delivery coordinators failed:', err)
          return []
        }),
        getSalesConsultants()?.catch((err) => {
          console.error('[dropdowns:sales] Sales consultants failed:', err)
          return []
        }),
        getFinanceManagers()?.catch((err) => {
          console.error('[dropdowns:finance] Finance managers failed:', err)
          return []
        }),
        useTenantLists
          ? listStaffByOrg(tenant.orgId).catch((err) => {
              console.error('[dropdowns:users] tenant staff failed:', err)
              return []
            })
          : getUserProfiles({ activeOnly: true }).catch((err) => {
              console.error('[dropdowns:users] global user profiles failed:', err)
              return []
            }),
        useTenantLists
          ? listVendorsByOrg(tenant.orgId).catch((err) => {
              console.error('[dropdowns:vendors] tenant vendors failed:', err)
              return []
            })
          : getVendors({ activeOnly: true }).catch((err) => {
              console.error('[dropdowns:vendors] global vendors failed:', err)
              return []
            }),
        useTenantLists
          ? listProductsByOrg(tenant.orgId).catch((err) => {
              console.error('[dropdowns:products] tenant products failed:', err)
              return []
            })
          : getProducts({ activeOnly: true }).catch((err) => {
              console.error('[dropdowns:products] global products failed:', err)
              return []
            }),
        useTenantLists
          ? listSmsTemplatesByOrg(tenant.orgId).catch((err) => {
              console.error('[dropdowns:smsTemplates] tenant SMS templates failed:', err)
              return []
            })
          : Promise.resolve([]),
      ]

      const [dc, sales, finance, users, vendors, products, smsTemplates] =
        await Promise.all(promises)

      setState({
        dc,
        sales,
        finance,
        users,
        vendors,
        products,
        smsTemplates,
        loading: false,
        error: null,
        searchResults: null,
      })
      setLastUpdate(Date.now())
    } catch (err) {
      setState({
        dc: [],
        sales: [],
        finance: [],
        users: [],
        vendors: [],
        products: [],
        smsTemplates: [],
        loading: false,
        error: err?.message || 'Failed to load dropdown data',
        searchResults: null,
      })
      console.error('[dropdowns] Dropdown data load failed:', err)
    }
  }

  // Check if cache is still valid
  const isCacheValid = () => {
    if (!lastUpdate) return false
    return Date.now() - lastUpdate < cacheTime
  }

  // Refresh data if cache is invalid
  const refreshIfNeeded = async () => {
    if (!isCacheValid()) {
      await loadData()
    }
  }

  // Enhanced search functionality with error handling
  const performGlobalSearch = async (searchTerm) => {
    try {
      if (!searchTerm?.trim()) {
        setState((prev) => ({ ...prev, searchResults: null }))
        return
      }

      const results = await globalSearch(searchTerm)
      setState((prev) => ({ ...prev, searchResults: results }))
    } catch (err) {
      console.error('[dropdowns:search] Search failed:', err)
      setState((prev) => ({ ...prev, searchResults: { users: [], vendors: [] } }))
    }
  }

  // Clear search results
  const clearSearch = () => {
    setState((prev) => ({ ...prev, searchResults: null }))
  }

  // Get user options with filtering
  const getUserOptions = (filterOptions = {}) => {
    const { roles = [], departments = [], activeOnly = true } = filterOptions

    let filteredUsers = state?.users || []

    if (activeOnly) {
      filteredUsers = filteredUsers?.filter((user) => user?.is_active)
    }

    if (roles?.length > 0) {
      filteredUsers = filteredUsers?.filter((user) => roles?.includes(user?.role))
    }

    if (departments?.length > 0) {
      filteredUsers = filteredUsers?.filter((user) => departments?.includes(user?.department))
    }

    return (
      filteredUsers?.map((user) => ({
        id: user?.id,
        value: user?.id,
        label: user?.full_name,
        name: user?.full_name,
        role: user?.role,
        department: user?.department,
        email: user?.email,
      })) || []
    )
  }

  // Get vendor options with filtering
  const getVendorOptions = (filterOptions = {}) => {
    const { activeOnly = true, specialty = null } = filterOptions

    let filteredVendors = state?.vendors || []

    if (activeOnly) {
      filteredVendors = filteredVendors?.filter((vendor) => vendor?.is_active)
    }

    if (specialty) {
      filteredVendors = filteredVendors?.filter((vendor) =>
        vendor?.specialty?.toLowerCase()?.includes(specialty?.toLowerCase())
      )
    }

    return (
      filteredVendors?.map((vendor) => ({
        id: vendor?.id,
        value: vendor?.value || vendor?.id,
        label: vendor?.label || vendor?.name,
        name: vendor?.name,
        specialty: vendor?.specialty,
        email: vendor?.email,
        phone: vendor?.phone,
      })) || []
    )
  }

  // Load data on mount if requested
  useEffect(() => {
    let mounted = true

    ;(async () => {
      if (!loadOnMount) return

      // wait until auth.loading === false (or timeout after a few tries)
      const start = Date.now()
      while (mounted && auth?.loading && Date.now() - start < 5000) {
        // small sleep
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 200))
      }

      if (!mounted) return
      if (!auth?.user) {
        console.warn(
          'Dropdowns: no authenticated user; dropdown queries will likely return empty due to RLS'
        )
      } else {
        console.log('Dropdowns: authenticated user', auth?.user?.id)
        if (auth?.userProfile) console.log('Dropdowns: user profile org', auth.userProfile)
      }

      if (mounted) await loadData()
    })()

    return () => {
      mounted = false
    }
  }, [loadOnMount, auth?.loading, auth?.user?.id, tenant?.loading, tenant?.orgId])

  return {
    // Original data arrays
    dc: state?.dc,
    sales: state?.sales,
    finance: state?.finance,
    users: state?.users,
    vendors: state?.vendors,
    products: state?.products,
    smsTemplates: state?.smsTemplates,

    // Loading state
    loading: state?.loading,
    error: state?.error,

    // Search functionality
    searchResults: state?.searchResults,
    globalSearch: performGlobalSearch,
    clearSearch,

    // Enhanced options methods expected by deals page
    getUserOptions,
    getVendorOptions,

    // Actions
    refresh: loadData,
    refreshIfNeeded,

    // Cache info
    lastUpdate,
    isCacheValid: isCacheValid(),

    // Formatted options for backward compatibility
    salesConsultantOptions: (state?.sales || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),

    deliveryCoordinatorOptions: (state?.dc || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),

    financeManagerOptions: (state?.finance || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),
  }
}

// Enhanced deal form dropdowns hook with Finance Managers
export const useDealFormDropdowns = () => {
  const {
    dc: deliveryCoordinators,
    sales: salesConsultants,
    finance: financeManagers,
    vendors,
    products,
    loading,
    error,
    refresh,
  } = useDropdownData({ loadOnMount: true })

  return {
    // Deal-specific data with Finance Managers and additional data
    salesConsultants,
    deliveryCoordinators,
    financeManagers,
    vendors,
    products,

    // Loading state
    loading,
    error,

    // Actions
    refresh,

    // Formatted options for dropdowns
    salesConsultantOptions: (salesConsultants || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),

    deliveryCoordinatorOptions: (deliveryCoordinators || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),

    financeManagerOptions: (financeManagers || [])?.map((item) => ({
      id: item?.id,
      value: item?.id,
      label: item?.full_name,
      name: item?.full_name,
    })),

    vendorOptions: vendors || [],
    productOptions: products || [],
  }
}

export default useDropdownData
