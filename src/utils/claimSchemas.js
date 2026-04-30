// src/utils/claimSchemas.js
// Centralized Zod schemas for form validations across claims and deals

import { z } from 'zod'

/**
 * VIN Schema
 * - Must not be empty
 * - Must be exactly 17 characters
 * - Alphanumeric excluding I, O, Q (to avoid confusion with 1, 0)
 *
 * Order matters: required check runs first via min(1). Format checks use
 * refine() so they only execute after the required check passes, preventing
 * the IOQ error from firing on an empty submit.
 */
export const vinSchema = z
  .string()
  .min(1, 'VIN is required')
  .refine((v) => /^[A-Z0-9]+$/i.test(v), 'VIN must be alphanumeric')
  .refine((v) => !/[IOQ]/i.test(v), 'VIN cannot contain I, O, or Q')
  .refine((v) => v.length === 17, 'VIN must be exactly 17 characters')

/**
 * Guest Claim Schema
 * Complete validation for the guest warranty claims submission form
 */
export const guestClaimSchema = z
  .object({
    customer_name: z
      .string()
      .min(1, 'Customer name is required')
      .transform((val) => val.trim()),
    customer_email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    customer_phone: z
      .string()
      .min(1, 'Phone number is required')
      .transform((val) => val.trim()),
    vehicle_year: z
      .string()
      .min(1, 'Year is required')
      .regex(/^\d{4}$/, 'Enter a valid 4-digit year')
      .refine((val) => {
        const yr = parseInt(val, 10)
        const currentYear = new Date().getFullYear()
        return yr >= 1990 && yr <= currentYear + 1
      }, 'Enter a valid year (e.g. 2022)'),
    vehicle_make: z
      .string()
      .min(1, 'Vehicle make is required')
      .transform((val) => val.trim()),
    vehicle_model: z
      .string()
      .min(1, 'Vehicle model is required')
      .transform((val) => val.trim()),
    vehicle_vin: vinSchema,
    product_selection: z
      .string()
      .min(1, 'Product selection is required')
      .transform((val) => val.trim()),
    other_product_description: z.string().optional(),
    issue_description: z
      .string()
      .min(1, 'Issue description is required')
      .transform((val) => val.trim()),
    preferred_resolution: z
      .string()
      .min(1, 'Preferred resolution is required')
      .transform((val) => val.trim()),
    // Optional fields that may be present in the form
    purchase_date: z.string().optional(),
    comments: z.string().optional(),
    priority: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate other_product_description if "other" is selected
      if (data.product_selection === 'other' && !data.other_product_description?.trim()) {
        return false
      }
      return true
    },
    {
      message: 'Please describe the other product',
      path: ['other_product_description'],
    }
  )

/**
 * Customer Claim Step 1 Schema
 * Validates customer contact information
 */
export const customerClaimStep1Schema = z.object({
  customer_name: z
    .string()
    .min(1, 'Customer name is required')
    .transform((val) => val.trim()),
  customer_email: z
    .string()
    .min(1, 'Customer email is required')
    .email('Please enter a valid email address'),
  customer_phone: z
    .string()
    .min(1, 'Customer phone is required')
    .transform((val) => val.trim()),
  // Allow other fields to pass through without validation
  vehicle_id: z.unknown().optional(),
  product_id: z.unknown().optional(),
  issue_description: z.string().optional(),
  preferred_resolution: z.string().optional(),
  claim_amount: z.unknown().optional(),
  priority: z.unknown().optional(),
})

/**
 * Customer Claim Step 2 Schema
 * Validates vehicle and product selection
 */
export const customerClaimStep2Schema = z.object({
  vehicle_id: z.string().min(1, 'Please select a vehicle'),
  product_id: z.string().min(1, 'Please select a product/service'),
  // Allow other fields to pass through without validation
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  issue_description: z.string().optional(),
  preferred_resolution: z.string().optional(),
  claim_amount: z.unknown().optional(),
  priority: z.unknown().optional(),
})

/**
 * Customer Claim Step 3 Schema
 * Validates issue details
 */
export const customerClaimStep3Schema = z.object({
  issue_description: z
    .string()
    .min(1, 'Issue description is required')
    .transform((val) => val.trim()),
  preferred_resolution: z
    .string()
    .min(1, 'Preferred resolution is required')
    .transform((val) => val.trim()),
  // Allow other fields to pass through without validation
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  vehicle_id: z.unknown().optional(),
  product_id: z.unknown().optional(),
  claim_amount: z.unknown().optional(),
  priority: z.unknown().optional(),
})
