import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: null, loading: false }),
}))

vi.mock('@/components/ui/ToastProvider', async () => {
  const actual = await vi.importActual('@/components/ui/ToastProvider')
  return {
    ...actual,
    useToast: () => ({
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  }
})

describe('CalendarFlowManagementCenter smoke', () => {
  it('renders without crashing', async () => {
    const mod = await import('@/pages/calendar-flow-management-center')
    const CalendarFlowManagementCenter = mod.default

    await act(async () => {
      expect(() => {
        render(
          <MemoryRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <CalendarFlowManagementCenter />
          </MemoryRouter>
        )
      }).not.toThrow()
    })
  }, 15000)
})
