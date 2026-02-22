import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OverdueInbox from '@/pages/overdue-inbox'
import { getNeedsSchedulingPromiseItems } from '@/services/scheduleItemsService'

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: 'org-1', loading: false }),
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getNeedsSchedulingPromiseItems: vi.fn(),
}))

describe('OverdueInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders overdue rows and opens DealDrawer with Set time action', async () => {
    vi.mocked(getNeedsSchedulingPromiseItems).mockResolvedValue({
      items: [
        {
          raw: {
            id: 'job-1',
            job_number: 'JOB-1001',
            customer_name: 'Ada Lovelace',
            promised_date: '2025-01-01',
            updated_at: '2025-01-02T12:00:00.000Z',
            job_status: 'promised',
            location: 'On-Site',
          },
        },
      ],
    })

    const user = userEvent.setup()
    render(<OverdueInbox />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Overdue Inbox' })).toBeInTheDocument()
      expect(screen.getByText('JOB-1001')).toBeInTheDocument()
    })

    await user.click(screen.getByText('JOB-1001'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Set time/i })).toBeInTheDocument()
  })
})