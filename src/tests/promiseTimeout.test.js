import { describe, expect, it, vi } from 'vitest'
import { withTimeout } from '@/utils/promiseTimeout'

describe('withTimeout', () => {
  it('resolves when the promise resolves before the timeout', async () => {
    vi.useFakeTimers()
    try {
      const p = new Promise((resolve) => {
        setTimeout(() => resolve('ok'), 10)
      })

      const wrapped = withTimeout(p, 100, { label: 'test' })
      const assertion = expect(wrapped).resolves.toBe('ok')

      await vi.advanceTimersByTimeAsync(10)
      await Promise.resolve()
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects with TimeoutError when the promise does not resolve in time', async () => {
    vi.useFakeTimers()
    try {
      const never = new Promise(() => {})
      const wrapped = withTimeout(never, 50, { label: 'test op' })
      const assertion = expect(wrapped).rejects.toMatchObject({ name: 'TimeoutError' })

      await vi.advanceTimersByTimeAsync(51)
      await Promise.resolve()
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
