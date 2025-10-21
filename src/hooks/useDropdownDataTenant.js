// src/hooks/useDropdownDataTenant.js
import { useEffect, useState } from 'react'
import {
  getDeliveryCoordinators,
  getSalesConsultants,
  getFinanceManagers,
  getUserProfiles,
  getVendors,
  getProducts,
  globalSearch,
} from '../services/dropdownService'
import useTenant from './useTenant'
import { listVendorsByOrg, listProductsByOrg, listStaffByOrg } from '../services/tenantService'

export function useDropdownDataTenant(options = {}) {
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
    loading: true,
    error: null,
    searchResults: null,
  })

  const [lastUpdate, setLastUpdate] = useState(null)
  const { orgId } = useTenant()

  const loadData = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const promises = [
        (async () => {
          try {
            return await getDeliveryCoordinators()
          } catch (e) {
            console.error('Delivery coordinators failed:', e)
            return []
          }
        })(),
        (async () => {
          try {
            return await getSalesConsultants()
          } catch (e) {
            console.error('Sales consultants failed:', e)
            return []
          }
        })(),
        (async () => {
          try {
            return await getFinanceManagers()
          } catch (e) {
            console.error('Finance managers failed:', e)
            return []
          }
        })(),
        (async () => {
          try {
            if (orgId) return await listStaffByOrg(orgId, { activeOnly: true })
            return await getUserProfiles({ activeOnly: true })
          } catch (e) {
            console.error('User profiles failed:', e)
            return []
          }
        })(),
        (async () => {
          try {
            if (orgId) return await listVendorsByOrg(orgId, { activeOnly: true })
            return await getVendors({ activeOnly: true })
          } catch (e) {
            console.error('Vendors failed:', e)
            return []
          }
        })(),
        (async () => {
          try {
            if (orgId) return await listProductsByOrg(orgId, { activeOnly: true })
            return await getProducts({ activeOnly: true })
          } catch (e) {
            console.error('Products failed:', e)
            return []
          }
        })(),
      ]

      const [dc, sales, finance, users, vendors, products] = await Promise.all(promises)

      setState({
        dc,
        sales,
        finance,
        users,
        vendors,
        products,
        loading: false,
        error: null,
        searchResults: null,
      })
      setLastUpdate(Date.now())
    } catch (err) {
      setState(() => ({
        dc: [],
        sales: [],
        finance: [],
        users: [],
        vendors: [],
        products: [],
        loading: false,
        error: err?.message || 'Failed to load dropdown data',
        searchResults: null,
      }))
      console.error('Dropdown data load failed:', err)
    }
  }

  const isCacheValid = () => {
    if (!lastUpdate) return false
    return Date.now() - lastUpdate < cacheTime
  }

  const refreshIfNeeded = async () => {
    if (!isCacheValid()) await loadData()
  }

  const performGlobalSearch = async (searchTerm) => {
    try {
      if (!searchTerm?.trim()) {
        setState((prev) => ({ ...prev, searchResults: null }))
        return
      }
      const results = await globalSearch(searchTerm)
      setState((prev) => ({ ...prev, searchResults: results }))
    } catch (err) {
      console.error('Search failed:', err)
      setState((prev) => ({ ...prev, searchResults: { users: [], vendors: [] } }))
    }
  }

  const clearSearch = () => setState((prev) => ({ ...prev, searchResults: null }))

  const getUserOptions = (filterOptions = {}) => {
    const { roles = [], departments = [], activeOnly = true } = filterOptions
    let filteredUsers = state?.users || []
    if (activeOnly) filteredUsers = filteredUsers?.filter((u) => u?.is_active)
    if (roles?.length) filteredUsers = filteredUsers?.filter((u) => roles.includes(u?.role))
    if (departments?.length)
      filteredUsers = filteredUsers?.filter((u) => departments.includes(u?.department))
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

  const getVendorOptions = (filterOptions = {}) => {
    const { activeOnly = true, specialty = null } = filterOptions
    let filteredVendors = state?.vendors || []
    if (activeOnly) filteredVendors = filteredVendors?.filter((v) => v?.is_active)
    if (specialty)
      filteredVendors = filteredVendors?.filter((v) =>
        v?.specialty?.toLowerCase()?.includes(specialty?.toLowerCase())
      )
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

  useEffect(() => {
    if (loadOnMount) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOnMount, orgId])

  return {
    dc: state?.dc,
    sales: state?.sales,
    finance: state?.finance,
    users: state?.users,
    vendors: state?.vendors,
    products: state?.products,
    loading: state?.loading,
    error: state?.error,
    searchResults: state?.searchResults,
    globalSearch: performGlobalSearch,
    clearSearch,
    getUserOptions,
    getVendorOptions,
    refresh: loadData,
    refreshIfNeeded,
    lastUpdate,
    isCacheValid: isCacheValid(),
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
    vendorOptions: state?.vendors || [],
    productOptions: state?.products || [],
  }
}

export default useDropdownDataTenant
