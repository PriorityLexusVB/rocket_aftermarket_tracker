import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuestClaimsSubmissionForm from '../pages/guest-claims-submission-form'

const claimServiceMocks = vi.hoisted(() => ({
  getPublicClaimProducts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../services/claimsService', () => ({
  claimsService: claimServiceMocks,
}))

afterEach(() => {
  cleanup()
  claimServiceMocks.getPublicClaimProducts.mockClear()
})

const controls = [
  ['Full Name', 'guest-claim-customer-name', true],
  ['Email Address', 'guest-claim-customer-email', true],
  ['Phone Number', 'guest-claim-customer-phone', true],
  ['Year', 'guest-claim-vehicle-year', true],
  ['Make', 'guest-claim-vehicle-make', true],
  ['Model', 'guest-claim-vehicle-model', true],
  ['VIN', 'guest-claim-vehicle-vin', true],
  ['Product / Service', 'guest-claim-product-selection', true],
  ['Purchase Date (Optional)', 'guest-claim-purchase-date', false],
  ['Issue Description', 'guest-claim-issue-description', true],
  ['Preferred Resolution', 'guest-claim-preferred-resolution', true],
  ['Comments (Optional)', 'guest-claim-comments', false],
]

describe('GuestClaimsSubmissionForm accessibility', () => {
  it('associates every visible label with a stable control id and preserves required fields', async () => {
    render(<GuestClaimsSubmissionForm />)

    await waitFor(() => expect(claimServiceMocks.getPublicClaimProducts).toHaveBeenCalledTimes(1))

    controls.forEach(([label, id, required]) => {
      const control = screen.getByLabelText(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      expect(control).toHaveAttribute('id', id)
      expect(control.required).toBe(required)
    })
  })

  it('adds an associated required control when Other is selected', async () => {
    render(<GuestClaimsSubmissionForm />)

    await waitFor(() => expect(claimServiceMocks.getPublicClaimProducts).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText(/Product \/ Service/), { target: { value: 'other' } })

    const otherProductDescription = screen.getByLabelText(/Describe the product \/ service/)
    expect(otherProductDescription).toHaveAttribute('id', 'guest-claim-other-product-description')
    expect(otherProductDescription.required).toBe(true)
  })
})
