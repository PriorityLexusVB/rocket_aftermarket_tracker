// Pure helpers for SnapshotView undo behavior
// Keep side-effect free and easily testable

/**
 * Create an undo metadata entry.
 * @param {string} jobId
 * @param {string} prevStatus
 * @param {any} [timeoutId=null]
 * @returns {{ jobId: string, prevStatus: string, timeoutId: any }}
 */
export function createUndoEntry(jobId, prevStatus, timeoutId = null) {
  return { jobId, prevStatus, timeoutId }
}

/**
 * Check whether a given job can be undone.
 * @param {Map<string, any>} undoMap
 * @param {string} jobId
 * @returns {boolean}
 */
export function canUndo(undoMap, jobId) {
  return !!(undoMap && typeof undoMap.has === 'function' && undoMap.has(jobId))
}
