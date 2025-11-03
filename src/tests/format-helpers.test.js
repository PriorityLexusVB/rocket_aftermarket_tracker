/**
 * Unit tests for phone formatting helpers
 */
import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, prettyPhone, titleCase } from '../lib/format';

describe('Phone formatting helpers', () => {
  describe('normalizePhoneE164', () => {
    it('should convert 10-digit number to E.164 format', () => {
      expect(normalizePhoneE164('5551234567')).toBe('+15551234567');
      expect(normalizePhoneE164('(555) 123-4567')).toBe('+15551234567');
      expect(normalizePhoneE164('555-123-4567')).toBe('+15551234567');
    });

    it('should handle 11-digit number starting with 1', () => {
      expect(normalizePhoneE164('15551234567')).toBe('+15551234567');
      expect(normalizePhoneE164('1-555-123-4567')).toBe('+15551234567');
    });

    it('should return original string for invalid numbers', () => {
      expect(normalizePhoneE164('123')).toBe('123');
      expect(normalizePhoneE164('abc')).toBe('abc');
    });

    it('should return empty string for empty input', () => {
      expect(normalizePhoneE164('')).toBe('');
      expect(normalizePhoneE164(null)).toBe('');
      expect(normalizePhoneE164(undefined)).toBe('');
    });
  });

  describe('prettyPhone', () => {
    it('should format 10-digit number as (555) 123-4567', () => {
      expect(prettyPhone('5551234567')).toBe('(555) 123-4567');
      expect(prettyPhone('(555) 123-4567')).toBe('(555) 123-4567');
    });

    it('should format 11-digit number starting with 1', () => {
      expect(prettyPhone('15551234567')).toBe('(555) 123-4567');
      expect(prettyPhone('+15551234567')).toBe('(555) 123-4567');
    });

    it('should return original string for invalid numbers', () => {
      expect(prettyPhone('123')).toBe('123');
      expect(prettyPhone('abc')).toBe('abc');
    });

    it('should return empty string for empty input', () => {
      expect(prettyPhone('')).toBe('');
      expect(prettyPhone(null)).toBe('');
      expect(prettyPhone(undefined)).toBe('');
    });
  });

  describe('titleCase (existing)', () => {
    it('should convert text to title case', () => {
      expect(titleCase('john doe')).toBe('John Doe');
      expect(titleCase('john smith')).toBe('John Smith');
    });

    it('should preserve acronyms (all-caps 2+ letters)', () => {
      expect(titleCase('BMW X5')).toBe('BMW X5');
      expect(titleCase('PPF installation')).toBe('PPF Installation');
      // Note: "JOHN DOE" is treated as two acronyms, which is intended behavior
      expect(titleCase('JOHN DOE')).toBe('JOHN DOE');
    });

    it('should handle mixed case by normalizing', () => {
      expect(titleCase('john DOE')).toBe('John DOE'); // DOE is preserved as acronym
      // Note: apostrophe handling capitalizes first letter only (O'brien not O'Brien)
      expect(titleCase("o'brien")).toBe("O'brien");
    });
  });
});
