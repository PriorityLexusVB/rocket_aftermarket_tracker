import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { authService } from '@/services/authService'

export const userManagementService = {
  async loadUserManagementData() {
    try {
      const usersQ = supabase
        ?.from('user_profiles')
        ?.select(
          `
          *,
          vendor:vendors(id, name)
        `
        )
        ?.order('created_at', { ascending: false })

      const vendorsQ = supabase
        ?.from('vendors')
        ?.select('id, name, is_active')
        ?.eq('is_active', true)
        ?.order('name')

      const orgsQ = supabase?.from('organizations')?.select('id, name')?.order('name')

      const [users, vendors, organizations] = await Promise.all([
        safeSelect(usersQ, 'userManagement:users', { allowRLS: true }),
        safeSelect(vendorsQ, 'userManagement:vendors', { allowRLS: true }),
        safeSelect(orgsQ, 'userManagement:organizations', { allowRLS: true }),
      ])

      return {
        data: {
          users: users || [],
          vendors: vendors || [],
          organizations: organizations || [],
        },
        error: null,
      }
    } catch (error) {
      console.error('[userManagement] loadUserManagementData failed', error)
      return { data: { users: [], vendors: [], organizations: [] }, error }
    }
  },

  async createUserWithLogin({ email, password, profile }) {
    const { data: authData, error: authError } = await authService.signUp(email, password)
    if (authError) throw new Error(authError?.message || 'Failed to create auth user')

    const userId = authData?.user?.id
    if (!userId) throw new Error('Auth user id missing after sign up')

    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.insert([
        {
          id: userId,
          email,
          full_name: profile?.full_name,
          role: profile?.role,
          vendor_id: profile?.role === 'vendor' ? profile?.vendor_id : null,
          phone: profile?.phone,
          department: profile?.department,
          is_active: true,
          org_id: profile?.org_id || null,
        },
      ])
      ?.select()
      ?.single()

    if (error) throw error
    return data
  },

  async createStaffProfile({ id, profile }) {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.insert([
        {
          id,
          full_name: profile?.full_name,
          email: null,
          phone: profile?.phone || null,
          role: 'staff',
          department: profile?.department,
          is_active: true,
          vendor_id: null,
          org_id: profile?.org_id || null,
        },
      ])
      ?.select()
      ?.single()

    if (error) throw error
    return data
  },

  async setUserActive({ userId, isActive }) {
    const { error } = await supabase
      ?.from('user_profiles')
      ?.update({ is_active: isActive })
      ?.eq('id', userId)

    if (error) throw error
    return true
  },
}
