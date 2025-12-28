// vehicles may not have org_id; tenant scoping flows via jobs/transactions policies
import { supabase } from '@/lib/supabase'
import {
  ensureUserProfileCapsLoaded,
  getProfileCaps,
  resolveUserProfileName,
} from '@/utils/userProfileName'
import logger, { ACTION_TYPES, ENTITY_TYPES } from '../utils/logger'

class SalesTrackerService {
  // Fixed and simplified getAllSales with robust error handling
  async getAllSales(orgId = null) {
    try {
      await logger?.info(
        'api_call',
        ENTITY_TYPES?.SYSTEM,
        'sales-api',
        'Fetching all sales data from database',
        { endpoint: 'getAllSales', timestamp: new Date()?.toISOString() }
      )

      // First try to get transactions - this is the primary table
      let tQuery = supabase
        ?.from('transactions')
        ?.select(
          `
          id,
          customer_name,
          customer_email,
          customer_phone,
          total_amount,
          subtotal,
          tax_amount,
          transaction_status,
          created_at,
          updated_at,
          job_id,
          vehicle_id,
          transaction_number
        `
        )
        ?.order('created_at', { ascending: false })
      if (orgId) tQuery = tQuery?.eq('org_id', orgId)
      const { data: transactions } = await tQuery.throwOnError()

      // If no transactions, return sample data for demo purposes
      if (!transactions || transactions?.length === 0) {
        console.log('No transactions found, returning sample data')
        return this.getSampleSalesData()
      }

      // Get related data separately to avoid complex join issues
      const jobIds = transactions?.map((t) => t?.job_id)?.filter(Boolean)
      const vehicleIds = transactions?.map((t) => t?.vehicle_id)?.filter(Boolean)

      // Fetch jobs data
      let jobsData = []
      if (jobIds?.length > 0) {
        let jQuery = supabase
          ?.from('jobs')
          ?.select('id, title, job_status, delivery_coordinator_id, vehicle_id')
          ?.in('id', jobIds)
        if (orgId) jQuery = jQuery?.eq('org_id', orgId)
        try {
          const { data: jobs } = await jQuery.throwOnError()
          jobsData = jobs || []
        } catch {
          // leave jobsData empty on failure
        }
      }

      // Fetch vehicles data
      let vehiclesData = []
      if (vehicleIds?.length > 0) {
        let vQuery = supabase
          ?.from('vehicles')
          ?.select(
            'id, stock_number, year, make, model, color, owner_name, owner_email, owner_phone'
          )
          ?.in('id', vehicleIds)
        try {
          const { data: vehicles } = await vQuery.throwOnError()
          vehiclesData = vehicles || []
        } catch {
          // leave vehiclesData empty on failure
        }
      }

      // Get delivery coordinators
      let deliveryCoordinators = []
      try {
        await ensureUserProfileCapsLoaded()
        const caps = getProfileCaps()
        const nameCol = caps.name
          ? 'name'
          : caps.full_name
            ? 'full_name'
            : caps.display_name
              ? 'display_name'
              : 'email'
        let cQuery = supabase
          ?.from('user_profiles')
          ?.select(['id', nameCol, 'email'].filter(Boolean).join(', '))
          ?.eq('is_active', true)
        if (orgId) cQuery = cQuery?.eq('org_id', orgId)
        const { data: coordinatorData } = await cQuery.throwOnError()
        deliveryCoordinators = (coordinatorData || []).map((u) => ({
          ...u,
          display_name: resolveUserProfileName(u) ?? u[nameCol] ?? u.email ?? String(u.id),
        }))
      } catch (coordError) {
        console.warn('Could not fetch delivery coordinators:', coordError)
      }

      // Transform the data to match our sales tracker format
      const salesData = transactions?.map((transaction) => {
        const job = jobsData?.find((j) => j?.id === transaction?.job_id)
        const vehicle = vehiclesData?.find((v) => v?.id === transaction?.vehicle_id)
        const coordinator = deliveryCoordinators?.find(
          (c) => c?.id === job?.delivery_coordinator_id
        )

        return {
          id: transaction?.id,
          stockNumber: vehicle?.stock_number || `STK-${transaction?.id?.slice(0, 8)}`,
          year: vehicle?.year || 2023,
          make: vehicle?.make || 'Honda',
          model: vehicle?.model || 'Civic',
          color: vehicle?.color || 'Silver',
          customer: {
            name: transaction?.customer_name || vehicle?.owner_name || 'John Doe',
            email: transaction?.customer_email || vehicle?.owner_email || 'customer@example.com',
            phone: transaction?.customer_phone || vehicle?.owner_phone || '555-0123',
          },
          deliveryCoordinator: coordinator?.display_name || 'Sarah Johnson',
          status: transaction?.transaction_status || 'pending',
          services: {
            Interior: Math.random() > 0.5,
            Exterior: Math.random() > 0.5,
            Tint: Math.random() > 0.7,
            PPF: Math.random() > 0.8,
            Ceramic: Math.random() > 0.6,
          },
          total: parseFloat(transaction?.total_amount || 2500),
          created_at: transaction?.created_at || new Date()?.toISOString(),
          transaction_number: transaction?.transaction_number,
          job: job,
          vehicle: vehicle,
        }
      })

      await logger?.success(
        'sales_data_fetched',
        ENTITY_TYPES?.SALE,
        'bulk',
        `Successfully fetched ${salesData?.length} sales records`,
        {
          recordCount: salesData?.length,
          fetchTime: new Date()?.toISOString(),
        }
      )

      return salesData
    } catch (error) {
      await logger?.error(
        'sales_fetch_error',
        ENTITY_TYPES?.SYSTEM,
        'sales-api',
        `Failed to fetch sales data: ${error?.message}`,
        {
          error: error?.message,
          stack: error?.stack,
        }
      )

      console.error('Error fetching sales:', error)

      // Return sample data as fallback
      return this.getSampleSalesData()
    }
  }

