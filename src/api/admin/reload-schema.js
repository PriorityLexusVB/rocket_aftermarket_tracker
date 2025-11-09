// /api/admin/reload-schema (server route)
// Admin-only endpoint to trigger PostgREST schema cache reload
import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()

  try {
    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required',
        timestamp,
      })
    }

    // Check if user has admin privileges
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(403).json({
        error: 'Forbidden: Unable to verify admin privileges',
        timestamp,
      })
    }

    // Check is_admin flag or role
    const isAdmin = profile.is_admin === true || profile.role === 'admin'

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Admin privileges required',
        userRole: profile.role,
        timestamp,
      })
    }

    // Execute schema reload notification
    // Note: NOTIFY is a PostgreSQL command that PostgREST listens for
    const { error: reloadError } = await supabase.rpc('notify_schema_reload', {})

    if (reloadError) {
      // Fallback: Try using raw SQL if RPC function doesn't exist
      const { error: rawSqlError } = await supabase.rpc('exec_sql', {
        sql: "NOTIFY pgrst, 'reload schema'",
      })

      if (rawSqlError) {
        return res.status(500).json({
          error: 'Failed to reload schema cache',
          details: rawSqlError.message,
          fallbackAttempted: true,
          timestamp,
        })
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Schema cache reload notification sent',
      note: 'PostgREST will reload schema cache. Allow 1-2 seconds for completion.',
      timestamp,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unexpected error during schema reload',
      timestamp,
    })
  }
}
