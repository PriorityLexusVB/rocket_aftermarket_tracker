// tests/unit/claimSchemas.test.js
import { describe, it, expect } from 'vitest'
import {
  vinSchema,
  guestClaimSchema,
  customerClaimStep1Schema,
  customerClaimStep2Schema,
  customerClaimStep3Schema,
} from '../../src/utils/claimSchemas'

describe('vinSchema', () => {
  it('should validate a valid VIN', () => {
    const result = vinSchema.safeParse('1HGBH41JXMN109186')
    expect(result.success).toBe(true)
  })

  it('should reject VIN shorter than 17 characters', () => {
    const result = vinSchema.safeParse('1HGBH41JXMN10918')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('17 characters')
  })

  it('should reject VIN longer than 17 characters', () => {
    const result = vinSchema.safeParse('1HGBH41JXMN1091866')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('17 characters')
  })

  it('should reject VIN containing I, O, or Q', () => {
    const resultI = vinSchema.safeParse('1HGBH41JXMN10918I')
    expect(resultI.success).toBe(false)
    expect(resultI.error?.issues[0]?.message).toContain('cannot contain I, O, or Q')

    const resultO = vinSchema.safeParse('1HGBH41JXMN10918O')
    expect(resultO.success).toBe(false)

    const resultQ = vinSchema.safeParse('1HGBH41JXMN10918Q')
    expect(resultQ.success).toBe(false)
  })

  it('should accept valid VIN with mixed case', () => {
    const result = vinSchema.safeParse('1hgbh41jxmn109186')
    expect(result.success).toBe(true)
  })
})

describe('guestClaimSchema', () => {
  const validFormData = {
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '555-1234',
    vehicle_year: '2020',
    vehicle_make: 'Honda',
    vehicle_model: 'Accord',
    vehicle_vin: '1HGBH41JXMN109186',
    product_selection: 'warranty',
    issue_description: 'Engine issue',
    preferred_resolution: 'Repair',
  }

  it('should validate complete valid form data', () => {
    const result = guestClaimSchema.safeParse(validFormData)
    expect(result.success).toBe(true)
  })

  it('should reject missing required fields', () => {
    const incomplete = { ...validFormData }
    delete incomplete.customer_name

    const result = guestClaimSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('should reject invalid email', () => {
    const invalid = { ...validFormData, customer_email: 'not-an-email' }
    const result = guestClaimSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('valid email')
  })

  it('should reject invalid vehicle year', () => {
    const invalid = { ...validFormData, vehicle_year: '1800' }
    const result = guestClaimSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should require other_product_description when product_selection is "other"', () => {
    const other = { ...validFormData, product_selection: 'other' }
    const result = guestClaimSchema.safeParse(other)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path[0]).toBe('other_product_description')
  })

  it('should accept other_product_description when provided for "other" selection', () => {
    const other = {
      ...validFormData,
      product_selection: 'other',
      other_product_description: 'Custom product',
    }
    const result = guestClaimSchema.safeParse(other)
    expect(result.success).toBe(true)
  })
})

describe('customerClaimStep1Schema', () => {
  it('should validate step 1 fields only', () => {
    const step1Data = {
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      customer_phone: '555-5678',
    }

    const result = customerClaimStep1Schema.safeParse(step1Data)
    expect(result.success).toBe(true)
  })

  it('should reject missing customer_name', () => {
    const incomplete = {
      customer_email: 'jane@example.com',
      customer_phone: '555-5678',
    }

    const result = customerClaimStep1Schema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})

describe('customerClaimStep2Schema', () => {
  it('should validate step 2 fields only', () => {
    const step2Data = {
      vehicle_id: 'vehicle-123',
      product_id: 'product-456',
    }

    const result = customerClaimStep2Schema.safeParse(step2Data)
    expect(result.success).toBe(true)
  })

  it('should reject missing vehicle_id', () => {
    const incomplete = {
      product_id: 'product-456',
    }

    const result = customerClaimStep2Schema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})

describe('customerClaimStep3Schema', () => {
  it('should validate step 3 fields only', () => {
    const step3Data = {
      issue_description: 'Engine makes strange noise',
      preferred_resolution: 'Repair under warranty',
    }

    const result = customerClaimStep3Schema.safeParse(step3Data)
    expect(result.success).toBe(true)
  })

  it('should reject missing issue_description', () => {
    const incomplete = {
      preferred_resolution: 'Repair under warranty',
    }

    const result = customerClaimStep3Schema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})
