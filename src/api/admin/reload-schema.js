// /api/admin/reload-schema (server route)
// Admin-only endpoint to trigger PostgREST schema cache reload
// Enhanced with rate limiting to prevent abuse
import { supabase } from '@/lib/supabase'

// Simple in-memory rate limiting
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5 // Max 5 requests per minute per user

/**
 * Check if request is within rate limit
 * @param {string} userId - User ID to check
 * @returns {Object} - { allowed: boolean, resetAt: Date }
 */
function checkRateLimit(userId) {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId) || { count: 0, windowStart: now }

  // Reset window if expired
  if (now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    userLimit.count = 0
    userLimit.windowStart = now
  }

  // Check if limit exceeded
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetAt = new Date(userLimit.windowStart + RATE_LIMIT_WINDOW_MS)
    return { allowed: false, resetAt, remaining: 0 }
  }

  // Increment counter
  userLimit.count++
  rateLimitMap.set(userId, userLimit)

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - userLimit.count,
    resetAt: new Date(userLimit.windowStart + RATE_LIMIT_WINDOW_MS),
  }
}

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

    // Check rate limit
    const rateLimitResult = checkRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${MAX_REQUESTS_PER_WINDOW} requests per minute. Please try again later.`,
        resetAt: rateLimitResult.resetAt.toISOString(),
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
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt.toISOString(),
      },
      timestamp,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unexpected error during schema reload',
      timestamp,
    })
  }
}
