import { supabase } from '@/lib/supabase'

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
      let q = supabase
        ?.from('notification_outbox')
        ?.select('id, status, created_at, message_template, phone_e164')
        ?.eq('status', 'pending')
      if (opts?.orgId) q = q?.eq('dealer_id', opts.orgId)
      const { data } = await q?.order('created_at', { ascending: false })?.limit(5)?.throwOnError()

      return {
        data: data || [],
        error: null,
        count: data?.length || 0,
      }
    } catch (error) {
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

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_outbox',
        },
        () => {
          // Refresh notifications when SMS outbox changes
          this.getNotificationCount(userId)?.then(callback)
        }
      )

      channel?.subscribe?.()
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
