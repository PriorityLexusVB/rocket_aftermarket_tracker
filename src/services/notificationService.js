import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import {
  NOTIFICATION_OUTBOX_TABLE_AVAILABLE,
  SMS_TEMPLATES_TABLE_AVAILABLE,
  disableNotificationOutboxCapability,
  disableSmsTemplatesCapability,
} from '@/utils/capabilityTelemetry'

/**
 * Interpolate a message template string.
 * Replaces all occurrences of {{key}} (double-brace, case-insensitive key match)
 * with the corresponding value from vars.  Unknown placeholders are left unchanged.
 *
 * @param {string} template
 * @param {Record<string, string | number>} vars
 * @returns {string}
 */
function interpolateTemplate(template, vars) {
  if (!template) return ''
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key]
    return value !== undefined && value !== null ? String(value) : match
  })
}

/**
 * Enqueue an SMS notification for a job.
 *
 * Looks up the sms_templates row by name (e.g. 'Service Scheduled'), interpolates
 * the template body with the supplied vars, resolves the customer phone from the
 * jobs → vehicles join, and inserts a row into notification_outbox with
 * status='pending' for the processOutbox edge function to pick up.
 *
 * Fails loudly in the log but returns null (does NOT throw) so callers can
 * safely fire-and-forget without disrupting the primary job mutation.
 *
 * Template name → status mapping:
 *   'Service Scheduled'  ← job_status 'scheduled'
 *   'Work In Progress'   ← job_status 'in_progress'
 *   'Service Complete'   ← job_status 'completed'
 *
 * Available vars for substitution ({{double_brace}} syntax):
 *   stock_number, vehicle_info, date, time, completion_time, contact_phone, etc.
 *
 * @param {string} jobId
 * @param {string} templateName  - Matches sms_templates.name exactly
 * @param {Record<string, string | number>} vars - Template interpolation values
 * @returns {Promise<string | null>} - The inserted outbox row id, or null on failure/skip
 */
