/**
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
