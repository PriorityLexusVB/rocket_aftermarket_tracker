/**
 * Zod schemas generated from Drizzle tables
 *
 * These schemas are used for:
 * - Form validation with react-hook-form + zodResolver
 * - Type-safe Supabase inserts/updates
 * - Runtime data validation
 *
 * Reference: .github/copilot-instructions.md Section 20.3–20.4
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { jobs, jobParts, vendors } from './schema';

// ============================================================================
// VENDORS
// ============================================================================

// Base schemas generated from Drizzle
const baseVendorInsertSchema = createInsertSchema(vendors, {
  name: z.string().min(1, 'Vendor name is required'),
});

const baseVendorSelectSchema = createSelectSchema(vendors);

// Vendor Insert Schema with enhanced validation
export const vendorInsertSchema = baseVendorInsertSchema
  .extend({
    // Rating: allow string/number/empty -> normalize to number|null, 0–5
    rating: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return null;
        const num = typeof val === 'number' ? val : parseFloat(val);
        return Number.isNaN(num) ? null : num;
      })
      .refine(
        (val) => val === null || (val >= 0 && val <= 5),
        'Rating must be between 0 and 5'
      ),

    // Email: optional, but must be valid if non-empty
    email: z
      .union([z.literal(''), z.string().email('Invalid email address')])
      .optional(),
  })
  .omit({
    // Remove fields that are auto-generated or system-managed
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  });

export const vendorSelectSchema = baseVendorSelectSchema;

export type VendorInsert = z.infer<typeof vendorInsertSchema>;
export type Vendor = z.infer<typeof vendorSelectSchema>;

// ============================================================================
// JOBS
// ============================================================================

export const jobInsertSchema = createInsertSchema(jobs, {
  // Custom refinements
  title: z.string().min(1, 'Job title is required'),
  jobNumber: z.string().min(1, 'Job number is required'),

  // These are deprecated in favor of job_parts scheduling,
  // but kept here for compatibility with existing UI.
  scheduledStartTime: z
    .string()
    .optional()
    .describe('[DEPRECATED] Use job_parts scheduled times'),
  scheduledEndTime: z
    .string()
    .optional()
    .describe('[DEPRECATED] Use job_parts scheduled times'),
});

export const jobSelectSchema = createSelectSchema(jobs);

export type JobInsert = z.infer<typeof jobInsertSchema>;
export type Job = z.infer<typeof jobSelectSchema>;

// ============================================================================
// JOB PARTS
// ============================================================================

export const jobPartInsertSchema = createInsertSchema(jobParts, {
  // Custom refinements
  quantityUsed: z
    .number()
    .int()
    .min(1, 'Quantity must be at least 1'),
  unitPrice: z
    .coerce
    .number()
    .min(0, 'Unit price must be non-negative'),
});

export const jobPartSelectSchema = createSelectSchema(jobParts);

export type JobPartInsert = z.infer<typeof jobPartInsertSchema>;
export type JobPart = z.infer<typeof jobPartSelectSchema>;
