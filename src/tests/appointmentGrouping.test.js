import { describe, it, expect } from 'vitest'
import {
  groupVendorJobs,
  groupOnsiteJobs,
  groupByVendorAndType,
} from '../utils/appointmentGrouping'

describe('appointmentGrouping', () => {
  describe('groupVendorJobs', () => {
    it('should group appointments by vendor_id', () => {
      const appointments = [
        { id: 1, vendor_id: 'v1', title: 'Job 1' },
        { id: 2, vendor_id: 'v1', title: 'Job 2' },
        { id: 3, vendor_id: 'v2', title: 'Job 3' },
      ]

      const result = groupVendorJobs(appointments)

      expect(result).toHaveProperty('v1')
      expect(result).toHaveProperty('v2')
      expect(result.v1).toHaveLength(2)
      expect(result.v2).toHaveLength(1)
    })

    it('should handle appointments without vendor_id as unassigned', () => {
      const appointments = [
        { id: 1, title: 'Job 1' },
        { id: 2, vendor_id: null, title: 'Job 2' },
      ]

      const result = groupVendorJobs(appointments)

      expect(result).toHaveProperty('unassigned')
      expect(result.unassigned).toHaveLength(2)
    })

    it('should return empty object for null input', () => {
      expect(groupVendorJobs(null)).toEqual({})
      expect(groupVendorJobs(undefined)).toEqual({})
    })

    it('should filter out invalid appointments', () => {
      const appointments = [
        { id: 1, vendor_id: 'v1' },
        null,
        { vendor_id: 'v1' }, // missing id
        undefined,
        { id: 2, vendor_id: 'v1' },
      ]

      const result = groupVendorJobs(appointments)

      expect(result.v1).toHaveLength(2)
    })
  })

  describe('groupOnsiteJobs', () => {
    it('should separate onsite and offsite jobs based on is_off_site', () => {
      const appointments = [
        { id: 1, is_off_site: false, title: 'Onsite 1' },
        { id: 2, is_off_site: true, title: 'Offsite 1' },
        { id: 3, is_off_site: false, title: 'Onsite 2' },
      ]

      const result = groupOnsiteJobs(appointments)

      expect(result.onsite).toHaveLength(2)
      expect(result.offsite).toHaveLength(1)
    })

    it('should treat undefined is_off_site as onsite', () => {
      const appointments = [
        { id: 1, title: 'Job 1' },
        { id: 2, is_off_site: null, title: 'Job 2' },
      ]

      const result = groupOnsiteJobs(appointments)

      expect(result.onsite).toHaveLength(2)
      expect(result.offsite).toHaveLength(0)
    })

    it('should use service_type as fallback', () => {
      const appointments = [
        { id: 1, service_type: 'vendor', title: 'Vendor Job' },
        { id: 2, service_type: 'onsite', title: 'Onsite Job' },
      ]

      const result = groupOnsiteJobs(appointments)

      expect(result.offsite).toHaveLength(1)
      expect(result.onsite).toHaveLength(1)
    })

    it('should return empty arrays for null input', () => {
      const result = groupOnsiteJobs(null)

      expect(result.onsite).toEqual([])
      expect(result.offsite).toEqual([])
    })
  })

  describe('groupByVendorAndType', () => {
    it('should create nested structure of service type and vendor', () => {
      const appointments = [
        { id: 1, is_off_site: false, vendor_id: 'v1' },
        { id: 2, is_off_site: true, vendor_id: 'v2' },
        { id: 3, is_off_site: false, vendor_id: 'v1' },
      ]

      const result = groupByVendorAndType(appointments)

      expect(result).toHaveProperty('onsite')
      expect(result).toHaveProperty('offsite')
      expect(result.onsite.v1).toHaveLength(2)
      expect(result.offsite.v2).toHaveLength(1)
    })

    it('should handle null input gracefully', () => {
      const result = groupByVendorAndType(null)

      expect(result).toEqual({ onsite: {}, offsite: {} })
    })
  })
})
