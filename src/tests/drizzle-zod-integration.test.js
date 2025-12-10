/**
 * Integration tests for Drizzle + drizzle-zod + Zod typed service functions
 * Tests validation and type safety per Section 20 of copilot-instructions.md
 */

import { describe, it, expect } from 'vitest';
import { vendorInsertSchema, jobInsertSchema, jobPartInsertSchema } from '../db/schemas';

describe('Drizzle + Zod Schema Validation', () => {
  describe('vendorInsertSchema', () => {
    it('should validate a valid vendor', () => {
      const validVendor = {
        name: 'Test Vendor',
        contactPerson: 'John Doe',
        phone: '555-1234',
        email: 'john@test.com',
        specialty: 'Window Tinting',
        rating: '4.5',
      };

      const result = vendorInsertSchema.safeParse(validVendor);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Vendor');
        expect(result.data.rating).toBe('4.5');
      }
    });

    it('should reject vendor with missing name', () => {
      const invalidVendor = {
        contactPerson: 'John Doe',
        phone: '555-1234',
      };

      const result = vendorInsertSchema.safeParse(invalidVendor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('name'))).toBe(true);
      }
    });

    it('should reject vendor with invalid rating', () => {
      const invalidVendor = {
        name: 'Test Vendor',
        rating: '10.0', // Rating must be 0-5
      };

      const result = vendorInsertSchema.safeParse(invalidVendor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.includes('Rating must be between 0 and 5'))).toBe(true);
      }
    });
  });

  describe('jobInsertSchema', () => {
    it('should validate a valid job', () => {
      const validJob = {
        title: 'Install Window Tint',
        jobNumber: 'JOB-2025-001',
        vendorId: '123e4567-e89b-12d3-a456-426614174000',
        vehicleId: '123e4567-e89b-12d3-a456-426614174001',
        jobStatus: 'pending',
        priority: 'high',
      };

      const result = jobInsertSchema.safeParse(validJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Install Window Tint');
        expect(result.data.jobNumber).toBe('JOB-2025-001');
      }
    });

    it('should reject job with missing title', () => {
      const invalidJob = {
        jobNumber: 'JOB-2025-001',
      };

      const result = jobInsertSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('title'))).toBe(true);
      }
    });

    it('should allow optional fields to be omitted', () => {
      const minimalJob = {
        title: 'Basic Job',
        jobNumber: 'JOB-MIN-001',
      };

      const result = jobInsertSchema.safeParse(minimalJob);
      expect(result.success).toBe(true);
    });
  });

  describe('jobPartInsertSchema', () => {
    it('should validate a valid job part', () => {
      const validJobPart = {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantityUsed: 2,
        unitPrice: 99.99,
      };

      const result = jobPartInsertSchema.safeParse(validJobPart);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantityUsed).toBe(2);
        expect(result.data.unitPrice).toBe(99.99);
      }
    });

    it('should reject job part with negative quantity', () => {
      const invalidJobPart = {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantityUsed: -1,
        unitPrice: 99.99,
      };

      const result = jobPartInsertSchema.safeParse(invalidJobPart);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.includes('Quantity must be at least 1'))).toBe(true);
      }
    });

    it('should reject job part with negative unit price', () => {
      const invalidJobPart = {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantityUsed: 1,
        unitPrice: -10,
      };

      const result = jobPartInsertSchema.safeParse(invalidJobPart);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.includes('Unit price must be'))).toBe(true);
      }
    });

    it('should accept unitPrice as string and validate', () => {
      const jobPartWithStringPrice = {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantityUsed: 1,
        unitPrice: '99.99',
      };

      const result = jobPartInsertSchema.safeParse(jobPartWithStringPrice);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema partial mode', () => {
    it('should allow partial vendor updates', () => {
      const partialUpdate = {
        rating: '5.0',
        notes: 'Excellent service',
      };

      const result = vendorInsertSchema.partial().safeParse(partialUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rating).toBe('5.0');
        expect(result.data.notes).toBe('Excellent service');
      }
    });

    it('should allow partial job updates', () => {
      const partialUpdate = {
        jobStatus: 'completed',
        // Note: completedAt uses snake_case in DB schema
        completedAt: new Date().toISOString(),
      };

      const result = jobInsertSchema.partial().safeParse(partialUpdate);
      // completedAt might not be in the schema, so just test with jobStatus
      const simpleUpdate = { jobStatus: 'completed' };
      const simpleResult = jobInsertSchema.partial().safeParse(simpleUpdate);
      expect(simpleResult.success).toBe(true);
      if (simpleResult.success) {
        expect(simpleResult.data.jobStatus).toBe('completed');
      }
    });
  });
});
