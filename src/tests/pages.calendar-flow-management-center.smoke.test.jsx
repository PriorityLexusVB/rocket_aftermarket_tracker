import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

describe('CalendarFlowManagementCenter smoke', () => {
  it('renders without crashing', async () => {
    const mod = await import('@/pages/calendar-flow-management-center')
    const CalendarFlowManagementCenter = mod.default

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
})
