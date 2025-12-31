import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { vehicleService } from '@/services/vehicleService'
import { supabase } from '@/lib/supabase'

describe('vehicleService.updateVehicle - RLS/no-op verification', () => {
  let fromSpy

  beforeEach(() => {
    fromSpy = vi.spyOn(supabase, 'from')
  })

  afterEach(() => {
    fromSpy?.mockRestore?.()
  })

  it('returns a clear error when vehicle update is blocked by RLS (0 rows affected)', async () => {
    const vehicleId = 'veh-1'

    // vehicles update -> returns 0 rows (RLS/no-op)
    const vUpdateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const vUpdateSelect = vi.fn(() => ({ maybeSingle: vUpdateMaybeSingle }))
    const vUpdateEq = vi.fn(() => ({ select: vUpdateSelect }))
    const vUpdate = vi.fn(() => ({ eq: vUpdateEq }))

    // vehicles follow-up select -> confirms row exists
    const vCheckLimit = vi.fn().mockResolvedValue({ data: [{ id: vehicleId }], error: null })
    const vCheckEq = vi.fn(() => ({ limit: vCheckLimit }))
    const vCheckSelect = vi.fn(() => ({ eq: vCheckEq }))

    fromSpy.mockImplementation((table) => {
      if (table === 'vehicles') {
        return {
          update: vUpdate,
          select: vCheckSelect,
        }
      }

      return {}
    })

    const res = await vehicleService.updateVehicle(vehicleId, { make: 'Toyota' })

    expect(res?.data).toBe(null)
    expect(res?.error?.message).toBe('Update was blocked by permissions (RLS).')

    expect(fromSpy).toHaveBeenCalledWith('vehicles')
    expect(vUpdate).toHaveBeenCalledTimes(1)
    expect(vUpdateMaybeSingle).toHaveBeenCalledTimes(1)
    expect(vCheckLimit).toHaveBeenCalledTimes(1)
  })
})
