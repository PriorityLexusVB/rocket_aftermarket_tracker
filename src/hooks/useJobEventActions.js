// src/hooks/useJobEventActions.js
// Pure logic hook providing scheduling-related action handlers.
// Side-effects (navigation, service calls) are delegated to injected callbacks.
import { useCallback } from 'react'
import { validateScheduleRange } from '@/utils/dateTimeUtils'

/**
 * @param {Object} opts
 * @param {(jobId:string)=>void} opts.onOpenDeal
 * @param {(jobId:string)=>void} opts.onReschedule
 * @param {(jobId:string)=>Promise<void>} opts.onComplete
 * @param {(jobId:string)=>Promise<void>} opts.onUndoComplete
 * @returns {{ handleOpenDeal, handleReschedule, handleComplete, handleUndoComplete, validateRange }}
 */
export default function useJobEventActions(opts = {}) {
  const {
    onOpenDeal = () => console.warn('[useJobEventActions] onOpenDeal not provided'),
    onReschedule = () => console.warn('[useJobEventActions] onReschedule not provided'),
    onComplete = async () => console.warn('[useJobEventActions] onComplete not provided'),
    onUndoComplete = async () => console.warn('[useJobEventActions] onUndoComplete not provided'),
  } = opts

  const handleOpenDeal = useCallback(
    (jobId) => {
      if (!jobId) return console.warn('[useJobEventActions] Missing jobId for open')
      onOpenDeal(jobId)
    },
    [onOpenDeal]
  )

  const handleReschedule = useCallback(
    (jobId) => {
      if (!jobId) return console.warn('[useJobEventActions] Missing jobId for reschedule')
      onReschedule(jobId)
    },
    [onReschedule]
  )

  const handleComplete = useCallback(
    async (jobId) => {
      if (!jobId) return console.warn('[useJobEventActions] Missing jobId for complete')
      await onComplete(jobId)
    },
    [onComplete]
  )

  const handleUndoComplete = useCallback(
    async (jobId) => {
      if (!jobId) return console.warn('[useJobEventActions] Missing jobId for undo')
      await onUndoComplete(jobId)
    },
    [onUndoComplete]
  )

  const validateRange = useCallback(
    (startIso, endIso) => validateScheduleRange(startIso, endIso),
    []
  )

  return { handleOpenDeal, handleReschedule, handleComplete, handleUndoComplete, validateRange }
}
