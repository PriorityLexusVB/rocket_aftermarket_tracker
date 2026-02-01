import React, { useMemo } from 'react'
import { CheckCircle2, Clock, Pencil, RefreshCcw, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

import { cn } from '../../../utils/cn'
import jobService from '../../../services/jobService'
import { getReopenTargetStatus } from '../../../utils/jobStatusTimeRules'

function fmtMaybe(dateValue) {
  if (!dateValue) return null
  try {
    return format(new Date(dateValue), 'MMM d, h:mm a')
  } catch {
    return null
  }
}

function actionMeta(job) {
  const isCompleted = job?.job_status === 'completed'
  return isCompleted
    ? { label: 'Reopen', title: 'Reopen deal' }
    : { label: 'Complete', title: 'Mark completed' }
}

export default function UnassignedQueue({
  jobs,
  onEdit,
  onDelete,
  onRefresh,
  now,
  isStatusInFlight,
}) {
  const rows = useMemo(() => jobs ?? [], [jobs])
  const currentNow = now ?? new Date()

  async function onToggleComplete(job) {
    if (!job?.id) return
    if (isStatusInFlight?.(job.id)) return

    const isCompleted = job.job_status === 'completed'
    if (isCompleted) {
      const targetStatus = getReopenTargetStatus(job, {
        now: currentNow,
      })
      await jobService.updateStatus(job.id, targetStatus, {
        completed_at: null,
      })
      return
    }

    await jobService.updateStatus(job.id, 'completed', {
      completed_at: new Date().toISOString(),
    })
  }

  return (
    <div className={cn('rounded-lg', 'border', 'border-gray-200', 'bg-white')}>
      <div className={cn('flex items-center justify-between', 'border-b border-gray-200', 'p-3')}>
        <div className={cn('flex items-center', 'gap-2')}>
          <Clock className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Unassigned</h3>
          <span className="text-xs text-gray-500">({rows.length})</span>
        </div>

        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2',
            'rounded-md',
            'border border-gray-200',
            'px-2 py-1',
            'text-xs text-gray-700',
            'hover:bg-gray-50'
          )}
          onClick={onRefresh}
          title="Refresh"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className={cn('divide-y', 'divide-gray-100')}>
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No unassigned jobs.</div>
        ) : null}

        {rows.map((job) => {
          const isCompleted = job.job_status === 'completed'
          const isBusy = Boolean(isStatusInFlight?.(job.id))
          const completedAt = fmtMaybe(job.completed_at)
          const createdAt = fmtMaybe(job.created_at)
          const { label, title } = actionMeta(job)

          return (
            <div
              key={job.id}
              className={cn(
                'p-3',
                isBusy ? 'opacity-60' : null,
                isCompleted ? 'bg-green-50/40' : null
              )}
            >
              <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
                <div className={cn('min-w-0')}>
                  <div className={cn('flex flex-wrap items-center', 'gap-x-2 gap-y-1')}>
                    <div className={cn('truncate', 'text-sm', 'font-medium', 'text-gray-900')}>
                      {job.vehicle_description || job.vehicle || '(No vehicle)'}
                    </div>

                    {isCompleted ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          'rounded-full',
                          'bg-green-100',
                          'px-2 py-0.5',
                          'text-[11px]',
                          'font-medium',
                          'text-green-800'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Completed
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      'mt-1',
                      'flex flex-wrap items-center',
                      'gap-x-2 gap-y-1',
                      'text-xs text-gray-600'
                    )}
                  >
                    {job.customer_name ? (
                      <span className={cn('truncate')}>{job.customer_name}</span>
                    ) : null}
                    {job.stock_number ? (
                      <span className={cn('truncate')}>Stock {job.stock_number}</span>
                    ) : null}
                    {job.job_number ? (
                      <span className={cn('truncate')}>Job {job.job_number}</span>
                    ) : null}
                    {createdAt ? <span>Created {createdAt}</span> : null}
                    {completedAt ? <span>Completed {completedAt}</span> : null}
                  </div>
                </div>

                <div className={cn('flex', 'shrink-0', 'items-center', 'gap-2')}>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1',
                      'rounded-md',
                      isCompleted
                        ? 'border border-indigo-200 text-indigo-800'
                        : 'border border-emerald-200 text-emerald-800',
                      'px-2 py-1',
                      'text-xs font-medium',
                      isCompleted ? 'hover:bg-indigo-50' : 'hover:bg-emerald-50'
                    )}
                    onClick={() => onToggleComplete(job)}
                    title={title}
                    aria-label={title}
                    disabled={isBusy}
                  >
                    {isCompleted ? (
                      <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {label}
                  </button>

                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1',
                      'rounded-md',
                      'border border-gray-200',
                      'px-2 py-1',
                      'text-xs text-gray-700',
                      'hover:bg-gray-50'
                    )}
                    onClick={() => onEdit?.(job)}
                    title="Edit"
                    disabled={isBusy}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>

                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1',
                      'rounded-md',
                      'border border-red-200',
                      'px-2 py-1',
                      'text-xs text-red-700',
                      'hover:bg-red-50'
                    )}
                    onClick={() => onDelete?.(job)}
                    title="Delete"
                    disabled={isBusy}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>

              {job.notes ? (
                <div className={cn('mt-2', 'line-clamp-2', 'text-xs', 'text-gray-600')}>
                  {job.notes}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