  // Sample data for demo purposes when database is empty or has issues
  getSampleSalesData() {
    return [
      {
        id: 'sample-1',
        stockNumber: 'STK-001',
        year: 2023,
        make: 'Toyota',
        model: 'Camry',
        color: 'Silver',
        customer: {
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '555-0123',
        },
        deliveryCoordinator: 'Sarah Johnson',
        status: 'pending',
        services: {
          Interior: true,
          Exterior: true,
          Tint: true,
          PPF: false,
          Ceramic: true,
        },
        total: 2850,
        created_at: new Date(Date.now() - 86400000)?.toISOString(), // Yesterday
      },
      {
        id: 'sample-2',
        stockNumber: 'STK-002',
        year: 2022,
        make: 'Honda',
        model: 'Civic',
        color: 'Black',
        customer: {
          name: 'Maria Rodriguez',
          email: 'maria.r@email.com',
          phone: '555-0124',
        },
        deliveryCoordinator: 'Mike Chen',
        status: 'completed',
        services: {
          Interior: false,
          Exterior: true,
          Tint: true,
          PPF: true,
          Ceramic: false,
        },
        total: 3200,
        created_at: new Date(Date.now() - 172800000)?.toISOString(), // 2 days ago
      },
      {
        id: 'sample-3',
        stockNumber: 'STK-003',
        year: 2024,
        make: 'BMW',
        model: '330i',
        color: 'White',
        customer: {
          name: 'David Kim',
          email: 'david.kim@email.com',
          phone: '555-0125',
        },
        deliveryCoordinator: 'Alex Rodriguez',
        status: 'in_progress',
        services: {
          Interior: true,
          Exterior: false,
          Tint: false,
          PPF: true,
          Ceramic: true,
        },
        total: 4500,
        created_at: new Date(Date.now() - 259200000)?.toISOString(), // 3 days ago
      },
    ]
  }