export async function enqueueNotification(jobId, templateName, vars = {}) {
  // Fast-exit if either table was marked unavailable during this session
  if (NOTIFICATION_OUTBOX_TABLE_AVAILABLE === false) {
    console.debug('[notify:enqueue] skipped – notification_outbox table unavailable')
    return null
  }
  if (SMS_TEMPLATES_TABLE_AVAILABLE === false) {
    console.debug('[notify:enqueue] skipped – sms_templates table unavailable')
    return null
  }

  if (!jobId) {
    console.warn('[notify:enqueue] called without jobId – skipping')
    return null
  }
  if (!templateName) {
    console.warn('[notify:enqueue] called without templateName – skipping')
    return null
  }

  try {
    // 1. Resolve the customer phone number via the jobs → vehicles join
    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .select('id, vehicle_id, dealer_id, vehicles(stock_number, owner_phone, year, make, model)')
      .eq('id', jobId)
      .single()

    if (jobErr) {
      console.warn(`[notify:enqueue] job lookup failed (jobId=${jobId}):`, jobErr.message)
      return null
    }

    const phone = jobRow?.vehicles?.owner_phone
    if (!phone) {
      console.info(`[notify:enqueue] no customer phone for jobId=${jobId} – skipping SMS`)
      return null
    }

    // Check opt-out before fetching template (cheap short-circuit)
    const { data: optOut } = await supabase
      .from('sms_opt_outs')
      .select('phone_e164')
      .eq('phone_e164', phone)
      .maybeSingle()

    if (optOut) {
      console.info(`[notify:enqueue] phone ${phone} has opted out – skipping SMS`)
      return null
    }

    // 2. Fetch the SMS template by name
    let templateRow = null
    try {
      const { data: tmpl, error: tmplErr } = await supabase
        .from('sms_templates')
        .select('id, name, message_template')
        .eq('name', templateName)
        .eq('is_active', true)
        .maybeSingle()

      if (tmplErr) {
        const msg = String(tmplErr?.message || '').toLowerCase()
        if (msg.includes('sms_templates') && msg.includes('could not find the table')) {
          disableSmsTemplatesCapability()
          return null
        }
        console.warn(`[notify:enqueue] sms_templates lookup failed:`, tmplErr.message)
        return null
      }
      templateRow = tmpl
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('sms_templates') && msg.includes('could not find the table')) {
        disableSmsTemplatesCapability()
        return null
      }
      throw e
    }

    if (!templateRow) {
      console.warn(
        `[notify:enqueue] template "${templateName}" not found or inactive – skipping SMS`
      )
      return null
    }

    // 3. Build default vars from the vehicle data so callers only need to supply overrides
    const v = jobRow?.vehicles ?? {}
    const vehicleInfo =
      [v.year, v.make, v.model].filter(Boolean).join(' ') || 'your vehicle'
    const mergedVars = {
      stock_number: v.stock_number ?? '',
      vehicle_info: vehicleInfo,
      contact_phone: '757-486-3500',
      ...vars,
    }

    // 4. Interpolate the template body client-side ({{key}} double-brace syntax)
    const messageBody = interpolateTemplate(templateRow.message_template, mergedVars)

    // 5. Insert into notification_outbox
    let outboxId = null
    try {
      const { data: outboxRow, error: outboxErr } = await supabase
        .from('notification_outbox')
        .insert({
          phone_e164: phone,
          message_template: messageBody,
          variables: null, // already interpolated; processOutbox sees no placeholders
          not_before: new Date().toISOString(),
          status: 'pending',
          dealer_id: jobRow?.dealer_id ?? null,
        })
        .select('id')
        .single()

      if (outboxErr) {
        const msg = String(outboxErr?.message || '').toLowerCase()
        if (msg.includes('notification_outbox') && msg.includes('could not find the table')) {
          disableNotificationOutboxCapability()
          return null
        }
        console.error(`[notify:enqueue] insert into notification_outbox failed:`, outboxErr.message)
        return null
      }

      outboxId = outboxRow?.id ?? null
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('notification_outbox') && msg.includes('could not find the table')) {
        disableNotificationOutboxCapability()
        return null
      }
      throw e
    }

    console.info(
      `[notify:enqueue] queued "${templateName}" for job ${jobId} → outbox ${outboxId}`
    )
    return outboxId
  } catch (err) {
    // Fail loudly in logs, softly to caller
    console.error(`[notify:enqueue] unexpected error for jobId=${jobId}:`, err?.message ?? err)
    return null
  }
}

let pendingOutboxFetchPromise = null

