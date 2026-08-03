import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '@/lib/supabase'
// Import via relative path to avoid the global partial mock in src/tests/setup.ts.
import { deleteDeal } from '../services/dealService.js'

describe('dealService.deleteDeal', () => {
  let originalFrom
  let originalRpc

  beforeEach(() => {
    originalFrom = supabase.from
    originalRpc = supabase.rpc
    supabase.from = vi.fn()
    supabase.rpc = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    supabase.from = originalFrom
    supabase.rpc = originalRpc
  })

  it('rejects missing deal ids before making a request', async () => {
    await expect(deleteDeal(null)).rejects.toThrow('missing deal id')
    await expect(deleteDeal('')).rejects.toThrow('missing deal id')
    await expect(deleteDeal(undefined)).rejects.toThrow('missing deal id')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('uses exactly one atomic RPC and no table deletes on success', async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null })

    await expect(deleteDeal('test-id')).resolves.toBe(true)

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('delete_deal_atomic', { p_job_id: 'test-id' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('maps RPC permission errors without exposing tenant details', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for tenant tenant-secret-id' },
    })

    await expect(deleteDeal('test-id')).rejects.toThrow(
      'You do not have permission to delete deals.'
    )
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('maps RPC not-found errors without exposing tenant details', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'deal not found in tenant tenant-secret-id' },
    })

    await expect(deleteDeal('test-id')).rejects.toThrow(
      'Deal not found or you do not have access to it.'
    )
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('uses a safe general error for unexpected RPC failures', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'tenant tenant-secret-id database failure' },
    })

    await expect(deleteDeal('test-id')).rejects.toThrow('Failed to delete deal. Please try again.')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it.each([false, null, undefined])('rejects a non-true RPC result: %s', async (data) => {
    supabase.rpc.mockResolvedValue({ data, error: null })

    await expect(deleteDeal('test-id')).rejects.toThrow('Failed to delete deal. Please try again.')
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