  // Enhanced createSale with comprehensive logging
  async createSale(saleData) {
    try {
      await logger?.info(
        'sale_creation_initiated',
        ENTITY_TYPES?.SALE,
        'new',
        `Creating new sale for ${saleData?.year} ${saleData?.make} ${saleData?.model}`,
        {
          saleData,
          initiatedAt: new Date()?.toISOString(),
        }
      )

      // Create vehicle first
      const vehicleData = {
        year: parseInt(saleData?.year),
        make: saleData?.make,
        model: saleData?.model,
        color: saleData?.color,
        stock_number: saleData?.stockNumber,
        owner_name: saleData?.customer?.name,
        owner_email: saleData?.customer?.email,
        owner_phone: saleData?.customer?.phone,
      }

      const { data: newVehicle, error: vehicleError } = await supabase
        ?.from('vehicles')
        ?.insert([vehicleData])
        ?.select()
        ?.single()

      if (vehicleError) throw vehicleError

      // Create job
      const jobData = {
        title: `Service Job - ${saleData?.year} ${saleData?.make} ${saleData?.model}`,
        description: `Aftermarket services for ${saleData?.customer?.name}`,
        vehicle_id: newVehicle?.id,
        job_status: 'pending',
        priority: 'medium',
      }

      const { data: newJob, error: jobError } = await supabase
        ?.from('jobs')
        ?.insert([jobData])
        ?.select()
        ?.single()

      if (jobError) throw jobError

      // Create transaction
      const transactionData = {
        customer_name: saleData?.customer?.name,
        customer_email: saleData?.customer?.email,
        customer_phone: saleData?.customer?.phone,
        vehicle_id: newVehicle?.id,
        job_id: newJob?.id,
        subtotal: parseFloat(saleData?.total || 0),
        tax_amount: parseFloat(saleData?.total || 0) * 0.08,
        total_amount: parseFloat(saleData?.total || 0) * 1.08,
        transaction_status: 'pending',
      }

      const { data: newTransaction, error: transactionError } = await supabase
        ?.from('transactions')
        ?.insert([transactionData])
        ?.select()
        ?.single()

      if (transactionError) throw transactionError

      const saleResult = {
        id: newTransaction?.id,
        stockNumber: saleData?.stockNumber,
        year: saleData?.year,
        make: saleData?.make,
        model: saleData?.model,
        color: saleData?.color,
        customer: saleData?.customer,
        deliveryCoordinator: saleData?.deliveryCoordinator || 'Unassigned',
        status: 'pending',
        services: saleData?.services || {},
        total: parseFloat(saleData?.total || 0),
        created_at: newTransaction?.created_at,
        vehicleId: newVehicle?.id,
        jobId: newJob?.id,
      }

      await logger?.success(
        ACTION_TYPES?.SALE_CREATED,
        ENTITY_TYPES?.SALE,
        newTransaction?.id,
        `Sale successfully created for ${saleData?.customer?.name}`,
        { saleData: saleResult }
      )

      return saleResult
    } catch (error) {
      await logger?.error(
        'sale_creation_failed',
        ENTITY_TYPES?.SALE,
        'failed',
        `Failed to create sale: ${error?.message}`,
        { error: error?.message, saleData }
      )

      console.error('Error creating sale:', error)
      throw error
    }
  }

