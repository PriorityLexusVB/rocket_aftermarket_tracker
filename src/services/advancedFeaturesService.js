import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCapabilities } from '@/services/dealService'

// Utility functions for safe data handling
const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

const safeString = (value, defaultValue = '') => {
  return value === null || value === undefined ? defaultValue : String(value)
}

// Enhanced service with all advanced features
export const advancedFeaturesService = {
  // Overdue Jobs Service
  async getOverdueJobs() {
    try {
      const { data, error } = await supabase?.rpc('get_overdue_jobs_enhanced')

      if (error) {
        console.error('Error fetching overdue jobs:', error)
        return { data: [], error: { message: error?.message } }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in getOverdueJobs service:', error)
      return { data: [], error: { message: 'Failed to fetch overdue jobs' } }
    }
  },

  // SMS Template Service
  async getSmsTemplates() {
    try {
      const { data, error } = await supabase
        ?.from('sms_templates')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: { message: error?.message } }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching SMS templates:', error)
      return { data: [], error: { message: 'Failed to fetch SMS templates' } }
    }
  },

  async createSmsTemplate(template) {
    try {
      const currentUser = await supabase?.auth?.getUser()
      const { data, error } = await supabase
        ?.from('sms_templates')
        ?.insert([
          {
            ...template,
            created_by: currentUser?.data?.user?.id,
          },
        ])
        ?.select()
        ?.single()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error creating SMS template:', error)
      return { data: null, error: { message: 'Failed to create SMS template' } }
    }
  },

  async updateSmsTemplate(id, updates) {
    try {
      const { data, error } = await supabase
        ?.from('sms_templates')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', id)
        ?.select()
        ?.single()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error updating SMS template:', error)
      return { data: null, error: { message: 'Failed to update SMS template' } }
    }
  },

  async deleteSmsTemplate(id) {
    try {
      const { error } = await supabase?.from('sms_templates')?.delete()?.eq('id', id)

      if (error) {
        return { error: { message: error?.message } }
      }

      return { error: null }
    } catch (error) {
      console.error('Error deleting SMS template:', error)
      return { error: { message: 'Failed to delete SMS template' } }
    }
  },

  // Filter Presets Service
  async getFilterPresets(pageType) {
    try {
      const currentUser = await supabase?.auth?.getUser()
      const { data, error } = await supabase
        ?.from('filter_presets')
        ?.select('*')
        ?.eq('page_type', pageType)
        ?.or(`user_id.eq.${currentUser?.data?.user?.id},is_public.eq.true`)
        ?.order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: { message: error?.message } }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching filter presets:', error)
      return { data: [], error: { message: 'Failed to fetch filter presets' } }
    }
  },

  async saveFilterPreset(pageType, name, filters, isPublic = false) {
    try {
      const currentUser = await supabase?.auth?.getUser()
      const { data, error } = await supabase
        ?.from('filter_presets')
        ?.insert([
          {
            user_id: currentUser?.data?.user?.id,
            page_type: pageType,
            name,
            filters,
            is_public: isPublic,
          },
        ])
        ?.select()
        ?.single()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error saving filter preset:', error)
      return { data: null, error: { message: 'Failed to save filter preset' } }
    }
  },

  async deleteFilterPreset(id) {
    try {
      const { error } = await supabase?.from('filter_presets')?.delete()?.eq('id', id)

      if (error) {
        return { error: { message: error?.message } }
      }

      return { error: null }
    } catch (error) {
      console.error('Error deleting filter preset:', error)
      return { error: { message: 'Failed to delete filter preset' } }
    }
  },

  // Export Service
  async exportData(exportType, filters = {}, userRole = 'staff') {
    try {
      const { data, error } = await supabase?.rpc('generate_export_data', {
        export_type: exportType,
        filters,
        user_role: userRole,
      })

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      // Clean and validate export data to prevent NaN/undefined values
      const cleanedData = (data || [])?.map((item) => {
        const exportData = item?.export_data || item
        const cleanedExportData = {}

        Object?.entries(exportData)?.forEach(([key, value]) => {
          if (typeof value === 'number') {
            cleanedExportData[key] = isNaN(value) ? 0 : value
          } else if (value === null || value === undefined) {
            cleanedExportData[key] = ''
          } else {
            cleanedExportData[key] = value
          }
        })

        return { export_data: cleanedExportData }
      })

      return { data: cleanedData, error: null }
    } catch (error) {
      console.error('Error exporting data:', error)
      return { data: null, error: { message: 'Failed to export data' } }
    }
  },

  async exportToCSV(data, filename, headers = null) {
    try {
      if (!data || data?.length === 0) {
        throw new Error('No data to export')
      }

      let csvContent = ''

      // Optional metadata header for diagnostics and auditability
      try {
        const caps = getCapabilities?.() || {}
        const omitted = []
        if (caps.jobPartsHasTimes === false) omitted.push('scheduled_times')
        if (caps.jobPartsVendorRel === false) omitted.push('vendor_relationship')
        if (caps.jobPartsVendorId === false) omitted.push('vendor_id')
        const metadata = {
          generated_at: new Date().toISOString(),
          mode: (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'unknown',
          omitted_capabilities: omitted.join('; ') || 'none',
        }
        csvContent +=
          `# metadata: ${Object.entries(metadata)
            .map(([k, v]) => `${k}=${String(v).replace(/,/g, ';')}`)
            .join(',')}` + '\n'
      } catch (_e) {
        // Non-fatal if capabilities or env not available
      }

      // Add headers
      if (headers) {
        csvContent += headers?.join(',') + '\n'
      } else {
        // Use object keys as headers for JSONB data
        const firstRow = data?.[0]?.export_data || data?.[0]
        if (firstRow) {
          csvContent += Object?.keys(firstRow)?.join(',') + '\n'
        }
      }

      // Add data rows with safe value handling
      data?.forEach((row) => {
        const rowData = row?.export_data || row
        const values = Object?.values(rowData)?.map((value) => {
          // Handle nulls, undefined, and NaN values
          if (value === null || value === undefined) return ''

          // Handle NaN specifically
          if (typeof value === 'number' && isNaN(value)) return '0'

          // Convert to string safely
          let stringValue = safeString(value)

          // Escape commas and quotes in CSV
          if (stringValue?.includes(',') || stringValue?.includes('"')) {
            return `"${stringValue?.replace(/"/g, '""')}"`
          }

          return stringValue
        })
        csvContent += values?.join(',') + '\n'
      })

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')

      if (link?.download !== undefined) {
        const url = URL?.createObjectURL(blob)
        link?.setAttribute('href', url)
        link?.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body?.appendChild(link)
        link?.click()
        document.body?.removeChild(link)
        // Clean up the URL object
        URL?.revokeObjectURL(url)
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Export to CSV error:', error)
      return { success: false, error: { message: error?.message || 'Failed to export CSV' } }
    }
  },

  // Bulk Operations Service
  async bulkUpdateJobs(jobIds, updates) {
    try {
      const currentUser = await supabase?.auth?.getUser()
      const { data, error } = await supabase?.rpc('bulk_update_jobs', {
        job_ids: jobIds,
        updates,
        performed_by: currentUser?.data?.user?.id,
      })

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      return { data: data?.[0] || null, error: null }
    } catch (error) {
      console.error('Error in bulk update jobs:', error)
      return { data: null, error: { message: 'Failed to bulk update jobs' } }
    }
  },

  // Notification Service
  async getNotificationPreferences() {
    try {
      const currentUser = await supabase?.auth?.getUser()
      const { data, error } = await supabase
        ?.from('notification_preferences')
        ?.select('*')
        ?.eq('user_id', currentUser?.data?.user?.id)

      if (error) {
        return { data: [], error: { message: error?.message } }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
      return { data: [], error: { message: 'Failed to fetch notification preferences' } }
    }
  },

  async updateNotificationPreferences(preferences) {
    try {
      const currentUser = await supabase?.auth?.getUser()

      // Delete existing preferences and insert new ones
      await supabase
        ?.from('notification_preferences')
        ?.delete()
        ?.eq('user_id', currentUser?.data?.user?.id)

      const preferencesWithUser = preferences?.map((pref) => ({
        ...pref,
        user_id: currentUser?.data?.user?.id,
      }))

      const { data, error } = await supabase
        ?.from('notification_preferences')
        ?.insert(preferencesWithUser)
        ?.select()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      return { data: null, error: { message: 'Failed to update notification preferences' } }
    }
  },

  // Real-time subscriptions
  subscribeToOverdueJobs(callback) {
    try {
      const subscription = supabase
        ?.channel('overdue-jobs')
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
          // Refetch overdue jobs when any job changes
          this.getOverdueJobs()?.then((result) => {
            if (result?.data) {
              callback(result?.data)
            }
          })
        })
        ?.subscribe()

      return subscription
    } catch (error) {
      console.error('Error subscribing to overdue jobs:', error)
      return null
    }
  },

  // Enhanced search with filters
  async searchWithFilters(searchQuery, filters, tableType) {
    try {
      let query = supabase?.from(tableType)

      // Apply search
      if (searchQuery) {
        switch (tableType) {
          case 'jobs':
            query = query?.or(`job_number.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`)
            break
          case 'vehicles':
            query = query?.or(
              `vin.ilike.%${searchQuery}%,make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
            )
            break
          case 'vendors':
            query = query?.or(`name.ilike.%${searchQuery}%,specialty.ilike.%${searchQuery}%`)
            break
        }
      }

      // Apply filters
      Object?.entries(filters)?.forEach(([key, value]) => {
        if (value != null && value !== '') {
          if (Array?.isArray(value)) {
            query = query?.in(key, value)
          } else if (typeof value === 'object' && value?.min !== undefined) {
            query = query?.gte(key, value?.min)
          } else if (typeof value === 'object' && value?.max !== undefined) {
            query = query?.lte(key, value?.max)
          } else {
            query = query?.eq(key, value)
          }
        }
      })

      const { data, error } = await query?.select('*')?.order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: { message: error?.message } }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in search with filters:', error)
      return { data: [], error: { message: 'Failed to search with filters' } }
    }
  },
}

// Hook for overdue jobs
export const useOverdueJobs = () => {
  const [overdueJobs, setOverdueJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOverdueJobs = async () => {
    try {
      setLoading(true)
      const result = await advancedFeaturesService?.getOverdueJobs()
      if (result?.error) {
        setError(result?.error?.message)
      } else {
        setOverdueJobs(result?.data)
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching overdue jobs:', err)
      setError('Failed to fetch overdue jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverdueJobs()

    // Set up real-time subscription
    const subscription = advancedFeaturesService?.subscribeToOverdueJobs(setOverdueJobs)

    return () => {
      if (subscription) {
        subscription?.unsubscribe()
      }
    }
  }, [])

  return { overdueJobs, loading, error, refetch: fetchOverdueJobs }
}

// Hook for filter presets
export const useFilterPresets = (pageType) => {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPresets = async () => {
      setLoading(true)
      const result = await advancedFeaturesService?.getFilterPresets(pageType)
      if (result?.data) {
        setPresets(result?.data)
      }
      setLoading(false)
    }

    loadPresets()
  }, [pageType])

  const savePreset = async (name, filters, isPublic = false) => {
    const result = await advancedFeaturesService?.saveFilterPreset(
      pageType,
      name,
      filters,
      isPublic
    )
    if (result?.data) {
      setPresets((prev) => [result?.data, ...prev])
    }
    return result
  }

  const deletePreset = async (id) => {
    const result = await advancedFeaturesService?.deleteFilterPreset(id)
    if (result?.error === null) {
      setPresets((prev) => prev?.filter((preset) => preset?.id !== id))
    }
    return result
  }

  return { presets, loading, savePreset, deletePreset }
}

export default advancedFeaturesService
