/**
<<<<<<< HEAD
 * Drizzle ORM Schema Definitions
 * 
 * This file mirrors the Supabase schema for type safety and validation.
 * It is NOT used to modify the database schema directly.
 * All schema changes must go through Supabase migrations.
 * 
 * See Section 20.2 of .github/copilot-instructions.md
=======
 * Drizzle ORM schema definitions for Supabase tables
 * 
 * IMPORTANT: This file is for TYPE DEFINITIONS ONLY
 * - Do NOT use Drizzle to change production schema (no drizzle-kit push)
 * - All real schema changes must go through supabase/migrations
 * - These definitions must match the current Supabase schema exactly
 * 
 * Reference: .github/copilot-instructions.md Section 20
>>>>>>> main
 */

import {
  pgTable,
  uuid,
  text,
<<<<<<< HEAD
  boolean,
  decimal,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Vendors table definition
 * Mirrors: supabase/migrations/20250922170950_automotive_aftermarket_system.sql
 */
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
=======
  integer,
  decimal,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Vendors table
 * Multi-tenant via org_id
 */
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
>>>>>>> main
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  specialty: text('specialty'),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
<<<<<<< HEAD
  orgId: uuid('org_id'), // Added in migration 20251106120000_add_missing_org_id_columns.sql
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
=======
  orgId: uuid('org_id'), // Added in migration 20251106120000
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Jobs table
 * Multi-tenant via org_id
 * Scheduled times are DEPRECATED - use job_parts scheduled times instead
 */
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text('job_number').notNull().unique(),
  vehicleId: uuid('vehicle_id'),
  assignedTo: uuid('assigned_to'),
  vendorId: uuid('vendor_id'),
  title: text('title').notNull(),
  description: text('description'),
  jobStatus: text('job_status').default('pending'),
  priority: text('priority').default('medium'),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  // Calendar scheduling fields (DEPRECATED - see migration 20250923142511_calendar_scheduling_enhancement.sql)
  scheduledStartTime: timestamp('scheduled_start_time', { withTimezone: true }),
  scheduledEndTime: timestamp('scheduled_end_time', { withTimezone: true }),
  calendarNotes: text('calendar_notes'),
  isRecurring: boolean('is_recurring').default(false),
  recurrencePattern: text('recurrence_pattern'),
  location: text('location'),
  colorCode: text('color_code').default('#3b82f6'),
  // Multi-tenant
  orgId: uuid('org_id'), // Added in migration 20251022180000
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Job Parts junction table
 * Links jobs to products with quantity and pricing
 * Inherits org from parent job (no direct org_id)
 */
export const jobParts = pgTable('job_parts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid('job_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantityUsed: integer('quantity_used').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  // totalPrice is a GENERATED ALWAYS column in Supabase - not included here as Drizzle doesn't support generated columns well
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
>>>>>>> main