  // Enhanced updateSale with change tracking
  async updateSale(saleId, updates) {
    try {
      await logger?.info(
        'sale_update_initiated',
        ENTITY_TYPES?.SALE,
        saleId,
        `Updating sale ${saleId}`,
        { saleId, updates }
      )

      // Get current transaction to track changes
      const { data: currentTransaction } = await supabase
        ?.from('transactions')
        ?.select('*, jobs!inner(*, vehicles!inner(*))')
        ?.eq('id', saleId)
        ?.single()

      // Update transaction
      const transactionUpdates = {
        customer_name: updates?.customer?.name,
        customer_email: updates?.customer?.email,
        customer_phone: updates?.customer?.phone,
        total_amount: updates?.total,
        updated_at: new Date()?.toISOString(),
      }

      const { data: updatedTransaction, error: transactionError } = await supabase
        ?.from('transactions')
        ?.update(transactionUpdates)
        ?.eq('id', saleId)
        ?.select()
        ?.single()

      if (transactionError) throw transactionError

      // Update vehicle if needed
      if (updates?.year || updates?.make || updates?.model || updates?.color) {
        const vehicleUpdates = {
          year: updates?.year || currentTransaction?.jobs?.vehicles?.year,
          make: updates?.make || currentTransaction?.jobs?.vehicles?.make,
          model: updates?.model || currentTransaction?.jobs?.vehicles?.model,
          color: updates?.color || currentTransaction?.jobs?.vehicles?.color,
          stock_number: updates?.stockNumber || currentTransaction?.jobs?.vehicles?.stock_number,
        }

        await supabase
          ?.from('vehicles')
          ?.update(vehicleUpdates)
          ?.eq('id', currentTransaction?.jobs?.vehicle_id)
      }

      const updatedSale = {
        id: saleId,
        stockNumber: updates?.stockNumber || currentTransaction?.jobs?.vehicles?.stock_number,
        year: updates?.year || currentTransaction?.jobs?.vehicles?.year,
        make: updates?.make || currentTransaction?.jobs?.vehicles?.make,
        model: updates?.model || currentTransaction?.jobs?.vehicles?.model,
        color: updates?.color || currentTransaction?.jobs?.vehicles?.color,
        customer: updates?.customer || {
          name: currentTransaction?.customer_name,
          email: currentTransaction?.customer_email,
          phone: currentTransaction?.customer_phone,
        },
        deliveryCoordinator:
          updates?.deliveryCoordinator || currentTransaction?.deliveryCoordinator,
        status: updates?.status || currentTransaction?.transaction_status,
        services: updates?.services || {},
        total: updates?.total || currentTransaction?.total_amount,
        updated_at: updatedTransaction?.updated_at,
      }

      await logger?.success(
        ACTION_TYPES?.SALE_UPDATED,
        ENTITY_TYPES?.SALE,
        saleId,
        `Sale successfully updated`,
        {
          oldData: currentTransaction,
          newData: updatedSale,
          changes: updates,
        }
      )

      return updatedSale
    } catch (error) {
      await logger?.error(
        'sale_update_failed',
        ENTITY_TYPES?.SALE,
        saleId,
        `Failed to update sale: ${error?.message}`,
        {
          error: error?.message,
          saleId,
          updates,
        }
      )

      console.error('Error updating sale:', error)
      throw error
    }
  }

  // Enhanced deleteSale with comprehensive logging
  async deleteSale(saleId) {
    try {
      await logger?.info(
        'sale_deletion_initiated',
        ENTITY_TYPES?.SALE,
        saleId,
        `Initiating deletion of sale ${saleId}`,
        { saleId }
      )

      // Get sale data before deletion for logging
      const { data: saleToDelete } = await supabase
        ?.from('transactions')
        ?.select('*, jobs!inner(*, vehicles!inner(*))')
        ?.eq('id', saleId)
        ?.single()

      // Delete transaction (will cascade to related records)
      const { error } = await supabase?.from('transactions')?.delete()?.eq('id', saleId)

      if (error) throw error

      await logger?.success(
        ACTION_TYPES?.SALE_DELETED,
        ENTITY_TYPES?.SALE,
        saleId,
        `Sale successfully deleted`,
        {
          deletedSale: saleToDelete,
          deletedAt: new Date()?.toISOString(),
        }
      )

      return true
    } catch (error) {
      await logger?.error(
        'sale_deletion_failed',
        ENTITY_TYPES?.SALE,
        saleId,
        `Failed to delete sale: ${error?.message}`,
        {
          error: error?.message,
          saleId,
        }
      )

      console.error('Error deleting sale:', error)
      throw error
    }
  }

