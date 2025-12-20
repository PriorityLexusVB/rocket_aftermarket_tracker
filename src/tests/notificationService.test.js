import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockRemoveChannel = vi.fn(async () => ({}))
  const mockChannelUnsubscribe = vi.fn(async () => ({}))
  const mockChannelOn = vi.fn().mockReturnThis()
  const mockChannelSubscribe = vi.fn(async () => ({
    data: { subscription: { state: 'SUBSCRIBED' } },
  }))
  const mockChannel = {
    on: mockChannelOn,
    subscribe: mockChannelSubscribe,
    unsubscribe: mockChannelUnsubscribe,
  }

  return {
    mockRemoveChannel,
    mockChannelUnsubscribe,
    mockChannelOn,
    mockChannelSubscribe,
    mockChannel,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mocks.mockChannel),
    removeChannel: mocks.mockRemoveChannel,
  },
}))

import { notificationService } from '@/services/notificationService'

describe('notificationService subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a cleanup function that tears down the channel safely', async () => {
    const cleanup = notificationService.subscribeToNotifications('user-1', vi.fn())

    expect(typeof cleanup).toBe('function')

    await cleanup()

    expect(mocks.mockChannelUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.mockChannel)
  })

  it('unsubscribeFromNotifications handles functions and channel-like objects without throwing', async () => {
    const cleanupFn = vi.fn()
    await notificationService.unsubscribeFromNotifications(cleanupFn)
    expect(cleanupFn).toHaveBeenCalledTimes(1)

    const channelLike = { channel: true }
    await notificationService.unsubscribeFromNotifications(channelLike)
    expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(channelLike)
  })
})