export const notificationService = {
  // Get pending/recent communications as notifications
  async getNotifications(userId, opts = {}) {
    try {
      if (!userId) {
        return { data: [], error: null, count: 0 }
      }

      let q = supabase?.from('communications')?.select(`
          id,
          message,
          subject,
          communication_type,
          sent_at,
          is_successful,
          recipient,
          job_id,
          vehicle_id
        `)
      // Back-compat: opts.orgId is treated as dealer_id.
      if (opts?.orgId) q = q?.eq('dealer_id', opts.orgId)
      const { data } = await q?.order('sent_at', { ascending: false })?.limit(10)?.throwOnError()

      // Filter for recent communications (within last 7 days)
      const weekAgo = new Date()
      weekAgo?.setDate(weekAgo?.getDate() - 7)

      const recentNotifications =
        data?.filter((notification) => new Date(notification.sent_at) >= weekAgo) || []

      return {
        data: recentNotifications,
        error: null,
        count: recentNotifications?.length,
      }
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return {
          data: [],
          error: 'Cannot connect to database. Please check your connection.',
          count: 0,
        }
      }
      console.warn('[notify] getNotifications failed:', error?.message || error)
      return { data: [], error: 'Failed to load notifications', count: 0 }
    }
  },

  // Get pending SMS notifications from outbox
  async getPendingSMSNotifications(opts = {}) {
    try {
      if (NOTIFICATION_OUTBOX_TABLE_AVAILABLE === false) {
        return { data: [], error: null, count: 0 }
      }

      if (pendingOutboxFetchPromise) {
        const data = await pendingOutboxFetchPromise
        return { data: data || [], error: null, count: data?.length || 0 }
      }

      pendingOutboxFetchPromise = (async () => {
        try {
          let q = supabase
            ?.from('notification_outbox')
            ?.select('id, status, created_at, message_template, phone_e164')
            ?.eq('status', 'pending')
          if (opts?.orgId) q = q?.eq('dealer_id', opts.orgId)

          q = q?.order('created_at', { ascending: false })?.limit(5)

          const data = await safeSelect(q, 'notification_outbox:notificationService:getPending')
          return data || []
        } catch (error) {
          const msg = String(error?.message || error || '').toLowerCase()
          if (msg.includes('notification_outbox') && msg.includes('could not find the table')) {
            disableNotificationOutboxCapability()
            return []
          }
          throw error
        } finally {
          pendingOutboxFetchPromise = null
        }
      })()

      const data = await pendingOutboxFetchPromise

      return {
        data: data || [],
        error: null,
        count: data?.length || 0,
      }
    } catch (error) {
      const msg = String(error?.message || error || '').toLowerCase()
      if (msg.includes('notification_outbox') && msg.includes('could not find the table')) {
        disableNotificationOutboxCapability()
        return { data: [], error: null, count: 0 }
      }
      console.warn('[notify] getPendingSMSNotifications failed:', error?.message || error)
      return { data: [], error: 'Failed to load pending notifications', count: 0 }
    }
  },

  // Get combined notification count
  async getNotificationCount(userId, opts = {}) {
    try {
      const [communications, pendingSMS] = await Promise.all([
        this.getNotifications(userId, opts),
        this.getPendingSMSNotifications(opts),
      ])

      const totalCount = (communications?.count || 0) + (pendingSMS?.count || 0)

      return { count: totalCount, error: null }
    } catch (error) {
      console.warn('[notify] getNotificationCount failed:', error?.message || error)
      return { count: 0, error: 'Failed to load notification count' }
    }
  },

  // Subscribe to real-time notification updates
  subscribeToNotifications(userId, callback) {
    if (!userId || !callback) return null

    try {
      const channel = supabase?.channel?.('notifications')
      if (!channel?.on) return null

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
        },
        () => {
          // Refresh notifications when communications change
          this.getNotificationCount(userId)?.then(callback)
        }
      )

      const service = this
      ;(async () => {
        // Only subscribe to outbox changes if the table is verified for this session.
        // (If the table is missing, getPendingSMSNotifications will disable the capability.)
        if (NOTIFICATION_OUTBOX_TABLE_AVAILABLE !== false) {
          await service.getPendingSMSNotifications()

          if (NOTIFICATION_OUTBOX_TABLE_AVAILABLE !== false) {
            channel.on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'notification_outbox',
              },
              () => {
                // Refresh notifications when SMS outbox changes
                service.getNotificationCount(userId)?.then(callback)
              }
            )
          }
        }

        channel?.subscribe?.()
      })()

      // Return a cleanup function (awaitable) to avoid leaking realtime subscriptions.
      return async () => {
        await this.unsubscribeFromNotifications(channel)
      }
    } catch (error) {
      console.warn('Failed to subscribe to notifications:', error)
      return null
    }
  },

  // Unsubscribe from notifications
  async unsubscribeFromNotifications(subscription) {
    try {
      if (!subscription) return

      // New contract: subscription may be a cleanup function
      if (typeof subscription === 'function') {
        await subscription()
        return
      }

      // For Supabase Realtime v2 channels, removing the channel is the canonical teardown.
      // Prefer `removeChannel` and only fall back to `channel.unsubscribe` when unavailable.
      if (typeof supabase?.removeChannel === 'function') {
        await supabase.removeChannel(subscription)
        return
      }

      if (typeof subscription?.unsubscribe === 'function') {
        await subscription.unsubscribe()
      }
    } catch (error) {
      console.warn('Failed to unsubscribe from notifications:', error)
    }
  },
}