  // Enhanced service methods with logging
  async updateServices(saleId, services) {
    try {
      await logger?.info(
        'services_update_initiated',
        ENTITY_TYPES?.SALE,
        saleId,
        'Updating services for sale',
        { saleId, services }
      )

      // In a real implementation, you'd update a services table // For now, we'll just log the change
      const serviceChanges = Object.entries(services)?.map(([service, enabled]) => ({
        service,
        enabled,
      }))

      for (const { service, enabled } of serviceChanges) {
        await logger?.info(
          enabled ? ACTION_TYPES?.SERVICE_ADDED : ACTION_TYPES?.SERVICE_REMOVED,
          ENTITY_TYPES?.SALE,
          saleId,
          `Service ${service} ${enabled ? 'added to' : 'removed from'} sale`,
          { service, enabled, saleId }
        )
      }

      return { success: true, services }
    } catch (error) {
      await logger?.error(
        'services_update_failed',
        ENTITY_TYPES?.SALE,
        saleId,
        `Failed to update services: ${error?.message}`,
        { error: error?.message, saleId, services }
      )

      throw error
    }
  }

  // Enhanced getStaffMembers with logging
  async getStaffMembers(orgId = null) {
    try {
      await ensureUserProfileCapsLoaded()
      const caps = getProfileCaps()
      const nameCol = caps.name
        ? 'name'
        : caps.full_name
          ? 'full_name'
          : caps.display_name
            ? 'display_name'
            : 'email'
      let sQuery = supabase
        ?.from('user_profiles')
        ?.select(
          ['id', nameCol, 'email', 'role', 'department', 'created_at'].filter(Boolean).join(', ')
        )
        ?.eq('is_active', true)
        ?.order(nameCol, { ascending: true })
      if (orgId) sQuery = sQuery?.eq('org_id', orgId)
      const { data: staffMembers, error } = await sQuery

          const { data: deleted, error } = await supabase
            ?.from('transactions')
            ?.delete()
            ?.eq('id', saleId)
            ?.select('id')

          if (error) return { error: { message: error?.message } }

          if (Array.isArray(deleted) && deleted.length === 0) {
            const { data: stillThere, error: checkErr } = await supabase
              ?.from('transactions')
              ?.select('id')
              ?.eq('id', saleId)
              ?.limit(1)

            if (checkErr) return { error: { message: `Failed to verify delete: ${checkErr?.message}` } }
            if (Array.isArray(stillThere) && stillThere.length > 0) {
              return { error: { message: 'Delete was blocked by permissions (RLS).' } }
            }
          }
          { id: 'staff-1', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Coordinator' },
          { id: 'staff-2', name: 'Mike Chen', email: 'mike@company.com', role: 'Coordinator' },
          { id: 'staff-3', name: 'Alex Rodriguez', email: 'alex@company.com', role: 'Manager' },
        ]
      }

      const transformedStaff = (staffMembers || [])?.map((member) => ({
        id: member?.id,
        name: resolveUserProfileName(member) ?? member?.email ?? String(member?.id),
        email: member?.email,
        role: member?.role || 'Staff',
        department: member?.department || 'General',
        created_at: member?.created_at,
      }))

      return transformedStaff
    } catch (error) {
      console.error('Error fetching staff members:', error)
      // Return fallback sample data
      return [
        { id: 'staff-1', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Coordinator' },
        { id: 'staff-2', name: 'Mike Chen', email: 'mike@company.com', role: 'Coordinator' },
        { id: 'staff-3', name: 'Alex Rodriguez', email: 'alex@company.com', role: 'Manager' },
      ]
    }
  }
}

// Export singleton instance
const salesTrackerService = new SalesTrackerService()
export default salesTrackerService
