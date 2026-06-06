// Wave XXX-AH: hook for the navbar New Claims pill.
// Tracks count of status='submitted' claims + whether a new one has arrived
// since the user's last visit to /claims-management-center.
//
// Returns:
//   count           — number of submitted claims (always reflects DB truth)
//   shouldPulse     — true if latest claim created_at > user's lastSeenIso
//   markAsSeen()    — call after the user visits claims page; clears pulse
//
// Last-seen is persisted per-user in localStorage so it survives reloads.
import { useCallback, useEffect, useRef, useState } from 'react'
import { claimsService } from '@/services/claimsService'

const LS_KEY_PREFIX = 'rocket:claims:lastSeen:'

const readLastSeen = (userId) => {
  if (!userId) return null
  try {
    return window?.localStorage?.getItem?.(LS_KEY_PREFIX + userId) || null
  } catch {
    return null
  }
}

const writeLastSeen = (userId, iso) => {
  if (!userId) return
  try {
    window?.localStorage?.setItem?.(LS_KEY_PREFIX + userId, iso)
  } catch {
    /* localStorage unavailable — ignore, pulse will just keep showing */
  }
}

/**
 * @param {{userId?: string, enabled?: boolean}} opts
 */
export function useNewClaimsBadge({ userId, enabled = true } = {}) {
  const [count, setCount] = useState(0)
  const [latestCreatedAt, setLatestCreatedAt] = useState(null)
  const [lastSeen, setLastSeen] = useState(() => readLastSeen(userId))
  // Debounce realtime refetches so a burst of inserts only triggers one query.
  const refetchTimerRef = useRef(null)

  const refetch = useCallback(async () => {
    if (!enabled) return
    const { count, latestCreatedAt } = await claimsService.getNewClaimsCount()
    setCount(count)
    setLatestCreatedAt(latestCreatedAt)
  }, [enabled])

  // Refresh lastSeen if userId switches (login/logout)
  useEffect(() => {
    setLastSeen(readLastSeen(userId))
  }, [userId])

  // Initial fetch
  useEffect(() => {
    if (!enabled) return
    refetch()
  }, [enabled, refetch])

  // Realtime subscription — debounce 400ms so a burst of inserts collapses
  useEffect(() => {
    if (!enabled) return
    const unsubscribe = claimsService.subscribeToClaims(() => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      refetchTimerRef.current = setTimeout(() => {
        refetch()
      }, 400)
    })
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      unsubscribe?.()
    }
  }, [enabled, refetch])

  const markAsSeen = useCallback(() => {
    const nowIso = new Date().toISOString()
    setLastSeen(nowIso)
    writeLastSeen(userId, nowIso)
  }, [userId])

  // Pulse when there's at least 1 submitted claim AND the latest one is newer
  // than what the user has already seen. If lastSeen is null (first visit),
  // pulse whenever count > 0 so brand-new users see the cue immediately.
  const shouldPulse =
    count > 0 &&
    (lastSeen == null ||
      (latestCreatedAt != null && new Date(latestCreatedAt) > new Date(lastSeen)))

  return {
    count,
    shouldPulse,
    markAsSeen,
    refetch,
  }
}

export default useNewClaimsBadge
