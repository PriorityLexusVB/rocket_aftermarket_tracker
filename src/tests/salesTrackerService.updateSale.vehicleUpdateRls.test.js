import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import salesTrackerService from '@/services/salesTrackerService'
import { supabase } from '@/lib/supabase'

describe('salesTrackerService.updateSale - vehicle update RLS verification', () => {
  let fromSpy

  beforeEach(() => {
    fromSpy = vi.spyOn(supabase, 'from')
  })

  afterEach(() => {
    fromSpy?.mockRestore?.()
  })

  it('throws a clear error when vehicle update is blocked by RLS (0 rows affected)', async () => {
    const saleId = 'sale-123'
    const vehicleId = 'veh-1'

    const currentTransaction = {
      id: saleId,
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      customer_phone: '555-1111',
      total_amount: 100,
      transaction_status: 'pending',
      jobs: {
        vehicle_id: vehicleId,
        vehicles: {
          id: vehicleId,
          year: 2020,
          make: 'Toyota',
          model: 'Camry',
          color: 'Blue',
          stock_number: 'STK-1',
        },
      },
    }

    // transactions select (currentTransaction)
    const txSelectSingle = vi.fn().mockResolvedValue({ data: currentTransaction, error: null })
    const txSelectEq = vi.fn(() => ({ single: txSelectSingle }))
    const txSelect = vi.fn(() => ({ eq: txSelectEq }))

    // transactions update (updatedTransaction)
    const updatedTransactionRow = { id: saleId, updated_at: '2025-12-30T00:00:00.000Z' }
    const txUpdateSingle = vi.fn().mockResolvedValue({ data: updatedTransactionRow, error: null })
    const txUpdateSelect = vi.fn(() => ({ single: txUpdateSingle }))
    const txUpdateEq = vi.fn(() => ({ select: txUpdateSelect }))
    const txUpdate = vi.fn(() => ({ eq: txUpdateEq }))

    // vehicles update -> returns 0 rows (RLS/no-op)
    const vUpdateSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const vUpdateEq = vi.fn(() => ({ select: vUpdateSelect }))
    const vUpdate = vi.fn(() => ({ eq: vUpdateEq }))

    // vehicles follow-up select -> confirms row exists
    const vCheckLimit = vi.fn().mockResolvedValue({ data: [{ id: vehicleId }], error: null })
    const vCheckEq = vi.fn(() => ({ limit: vCheckLimit }))
    const vCheckSelect = vi.fn(() => ({ eq: vCheckEq }))

    fromSpy.mockImplementation((table) => {
      if (table === 'transactions') {
        return {
          select: txSelect,
          update: txUpdate,
        }
      }

      if (table === 'vehicles') {
        return {
          update: vUpdate,
          select: vCheckSelect,
        }
      }

      return {}
    })

    await expect(
      salesTrackerService.updateSale(saleId, {
        year: 2021,
        make: 'Toyota',
        model: 'Camry',
        color: 'Red',
      })
    ).rejects.toThrow('Vehicle update was blocked by permissions (RLS).')

    expect(fromSpy).toHaveBeenCalledWith('vehicles')
    expect(vUpdate).toHaveBeenCalledTimes(1)
    expect(vUpdateSelect).toHaveBeenCalledTimes(1)
    expect(vCheckLimit).toHaveBeenCalledTimes(1)
  })
})
