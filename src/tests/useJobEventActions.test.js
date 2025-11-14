// src/tests/useJobEventActions.test.js
// Tests for useJobEventActions hook
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useJobEventActions from '@/hooks/useJobEventActions'

describe('useJobEventActions', () => {
  describe('missing jobId warnings', () => {
    it('should warn when handleOpenDeal is called without jobId', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onOpenDeal = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onOpenDeal }))
      
      result.current.handleOpenDeal(null)
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] Missing jobId for open')
      expect(onOpenDeal).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should warn when handleReschedule is called without jobId', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onReschedule = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onReschedule }))
      
      result.current.handleReschedule(undefined)
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] Missing jobId for reschedule')
      expect(onReschedule).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should warn when handleComplete is called without jobId', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onComplete = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onComplete }))
      
      await result.current.handleComplete(null)
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] Missing jobId for complete')
      expect(onComplete).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should warn when handleUndoComplete is called without jobId', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onUndoComplete = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onUndoComplete }))
      
      await result.current.handleUndoComplete(null)
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] Missing jobId for undo')
      expect(onUndoComplete).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('successful handler callbacks', () => {
    it('should call onOpenDeal with jobId when handleOpenDeal is invoked', () => {
      const onOpenDeal = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onOpenDeal }))
      
      result.current.handleOpenDeal('job-123')
      
      expect(onOpenDeal).toHaveBeenCalledWith('job-123')
      expect(onOpenDeal).toHaveBeenCalledTimes(1)
    })

    it('should call onReschedule with jobId when handleReschedule is invoked', () => {
      const onReschedule = vi.fn()
      
      const { result } = renderHook(() => useJobEventActions({ onReschedule }))
      
      result.current.handleReschedule('job-456')
      
      expect(onReschedule).toHaveBeenCalledWith('job-456')
      expect(onReschedule).toHaveBeenCalledTimes(1)
    })

    it('should call onComplete with jobId when handleComplete is invoked', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useJobEventActions({ onComplete }))
      
      await result.current.handleComplete('job-789')
      
      expect(onComplete).toHaveBeenCalledWith('job-789')
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('should call onUndoComplete with jobId when handleUndoComplete is invoked', async () => {
      const onUndoComplete = vi.fn().mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useJobEventActions({ onUndoComplete }))
      
      await result.current.handleUndoComplete('job-abc')
      
      expect(onUndoComplete).toHaveBeenCalledWith('job-abc')
      expect(onUndoComplete).toHaveBeenCalledTimes(1)
    })

    it('should handle async onComplete with promise resolution', async () => {
      const onComplete = vi.fn().mockImplementation(async (jobId) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return `completed-${jobId}`
      })
      
      const { result } = renderHook(() => useJobEventActions({ onComplete }))
      
      await result.current.handleComplete('job-def')
      
      expect(onComplete).toHaveBeenCalledWith('job-def')
    })

    it('should handle async onUndoComplete with promise resolution', async () => {
      const onUndoComplete = vi.fn().mockImplementation(async (jobId) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return `undone-${jobId}`
      })
      
      const { result } = renderHook(() => useJobEventActions({ onUndoComplete }))
      
      await result.current.handleUndoComplete('job-ghi')
      
      expect(onUndoComplete).toHaveBeenCalledWith('job-ghi')
    })
  })

  describe('default warnings when handlers not provided', () => {
    it('should warn when onOpenDeal is not provided and handleOpenDeal is called', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useJobEventActions({}))
      
      result.current.handleOpenDeal('job-123')
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] onOpenDeal not provided')
      
      consoleSpy.mockRestore()
    })

    it('should warn when onReschedule is not provided and handleReschedule is called', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useJobEventActions({}))
      
      result.current.handleReschedule('job-456')
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] onReschedule not provided')
      
      consoleSpy.mockRestore()
    })

    it('should warn when onComplete is not provided and handleComplete is called', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useJobEventActions({}))
      
      await result.current.handleComplete('job-789')
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] onComplete not provided')
      
      consoleSpy.mockRestore()
    })

    it('should warn when onUndoComplete is not provided and handleUndoComplete is called', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useJobEventActions({}))
      
      await result.current.handleUndoComplete('job-abc')
      
      expect(consoleSpy).toHaveBeenCalledWith('[useJobEventActions] onUndoComplete not provided')
      
      consoleSpy.mockRestore()
    })
  })

  describe('validateRange passthrough', () => {
    it('should provide validateRange function that validates ISO timestamps', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        '2024-01-20T14:00:00Z',
        '2024-01-20T16:00:00Z'
      )
      
      expect(validation).toEqual({
        valid: true,
        errors: [],
        error: ''
      })
    })

    it('should detect when end time is before start time', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        '2024-01-20T16:00:00Z',
        '2024-01-20T14:00:00Z'
      )
      
      expect(validation).toEqual({
        valid: false,
        errors: ['end_not_after_start'],
        error: 'End time must be after start time'
      })
    })

    it('should detect missing start time', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        null,
        '2024-01-20T16:00:00Z'
      )
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('start_required')
      expect(validation.error).toBe('Start time is required')
    })

    it('should detect missing end time', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        '2024-01-20T14:00:00Z',
        null
      )
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('end_required')
      expect(validation.error).toBe('End time is required')
    })

    it('should handle invalid ISO timestamps', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        'not-a-date',
        '2024-01-20T16:00:00Z'
      )
      
      expect(validation.valid).toBe(false)
    })

    it('should validate sample timestamps across different days', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        '2024-01-20T14:00:00Z',
        '2024-01-21T14:00:00Z'
      )
      
      expect(validation).toEqual({
        valid: true,
        errors: [],
        error: ''
      })
    })

    it('should validate timestamps in same hour', () => {
      const { result } = renderHook(() => useJobEventActions({}))
      
      const validation = result.current.validateRange(
        '2024-01-20T14:00:00Z',
        '2024-01-20T14:30:00Z'
      )
      
      expect(validation).toEqual({
        valid: true,
        errors: [],
        error: ''
      })
    })
  })

  describe('hook stability', () => {
    it('should maintain stable function references across re-renders when deps do not change', () => {
      const onOpenDeal = vi.fn()
      
      const { result, rerender } = renderHook(
        ({ opts }) => useJobEventActions(opts),
        { initialProps: { opts: { onOpenDeal } } }
      )
      
      const firstHandleOpenDeal = result.current.handleOpenDeal
      
      rerender({ opts: { onOpenDeal } })
      
      expect(result.current.handleOpenDeal).toBe(firstHandleOpenDeal)
    })

    it('should update function references when deps change', () => {
      const onOpenDeal1 = vi.fn()
      const onOpenDeal2 = vi.fn()
      
      const { result, rerender } = renderHook(
        ({ opts }) => useJobEventActions(opts),
        { initialProps: { opts: { onOpenDeal: onOpenDeal1 } } }
      )
      
      const firstHandleOpenDeal = result.current.handleOpenDeal
      
      rerender({ opts: { onOpenDeal: onOpenDeal2 } })
      
      expect(result.current.handleOpenDeal).not.toBe(firstHandleOpenDeal)
    })
  })
})
