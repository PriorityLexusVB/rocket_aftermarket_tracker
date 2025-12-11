/**
<<<<<<< HEAD
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
      ),
    // Name is required
    name: z.string().min(1, 'Vendor name is required'),
    // Email validation (optional but must be valid if provided)
    email: z.union([
      z.literal(''),
      z.string().email('Invalid email address')
    ]).optional(),
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
=======
 * Zod schemas generated from Drizzle tables
 * 
 * These schemas are used for:
 * - Form validation with react-hook-form + zodResolver
 * - Type-safe Supabase inserts/updates
 * - Runtime data validation
 * 
 * Reference: .github/copilot-instructions.md Section 20.3-20.4
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { jobs, jobParts, vendors } from './schema';

// ============================================================================
// VENDORS
// ============================================================================

export const vendorInsertSchema = createInsertSchema(vendors, {
  // Custom refinements if needed
  name: z.string().min(1, 'Vendor name is required'),
  // Rating: coerce string/number input to number, validate range
  rating: z.coerce.number()
    .min(0, 'Rating must be between 0 and 5')
    .max(5, 'Rating must be between 0 and 5')
    .optional(),
});

export const vendorSelectSchema = createSelectSchema(vendors);

export type VendorInsert = z.infer<typeof vendorInsertSchema>;
export type Vendor = z.infer<typeof vendorSelectSchema>;

// ============================================================================
// JOBS
// ============================================================================

export const jobInsertSchema = createInsertSchema(jobs, {
  // Custom refinements
  title: z.string().min(1, 'Job title is required'),
  jobNumber: z.string().min(1, 'Job number is required'),
  scheduledStartTime: z.string().optional().describe('[DEPRECATED] Use job_parts scheduled times'),
  scheduledEndTime: z.string().optional().describe('[DEPRECATED] Use job_parts scheduled times'),
});

export const jobSelectSchema = createSelectSchema(jobs);

export type JobInsert = z.infer<typeof jobInsertSchema>;
export type Job = z.infer<typeof jobSelectSchema>;

// ============================================================================
// JOB PARTS
// ============================================================================

export const jobPartInsertSchema = createInsertSchema(jobParts, {
  // Custom refinements
  quantityUsed: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

export const jobPartSelectSchema = createSelectSchema(jobParts);

export type JobPartInsert = z.infer<typeof jobPartInsertSchema>;
export type JobPart = z.infer<typeof jobPartSelectSchema>;
>>>>>>> main
