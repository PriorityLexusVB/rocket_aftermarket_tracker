import { supabase } from '@/lib/supabase'
import { buildUserProfileSelectFragment, resolveUserProfileName } from '@/utils/userProfileName'
import { safeSelect } from '../lib/supabase/safeSelect'

export const vehicleService = {
  // Get all vehicles with optional filtering
  async getVehicles(filters = {}, orgId = null) {
    try {
      const profileFrag = buildUserProfileSelectFragment()
      let query = supabase
        ?.from('vehicles')
        ?.select(
          `
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey${profileFrag}
        `
        )
        ?.order('created_at', { ascending: false })
      if (orgId) query = query?.eq('org_id', orgId)

      // Apply filters
      if (filters?.status) {
        query = query?.eq('vehicle_status', filters?.status)
      }

      if (filters?.make) {
        query = query?.eq('make', filters?.make)
      }

      if (filters?.year) {
        query = query?.eq('year', filters?.year)
      }

      if (filters?.search) {
        query = query?.or(
          `vin.ilike.%${filters?.search}%,make.ilike.%${filters?.search}%,model.ilike.%${filters?.search}%,license_plate.ilike.%${filters?.search}%,owner_name.ilike.%${filters?.search}%,owner_phone.ilike.%${filters?.search}%,owner_email.ilike.%${filters?.search}%,stock_number.ilike.%${filters?.search}%`
        )
      }

      const data = await safeSelect(query, 'vehicles:getVehicles')
      const mapped = (data || []).map((v) => ({
        ...v,
        created_by_profile: v?.created_by_profile
          ? { ...v.created_by_profile, display_name: resolveUserProfileName(v.created_by_profile) }
          : null,
      }))

      return { data: mapped, error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: null,
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { data: null, error: { message: 'Failed to load vehicles' } }
    }
  },

  // Get single vehicle by ID
  async getVehicleById(id, orgId = null) {
    try {
      const profileFrag2 = buildUserProfileSelectFragment()
      let q = supabase
        ?.from('vehicles')
        ?.select(
          `
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey${profileFrag2},
          jobs(
            id,
            job_number,
            title,
            job_status,
            priority,
            estimated_cost,
            actual_cost,
            created_at,
            assigned_to_profile:user_profiles!jobs_assigned_to_fkey${profileFrag2}
          )
        `
        )
        ?.eq('id', id)
        ?.single()
      if (orgId) q = q?.eq('org_id', orgId)
      const data = await safeSelect(q, 'vehicles:getVehicleById')
      if (data?.created_by_profile) {
        data.created_by_profile.display_name = resolveUserProfileName(data.created_by_profile)
      }
      if (Array.isArray(data?.jobs)) {
        data.jobs = data.jobs.map((j) => {
          if (j?.assigned_to_profile) {
            j.assigned_to_profile.display_name = resolveUserProfileName(j.assigned_to_profile)
          }
          return j
        })
      }

      return { data, error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: null,
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { data: null, error: { message: 'Failed to load vehicle details' } }
    }
  },

  // Create new vehicle
  async createVehicle(vehicleData) {
    try {
      const profileFrag3 = buildUserProfileSelectFragment()
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.insert([
          {
            ...vehicleData,
            created_by: (await supabase?.auth?.getUser())?.data?.user?.id,
          },
        ])
        ?.select(
          `
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey${profileFrag3}
        `
        )
        ?.single()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      if (data?.created_by_profile) {
        data.created_by_profile.display_name = resolveUserProfileName(data.created_by_profile)
      }
      return { data, error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: null,
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { data: null, error: { message: 'Failed to create vehicle' } }
    }
  },

  async create(vehicleData) {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.insert([vehicleData])
        ?.select()
        ?.single()

      if (error) {
        console.error('Vehicle creation error:', error)
        throw new Error(error.message || 'Failed to create vehicle')
      }

      console.log('Vehicle created successfully:', data)
      return data
    } catch (error) {
      console.error('Error in vehicleService.create:', error)
      throw error
    }
  },

  async createVehicleWithProducts(vehicleData) {
    try {
      console.log('Creating vehicle with products:', vehicleData)

      // In a real implementation, this would:
      // 1. Create the vehicle record in the vehicles table
      // 2. Create vehicle_products records for each selected product
      // 3. Optionally create initial job records if vendor is assigned
      // 4. Return the created vehicle with all relationships

      // Mock implementation for now
      const mockVehicleId = `vehicle_${Date.now()}`

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock successful response
      const createdVehicle = {
        id: mockVehicleId,
        ...vehicleData,
        created_at: new Date()?.toISOString(),
        initial_products_count: vehicleData?.initial_products?.length || 0,
        estimated_aftermarket_value: vehicleData?.total_initial_product_value || 0,
      }

      console.log('Vehicle created successfully:', createdVehicle)
      return createdVehicle
    } catch (error) {
      console.error('Error creating vehicle with products:', error)
      throw error
    }
  },

  async checkStockNumberExists(stockNumber) {
    if (!stockNumber?.trim()) return false

    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select('id')
        ?.eq('stock_number', stockNumber?.trim())
        ?.maybeSingle()

      if (error) {
        console.error('Stock number check error:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking stock number:', error)
      return false
    }
  },

  async checkVinExists(vin) {
    if (!vin?.trim()) return false

    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select('id')
        ?.eq('vin', vin?.trim())
        ?.maybeSingle()

      if (error) {
        console.error('VIN check error:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking VIN:', error)
      return false
    }
  },

  // Update vehicle
  async updateVehicle(id, updates) {
    try {
      const profileFrag4 = buildUserProfileSelectFragment()
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', id)
        ?.select(
          `
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey${profileFrag4}
        `
        )
        ?.maybeSingle()

      if (error) {
        return { data: null, error: { message: error?.message } }
      }

      // Guard: UPDATE can be blocked by RLS and return 0 rows without error.
      if (!data) {
        const { data: stillThere, error: checkErr } = await supabase
          ?.from('vehicles')
          ?.select('id')
          ?.eq('id', id)
          ?.limit(1)

        if (checkErr) {
          return {
            data: null,
            error: { message: `Failed to verify update: ${checkErr?.message}` },
          }
        }

        if (Array.isArray(stillThere) && stillThere.length > 0) {
          return { data: null, error: { message: 'Update was blocked by permissions (RLS).' } }
        }

        return { data: null, error: { message: 'Vehicle not found (or you do not have access).' } }
      }

      if (data?.created_by_profile) {
        data.created_by_profile.display_name = resolveUserProfileName(data.created_by_profile)
      }
      return { data, error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: null,
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { data: null, error: { message: 'Failed to update vehicle' } }
    }
  },

  // Delete vehicle
  async deleteVehicle(id) {
    try {
      const { data: deleted, error } = await supabase
        ?.from('vehicles')
        ?.delete()
        ?.eq('id', id)
        ?.select('id')

      if (error) return { error: { message: error?.message } }

      if (Array.isArray(deleted) && deleted.length === 0) {
        const { data: stillThere, error: checkErr } = await supabase
          ?.from('vehicles')
          ?.select('id')
          ?.eq('id', id)
          ?.limit(1)

        if (checkErr) return { error: { message: `Failed to verify delete: ${checkErr?.message}` } }
        if (Array.isArray(stillThere) && stillThere.length > 0) {
          return { error: { message: 'Delete was blocked by permissions (RLS).' } }
        }
      }

      return { error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { error: { message: 'Failed to delete vehicle' } }
    }
  },

  // Get vehicle statistics
  async getVehicleStats(orgId = null) {
    try {
      let q = supabase?.from('vehicles')?.select('vehicle_status')
      if (orgId) q = q?.eq('org_id', orgId)
      const data = await safeSelect(q, 'vehicles:getVehicleStats')

      const stats = {
        total: data?.length || 0,
        active: data?.filter((v) => v?.vehicle_status === 'active')?.length || 0,
        maintenance: data?.filter((v) => v?.vehicle_status === 'maintenance')?.length || 0,
        retired: data?.filter((v) => v?.vehicle_status === 'retired')?.length || 0,
        sold: data?.filter((v) => v?.vehicle_status === 'sold')?.length || 0,
      }

      return { data: stats, error: null }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: null,
          error: {
            message:
              'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.',
          },
        }
      }
      return { data: null, error: { message: 'Failed to load vehicle statistics' } }
    }
  },

  // Get all vehicles (alias for getVehicles for consistent API usage)
  async getAllVehicles(filters = {}) {
    return await this.getVehicles(filters)
  },
}

// Add vendor-aware vehicle fetching
export const getVehicles = async (options = {}, orgId = null) => {
  try {
    let query = supabase?.from('vehicles')?.select(`
      *,
      jobs:jobs!vehicles_vehicle_id_fkey(
        id,
        job_number,
        title,
        job_status,
        vendor_id,
        assigned_to
      )
    `)
    if (orgId) query = query?.eq('org_id', orgId)

    // Apply filters if provided
    if (options?.status) {
      query = query?.eq('vehicle_status', options?.status)
    }

    if (options?.search) {
      query = query?.or(`
        make.ilike.%${options?.search}%,
        model.ilike.%${options?.search}%,
        vin.ilike.%${options?.search}%,
        license_plate.ilike.%${options?.search}%
      `)
    }

    const data = await safeSelect(
      query?.order('created_at', { ascending: false }),
      'vehicles:getVehiclesFlat'
    )
    return data || []
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    throw error
  }
}

// Vendor-specific vehicle access function
export const getVendorAccessibleVehicles = async (vendorId) => {
  try {
    const { data, error } = await supabase?.rpc('get_vendor_vehicles', {
      vendor_uuid: vendorId,
    })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error fetching vendor vehicles:', error)
    throw error
  }
}
function createVehicleWithProducts(...args) {
  console.warn('Placeholder: createVehicleWithProducts is not implemented yet.', args)
  return null
}

export { createVehicleWithProducts }
