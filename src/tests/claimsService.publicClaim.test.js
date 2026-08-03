import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { claimsService } from '@/services/claimsService'

describe('claimsService public guest-claim RPCs', () => {
  let originalFrom
  let originalRpc

  beforeEach(() => {
    originalFrom = supabase.from
    originalRpc = supabase.rpc
    supabase.from = vi.fn()
    supabase.rpc = vi.fn()
  })

  afterEach(() => {
    supabase.from = originalFrom
    supabase.rpc = originalRpc
    vi.restoreAllMocks()
  })

  it('loads the public product catalog through the tenant-scoped RPC only', async () => {
    const products = [
      {
        id: 'product-1',
        name: 'Protection',
        brand: 'Rocket',
        category: 'Warranty',
        unit_price: 99,
        dealer_id: 'must-not-reach-the-browser',
      },
    ]
    supabase.rpc.mockResolvedValue({ data: products, error: null })

    await expect(claimsService.getPublicClaimProducts()).resolves.toEqual([
      {
        id: 'product-1',
        name: 'Protection',
        brand: 'Rocket',
        category: 'Warranty',
        unit_price: 99,
      },
    ])

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('get_public_claim_products')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('maps guest form data to one submit RPC and returns only the safe receipt', async () => {
    const receipt = {
      id: 'claim-1',
      claim_number: 'CLM-12345',
      customer_name: 'Taylor Customer',
      status: 'submitted',
      created_at: '2026-08-02T00:00:00.000Z',
      dealer_id: 'must-not-reach-the-browser',
      internal_note: 'must-not-reach-the-browser',
    }
    supabase.rpc.mockResolvedValue({ data: receipt, error: null })

    await expect(
      claimsService.createPublicClaim({
        customer_name: 'Taylor Customer',
        customer_email: 'taylor@example.com',
        customer_phone: '757-555-0100',
        product_id: 'product-1',
        issue_description: 'The product needs attention.',
        preferred_resolution: 'Repair',
        priority: 'high',
        status: 'submitted',
        dealer_id: 'attacker-controlled-value',
      })
    ).resolves.toEqual({
      id: 'claim-1',
      claim_number: 'CLM-12345',
      customer_name: 'Taylor Customer',
      status: 'submitted',
      created_at: '2026-08-02T00:00:00.000Z',
    })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('submit_guest_claim', {
      p_customer_name: 'Taylor Customer',
      p_customer_email: 'taylor@example.com',
      p_customer_phone: '757-555-0100',
      p_product_id: 'product-1',
      p_issue_description: 'The product needs attention.',
      p_preferred_resolution: 'Repair',
      p_priority: 'high',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('rejects malformed RPC receipts without issuing a follow-up table query', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'claim-1' }, error: null })

    await expect(
      claimsService.createPublicClaim({
        customer_name: 'Taylor Customer',
        customer_email: 'taylor@example.com',
        customer_phone: '757-555-0100',
        product_id: null,
        issue_description: 'The product needs attention.',
        preferred_resolution: 'Repair',
        priority: 'medium',
      })
    ).rejects.toThrow('Failed to submit claim. Please try again.')

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('keeps direct table access out of the public guest-claim methods', async () => {
    const serviceSource = await import.meta.glob('../services/claimsService.js', {
      eager: true,
      query: '?raw',
      import: 'default',
    })

    const source = Object.values(serviceSource)[0]
    const publicMethods = source.slice(
      source.indexOf('async getPublicClaimProducts()'),
      source.indexOf('// Get all claims with vehicle and product details')
    )

    expect(publicMethods).toContain("rpc('get_public_claim_products')")
    expect(publicMethods).toContain("rpc('submit_guest_claim'")
    expect(publicMethods).not.toContain("from('products')")
    expect(publicMethods).not.toContain("from('claims')")
    expect(publicMethods).not.toContain('generate_claim_number')
  })
})
