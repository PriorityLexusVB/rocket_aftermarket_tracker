import { describe, it, expect } from 'vitest'

const shouldReportHandles = process.env.VITEST_DEBUG_OPEN_HANDLES === 'true'

describe('open handles debug', () => {
  it('reports active handles when explicitly enabled', () => {
    if (!shouldReportHandles) {
      return
    }

    const handles = typeof process._getActiveHandles === 'function' ? process._getActiveHandles() : []
    const requests =
      typeof process._getActiveRequests === 'function' ? process._getActiveRequests() : []

    const handleTypes = handles.map((handle) => handle?.constructor?.name || typeof handle)
    const maybeRealtimeHandles = handleTypes.filter((type) =>
      String(type || '').toLowerCase().includes('websocket')
    )

    console.log('[vitest-debug] open handles', {
      handles: handles.length,
      requests: requests.length,
      handleTypes,
      realtimeLike: maybeRealtimeHandles,
    })

    expect(handleTypes.length).toBe(handles.length)
    expect(requests.length).toBeGreaterThanOrEqual(0)
  })
})
