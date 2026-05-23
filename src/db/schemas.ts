/**
 * Zod schemas for Supabase table inserts/selects
 *
 * Hand-written to match the Drizzle table definitions in schema.ts without
 * pulling drizzle-orm or drizzle-zod into the browser bundle.
 *
 * These schemas are used for:
 * - Form validation with react-hook-form + zodResolver
 * - Type-safe Supabase inserts/updates
 * - Runtime data validation
 *
 * Reference: .github/copilot-instructions.md Section 20.3–20.4
 */

import { z } from 'zod'

const POSTGRES_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// VENDORS
// ============================================================================

export const vendorInsertSchema = z
  .object({
    name: z.string().min(1, 'Vendor name is required'),
    contactPerson: z.string().optional(),
    email: z.union([z.literal(''), z.string().email('Invalid email address')]).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    specialty: z.string().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
    orgId: z
      .union([z.literal(''), z.string().regex(POSTGRES_UUID_REGEX, 'Invalid UUID'), z.null()])
      .optional()
      .transform((val) => (val === '' ? null : val)),
    rating: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return null
        const num = typeof val === 'number' ? val : parseFloat(val as string)
        return Number.isNaN(num) ? null : num
      })
      .refine((val) => val === null || (val >= 0 && val <= 5), 'Rating must be between 0 and 5'),
  })

export const vendorSelectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactPerson: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

export type VendorInsert = z.infer<typeof vendorInsertSchema>
export type Vendor = z.infer<typeof vendorSelectSchema>

// ============================================================================
// JOBS
// ============================================================================

export const jobInsertSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  jobNumber: z.string().min(1, 'Job number is required'),
  vehicleId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  description: z.string().optional(),
  jobStatus: z.string().optional(),
  priority: z.string().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  estimatedHours: z.number().int().optional(),
  actualHours: z.number().int().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  // Deprecated fields kept for UI compatibility
  scheduledStartTime: z.string().optional().describe('[DEPRECATED] Use job_parts scheduled times'),
  scheduledEndTime: z.string().optional().describe('[DEPRECATED] Use job_parts scheduled times'),
  calendarNotes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.string().optional(),
  location: z.string().optional(),
  colorCode: z.string().optional(),
  orgId: z.string().uuid().optional(),
})

export const jobSelectSchema = z.object({
  id: z.string().uuid(),
  jobNumber: z.string(),
  vehicleId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  jobStatus: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  estimatedCost: z.number().nullable().optional(),
  actualCost: z.number().nullable().optional(),
  estimatedHours: z.number().int().nullable().optional(),
  actualHours: z.number().int().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  scheduledStartTime: z.coerce.date().nullable().optional(),
  scheduledEndTime: z.coerce.date().nullable().optional(),
  calendarNotes: z.string().nullable().optional(),
  isRecurring: z.boolean().nullable().optional(),
  recurrencePattern: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  colorCode: z.string().nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

export type JobInsert = z.infer<typeof jobInsertSchema>
export type Job = z.infer<typeof jobSelectSchema>

// ============================================================================
// JOB PARTS
// ============================================================================

export const jobPartInsertSchema = z.object({
  jobId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityUsed: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
})

export const jobPartSelectSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityUsed: z.number().int(),
  unitPrice: z.number(),
  createdAt: z.coerce.date().nullable().optional(),
})

export type JobPartInsert = z.infer<typeof jobPartInsertSchema>
export type JobPart = z.infer<typeof jobPartSelectSchema>

// ============================================================================
// DEAL OPPORTUNITIES
// ============================================================================

export const dealOpportunityStatusSchema = z.enum(['open', 'accepted', 'declined'])

export const dealOpportunityInsertSchema = z
  .object({
    dealerId: z.string().uuid(),
    jobId: z.string().uuid(),
    productId: z.string().uuid().optional(),
    name: z.string().min(1, 'Opportunity name is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    status: dealOpportunityStatusSchema.default('open'),
    unitPrice: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return null
        const num = typeof val === 'number' ? val : parseFloat(val as string)
        return Number.isNaN(num) ? null : num
      })
      .refine((val) => val === null || val >= 0, 'Unit price must be non-negative'),
    declineReason: z.union([z.literal(''), z.string()]).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === 'declined') {
      const reason = String(val.declineReason ?? '').trim()
      if (!reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['declineReason'],
          message: 'Decline reason is required when declined',
        })
      }
    }
  })

export const dealOpportunitySelectSchema = z.object({
  id: z.string().uuid(),
  dealerId: z.string().uuid(),
  jobId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  name: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number().nullable().optional(),
  status: z.string(),
  declineReason: z.string().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  decidedAt: z.coerce.date().nullable().optional(),
})

export type DealOpportunityInsert = z.infer<typeof dealOpportunityInsertSchema>
export type DealOpportunity = z.infer<typeof dealOpportunitySelectSchema>
