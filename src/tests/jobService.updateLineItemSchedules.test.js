import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { jobService } from '@/services/jobService'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('jobService.updateLineItemSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should update scheduled_start_time, scheduled_end_time, and promised_date for all scheduled line items', async () => {
    const mockJobId = 'job-123'
    const mockScheduleData = {
      startTime: '2025-11-15T09:00:00Z',
      endTime: '2025-11-15T11:00:00Z',
    }

    const mockLineItems = [
      { id: 'item-1', requires_scheduling: true },
      { id: 'item-2', requires_scheduling: true },
      { id: 'item-3', requires_scheduling: false }, // Should not be updated
    ]

    const mockUpdatedJob = {
      id: mockJobId,
      title: 'Test Job',
      job_parts: mockLineItems,
    }

    // Track update calls
    const updateCalls = []

    // Mock the update queries
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn((data) => {
      updateCalls.push(data)
      return { eq: updateEqMock }
    })

    // Mock the select query for line items
    const selectMock = vi.fn().mockReturnThis()
    const eqSelectMock = vi.fn().mockResolvedValue({
      data: mockLineItems,
      error: null,
    })

    // Mock getJobById to return the updated job
    const getJobByIdSpy = vi.spyOn(jobService, 'getJobById').mockResolvedValue(mockUpdatedJob)

    // Setup the from mock chain
    supabase.from.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select: vi.fn(() => ({
            eq: eqSelectMock,
          })),
          update: updateMock,
        }
      }
      return {}
    })

    // Call the method
    const result = await jobService.updateLineItemSchedules(mockJobId, mockScheduleData)

    // Verify line items were fetched
    expect(supabase.from).toHaveBeenCalledWith('job_parts')

    // Verify only scheduled items (2 out of 3) were updated
    expect(updateMock).toHaveBeenCalledTimes(2)

    // Verify the update data includes all three fields
    const firstUpdateData = updateCalls[0]
    expect(firstUpdateData).toHaveProperty('scheduled_start_time', mockScheduleData.startTime)
    expect(firstUpdateData).toHaveProperty('scheduled_end_time', mockScheduleData.endTime)
    expect(firstUpdateData).toHaveProperty('promised_date', '2025-11-15') // Date extracted from startTime
    expect(firstUpdateData).toHaveProperty('updated_at')

    // Verify getJobById was called to fetch the updated job
    expect(getJobByIdSpy).toHaveBeenCalledWith(mockJobId)

    // Verify the result is the updated job
    expect(result).toEqual(mockUpdatedJob)
  })

  it('should throw error when jobId is missing', async () => {
    await expect(jobService.updateLineItemSchedules(null, { startTime: '2025-11-15T09:00:00Z', endTime: '2025-11-15T11:00:00Z' }))
      .rejects.toThrow('Job ID is required')
  })

  it('should throw error when startTime is missing', async () => {
    await expect(jobService.updateLineItemSchedules('job-123', { endTime: '2025-11-15T11:00:00Z' }))
      .rejects.toThrow('Start time and end time are required')
  })

  it('should throw error when endTime is missing', async () => {
    await expect(jobService.updateLineItemSchedules('job-123', { startTime: '2025-11-15T09:00:00Z' }))
      .rejects.toThrow('Start time and end time are required')
  })

  it('should throw error when no line items require scheduling', async () => {
    const mockJobId = 'job-456'
    const mockScheduleData = {
      startTime: '2025-11-15T09:00:00Z',
      endTime: '2025-11-15T11:00:00Z',
    }

    const mockLineItems = [
      { id: 'item-1', requires_scheduling: false },
      { id: 'item-2', requires_scheduling: false },
    ]

    const eqSelectMock = vi.fn().mockResolvedValue({
      data: mockLineItems,
      error: null,
    })

    supabase.from.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select: vi.fn(() => ({
            eq: eqSelectMock,
          })),
        }
      }
      return {}
    })

    await expect(jobService.updateLineItemSchedules(mockJobId, mockScheduleData))
      .rejects.toThrow('No line items require scheduling for this job')
  })

  it('should extract date correctly from ISO timestamp for promised_date', async () => {
    const mockJobId = 'job-789'
    
    // Test with different times on the same day
    const testCases = [
      { startTime: '2025-11-15T00:00:00Z', expectedDate: '2025-11-15' },
      { startTime: '2025-11-15T09:30:00Z', expectedDate: '2025-11-15' },
      { startTime: '2025-11-15T23:59:59Z', expectedDate: '2025-11-15' },
      { startTime: '2025-12-31T14:00:00Z', expectedDate: '2025-12-31' },
    ]

    for (const testCase of testCases) {
      vi.clearAllMocks()

      const mockScheduleData = {
        startTime: testCase.startTime,
        endTime: '2025-11-15T11:00:00Z',
      }

      const mockLineItems = [{ id: 'item-1', requires_scheduling: true }]
      const mockUpdatedJob = { id: mockJobId, job_parts: mockLineItems }

      // Track update calls
      const updateCalls = []

      const updateEqMock = vi.fn().mockResolvedValue({ error: null })
      const updateMock = vi.fn((data) => {
        updateCalls.push(data)
        return { eq: updateEqMock }
      })

      const eqSelectMock = vi.fn().mockResolvedValue({
        data: mockLineItems,
        error: null,
      })

      vi.spyOn(jobService, 'getJobById').mockResolvedValue(mockUpdatedJob)

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn(() => ({ eq: eqSelectMock })),
            update: updateMock,
          }
        }
        return {}
      })

      await jobService.updateLineItemSchedules(mockJobId, mockScheduleData)

      const updateData = updateCalls[0]
      expect(updateData.promised_date).toBe(testCase.expectedDate)
    }
  })
})
