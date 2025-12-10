/**
 * Drizzle ORM Schema Definitions
 * 
 * This file mirrors the Supabase schema for type safety and validation.
 * It is NOT used to modify the database schema directly.
 * All schema changes must go through Supabase migrations.
 * 
 * See Section 20.2 of .github/copilot-instructions.md
 */

import {
  pgTable,
  uuid,
  text,
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
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  specialty: text('specialty'),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  orgId: uuid('org_id'), // Added in migration 20251106120000_add_missing_org_id_columns.sql
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
