import { supabase } from '@/lib/supabase'
import { authService } from '@/services/authService'

function asErrorMessage(e) {
  return e?.message || (typeof e === 'string' ? e : 'Unknown error')
}

export const adminService = {
  async checkConnection() {
    try {
      if (!supabase) return { ok: false, error: { message: 'Supabase client unavailable' } }
      await supabase.from('user_profiles').select('id').limit(1).throwOnError()
      return { ok: true, error: null }
    } catch (e) {
      return { ok: false, error: { message: asErrorMessage(e) } }
    }
  },

  async debugAuthState() {
    try {
      const { session, error: sessionError } = await authService.getSession()

      let profile = null
      let profileError = null

      if (session?.user?.id) {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          profile = data ?? null
          profileError = error ?? null
        } catch (e) {
          profile = null
          profileError = e
        }
      } else {
        profileError = { message: sessionError?.message || 'No authenticated user' }
      }

      let testData = []
      let testError = null
      try {
        const q = supabase.from('user_profiles').select('id, full_name, role').limit(5)
        const res = await q
        testData = res?.data || []
        testError = res?.error || null
      } catch (e) {
        testData = []
        testError = e
      }

      return {
        session,
        sessionError,
        profile,
        profileError,
        test: {
          canAccess: !testError,
          recordCount: testData?.length || 0,
          error: testError,
        },
      }
    } catch (e) {
      return {
        session: null,
        sessionError: { message: asErrorMessage(e) },
        profile: null,
        profileError: e,
        test: { canAccess: false, recordCount: 0, error: e },
      }
    }
  },

  async listUserAccounts({ orgId = null, onlyMyOrg = false } = {}) {
    try {
      let q = supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .in('role', ['admin', 'manager'])

      if (onlyMyOrg && orgId) q = q.eq('dealer_id', orgId)
      q = q.order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async listStaffRecords({ orgId = null, onlyMyOrg = false } = {}) {
    try {
      let q = supabase.from('user_profiles').select('*', { count: 'exact' }).eq('role', 'staff')
      if (onlyMyOrg && orgId) q = q.eq('dealer_id', orgId)
      q = q.order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async listVendors({ orgId = null, onlyMyOrg = false } = {}) {
    try {
      let q = supabase.from('vendors').select('*', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q.eq('dealer_id', orgId)
      q = q.order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async listProducts({ orgId = null, onlyMyOrg = false } = {}) {
    try {
      let q = supabase.from('products').select('*, vendors(name)', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q.eq('dealer_id', orgId)
      q = q.order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async listSmsTemplates() {
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async listOrganizations({ orgId = null, onlyMyOrg = false } = {}) {
    try {
      let q = supabase.from('organizations').select('*', { count: 'exact' })
      if (onlyMyOrg && orgId) q = q.eq('id', orgId)
      q = q.order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return { data: data || [], error: null }
    } catch (e) {
      return { data: [], error: { message: asErrorMessage(e) } }
    }
  },

  async attachProfileToOrg({ profileId, orgId }) {
    await supabase
      .from('user_profiles')
      .update({ dealer_id: orgId, is_active: true })
      .eq('id', profileId)
      .throwOnError()
  },

  async assignOrgToActiveStaff({ orgId }) {
    await supabase
      .from('user_profiles')
      .update({ dealer_id: orgId, is_active: true })
      .is('dealer_id', null)
      .eq('role', 'staff')
      .throwOnError()
  },

  async assignOrgToAccounts({ orgId }) {
    await supabase
      .from('user_profiles')
      .update({ dealer_id: orgId, is_active: true })
      .is('dealer_id', null)
      .in('role', ['admin', 'manager'])
      .throwOnError()
  },

  async assignOrgToVendors({ orgId }) {
    await supabase.from('vendors').update({ dealer_id: orgId }).is('dealer_id', null).throwOnError()
  },

  async assignOrgToProducts({ orgId }) {
    await supabase
      .from('products')
      .update({ dealer_id: orgId })
      .is('dealer_id', null)
      .throwOnError()
  },

  async updateUserProfile(profileId, patch) {
    await supabase.from('user_profiles').update(patch).eq('id', profileId).throwOnError()
  },

  async createUserAccountWithLogin({ email, password, metadata }) {
    const { data, error } = await authService.signUp(email, password, metadata)
    if (error) throw new Error(error?.message || 'Failed to create auth user')
    return data
  },

  async createStaffWithOptionalLogin(staffData) {
    // If an email is provided, provision an auth account so the trigger creates the profile
    if (staffData?.email) {
      const autoPassword = staffData?.autoPassword
      if (!autoPassword) throw new Error('autoPassword is required when provisioning login')

      const { data: authData, error: authError } = await authService.signUp(
        staffData.email,
        autoPassword,
        {
          full_name: staffData.full_name,
          role: 'staff',
          department: staffData.department,
        }
      )
      if (authError) throw new Error(authError?.message || 'Failed to sign up staff user')

      // Best-effort: update org/phone on the newly created profile row
      const createdUserId = authData?.user?.id
      if (createdUserId) {
        try {
          await supabase
            .from('user_profiles')
            .update({ dealer_id: staffData.dealer_id, phone: staffData.phone, is_active: true })
            .or(`id.eq.${createdUserId},auth_user_id.eq.${createdUserId}`)
            .throwOnError()
        } catch (e) {
          console.warn('Post-signUp profile update failed:', asErrorMessage(e))
        }
      }

      return { authData }
    }

    // No email: create a directory-only staff profile (no login)
    await supabase.from('user_profiles').insert([staffData]).throwOnError()
    return { authData: null }
  },

  async saveProduct({ editingId = null, productData }) {
    if (editingId) {
      await supabase.from('products').update(productData).eq('id', editingId).throwOnError()
    } else {
      await supabase.from('products').insert([productData]).throwOnError()
    }
  },

  async saveSmsTemplate({ editingId = null, templateData }) {
    if (editingId) {
      await supabase.from('sms_templates').update(templateData).eq('id', editingId).throwOnError()
    } else {
      await supabase.from('sms_templates').insert([templateData]).throwOnError()
    }
  },

  async deleteRow(table, id) {
    const { data: deleted, error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')

    if (deleteError) throw deleteError

    if (Array.isArray(deleted) && deleted.length === 0) {
      const { data: stillThere, error: checkErr } = await supabase
        .from(table)
        .select('id')
        .eq('id', id)
        .limit(1)
      if (checkErr) throw checkErr
      if (Array.isArray(stillThere) && stillThere.length > 0) {
        throw new Error('Delete was blocked by permissions (RLS).')
      }
    }
  },

  async deleteUserProfileWithCleanup(userId) {
    const safeCleanupDelete = async (cleanupTable, whereColumn, whereValue) => {
      try {
        const { error } = await supabase
          .from(cleanupTable)
          .delete({ count: 'exact' })
          .eq(whereColumn, whereValue)
        if (error) {
          console.warn(`[adminService] Cleanup delete failed for ${cleanupTable}:`, error?.message)
        }
      } catch (e) {
        console.warn(`[adminService] Cleanup delete threw for ${cleanupTable}:`, asErrorMessage(e))
      }
    }

    const cleanupPromises = [
      supabase
        .from('jobs')
        .update({ assigned_to: null, created_by: null, delivery_coordinator_id: null })
        .or(
          `assigned_to.eq.${userId},created_by.eq.${userId},delivery_coordinator_id.eq.${userId}`
        ),
      supabase.from('transactions').update({ processed_by: null }).eq('processed_by', userId),
      supabase.from('vehicles').update({ created_by: null }).eq('created_by', userId),
      supabase.from('vendors').update({ created_by: null }).eq('created_by', userId),
      supabase.from('products').update({ created_by: null }).eq('created_by', userId),
      supabase.from('sms_templates').update({ created_by: null }).eq('created_by', userId),
      safeCleanupDelete('filter_presets', 'user_id', userId),
      safeCleanupDelete('notification_preferences', 'user_id', userId),
      safeCleanupDelete('activity_history', 'performed_by', userId),
      safeCleanupDelete('communications', 'sent_by', userId),
    ]

    await Promise.allSettled(cleanupPromises)
    await this.deleteRow('user_profiles', userId)
  },
}

export default adminService
