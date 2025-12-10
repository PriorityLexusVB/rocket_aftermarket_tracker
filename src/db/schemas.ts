/**
 * Zod Schemas Generated from Drizzle Tables
 * 
 * These schemas are used for form validation with react-hook-form.
 * They are automatically generated from Drizzle table definitions.
 * 
 * See Section 20.3 of .github/copilot-instructions.md
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { vendors } from './schema'
import { z } from 'zod'

// Base schemas generated from Drizzle
const baseVendorInsertSchema = createInsertSchema(vendors)
const baseVendorSelectSchema = createSelectSchema(vendors)

// Vendor Insert Schema with custom validations
export const vendorInsertSchema = baseVendorInsertSchema
  .extend({
    // Override rating validation to allow empty string or valid number
    rating: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val === '') return null
        const num = parseFloat(val)
        return isNaN(num) ? null : num
      })
      .refine(
        (val) => val === null || (val >= 0 && val <= 5),
        'Rating must be between 0 and 5'
      )
      .or(z.null())
      .optional(),
    // Name is required
    name: z.string().min(1, 'Vendor name is required'),
    // Email validation (optional but must be valid if provided)
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
  })
  .omit({
    // Remove fields that are auto-generated or set by the system
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })

// Vendor Select Schema (for reading from DB)
export const vendorSelectSchema = baseVendorSelectSchema

// TypeScript types derived from schemas
export type VendorInsert = z.infer<typeof vendorInsertSchema>
export type Vendor = z.infer<typeof vendorSelectSchema>
