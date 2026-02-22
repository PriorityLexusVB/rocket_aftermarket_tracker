import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OverdueInbox, { isStrictOverdueJob, normalizeOverdueRows } from '@/pages/overdue-inbox'
import { jobService } from '@/services/jobService'

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: 'org-1', loading: false }),
}))

vi.mock('@/services/jobService', () => ({
  jobService: {
    getAllJobs: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}))

describe('OverdueInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('strict overdue filter includes only past promise and excludes complete/future/missing', () => {
    const now = new Date('2026-02-21T12:00:00.000Z')

    expect(
      isStrictOverdueJob({ promised_date: '2026-02-20T10:00:00.000Z', job_status: 'promised' }, now)
    ).toBe(true)
    expect(
      isStrictOverdueJob({ promised_date: '2026-02-20T10:00:00.000Z', job_status: 'completed' }, now)
    ).toBe(false)
    expect(
      isStrictOverdueJob({ promised_date: '2026-02-22T10:00:00.000Z', job_status: 'promised' }, now)
    ).toBe(false)
    expect(isStrictOverdueJob({ promised_date: null, job_status: 'promised' }, now)).toBe(false)
  })

  it('normalizeOverdueRows dedupes and keeps only strict overdue rows', () => {
    const now = new Date('2026-02-21T12:00:00.000Z')
    const rows = normalizeOverdueRows(
      [
        { id: 'job-1', promised_date: '2026-02-20T10:00:00.000Z', job_status: 'promised' },
        { id: 'job-1', promised_date: '2026-02-19T10:00:00.000Z', job_status: 'promised' },
        { id: 'job-2', promised_date: '2026-02-22T10:00:00.000Z', job_status: 'promised' },
        { id: 'job-3', promised_date: null, job_status: 'promised' },
        { id: 'job-4', promised_date: '2026-02-20T10:00:00.000Z', job_status: 'completed' },
      ],
      now
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('job-1')
    expect(rows[0].promised_date).toBe('2026-02-19T10:00:00.000Z')
  })

  it('renders overdue rows and opens DealDrawer with Set time action', async () => {
    vi.mocked(jobService.getAllJobs).mockResolvedValue([
      {
        id: 'job-1',
        job_number: 'JOB-1001',
        customer_name: 'Ada Lovelace',
        promised_date: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-02T12:00:00.000Z',
        job_status: 'promised',
        location: 'On-Site',
      },
    ])

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

  it('marks complete using existing service path and removes row', async () => {
    vi.mocked(jobService.getAllJobs)
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          job_number: 'JOB-1001',
          customer_name: 'Ada Lovelace',
          promised_date: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-02T12:00:00.000Z',
          job_status: 'promised',
          location: 'On-Site',
        },
      ])
      .mockResolvedValueOnce([])

    vi.mocked(jobService.updateStatus).mockResolvedValue({ id: 'job-1', job_status: 'completed' })

    const user = userEvent.setup()
    render(<OverdueInbox />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Overdue Inbox' })).toBeInTheDocument()
      expect(screen.getByText('JOB-1001')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Mark Complete/i }))

    expect(jobService.updateStatus).toHaveBeenCalledTimes(1)
    expect(jobService.updateStatus).toHaveBeenCalledWith(
      'job-1',
      'completed',
      expect.objectContaining({ completed_at: expect.any(String) })
    )

    await waitFor(() => {
      expect(screen.queryByText('JOB-1001')).not.toBeInTheDocument()
      expect(screen.getByText('No overdue items')).toBeInTheDocument()
    })
    expect(toastSuccess).toHaveBeenCalledWith('Marked complete')
  })
})